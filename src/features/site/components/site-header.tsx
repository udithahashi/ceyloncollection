import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import { BrandMark } from '@/components/layout/brand-mark';

import { site, whatsappLink } from '../content';

/**
 * The public site's header.
 *
 * Sticky, because the WhatsApp action is the entire point of the page and it
 * should never be more than a glance away once someone has scrolled into the
 * collections.
 *
 * `BrandMark` is the wordmark, set in Marcellus. A real logo mark is being drawn
 * by a designer - see docs/HANDOVER.md §2 - and this is what stands in until it
 * arrives. It is type, not a placeholder image, so it is already correct at every
 * size and needs replacing only when there is something better to show.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line-subtle bg-surface-page/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-6 px-6 py-5 lg:px-10">
        <Link href="/" aria-label={`${site.name} home`}>
          <BrandMark className="text-base" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
          {site.nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="relative py-1 text-sm text-ink-primary/80 transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:h-px after:w-0 after:bg-brand-gold after:transition-[width] after:duration-300 hover:text-ink-primary hover:after:w-full"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <a
          href={whatsappLink(site.hero.whatsappMessage)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-2 bg-action-primary px-5 label-caps text-xs text-action-on-primary transition-colors duration-200 hover:bg-action-primary-hover"
        >
          <MessageCircle aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">WhatsApp</span>
          <span className="sr-only sm:hidden">Message us on WhatsApp</span>
        </a>
      </div>
    </header>
  );
}
