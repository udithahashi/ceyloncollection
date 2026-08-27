'use client';

import { useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

/*
 * Lenis's own stylesheet, and it is load-bearing rather than cosmetic. Its first
 * rule is `html.lenis, html.lenis body { height: auto }`, which undoes the
 * `h-full` this app puts on <html> - without it Lenis measures a viewport-height
 * document, decides there is nothing to scroll, and the page stops moving.
 * Bundled through the build, so it is served from our own origin and satisfies
 * `style-src 'self'`.
 */
import 'lenis/dist/lenis.css';

/**
 * Inertia-smoothed scrolling for the public site.
 *
 * WHY LENIS AND SCROLLTRIGGER HAVE TO BE INTRODUCED TO EACH OTHER
 * Lenis stops the page scrolling natively and moves a transform instead, so
 * `window.scrollY` no longer changes the way ScrollTrigger expects. Left alone,
 * every pinned section and scrubbed animation would fire against a scroll
 * position that is no longer real. Driving Lenis from GSAP's ticker and calling
 * `ScrollTrigger.update()` on each Lenis frame keeps both reading the same
 * number.
 *
 * REDUCED MOTION TURNS THIS OFF ENTIRELY, NOT DOWN
 * Smoothing is the single most intrusive thing on this page for someone who
 * gets motion sick, and it affects every scroll rather than one section. Under
 * `prefers-reduced-motion` Lenis is never constructed, so the browser's own
 * scrolling is untouched.
 *
 * Renders nothing. It exists for its effect.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      syncTouch: false,
      anchors: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.off('scroll', ScrollTrigger.update);
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
    };
  }, []);

  return null;
}
