'use client';

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';

/** See the note on `SplitReveal`: the starting state is applied before paint. */
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : () => {};

/**
 * Time given to the hero's own entrance before the clock on the first word
 * starts.
 *
 * The entrance is still finishing until roughly 1.45s - the headline masks start
 * at 0.12 and run 1.05, and the buttons are still arriving at 0.6. Counting the
 * first hold from zero instead would quietly make `remember` the word with the
 * LEAST readable time on screen, which is backwards: it is the sentence the copy
 * actually authored and the one the hero comes back to rest on.
 */
const ENTRANCE_ALLOWANCE = 1.5;

/**
 * How long each word is left up, and how much longer the next one gets.
 *
 * THE CYCLE DECELERATES INTO ITS RESTING STATE. Each word holds `HOLD_DECAY`
 * longer than the one before it, so the sequence visibly relaxes rather than
 * running at a fixed tempo and then stopping dead - which reads as the animation
 * breaking rather than finishing.
 *
 * THIS IS DELIBERATELY NOT AN INFINITE BACKOFF. Slowing down forever was
 * considered and rejected: the headline would never come to rest, so the largest
 * type on the page keeps moving while someone reads, a visitor can never
 * anticipate the next change, and auto-starting motion that runs indefinitely
 * alongside other content is what WCAG 2.2.2 asks you to put a pause control on.
 * A cycle that ends by itself needs no control. The concern behind the idea -
 * that someone glancing away misses the other words - is answered by re-arming
 * on return to view instead, which is about attention rather than frequency.
 */
const HOLD = 3.4;
const HOLD_DECAY = 0.7;

/**
 * Where a word waits, as a percentage of its own height.
 *
 * THE TWO NUMBERS ARE NOT SYMMETRICAL, AND THE REASON IS THE MASK. `SplitReveal`
 * pads its line masks by `0.18em` so Fraunces' italic swash descenders are not
 * clipped, and the headline's leading is `0.92`. So the mask is taller than the
 * word by exactly that padding: a word sits flush with the mask's top edge and
 * has 0.18em of mask left underneath it.
 *
 * Going up, clearing the mask therefore costs one word-height - 110 is that plus
 * margin. Going down it costs (0.92 + 0.18) / 0.92, or 119.6%, so the 110 that
 * works for the exit leaves an 8px band of the incoming word visible at the
 * bottom of the mask before it starts moving - a thin slice of the next word
 * flickering under the current one. Both terms are in `em`, so the ratio holds
 * at every breakpoint; 125 is that threshold with room for subpixel rounding.
 *
 * Re-derive these if the leading or the mask padding ever changes.
 */
const ENTER_FROM = 125;
const EXIT_TO = -110;

/** The swap itself. */
const WORD_OUT = 0.5;
const WORD_IN = 0.7;
const PICTURE = 0.9;
const CARD = 0.45;

/**
 * The hero's rotating half: one word in the headline, one picture beside it.
 *
 * WHY THIS IS ONE COMPONENT AND NOT TWO. The word lives in the text column and
 * the picture lives in the image column, on opposite sides of the hero grid, and
 * the entire point is that they change together. Two components would need a
 * shared clock and would drift the moment either one was interrupted. This one
 * renders the `<section>` itself, finds both sets of targets inside it by data
 * attribute, and drives them from a single timeline - the same way every other
 * motion component in this folder works, and with no React state, so a rotating
 * hero costs zero re-renders.
 *
 * IT COMES TO REST, AND THAT IS THE DESIGN. The words play once each and the
 * hero settles back on `remember` - the sentence the house actually means. A
 * headline that cycles forever is the SaaS landing-page pattern this brand is
 * not, and past the first pass it stops being information and starts competing
 * with everything the visitor scrolled down to read. Resting also means the
 * page is completely still for anyone who lingers, which is what the rest of
 * this site is like.
 *
 * IT ALSO STOPS WHEN NOBODY IS LOOKING. The timeline pauses when the hero
 * scrolls out of view and when the tab is hidden, so the cycle a visitor sees
 * starts when they arrive rather than halfway through, and a backgrounded tab
 * is not burning frames on a picture nobody is looking at.
 *
 * THE PICTURE DOES NOT MOVE. There is no drift, no scale, no parallax - see the
 * note on the hero image in `page.tsx`: movement was tried there and the owner
 * asked for it gone. So the transition is carried entirely by opacity and a
 * blur that bridges the two frames. Without the blur a crossfade between two
 * photographs reads as two pictures briefly stacked; with it the eye takes it as
 * one image resolving into another.
 *
 * REDUCED MOTION GETS THE RESTING STATE, not a faster version of the animation.
 * The markup already renders the first word and the first picture, so there is
 * nothing to undo and the effect simply returns.
 */
