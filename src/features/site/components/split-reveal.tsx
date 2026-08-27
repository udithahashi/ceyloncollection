'use client';

import { useLayoutEffect, useRef, type ElementType } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { cn } from '@/lib/cn';

gsap.registerPlugin(ScrollTrigger);

/**
 * `useLayoutEffect` on the client, `useEffect` on the server.
 *
 * The hidden starting state is applied in a layout effect so it lands before the
 * browser paints - that is what removes the flash of finished text without
 * needing a static hidden class in the markup. React warns if `useLayoutEffect`
 * runs during SSR, hence the swap.
 */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : () => {};

/**
 * Reveals a heading line by line from behind a mask.
 *
 * The lines are passed in, not measured: splitting at runtime means reading
 * layout on every resize and font swap. The author chooses the break, which
 * for display type is what a designer would want anyway.
 *
 * The visible copy is broken into several elements, so the whole phrase is
 * repeated once in a visually hidden span and the pieces are hidden from the
 * accessibility tree.
 *
 * THE RESTING STATE IS VISIBLE, AND THE HIDING IS DONE BY JAVASCRIPT
 * This is the single most important thing about this component, and it was
 * learned the expensive way.
 *
 * The obvious way to stop a flash of finished text between first paint and
 * hydration is a static `translate-y-[110%]` class in the markup, matching the
 * `yPercent: 110` gsap animates from. That was done, and it inverted the failure
 * mode into the worst one available: with the mask clipping a parked line out of
 * its own box, the heading is INVISIBLE unless a JavaScript animation runs to
 * completion. Every way a tween can fail to finish - a stale bundle, a device
 * that throttles frames, an exception anywhere earlier in hydration, an
 * environment whose `requestAnimationFrame` never fires - stopped being "the
 * heading does not animate" and became "the page has no headline". The largest
 * text on the site is exactly the wrong place to take that bet.
 *
 * So the markup ships the heading in its normal, readable position, and the
 * hidden starting state is applied from `useLayoutEffect` - which runs after the
 * DOM is built but BEFORE the browser paints, so nothing is ever shown in the
 * finished position first. Same absence of flash, opposite failure mode: if the
 * JavaScript does not run, the visitor reads a static heading.
 *
 * That also makes reduced motion trivial - return before touching anything and
 * the heading is simply there, rather than needing a `transform: none` rescue
 * for a state the markup should never have been in.
 *
 * `gsap.fromTo()`, not `gsap.from()`: `.from()` infers its end state from the
 * target's current computed transform. That inference is fine now the resting
 * state is the visible one, but stating both ends explicitly costs nothing and
 * survives someone reintroducing a starting transform. See `Reveal`.
 */
export function SplitReveal({
  lines,
  as: Tag = 'h2',
  className,
  lineClassName,
  accent,
  accentAlternates,
  accentClassName = 'text-ink-accent italic',
  delay = 0,
  onLoad = false,
}: {
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  /**
   * A word or phrase within `lines` to set apart. Matched literally and only
   * on the first occurrence in each line.
   *
   * Kept as a substring of the plain strings rather than letting callers pass
   * markup, because the visible lines are hidden from assistive technology and
   * the whole phrase is re-announced from `lines.join(' ')`. If a caller could
   * pass elements, that accessible copy would have to be reconstructed from
   * them and would drift from what is on screen.
   */
  accent?: string;
  /**
   * Extra words to stack behind `accent` in the same slot, for a caller that
   * animates between them - see `HeroRotation`, which is the only one.
   *
   * They render into the DOM immediately and all but the first are parked at
   * `opacity: 0`, so a visitor whose JavaScript never runs reads the heading the
   * copy actually authored. The `sr-only` line above is unaffected either way:
   * the accessible name of the heading stays the one canonical sentence rather
   * than churning as the visual layer cycles.
   */
  accentAlternates?: readonly string[];
  accentClassName?: string;
  delay?: number;
  /** Skip ScrollTrigger and play on mount - see the same prop on `Reveal`.
   *  Pass this for a heading that is always part of the initial view. */
  onLoad?: boolean;
}) {
  const container = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const element = container.current;
    if (!element) return;

    // Nothing to undo: the markup already renders the heading in place.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // See the long note on `Reveal`: anything already on screen when JavaScript
    // takes over must not wait for a scroll event, because the mask means a
    // trigger that never fires leaves a blank space rather than static text.
    const box = element.getBoundingClientRect();
    const alreadyOnScreen = box.top < window.innerHeight && box.bottom > 0;
    const playOnMount = onLoad || alreadyOnScreen;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element.querySelectorAll('[data-line-inner]'),
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.05,
          ease: 'power3.out',
          stagger: 0.1,
          delay,
          scrollTrigger: playOnMount
            ? undefined
            : { trigger: element, start: 'top 88%', once: true },
        }
      );
    }, element);

    return () => ctx.revert();
  }, [delay, onLoad]);

  return (
    <Tag ref={container} className={className}>
      <span className="sr-only">{lines.join(' ')}</span>

      {lines.map((line, index) => (
        <span
          key={`${line}-${index}`}
          aria-hidden="true"
          // `pb-[0.08em]` alone clips an italic accent word: Fraunces italic's
          // swash descenders sit lower than the upright glyphs this padding was
          // sized for, and measuring the accent word in the hero showed a real
          // 7.6px clip at the bottom of the mask, not an animation artefact.
          // 0.18em covers that with margin at every size this component renders.
          className="block overflow-hidden pb-[0.18em]"
        >
          {/* No hidden class here on purpose - see the note at the top of this
              file. The starting offset is applied before paint by the layout
              effect above, so a heading whose JavaScript never runs stays
              readable instead of vanishing behind its own mask. */}
          <span data-line-inner className={cn('block', lineClassName)}>
            {renderLine(line, accent, accentAlternates, accentClassName)}
          </span>
        </span>
      ))}
    </Tag>
  );
}

/**
 * Splits one line around `accent` and wraps the match.
 *
 * Returns the line untouched when there is no accent or no match, so a typo in
 * the accent word degrades to an ordinary headline rather than a broken one.
 */
function renderLine(
  line: string,
  accent: string | undefined,
  alternates: readonly string[] | undefined,
  accentClassName: string
) {
  if (!accent) return line;

  const at = line.indexOf(accent);
  if (at === -1) return line;

  return (
    <>
      {line.slice(0, at)}
      {alternates && alternates.length > 0 ? (
        /*
          THE SLOT IS SIZED BY THE WORD IN FLOW, and every alternate is taken out
          of flow on top of it. That is the whole reason a swap costs nothing:
          the box never changes width, so the line never reflows and the mask
          above never has to re-measure. It only works because the accent is the
          last thing on its line - a shorter alternate just leaves rag after it,
          where a mid-line slot would leave a visible hole.

          `align-top` rather than the inline default. An inline-block takes its
          baseline from its last line box, and with absolutely positioned
          children that baseline drifts off the line the word is supposed to sit
          on; aligning the box top instead pins every alternate to the same
          cap-line as the text beside it.
        */
        <span className="relative inline-block align-top">
          <span data-hero-word className={cn('block', accentClassName)}>
            {accent}
          </span>
          {alternates.map((word) => (
            <span
              key={word}
              data-hero-word
              aria-hidden="true"
              className={cn('absolute top-0 left-0 block opacity-0', accentClassName)}
            >
              {word}
            </span>
          ))}
        </span>
      ) : (
        <span className={accentClassName}>{accent}</span>
      )}
      {line.slice(at + accent.length)}
    </>
  );
}
