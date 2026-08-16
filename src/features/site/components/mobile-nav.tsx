'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Menu, MessageCircle, X } from 'lucide-react';

import { cn } from '@/lib/cn';

type NavItem = { label: string; href: string };

/**
 * The phone navigation.
 *
 * The previous revision hid the nav below `lg` and offered nothing in its
 * place, which on a site whose audience is almost entirely on phones meant no
 * navigation at all for almost everyone. This is that gap closed.
 *
 * A full-screen panel rather than a slide-in drawer: at this size the page has
 * four destinations and one action, and a panel that owns the whole screen is
 * easier to hit and easier to leave than a sheet with a dismiss target.
 *
 * The behaviour that makes it a real dialog rather than a div that appears:
 * focus moves into it on open and returns to the trigger on close, `Escape`
 * closes it, focus is trapped while it is open, and the page behind cannot
 * scroll. Each of those is the kind of thing that is invisible when present and
 * obvious the moment it is missing.
 *
 * Deliberately CSS transitions, not GSAP: this has to work identically whether
 * or not the animation library loaded, and a menu that fails to open is a much
 * worse bug than a menu that opens without flourish.
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

    // Stop the page behind scrolling while the panel owns the screen. Restoring
    // the previous value rather than clearing it matters if anything else ever
    // locks scrolling too.
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

      // Trap: without this, tabbing walks out of the panel and into the page
      // behind it, which a sighted keyboard user cannot see and a screen reader
      // user cannot explain.
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
        <Menu aria-hidden="true" className="size-5" />
      </button>

      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        // Inert when closed, so a panel that is not on screen cannot still be
        // tabbed into or announced by a screen reader. React 19 takes this as a
        // real boolean - an empty string reads as `false` and warns.
        inert={!open}
        // WHETHER THIS PANEL IS VISIBLE IS A DISCRETE STATE, NOT AN ANIMATION.
        // An earlier version faded the whole panel in, which meant the primary
        // navigation on a phone only became usable once a CSS transition had
        // finished. Transitions are throttled in a backgrounded tab and dropped
        // entirely under some accessibility settings, and a menu that sometimes
        // does not appear is a far worse failure than one that appears without
        // ceremony. So the panel itself is simply shown or hidden; only the
        // links inside it animate, and they animate from a visible page.
        className={cn(
          'fixed inset-0 z-100 flex-col bg-surface-page lg:hidden',
          open ? 'flex' : 'hidden'
        )}
      >
        <div className="flex items-center justify-end px-6 py-5">
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="inline-flex size-11 items-center justify-center text-ink-primary"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>

        <nav aria-label="Main" className="flex flex-1 flex-col justify-center px-8">
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  onClick={close}
                  style={{ transitionDelay: open ? `${120 + index * 60}ms` : '0ms' }}
                  className={cn(
                    'block py-3 font-display text-4xl text-ink-primary',
                    'transition-[opacity,transform] duration-500 ease-out',
                    open ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
                  )}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-line-subtle p-8">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={close}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 bg-action-primary px-6 label-caps text-xs text-action-on-primary"
          >
            <MessageCircle aria-hidden="true" className="size-4" />
            Ask on WhatsApp
          </a>
        </div>
      </div>
    </>
  );
}
