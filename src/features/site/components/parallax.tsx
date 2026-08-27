'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Moves a child against the scroll to suggest depth.
 *
 * `scrub: true` ties the tween to scroll position rather than playing it on a
 * timer.
 *
 * THE CHILD MUST BE OVERSIZED, AND BY A SPECIFIC AMOUNT. This moves its child
 * between `-strength%` and `+strength%` of the child's own height, so the child
 * has to overhang its frame by at least `strength%` on each side or the frame's
 * background shows through at one end. A `scale-N` child overhangs by
 * `(N - 100) / 2`, which gives the rule:
 *
 *     scale >= 100 + (2 * strength)
 *
 * `strength={4}` therefore needs `scale-108`, not the `scale-105` that looks
 * about right - that combination was live for a while and left a thin sliver of
 * empty container at the top of the hero on scroll.
 *
 * Leave a couple of points spare rather than sitting on the equality. Meeting
 * it exactly puts the travel and the overhang within a rounding error of each
 * other (measured: 58.05px of travel against 58.08px of overhang), and a
 * browser resolving that the wrong way draws a hairline seam.
 */
export function Parallax({
  children,
  strength = 10,
  start = 'top bottom',
  className,
}: {
  children: ReactNode;
  strength?: number;
  /**
   * ScrollTrigger's start position.
   *
   * The default, `top bottom`, means "begin when the element's top reaches the
   * bottom of the viewport" - right for anything you scroll down to. It is
   * wrong for a hero, because an element already at the top of the page passed
   * that point before the page was ever painted: the tween opens roughly
   * halfway through its range, so half the movement is never seen and the image
   * starts already displaced. Pass `top top` there to anchor the start at
   * scroll zero and use the whole range.
   */
  start?: string;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    /*
     * `gsap.matchMedia` rather than reading `matchMedia` once.
     *
     * Both of the conditions below can change after mount, and the hand-rolled
     * version could not see either. It read the breakpoint at mount and kept
     * that answer forever, so a phone rotated into landscape - or any resize
     * across 768px - kept the wrong amount of travel; measured at 390px wide it
     * was still applying the desktop factor. It also meant someone turning on
     * "reduce motion" had to reload before the site respected it.
     *
     * matchMedia re-runs the setup when a condition flips and reverts what the
     * previous branch created, which is exactly the behaviour both need.
     */
    const mm = gsap.matchMedia();

    mm.add(
      {
        isPhone: '(max-width: 767px)',
        /*
         * `isDesktop` is not used below, and removing it silently disables the
         * whole effect on desktop. gsap.matchMedia only invokes the callback
         * when at least ONE of its queries currently matches; with just
         * `isPhone` and `prefersReduced`, an ordinary desktop visitor with
         * motion enabled matches neither, so the tween was never created and
         * the element kept no transform at all. Every branch of the matrix
         * needs a query that covers it.
         */
        isDesktop: '(min-width: 768px)',
        prefersReduced: '(prefers-reduced-motion: reduce)',
      },
      (context) => {
        const { isPhone, prefersReduced } = context.conditions as {
          isPhone: boolean;
          prefersReduced: boolean;
        };

        // Parallax is the effect motion-sensitive people most need gone, so
        // this leaves the element at its natural position rather than damping.
        if (prefersReduced) return;

        // Phones get three quarters of the travel, not half. The old halving
        // made it almost imperceptible on the screens most of this site's
        // visitors use - about 15px - which reads as broken rather than subtle.
        const factor = isPhone ? 0.75 : 1;

        gsap.fromTo(
          element,
          { yPercent: -strength * factor },
          {
            yPercent: strength * factor,
            ease: 'none',
            scrollTrigger: {
              trigger: element.parentElement ?? element,
              start,
              end: 'bottom top',
              scrub: true,
              // Start and end are measured once, when the trigger is created.
              // On this page that is before the display face has swapped and
              // before the hero photo has decoded, both of which change the
              // height this is measured against - leaving the tween keyed to
              // positions the page no longer has.
              invalidateOnRefresh: true,
            },
          }
        );
      }
    );

    /*
     * `load` fires after images and fonts, which is exactly when the numbers
     * above stop being provisional. Without this the hero can end up with a
     * trigger whose range was calculated against a shorter, unstyled page, and
     * the symptom is an effect that looks dead or fires at the wrong moment.
     */
    const refresh = () => ScrollTrigger.refresh();
    if (document.readyState === 'complete') refresh();
    else window.addEventListener('load', refresh, { once: true });

    return () => {
      window.removeEventListener('load', refresh);
      mm.revert();
    };
  }, [strength, start]);

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
