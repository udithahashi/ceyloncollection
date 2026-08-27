'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/cn';

import { EnquireLink } from './enquire-link';
import { LogoMark } from './logo-mark';
import { SocialLinks } from './social-links';

type NavItem = { label: string; href: string };

/**
 * Full-screen phone navigation.
 *
 * CSS transitions, not GSAP: a menu that fails to open is a worse bug than a
 * menu that opens without flourish. Focus trap, Escape, and body-scroll lock
 * are what make it a dialog rather than a div that appears.
 */
export function MobileNav({
  items,
  whatsappHref,
}: {
  items: readonly NavItem[];
  whatsappHref: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')).filter(
        (element) => element.offsetParent !== null
      );

    focusable()[0]?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }

      if (event.key !== 'Tab') return;

      const elements = focusable();
      if (elements.length === 0) return;

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (first === undefined || last === undefined) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Open menu"
        className="inline-flex size-11 items-center justify-center text-ink-primary lg:hidden"
      >
        <Menu aria-hidden="true" className="size-5" strokeWidth={1.5} />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={cn(
          'fixed inset-0 z-100 flex-col bg-surface-page lg:hidden',
          open ? 'flex' : 'hidden'
        )}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <LogoMark />
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="inline-flex size-11 items-center justify-center text-ink-primary"
          >
            <X aria-hidden="true" className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col justify-center px-8">
          <ul className="flex flex-col">
            {items.map((item, index) => (
              <li key={item.href} className="border-t border-line-subtle">
                <Link
                  href={item.href}
                  onClick={close}
                  style={{ transitionDelay: open ? `${120 + index * 60}ms` : '0ms' }}
                  className={cn(
                    'block py-5 font-display text-[2.4rem] leading-none text-ink-primary',
                    'transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]',
                    open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line-subtle p-8">
          <EnquireLink href={whatsappHref} className="w-full">
            Enquire on WhatsApp
          </EnquireLink>

          {/*
            The drawer is where a phone gets these - the header set is `lg:` and
            up. `-ml-3` pulls the first 44px hit area back so the mark lines up
            with the button's left edge above it rather than sitting proud.
          */}
          <SocialLinks className="mt-6 -ml-3" />
        </div>
      </div>
    </>
  );
}
