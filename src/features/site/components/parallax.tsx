'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Moves a child against the scroll to suggest depth.
 *
 * `scrub: true` ties the tween to scroll position rather than playing it on a
 * timer, so the movement is reversible and tracks the reader's thumb exactly -
 * a parallax that plays as an animation instead of following the scroll feels
 * detached the moment someone scrolls back up.
 *
 * The element is expected to be slightly taller than its container (usually via
 * `scale`), because moving something the exact size of its frame reveals the
 * background at one end.
 *
 * `strength` is in percent of the element's own height. Small numbers only:
 * anything past about 15 stops reading as depth and starts reading as a bug.
 */
export function Parallax({
  children,
  strength = 10,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Touch screens get roughly half the movement. The effect is driven by how
    // much of the viewport the element crosses, and on a phone that is a much
    // larger proportion of the screen, so the same number reads as far more
    // motion than it does on a desktop.
    const factor = window.matchMedia('(max-width: 767px)').matches ? 0.5 : 1;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        { yPercent: -strength * factor },
        {
          yPercent: strength * factor,
          ease: 'none',
          scrollTrigger: {
            trigger: element.parentElement ?? element,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        }
      );
    }, element);

    return () => ctx.revert();
  }, [strength]);

  return (
    <div ref={container} className={className}>
      {children}
    </div>
  );
}
