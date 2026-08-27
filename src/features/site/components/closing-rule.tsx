'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { cn } from '@/lib/cn';

/** See the note on `SplitReveal`: the starting state is applied before paint. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : () => {};

gsap.registerPlugin(ScrollTrigger);

/**
 * Two rules that close a gap, with an optional mark at the join.
 *
 * WHAT THIS IS FOR, because it is a component with an argument in it rather than
 * a divider. The manifesto's whole claim is that distance is the only thing
 * between the reader and clothing they already trust, and that this house closes
 * it. This draws that: a line reaching in from either edge of the window, a gap
 * between them, and then the gap gone. The sentence is split across it - the
 * trust on one side, where the reader is on the other - so the reading of the
 * section and the motion of it are the same gesture.
 *
 * It is therefore NOT reusable as an ornament. One per page, in the place that
 * is making that argument. A second use costs the first one its meaning.
 *
 * THE JOIN IS AT 58%, NOT 50%. A mark centred on a centred rule is a Word
 * document divider; the same mark at a measured point on a line is a stamp on a
 * route. The two rules are sized to match (58 + 42), so moving one means moving
 * all three numbers.
 *
 * THE RESTING STATE IS CLOSED, and this is the same hard rule the other motion
 * components in this folder carry: the markup ships the finished, readable state
 * and JavaScript applies the starting one from a layout effect, before paint. A
 * visitor whose JavaScript never runs, or who asks for reduced motion, gets one
 * continuous rule with the mark on it - a quiet composition rather than a broken
 * one. Ship the open state in the markup instead and a failed tween leaves two
 * stubs and a hole in the middle of the section.
 *
 * NO INLINE STYLE, ANYWHERE. `src/proxy.ts` serves a nonce policy with no
 * `unsafe-inline`, so a `style="width:58%"` attribute is refused by the browser
 * in production while looking perfect in dev. The percentages are Tailwind
 * classes for that reason, which is also why the join is not a prop. GSAP is
 * fine here: it writes through the CSSOM, which `style-src` does not govern.
 *
 * `scaleX`, not `width`. Width animation relayouts the section on every frame;
 * a transform is composited. The rules have their `transform-origin` at the
 * outer edge each one grows from.
 */
export function ClosingRule({ children, className }: { children?: ReactNode; className?: string }) {
  const container = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const element = container.current;
    if (!element) return;

    // Nothing to undo: the markup already renders the rule closed.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // See `Reveal` for the measurement behind this: anything already on screen
    // when JavaScript takes over must not wait for a scroll event that may
    // never come.
    const box = element.getBoundingClientRect();
    const playOnMount = box.top < window.innerHeight && box.bottom > 0;

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        scrollTrigger: playOnMount ? undefined : { trigger: element, start: 'top 85%', once: true },
      });

      timeline
        // Slower than the page's other entrances on purpose. This one is not
        // getting content on screen, it is making a point, and a point made in
        // 300ms is not made at all. It happens once per visit, in the section
        // the page has already stopped at.
        .fromTo('[data-rule]', { scaleX: 0.24 }, { scaleX: 1, duration: 1.3, ease: 'power3.out' })
        // Lands as the two ends arrive rather than after them, so the mark reads
        // as what closed the gap and not as a badge dropped on afterwards.
        // Never from `scale(0)` - nothing arrives out of nothing.
        .fromTo(
          '[data-seal]',
          { opacity: 0, scale: 0.92 },
          { opacity: 1, scale: 1, duration: 0.8, ease: 'power3.out' },
          0.5
        );
    }, element);

    return () => ctx.revert();
  }, []);

  return (
    // Full bleed by negative margins rather than by `left`, so the box is placed
    // in flow instead of being painted outside one - a shifted element still
    // reserves its old width and pushes the document's scrollWidth out to the
    // right, which is a horizontal scrollbar on every page that uses it.
    <div ref={container} className={cn('relative mx-[calc(50%-50vw)]', className)}>
      <div className="relative h-px">
        <div data-rule className="absolute inset-y-0 left-0 w-[58%] origin-left bg-ink-accent" />
        <div data-rule className="absolute inset-y-0 right-0 w-[42%] origin-right bg-ink-accent" />
      </div>

      {children ? (
        // TWO ELEMENTS, AND THE NESTING IS LOAD-BEARING. GSAP writes `translate:
        // none; rotate: none; scale: none` onto anything it animates, to stop the
        // individual CSS transform properties fighting the matrix it is writing
        // into `transform`. So the centring cannot live on the element the tween
        // touches: put `-translate-x-1/2` on `[data-seal]` and the first frame of
        // the scale tween silently deletes it, dropping the mark's left corner
        // onto the join instead of its middle. The outer element positions and is
        // never animated; the inner one is the tween's.
        <div
          className="absolute top-1/2 left-[58%] -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <div data-seal>{children}</div>
        </div>
      ) : null}
    </div>
  );
}
