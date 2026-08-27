'use client';

import { useLayoutEffect, useRef, type ElementType, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

/** See the note on `SplitReveal`: the hidden start is applied before paint. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : () => {};

/**
 * Scroll-triggered entrance animation.
 *
 * WHY GSAP AND NOT A CSS TRANSITION
 * The reveals here are staggered groups tied to scroll position, which CSS can
 * only do with either a per-child transition-delay written by hand or an
 * IntersectionObserver that ends up being half of ScrollTrigger anyway. GSAP is
 * the honest choice once the sequencing is real.
 *
 * WHY IT IS SAFE UNDER THE STRICT CSP
 * `src/proxy.ts` serves a nonce-based policy with no `unsafe-inline` in
 * production, which blocks inline `<style>` and `style="..."` in markup. GSAP
 * animates through the CSSOM - it assigns `element.style.opacity` from
 * JavaScript - and the CSSOM is not what `style-src` governs. No nonce plumbing
 * is needed here, and none should be added.
 *
 * THE RESTING STATE IS VISIBLE; THE HIDING HAPPENS BEFORE PAINT
 * A plain `useEffect` runs after the browser has painted, so `gsap.fromTo`
 * applying `opacity: 0` there means the server-rendered content is visible for
 * the gap between first paint and hydration and then vanishes to animate in -
 * on a slow device, long enough to see content appear, disappear, replay.
 *
 * The tempting fix is a static `opacity-0 translate-y-7` class in the markup.
 * That was tried, and it trades a cosmetic flash for content that is invisible
 * unless a JavaScript animation finishes - see the long version on
 * `SplitReveal`, where the mask made the same choice erase a headline outright.
 * A `useLayoutEffect` gets both: it runs before paint, so there is no flash, and
 * the markup keeps a visible resting state, so a visitor whose JavaScript never
 * runs still reads the page.
 *
 * `gsap.fromTo()`, not `gsap.from()`: `.from()` infers its end state from the
 * target's current computed style. That is correct now the resting state is the
 * visible one, but naming both ends explicitly costs nothing and does not
 * quietly break if a starting class is ever reintroduced.
 *
 * REDUCED MOTION SIMPLY RETURNS. There is nothing to undo - the content is
 * already in its resting position - so no `opacity: 1` rescue is needed.
 *
 * `stagger` animates `element.children` rather than the element itself. Nothing
 * passes it today; it needs no special handling here now that hiding is done in
 * JavaScript against whichever targets the tween is given.
 *
 * ANYTHING ALREADY ON SCREEN WHEN JAVASCRIPT TAKES OVER PLAYS IMMEDIATELY
 * This is the important one, and it is not an optimisation - it is what stops
 * visible text from sitting there invisible.
 *
 * `start: 'top 85%'` assumes the element is below the fold at load, so scrolling
 * it into that zone is the cue. Two things break that assumption. The hero's copy
 * column can run taller than `min-h-[calc(100dvh-7.6875rem)]` - measured at 934px
 * against a 777px floor on a 1440x900 window, because a min-height is a floor and
 * not a cap - which pushed the primary call to action below the trigger line. And
 * every page has a band between 85% of the viewport and the fold itself: content
 * there is plainly visible to the reader and still waiting on a scroll event.
 *
 * That was survivable when a missed trigger merely left content un-animated. It
 * is not survivable now that the static `opacity-0` class above starts it hidden
 * in the HTML: a trigger that does not fire leaves a permanent blank. So the
 * effect measures the element against the viewport and, if any part of it is
 * already on screen, skips ScrollTrigger and plays on mount.
 *
 * `onLoad` remains as an explicit override for a caller that knows its content is
 * part of the initial view and would rather say so than rely on the measurement -
 * the hero uses it. Below-the-fold content is untouched by both and still waits
 * for the scroll, which is the whole point of the effect.
 */
gsap.registerPlugin(ScrollTrigger);

type RevealProps = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  stagger?: boolean;
  delay?: number;
  /** Skip ScrollTrigger and play on mount - for content that is always part of
   *  the initial view (the hero), where a scroll-position gate can end up never
   *  firing without the user scrolling first. */
  onLoad?: boolean;
};

export function Reveal({
  children,
  as: Tag = 'div',
  className,
  stagger = false,
  delay = 0,
  onLoad = false,
}: RevealProps) {
  const container = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const element = container.current;
    if (!element) return;

    // Nothing to undo: the markup already renders the content in place.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Measured before the tween is built, while the element is still where the
    // browser laid it out. `top < innerHeight` catches anything with any part of
    // itself on screen, including the band below the 85% trigger line that is
    // visible but would otherwise wait for a scroll that may never come.
    const box = element.getBoundingClientRect();
    const alreadyOnScreen = box.top < window.innerHeight && box.bottom > 0;
    const playOnMount = onLoad || alreadyOnScreen;

    const ctx = gsap.context(() => {
      const targets = stagger ? Array.from(element.children) : element;

      gsap.fromTo(
        targets,
        { opacity: 0, y: 28 },
        {
          opacity: 1,
          y: 0,
          duration: 0.85,
          ease: 'power3.out',
          delay,
          stagger: stagger ? 0.1 : 0,
          scrollTrigger: playOnMount
            ? undefined
            : {
                trigger: element,
                start: 'top 85%',
                once: true,
              },
        }
      );
    }, element);

    return () => ctx.revert();
  }, [stagger, delay, onLoad]);

  return (
    // No hidden class - the layout effect above applies the starting state
    // before paint, so content stays readable if that never runs.
    <Tag ref={container} className={className}>
      {children}
    </Tag>
  );
}
