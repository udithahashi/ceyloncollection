'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * A hairline of brand gold across the top, filling as the page is read.
 *
 * Small, but it is what tells someone this page has an end. The homepage is a
 * long scroll with no pagination, and a progress line is the cheapest honest
 * answer to "how much more of this is there".
 *
 * `aria-hidden` and no ARIA progressbar role: it reports nothing a screen
 * reader user cannot already get from their own reading position, and
 * announcing a continuously changing value would be noise.
 *
 * Under reduced motion it simply never renders any movement - the bar stays at
 * zero width, which is visually identical to not being there.
 */
export function ScrollProgress() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = bar.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: document.documentElement,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.3,
          },
        }
      );
    }, element);

    return () => ctx.revert();
  }, []);

  return (
    <div aria-hidden="true" className="fixed inset-x-0 top-0 z-100 h-px bg-transparent">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-brand-gold" />
    </div>
  );
}
