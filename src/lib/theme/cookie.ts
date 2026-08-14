/**
 * Where the theme preference lives.
 *
 * A cookie rather than localStorage, because the SERVER has to know the theme
 * before it renders a single byte. The alternative - reading localStorage in the
 * browser and applying a class afterwards - produces the flash of wrong theme
 * that every dark-mode implementation is known for, or forces a blocking inline
 * script to prevent it. A cookie arrives with the request, so the correct
 * `data-theme` is already on <html> in the first response.
 *
 * SERVER ONLY: `cookies()` is a server API.
 */
import { cookies } from 'next/headers';

import { DEFAULT_ADMIN_THEME, isAdminTheme, type AdminThemeName } from './tokens';

export const THEME_COOKIE = 'cc_theme';

/** A year. The preference is not worth asking about again. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * The visitor's theme, or the default if they have never chosen or the cookie
 * has been tampered with. Cookies are user-controlled input, so the value is
 * validated rather than trusted - an unchecked value would end up in the
 * `data-theme` attribute of the HTML.
 */
export async function readTheme(): Promise<AdminThemeName> {
  const store = await cookies();
  const value = store.get(THEME_COOKIE)?.value;
  return isAdminTheme(value) ? value : DEFAULT_ADMIN_THEME;
}
