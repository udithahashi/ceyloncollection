import type { Metadata, Viewport } from 'next';

import { env } from '@/lib/env';
import { fontVariables } from '@/lib/theme/fonts';
import { themes } from '@/lib/theme/tokens';

import '../globals.css';

/**
 * Root layout for the public site.
 *
 * The second of two root layouts - see `(back-office)/layout.tsx` for why they
 * are split. The short version: this half of the application wants to be found
 * by search engines and the other half must never be, and `robots` is set on a
 * root layout.
 *
 * `data-theme="public"` is hardcoded, not read from the theme cookie. The
 * light/dark switch belongs to the back office, where someone works for hours;
 * a brand's shop window looks like the brand, and nothing else.
 */

/**
 * EVERY PAGE UNDER THIS LAYOUT MUST RENDER DYNAMICALLY. Copy the
 * `await connection()` line into any new public page. A prerendered page here
 * ships with no CSP nonce and the browser refuses all of its JavaScript.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: 'Ceylon Collection · Sri Lankan clothing, worn wherever you are',
    template: '%s · Ceylon Collection',
  },
  description:
    'Sri Lankan colour, cut, and cloth — selected with care. Flower frocks, batik, cotton, and officewear, brought closer.',
  applicationName: 'Ceylon Collection',
  openGraph: {
    type: 'website',
    siteName: 'Ceylon Collection',
    locale: 'en_QA',
  },
};

export const viewport: Viewport = {
  themeColor: themes.public.surface.page,
};

export default function PublicLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" dir="ltr" data-theme="public" className={`${fontVariables} h-full`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
