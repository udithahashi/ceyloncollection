'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * The scrolling strip, which reacts to how the page is being scrolled.
 *
 * The list is rendered twice and the track moves by exactly half its width
 * before looping, so the seam is invisible: at the moment it resets, the second
 * copy sits exactly where the first began.
 *
 * WHAT MAKES IT FEEL ALIVE RATHER THAN DECORATIVE
 * Scrolling speeds the strip up in proportion to scroll velocity, and scrolling
 * up runs it backwards. It is a small thing that makes the page feel like one
 * object responding to the reader instead of a stack of independent sections.
 * The speed eases back to its resting rate when scrolling stops.
 *
 * A GSAP tween rather than a CSS keyframe because the distance depends on the
 * rendered width of the text, which CSS cannot measure, and because timeScale
 * gives the velocity response for free.
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

      const loop = gsap.to(element, {
        x: -distance,
        // Duration from distance, not a fixed number, so a longer list scrolls
        // at the same pace rather than faster.
        duration: distance / 60,
        ease: 'none',
        repeat: -1,
      });

      const trigger = ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          // Direction flips the strip; velocity drives how far above resting
          // speed it runs. Clamped so a flung scroll on a phone cannot spin it
          // into an unreadable blur.
          const boost = gsap.utils.clamp(1, 6, Math.abs(self.getVelocity()) / 300);
          gsap.to(loop, {
            timeScale: boost * self.direction,
            duration: 0.35,
            overwrite: true,
          });
        },
      });

      // Settle back to a steady crawl once the page stops moving.
      const idle = window.setInterval(() => {
        if (Math.abs(loop.timeScale()) > 1.05) {
          gsap.to(loop, { timeScale: Math.sign(loop.timeScale()) || 1, duration: 0.8 });
        }
      }, 400);

      return () => {
        trigger.kill();
        window.clearInterval(idle);
      };
    }, element);

    return () => ctx.revert();
  }, [items]);

  return (
    <div className="overflow-hidden border-y border-white/10 bg-surface-sidebar py-4">
      <div ref={track} className="flex w-max">
        {[0, 1].map((copy) => (
          <ul key={copy} className="flex shrink-0" aria-hidden={copy === 1 ? true : undefined}>
            {items.map((item) => (
              <li
                key={item}
                className="flex items-center gap-10 px-10 label-caps text-xs whitespace-nowrap text-ink-on-sidebar"
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
