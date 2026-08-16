'use client';

import { useEffect, useRef, type ElementType } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import { cn } from '@/lib/cn';

gsap.registerPlugin(ScrollTrigger);

/**
 * Reveals a heading line by line from behind a mask.
 *
 * This is the single move that separates an editorial site from a page with a
 * fade on it. Each line sits in its own `overflow-hidden` wrapper and starts
 * translated fully below it, so the type appears to rise out of the rule beneath
 * it rather than simply becoming visible.
 *
 * WHY THE LINES ARE PASSED IN, NOT MEASURED
 * The obvious implementation splits rendered text on line breaks at runtime,
 * which means reading layout, and re-reading it on every resize and font swap.
 * Passing the lines as data instead makes the split deliberate, identical on
 * server and client, and free of layout thrash. The cost is that the author
 * chooses where lines break, which for display type is what a designer would
 * want anyway.
 *
 * ACCESSIBILITY: the visible copy is broken into several elements, so the whole
 * phrase is repeated once in a visually hidden span and the pieces are hidden
 * from the accessibility tree. Otherwise a screen reader reads a headline as
 * four disconnected fragments.
 *
 * See `reveal.tsx` for why GSAP is safe under this app's CSP and why reduced
 * motion is checked in JavaScript rather than left to the stylesheet.
 */
export function SplitReveal({
  lines,
  as: Tag = 'h2',
  className,
  lineClassName,
  delay = 0,
}: {
  lines: readonly string[];
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  delay?: number;
}) {
  const container = useRef<HTMLElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.from(element.querySelectorAll('[data-line-inner]'), {
        // 110% rather than 100%: descenders sit below the baseline box, and at
        // exactly 100% the tail of a "y" stays visible above the mask edge.
        yPercent: 110,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.09,
        delay,
        scrollTrigger: { trigger: element, start: 'top 88%', once: true },
      });
    }, element);

    return () => ctx.revert();
  }, [delay]);

  return (
    <Tag ref={container} className={className}>
      <span className="sr-only">{lines.join(' ')}</span>

      {lines.map((line, index) => (
        <span
          key={`${line}-${index}`}
          aria-hidden="true"
          className="block overflow-hidden pb-[0.08em]"
        >
          <span data-line-inner className={cn('block', lineClassName)}>
            {line}
          </span>
        </span>
      ))}
    </Tag>
  );
}
