import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { BrandMark } from '@/components/layout/brand-mark';

export const metadata: Metadata = {
  title: 'Sign in',
  // Nothing in this application should ever appear in a search result.
  robots: { index: false, follow: false },
};

/**
 * Layout for the unauthenticated pages: sign in, two-factor, invitation
 * acceptance.
 *
 * Single centred column, no navigation. There is nowhere else to go until you are
 * signed in, and offering links would only invite a redirect back here.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-5 py-12">
      <BrandMark className="text-base" />

      <main className="w-full max-w-[26rem]">{children}</main>

      <p className="text-center text-xs text-ink-secondary">
        Private system. Access is by invitation only.
      </p>
    </div>
  );
}
