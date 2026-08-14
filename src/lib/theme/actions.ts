'use server';

/**
 * Server Action for switching theme.
 *
 * A Server Action is a real HTTP endpoint - Next.js gives it a URL and anyone can
 * post to it - so it validates its input even though the only caller is our own
 * form with two possible values.
 *
 * No authorisation check here, and that is deliberate rather than forgotten: this
 * action reads nothing and writes nothing but a display preference in the
 * caller's own cookie. There is no data to protect and no state an anonymous
 * caller could affect beyond their own browser. Every action that touches the
 * database gets a check, starting in Phase 2.
 */
import { cookies } from 'next/headers';
import { z } from 'zod';

import { isProductionDeployment } from '@/lib/env';

import { THEME_COOKIE, THEME_COOKIE_MAX_AGE } from './cookie';
import { ADMIN_THEMES } from './tokens';

const themeInput = z.object({
  theme: z.enum(ADMIN_THEMES),
});

/**
 * Persists the chosen theme.
 *
 * Takes FormData so the switch works as a plain form submission with JavaScript
 * disabled or still loading.
 */
export async function setThemeAction(formData: FormData): Promise<void> {
  const parsed = themeInput.safeParse({ theme: formData.get('theme') });

  // Silently ignore nonsense. There is no user-facing error worth showing for a
  // request our own UI cannot produce.
  if (!parsed.success) return;

  const store = await cookies();

  store.set(THEME_COOKIE, parsed.data.theme, {
    // Not readable by JavaScript: the server is the only consumer.
    httpOnly: true,
    // Only over HTTPS once deployed. Locally there is no HTTPS, so requiring it
    // would stop the cookie being stored at all.
    secure: isProductionDeployment,
    // 'lax' still sends the cookie on a normal top-level navigation, which is
    // what a page load is, while withholding it from cross-site requests.
    sameSite: 'lax',
    path: '/',
    maxAge: THEME_COOKIE_MAX_AGE,
  });
}
