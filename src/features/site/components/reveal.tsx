'use client';

import { useEffect, useRef, type ElementType, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

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
 * REDUCED MOTION IS HANDLED TWICE, ON PURPOSE
 * `globals.css` already forces every animation and transition to ~0s under
 * `prefers-reduced-motion`, but that only neuters the movement - a `from` state of
 * `opacity: 0` set by JavaScript would simply stick, leaving invisible text. So
 * this checks the media query itself and skips the animation entirely, which
 * leaves the content in its natural, visible state.
 */
gsap.registerPlugin(ScrollTrigger);

type RevealProps = {
  children: ReactNode;
  /** Which element to render. Defaults to a plain div. */
  as?: ElementType;
  className?: string;
  /**
   * Animate direct children in sequence instead of the container as one block.
   * Use for card grids and lists; leave off for a single block of prose.
   */
  stagger?: boolean;
  /** Seconds to wait before starting, for sequencing against a neighbour. */
  delay?: number;
};

export function Reveal({
  children,
  as: Tag = 'div',
  className,
  stagger = false,
  delay = 0,
}: RevealProps) {
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // `gsap.context` scopes every tween to this element and gives one revert()
    // that cleans up the ScrollTriggers too - without it, React's strict-mode
    // double-invoke in development leaves a second dead trigger behind.
    const ctx = gsap.context(() => {
      const targets = stagger ? Array.from(element.children) : element;

      gsap.from(targets, {
        opacity: 0,
        y: 24,
        duration: 0.7,
        ease: 'power2.out',
        delay,
        stagger: stagger ? 0.12 : 0,
        // Strips the inline opacity/transform once the reveal has finished, so
        // the element ends up in its natural CSS state rather than carrying a
        // permanent `style="opacity: 1; transform: ..."` that would then fight
        // any hover or responsive rule defined in the stylesheet.
        clearProps: 'opacity,transform',
        scrollTrigger: {
          trigger: element,
          // Starts when the element's top reaches 85% down the viewport: far
          // enough in to feel deliberate, early enough that nothing is still
          // fading while the reader is already looking at it.
          start: 'top 85%',
          once: true,
        },
      });
    }, element);

    return () => ctx.revert();
  }, [stagger, delay]);

  return (
    <Tag ref={container} className={className}>
      {children}
    </Tag>
  );
}
