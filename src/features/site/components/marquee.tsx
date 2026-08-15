'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';

/**
 * The scrolling strip under the hero.
 *
 * The list is rendered twice and the track is moved by exactly half its width
 * before looping, which is what makes the seam invisible - at the moment it
 * resets, the second copy is sitting exactly where the first one started.
 *
 * A GSAP tween rather than a CSS keyframe animation because the distance depends
 * on the rendered width of the text, which CSS cannot measure. `repeat: -1` with
 * a linear ease keeps it steady rather than easing at each loop boundary.
 *
 * `aria-hidden` on the duplicate: it is the same words a second time, and a
 * screen reader announcing everything twice is worse than not announcing the
 * decorative strip at all.
 */
export function Marquee({ items }: { items: readonly string[] }) {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = track.current;
    if (!element) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      const distance = element.scrollWidth / 2;
      if (distance === 0) return;

      gsap.to(element, {
        x: -distance,
        // Speed set by distance, not a fixed duration, so a longer list scrolls
        // at the same pace rather than faster.
        duration: distance / 60,
        ease: 'none',
        repeat: -1,
      });
    }, element);

    return () => ctx.revert();
  }, [items]);

  return (
    <div className="overflow-hidden border-y border-line-subtle bg-surface-sidebar py-3.5">
      <div ref={track} className="flex w-max">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0" aria-hidden={copy === 1 ? true : undefined}>
            {items.map((item) => (
              <li
                key={item}
                className="flex items-center gap-8 px-8 label-caps text-xs whitespace-nowrap text-ink-on-sidebar"
              >
                {item}
                <span aria-hidden="true" className="text-brand-gold">
                  ◆
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
