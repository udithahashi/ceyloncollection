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
      // Just enough weight to feel considered, not so much that the page feels
      // like it is catching up with the reader.
      duration: 1.05,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // Touch devices already have their own momentum scrolling, and layering
      // ours on top is what makes smooth-scroll libraries feel broken on phones.
      smoothWheel: true,
      syncTouch: false,
      /*
       * NOT OPTIONAL ON THIS PAGE, despite reading like a nicety.
       *
       * Lenis takes ownership of scroll position, and a native anchor jump moves
       * the browser without telling it - so the two disagree and the page snaps
       * back or simply does not move. Every piece of navigation here is an
       * anchor: the four header links, both mobile-drawer and footer links, and
       * the hero's "See what we bring". Without this the menu looks fine and
       * does nothing, which is the worst kind of broken.
       */
      anchors: true,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => {
      // GSAP's ticker reports seconds; Lenis expects milliseconds.
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(raf);
    // GSAP smooths out frame-rate spikes by default, which fights an animation
    // being driven off real scroll position.
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
