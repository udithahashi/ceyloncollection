'use server';

/**
 * The two steps of an import: look, then write.
 *
 * `planImportAction` never writes. `commitImportAction` writes, and re-reads the file
 * from scratch before it does. That second point is the important one: what comes back
 * from the browser is a string that arrived over HTTP, so it is planned again, and the
 * rows that get inserted are the ones this server just decided were valid - not the ones
 * a report claimed were. If the taxonomy changed in between, or someone entered one of
 * these leads by hand while the report was on screen, the outcome reflects that.
 */
import { revalidatePath } from 'next/cache';

import { formToObject, parseInput, runAction } from '@/lib/actions';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { logActivity } from '@/lib/activity';
import { authorize } from '@/lib/auth/session';
import { createLogger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

import { commitImport } from './commit';
import { planImport } from './plan';
import type { ImportOutcome, ImportPlan } from './types';

const log = createLogger('lead-import');

/**
 * The upload limit, in characters of CSV.
 *
 * Two megabytes is far more than the row limit the planner enforces (MAX_IMPORT_ROWS in
 * `plan.ts`), so this is not the constraint anyone will meet - it is the guard that stops
 * a 400MB file being read into memory before the row count is even known. Server Actions
 * have their own body limit as well; see `next.config.ts`.
 */
const MAX_CSV_CHARS = 2_000_000;

const pastedSchema = z.object({
  csv: z.string().max(MAX_CSV_CHARS, 'That file is too large. Split it into smaller sheets.'),
});

/** Filenames a browser will offer for a spreadsheet saved as CSV. */
const CSV_TYPES = ['text/csv', 'text/plain', 'application/vnd.ms-excel', ''];

/**
 * Reads a spreadsheet and reports what importing it would do.
 *
 * Requires `imports:create` even though it changes nothing: the report names customers
 * and the sub-categories they asked about, which is the same data the leads pages are
 * protected for.
 */
export async function planImportAction(
  _previous: ActionResult<ImportPlan | undefined>,
  formData: FormData
): Promise<ActionResult<ImportPlan | undefined>> {
  return runAction('lead.import.plan', async () => {
    const user = await authorize('imports', 'create');

    const read = await readCsv(formData);
    if (!read.ok) return read.result;

    const { plan } = await planImport(read.csv);

    log.info(
      {
        userId: user.id,
        rows: plan.summary.rows,
        ready: plan.summary.ready,
        rejected: plan.summary.rejected,
      },
      'import planned'
    );

    return ok(plan);
  });
}

/** Imports the rows that a fresh read of the same file finds valid. */
export async function commitImportAction(
  _previous: ActionResult<ImportOutcome | undefined>,
  formData: FormData
): Promise<ActionResult<ImportOutcome | undefined>> {
  return runAction('lead.import.commit', async () => {
    const user = await authorize('imports', 'create');

    // Per user rather than per IP: this is a signed-in action, and the cost being
    // limited is the transaction, not the connection.
    const decision = await checkRateLimit('importCsv', user.id);

    if (!decision.allowed) {
      return fail('That is several imports in an hour. Wait a little before the next one.', {
        code: 'rateLimited',
      });
    }

    const read = await readCsv(formData);
    if (!read.ok) return read.result;

    const { plan, ready } = await planImport(read.csv);

    if (ready.length === 0) {
      return fail('There is nothing left to import from that file.', { code: 'validation' });
    }

    const outcome = await commitImport(ready, user.id);

    await logActivity({
      action: 'import.completed',
      actor: user,
      entityType: 'lead',
      entityLabel: `${outcome.imported} leads`,
      metadata: {
        imported: outcome.imported,
        newCustomers: outcome.newCustomers,
        skipped: plan.summary.duplicate + plan.summary.present,
        rejected: plan.summary.rejected,
        earliest: plan.summary.earliestDay,
        latest: plan.summary.latestDay,
      },
    });

    revalidatePath('/leads');
    revalidatePath('/customers');
    revalidatePath('/analytics/demand');

    return ok({
      imported: outcome.imported,
      newCustomers: outcome.newCustomers,
      skipped: plan.summary.duplicate + plan.summary.present,
      rejected: plan.summary.rejected,
    });
  });
}

/**
 * The CSV text, from an uploaded file or from the textarea.
 *
 * A file is preferred when both arrive. The textarea exists because the second step has
 * to send the file back and no browser lets JavaScript refill a file input - and because
 * pasting six rows to check the format is quicker than saving a file.
 */
async function readCsv(
  formData: FormData
): Promise<{ ok: true; csv: string } | { ok: false; result: ActionResult<never> }> {
  const file = formData.get('file');

  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_CSV_CHARS) {
      return {
        ok: false,
        result: fail('That file is too large.', {
          code: 'validation',
          fieldErrors: {
            file: [`Keep it under ${Math.round(MAX_CSV_CHARS / 1_000_000)}MB, or split the sheet.`],
          },
        }),
      };
    }

    // Checked, but not trusted as the only defence: the type a browser reports comes
    // from the file's extension. The parser treats the content as text either way.
    if (!CSV_TYPES.includes(file.type)) {
      return {
        ok: false,
        result: fail('That does not look like a CSV file.', {
          code: 'validation',
          fieldErrors: {
            file: ['Save the sheet as CSV first: File, Save As, "CSV (comma delimited)".'],
          },
        }),
      };
    }

    return { ok: true, csv: await file.text() };
  }

  const parsed = parseInput(pastedSchema, formToObject(formData));
  if (!parsed.ok) return { ok: false, result: parsed.result };

  if (parsed.data.csv.trim() === '') {
    return {
      ok: false,
      result: fail('Choose a file or paste some rows first.', {
        code: 'validation',
        fieldErrors: { file: ['Nothing to read.'] },
      }),
    };
  }

  return { ok: true, csv: parsed.data.csv };
}
