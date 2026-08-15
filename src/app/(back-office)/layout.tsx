import type { Metadata, Viewport } from 'next';

import { readTheme } from '@/lib/theme/cookie';
import { fontVariables } from '@/lib/theme/fonts';
import { themes } from '@/lib/theme/tokens';

import '../globals.css';

/**
 * Root layout for the back office - `/admin/*` and the sign-in flow.
 *
 * THIS IS ONE OF TWO ROOT LAYOUTS, WHICH IS WHY IT RENDERS <html> ITSELF.
 * `(public)` has its own, because the two halves of this application are
 * genuinely different documents: different typefaces, different theme, and -
 * most importantly - opposite instructions to search engines. When there was
 * only a back office, one root layout could say `noindex` for everything. A
 * public site that nobody can find is worthless, so the two cannot share.
 *
 * Next.js triggers a full page load when navigating between routes under
 * different root layouts. That is correct here: going from the shop window to
 * the operations tool is not a soft navigation, and it happens rarely.
 */
export const metadata: Metadata = {
  title: {
    default: 'Ceylon Collection',
    template: '%s · Ceylon Collection',
  },
  description: 'Lead intelligence and operations for Ceylon Collection.',
  applicationName: 'Ceylon Collection',
  // This is a private back office. Even behind a login, telling crawlers not to
  // index it keeps the URL structure and any error pages out of search results.
  robots: { index: false, follow: false, nocache: true },
};

export const viewport: Viewport = {
  // Tints the browser chrome on mobile to match the app surface.
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: themes['admin-dark'].surface.page },
    { media: '(prefers-color-scheme: light)', color: themes['admin-light'].surface.page },
  ],
};

export default async function BackOfficeLayout({ children }: LayoutProps<'/'>) {
  // Read on the server so the correct theme is in the first byte of HTML. This
  // makes every route dynamic, which is right for an app where every page is
  // behind a login and shows live data anyway.
  const theme = await readTheme();

  return (
    <html lang="en" dir="ltr" data-theme={theme} className={`${fontVariables} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
