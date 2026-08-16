'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

import { BrandMark } from '@/components/layout/brand-mark';
import { cn } from '@/lib/cn';

import { site, whatsappLink } from '../content';
import { MobileNav } from './mobile-nav';

/**
 * The public site's header.
 *
 * Transparent over the hero and solid once the reader has left it. That is not
 * decoration: the hero is a photograph with type laid over it, and a solid bar
 * across the top of it would cut the image in half at exactly the point it is
 * meant to be doing its work.
 *
 * A plain scroll listener rather than ScrollTrigger, because this has to keep
 * working if the animation library never loads - a header stuck transparent
 * over a white section is unreadable, which is a real failure rather than a
 * missing flourish.
 *
 * `BrandMark` is the wordmark in Marcellus. A real logo mark is being drawn by a
 * designer - see docs/HANDOVER.md - and this stands in until it arrives. It is
 * type, not a placeholder image, so it is already correct at every size.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,padding] duration-300',
        scrolled
          ? 'border-b border-line-subtle bg-surface-page/95 py-3 backdrop-blur-sm'
          : 'border-b border-transparent bg-transparent py-5'
      )}
    >
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-6 px-6 lg:px-10">
        <Link href="/" aria-label={`${site.name} home`}>
          <BrandMark className="text-base" />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-10 lg:flex">
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

        <div className="flex items-center gap-1">
          <a
            href={whatsappLink(site.hero.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden min-h-11 items-center gap-2 bg-action-primary px-5 label-caps text-xs text-action-on-primary transition-colors duration-200 hover:bg-action-primary-hover lg:inline-flex"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            WhatsApp
          </a>

          <MobileNav items={site.nav} whatsappHref={whatsappLink(site.hero.whatsappMessage)} />
        </div>
      </div>
    </header>
  );
}
