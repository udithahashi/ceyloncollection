'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

/**
 * The hero's entrance, and the one piece of motion on this page that is not
 * scroll-triggered - it plays on load, because the hero is already in view.
 *
 * Children animate in sequence by their `data-hero` order. Marking the elements
 * with a data attribute rather than passing refs down keeps the page component
 * a plain Server Component; only this wrapper ships JavaScript.
 *
 * See `reveal.tsx` for why GSAP is safe under the app's strict CSP and why
 * reduced motion is checked here in JavaScript rather than left to the
 * stylesheet.
 */
export function HeroMotion({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const items = element.querySelectorAll('[data-hero]');
      if (items.length === 0) return;

      gsap
        // `clearProps` on the defaults so both tweens tidy up after themselves -
        // see the note in reveal.tsx for why the inline styles should not linger.
        .timeline({ defaults: { ease: 'power3.out', clearProps: 'opacity,transform,scale' } })
        .from(items, {
          opacity: 0,
          y: 28,
          duration: 0.9,
          stagger: 0.1,
        })
        // The image resolves from a slight scale rather than sliding: a large
        // photograph moving across the viewport reads as a carousel about to
        // advance, which this is not.
        .from(
          '[data-hero-image]',
          { opacity: 0, scale: 1.06, duration: 1.4 },
          // Overlaps the text by 0.6s so the two feel like one entrance.
          '-=0.6'
        );
    }, element);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={container} className="contents">
      {children}
    </div>
  );
}