export function HeroRotation({ children, className }: { children: ReactNode; className?: string }) {
  const container = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const element = container.current;
    if (!element) return;

    // Nothing to undo: the markup already renders the resting word and picture.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const words = element.querySelectorAll<HTMLElement>('[data-hero-word]');
    const pictures = element.querySelectorAll<HTMLElement>('[data-hero-picture]');
    const cards = element.querySelectorAll<HTMLElement>('[data-hero-card]');

    // A hero with nothing to rotate is the static hero, which is a supported
    // state rather than a bug - `content.ts` can empty the array at any time.
    const steps = Math.min(words.length, pictures.length, cards.length);
    if (steps < 2) return;

    const ctx = gsap.context(() => {
      /*
        `immediateRender: false` ON EVERY `fromTo` IN HERE, AND IT IS NOT
        OPTIONAL. GSAP renders a `fromTo`'s starting values the moment the tween
        is CREATED, not when the playhead reaches it - so building this timeline
        wrote `opacity: 0` onto every target up front, including the resting word
        and the resting photograph, because the last step of the loop cycles back
        to index 0. The hero shipped with no picture at all and its headline
        parked below its own mask, and nothing threw: it just rendered empty
        until 3.6 seconds later when the first tween happened to reveal it.

        The default is right for a standalone tween and wrong for every sequenced
        one. Any `fromTo` added to this timeline needs the same flag.
      */
      const timeline = gsap.timeline({ paused: true });

      // Accumulated rather than computed from `index`, because each hold is
      // longer than the last - see `HOLD_DECAY`. Words are read for 3.4s, 4.1s
      // and 4.8s, so the first swap lands around 4.9s and the hero is still by
      // about 15.6s.
      let at = ENTRANCE_ALLOWANCE + HOLD;

      for (let index = 1; index <= steps; index += 1) {
        // The last step returns to the first pair rather than advancing past
        // the end, which is what makes the hero rest on the authored sentence.
        const from = index - 1;
        const to = index % steps;

        timeline
          // The outgoing word rises out through the line's own mask, and the
          // incoming one rises in behind it - the same gesture `SplitReveal`
          // uses for the entrance, so the headline only ever moves one way.
          .to(words[from]!, { yPercent: EXIT_TO, duration: WORD_OUT, ease: 'power2.in' }, at)
          .fromTo(
            words[to]!,
            { yPercent: ENTER_FROM, opacity: 1 },
            { yPercent: 0, duration: WORD_IN, ease: 'power3.out', immediateRender: false },
            at + WORD_OUT * 0.55
          )
          // Parked back above the line so the next lap starts from the same
          // place, and made invisible again so a mid-flight interrupt cannot
          // leave two words stacked in the slot.
          .set(words[from]!, { opacity: 0, yPercent: ENTER_FROM }, at + WORD_OUT)
          // The picture follows the word by a beat. The sentence is the lead
          // here; the photograph is the answer to it, not the other way round.
          // `fromTo` with an explicit `blur(0px)`, not a `to` off the resting
          // `filter: none`. GSAP can usually interpolate out of `none`, but it
          // has to guess the shape of the function list to do it, and a guess
          // that comes out wrong here shows up as the photograph snapping rather
          // than blurring. Naming both ends costs nothing and removes the guess.
          .fromTo(
            pictures[from]!,
            { opacity: 1, filter: 'blur(0px)' },
            {
              opacity: 0,
              filter: 'blur(6px)',
              duration: PICTURE,
              ease: 'power2.inOut',
              immediateRender: false,
            },
            at + 0.15
          )
          .fromTo(
            pictures[to]!,
            { opacity: 0, filter: 'blur(6px)' },
            {
              opacity: 1,
              filter: 'blur(0px)',
              duration: PICTURE,
              ease: 'power2.inOut',
              immediateRender: false,
            },
            at + 0.15
          )
          /*
            The card goes last, and quickly.

            Three things change on one beat and the eye can only follow one, so
            they are ordered by what is leading: the sentence, then the
            photograph that answers it, then the label in the corner. A card
            that arrived first would pull attention to the smallest element on
            screen.

            `autoAlpha`, not `opacity` - it drives `visibility` too, which is
            what keeps a parked card out of the tab order and out of the way of
            a stray click. No blur: bridging a crossfade is worth it on a
            photograph and just looks like a rendering fault on 16px type.
          */
          .to(cards[from]!, { autoAlpha: 0, duration: CARD, ease: 'power2.inOut' }, at + 0.3)
          .fromTo(
            cards[to]!,
            { autoAlpha: 0 },
            { autoAlpha: 1, duration: CARD, ease: 'power2.inOut', immediateRender: false },
            at + 0.3 + CARD * 0.7
          );

        at += WORD_OUT + HOLD + index * HOLD_DECAY;
      }

      /*
        Nobody looking, nothing playing - and it re-arms on a real return.

        Pausing off screen is the cheap half: it keeps a backgrounded hero from
        burning frames, and it means the cycle a visitor sees starts when they
        arrive rather than halfway through.

        The other half is what replaces looping forever. Once the timeline has
        finished, leaving the hero ENTIRELY - not merely scrolling it a little -
        arms it again, so coming back to the top of the page plays it once more.
        That covers the case the endless version was really trying to cover,
        someone who looked away and missed two thirds of the sentence, without
        ever taking away the stillness from the person who stayed. `hasLeft`
        exists so a few pixels of scroll cannot retrigger it; the hero is a full
        viewport tall, so clearing it is a deliberate movement.

        `intersectionRatio` rather than a bare `isIntersecting` so a hero that is
        only just clipped by the fold still counts as on screen.
      */
      let hasLeft = false;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry) return;

          if (entry.intersectionRatio === 0) {
            hasLeft = true;
            timeline.pause();
            return;
          }

          if (entry.intersectionRatio > 0.25) {
            // `invalidate` before replaying so the `to` tweens re-read their
            // start values from the DOM instead of replaying against the ones
            // they recorded on the first pass.
            if (hasLeft && timeline.progress() >= 1) timeline.invalidate().restart();
            else timeline.play();
            hasLeft = false;
          }
        },
        { threshold: [0, 0.25, 0.5] }
      );
      observer.observe(element);

      const onVisibility = () => {
        if (document.hidden) timeline.pause();
        else if (element.getBoundingClientRect().bottom > 0) timeline.play();
      };
      document.addEventListener('visibilitychange', onVisibility);

      return () => {
        observer.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
      };
    }, element);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={container} className={className}>
      {children}
    </section>
  );
}
