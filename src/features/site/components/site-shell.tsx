import type { ReactNode } from 'react';

import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';
import { SmoothScroll } from './smooth-scroll';

/**
 * Shared chrome for every public page.
 *
 * The header sits in the flow and takes its own height - it used to be
 * absolutely positioned so the hero could run under it, which worked while it
 * was transparent and stopped working the moment it became a solid band. Pages
 * therefore do NOT need top padding to clear it; adding some is now a double
 * gap rather than a fix.
 *
 * Its height is 8.3125rem (133px): a 40px announcement strip above a 93px nav row
 * (1.5rem padding top and bottom around a 44px row, plus the 1px rule). The
 * homepage hero subtracts that from its viewport height so the two together
 * fill exactly one screen - if the padding here changes, or the strip is
 * removed, that calc has to change with it.
 *
 * IT HAS DRIFTED ONCE ALREADY. The strip was 30px until its type was sized up
 * for legibility, which made it 40px and left the hero subtracting ten pixels
 * that no longer existed - nothing looked broken, the fold was just slightly
 * wrong. The social icons in that strip are positioned absolutely for the same
 * reason: their 44px targets are taller than the strip and would have grown it
 * again. Measure the header in the browser after touching either, and move this
 * number and the two `min-h-[calc(...)]` values on the homepage together.
 */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SmoothScroll />
      <SiteHeader />
      {children}
      <SiteFooter />
    </>
  );
}
