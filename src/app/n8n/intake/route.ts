/**
 * Receiving a message from n8n.
 *
 * The second of the two browser-facing-looking routes AGENTS.md permits, and the only
 * one with no session at all: n8n is not a person who signs in, so the shared secret in
 * N8N_WEBHOOK_SECRET (verified in @/lib/webhook-signature) is the whole of who-are-you.
 * In production this is reachable only on the internal Docker network - nginx does not
 * forward it from the public internet - and the credential check and rate limit here are
 * defence in depth for that boundary, not a substitute for it.
 *
 * Two credentials are accepted: a plain `Authorization: Bearer <secret>`, which n8n
 * sends natively from a Header Auth credential with no scripting at all, or the stronger
 * HMAC signature. @/lib/webhook-signature explains the trade between them and why both
 * are here rather than only the stronger one.
 *
 * Everything this route writes is a guess: see src/db/schema/lead-intake.ts for why it
 * lands in a staging table rather than in `leads`, and /intake for where a human turns
 * it into one.
 */
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/db/client';
import { leadIntake } from '@/db/schema';
import { intakePayloadSchema } from '@/features/leads/intake/schemas';
import { logActivity } from '@/lib/activity';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { verifyWebhookRequest } from '@/lib/webhook-signature';

const log = createLogger('n8n-intake');

/** There is exactly one caller, so the rate limit and the log both key on a name
 * rather than a per-request identity there is no way to derive here. */
const SIGNING_IDENTITY = 'n8n';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  );
}

export async function POST(request: Request) {
  // Read as text before anything else. The signature covers the exact bytes sent; a
  // round trip through JSON.parse and back could reorder keys or reformat numbers and
  // sign something n8n never actually sent.
  const rawBody = await request.text();

  const auth = verifyWebhookRequest({
    rawBody,
    authorization: request.headers.get('authorization'),
    timestamp: request.headers.get('x-timestamp'),
    signature: request.headers.get('x-signature'),
    secret: env.N8N_WEBHOOK_SECRET,
  });

  if (!auth.ok) {
    log.warn({ reason: auth.reason }, 'n8n intake: rejected');
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  const decision = await checkRateLimit('webhookIntake', SIGNING_IDENTITY);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(decision.retryAfterMs / 1000)) } }
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Body is not valid JSON.' }, { status: 400 });
  }

  const parsed = intakePayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid payload.', issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const payload = parsed.data;

  // A retried delivery - n8n resending because our response never arrived, not because
  // the message was sent twice - should land on the row it already made, not a second
  // one for the review queue to show twice.
  if (payload.externalId !== undefined) {
    const existing = await findByExternalId(payload.externalId);
    if (existing)
      return NextResponse.json({ id: existing.id, status: existing.status }, { status: 201 });
  }

  let row: { id: string } | undefined;

  try {
    [row] = await db
      .insert(leadIntake)
      .values({
        externalId: payload.externalId ?? null,
        ...(payload.receivedAt !== undefined ? { receivedAt: payload.receivedAt } : {}),
        rawPayload: payload,
        phoneRaw: payload.phone ?? null,
        customerNameRaw: payload.name ?? null,
        platformRaw: payload.platform ?? null,
        messageText: payload.message,
      })
      .returning({ id: leadIntake.id });
  } catch (error) {
    // The select above and this insert are not atomic, so two deliveries arriving at
    // the same instant can both miss the check and both try to insert. The unique
    // index is the real guard; this is what turns its rejection back into the same
    // idempotent response rather than a 500.
    if (isUniqueViolation(error) && payload.externalId !== undefined) {
      const existing = await findByExternalId(payload.externalId);
      if (existing) {
        return NextResponse.json({ id: existing.id, status: existing.status }, { status: 201 });
      }
    }

    throw error;
  }

  if (!row) throw new Error('lead intake insert returned no row');

  await logActivity({
    action: 'intake.received',
    actor: null,
    entityType: 'leadIntake',
    entityId: row.id,
    // Never the phone number itself here - see AGENTS.md rule 8. `authMethod` is worth
    // recording: it is how you notice a caller silently downgraded from signing.
    metadata: {
      platform: payload.platform ?? null,
      hasPhone: payload.phone !== undefined,
      authMethod: auth.method,
    },
  });

  return NextResponse.json({ id: row.id, status: 'pending' }, { status: 201 });
}

async function findByExternalId(externalId: string) {
  const [row] = await db
    .select({ id: leadIntake.id, status: leadIntake.status })
    .from(leadIntake)
    .where(eq(leadIntake.externalId, externalId))
    .limit(1);

  return row ?? null;
}
