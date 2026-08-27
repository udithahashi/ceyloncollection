'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { Reveal } from './reveal';

/**
 * A horizontal rail of tiles: real scrolling, snapped, with its scrollbar
 * hidden and prev/next buttons standing in for it.
 *
 * WHY NOT A PINNED GSAP SECTION, AND WHY NOT AUTOPLAY
 * Both were considered and rejected on evidence rather than taste.
 *
 * Pinning the viewport and translating a track sideways is scroll-jacking. It
 * hangs the viewport for anyone tabbing through the page, and it fights Lenis
 * in ways this project would feel immediately - anchor navigation is how every
 * link on this site moves, and Lenis plus ScrollTrigger is a documented source
 * of tweens that never finish after an anchor jump. GSAP's own position is that
 * ScrollTrigger was built deliberately not to jack the scroll.
 *
 * Auto-advancing is worse. Roughly 1% of people interact with a carousel at all
 * and the overwhelming majority of those only ever see the first slide; movement
 * costs comprehension rather than adding it. It also drags in WCAG 2.2.2 (Pause,
 * Stop, Hide) and turns every tile into a moving target for anyone who cannot
 * click quickly.
 *
 * What is left is the thing the browser already does well. Touch gets native
 * swipe with native momentum, which is most of this audience. Nothing here is
 * required for the content to be reachable: the buttons are an enhancement over
 * a list that already scrolls, so a failure of JavaScript costs polish, not
 * access - the lesson the reveal components learned the hard way.
 *
 * KEYBOARD ACCESS IS NOT OPTIONAL ONCE THE SCROLLBAR IS GONE
 * A visible scrollbar is a keyboard affordance. Hiding it without giving the
 * container `tabIndex` would strand a keyboard user with content they can see
 * and cannot reach - the failure axe reports as `scrollable-region-focusable`.
 * The `<ul>` is focusable and labelled, so arrow keys work whether or not the
 * buttons are on screen.
 */
export function ScrollRail({
  heading,
  label,
  children,
}: {
  /** The section's eyebrow/title block. Sits left of the controls. */
  heading: ReactNode;
  /** Names the rail for assistive technology, e.g. "New arrivals". */
  label: string;
  /** The `<li>` tiles. */
  children: ReactNode;
}) {
  const rail = useRef<HTMLUListElement>(null);

  // Starts `true` so the server renders the controls and hydration does not pop
  // them in. `sync` corrects it immediately if the tiles happen to fit.
  const [overflows, setOverflows] = useState(true);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;

    // Sub-pixel widths make an exact comparison flicker between states, so both
    // ends get a pixel of tolerance.
    const furthest = el.scrollWidth - el.clientWidth;
    setOverflows(furthest > 1);
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft >= furthest - 1);
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;

    sync();
    el.addEventListener('scroll', sync, { passive: true });

    // Catches the cases a scroll event does not: a resize, a font swapping in,
    // an image settling, or tiles being added later from real stock data.
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));

    return () => {
      el.removeEventListener('scroll', sync);
      observer.disconnect();
    };
  }, [sync]);

  const step = (direction: 1 | -1) => {
    const el = rail.current;
    if (!el) return;

    // One tile plus its gap, measured rather than assumed, so the step stays
    // right when the tile width changes at a breakpoint. Falls back to most of
    // a viewport if the rail is somehow empty.
    const first = el.firstElementChild;
    const second = el.children[1];
    const distance =
      first && second
        ? second.getBoundingClientRect().left - first.getBoundingClientRect().left
        : el.clientWidth * 0.8;

    el.scrollBy({
      left: distance * direction,
      // Honour reduced motion here too: a smooth programmatic scroll is exactly
      // the kind of movement that setting exists to stop.
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  return (
    <>
      {/*
        `pt-` only, never `py-`. Every other section on the page keeps its
        heading and its content in one block and separates them by `mt-16`; this
        one had a full section's bottom padding between the two, plus the rail's
        own top edge, which pushed the tiles about 130px further down than any
        other section would and meant the title and the controls had scrolled off
        before a whole tile was on screen. The rail below supplies the gap.
      */}
      <div className="mx-auto max-w-[1440px] px-6 pt-24 lg:px-10 lg:pt-32">
        <div className="flex items-end justify-between gap-6">
          {heading}

          {/*
            Hidden below `sm`, where a swipe is the obvious gesture and two
            buttons would only crowd the heading. The rail itself stays
            focusable at every width, so nothing is lost by hiding them.
          */}
          {overflows ? (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <RailButton
                direction="previous"
                label={`Previous ${label.toLowerCase()}`}
                disabled={atStart}
                onClick={() => step(-1)}
              />
              <RailButton
                direction="next"
                label={`Next ${label.toLowerCase()}`}
                disabled={atEnd}
                onClick={() => step(1)}
              />
            </div>
          ) : null}
        </div>
      </div>

      <Reveal>
        {/*
          `snap-start` with `scroll-pl-*` matching the rail's own padding, so a
          snapped tile lands flush with the page's left margin rather than
          against the viewport edge.

          `overscroll-x-contain` stops a horizontal flick from continuing into
          the browser's back-navigation gesture once the rail hits its end.
        */}
        <ul
          ref={rail}
          tabIndex={0}
          aria-label={label}
          className="mt-12 no-scrollbar flex snap-x snap-mandatory scroll-pl-6 gap-6 overflow-x-auto overscroll-x-contain px-6 pb-24 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-line-focus lg:mt-16 lg:scroll-pl-10 lg:px-10 lg:pb-32"
        >
          {children}
        </ul>
      </Reveal>
    </>
  );
}

/**
 * One control. A real `<button>`, so it is focusable, keyboard-operable and
 * announced without any ARIA beyond its label.
 *
 * 44px square: the minimum target this project set for itself, and the reason
 * the icon is drawn smaller than the box rather than the box being drawn to fit
 * the icon.
 */
function RailButton({
  direction,
  label,
  disabled,
  onClick,
}: {
  direction: 'previous' | 'next';
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-11 items-center justify-center rounded-control border border-line-strong text-ink-primary transition-colors duration-300 hover:border-ink-primary hover:bg-surface-panel disabled:pointer-events-none disabled:opacity-35"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="square"
        className="size-4"
      >
        <path d={direction === 'previous' ? 'M15 4 7 12l8 8' : 'M9 4l8 8-8 8'} />
      </svg>
    </button>
  );
}
