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
 * a brand's shop window looks like the brand, and nothing else. That attribute
 * is what swaps the entire palette, the corner radii, the shadow treatment and
 * the three editorial typefaces in one go - see `src/lib/theme/tokens.ts`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: {
    default: 'Ceylon Collection · Sri Lankan clothing, delivered in Qatar',
    template: '%s · Ceylon Collection',
  },
  description:
    'Sri Lankan sarees, frocks and occasion wear, sourced to order for families in Qatar. Tell us what you are looking for on WhatsApp and we will find it on the next trip.',
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
