import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';

import { offerCampaigns, seasonalCampaigns } from '@/features/site/campaigns';
import {
  AVAILABILITY_LABEL,
  collections,
  newArrivals,
  pieces,
  selectedPieces,
} from '@/features/site/catalog';
import { CampaignPanel } from '@/features/site/components/campaign-panel';
import { ClosingRule } from '@/features/site/components/closing-rule';
import { EnquireLink } from '@/features/site/components/enquire-link';
import { HeroRotation } from '@/features/site/components/hero-rotation';
import { ProductTile } from '@/features/site/components/product-tile';
import { Reveal } from '@/features/site/components/reveal';
import { ScrollRail } from '@/features/site/components/scroll-rail';
import { SiteShell } from '@/features/site/components/site-shell';
import { SplitReveal } from '@/features/site/components/split-reveal';
import { site, TODO_FIGURE, whatsappLink } from '@/features/site/content';
import { featuredStories } from '@/features/site/stories';
import { cn } from '@/lib/cn';

/**
 * The public homepage.
 *
 * A Server Component. Every image, every word and every link is rendered on
 * the server; the client components exist only to carry motion. The page is
 * complete and readable without any of them.
 *
 * WHAT IT IS NOT: a shop. No basket, no price, no checkout. Every commercial
 * action opens WhatsApp. Product data lives in `features/site/catalog.ts` so
 * a future backend can fill the same shapes.
 *
 * `await connection()` is load-bearing. A prerendered page here ships with no
 * CSP nonce and the browser refuses every script. `dynamic = 'force-dynamic'`
 * is not enough - see the note this file used to carry, in git history.
 */
export default async function HomePage() {
  await connection();

  const arrivals = newArrivals();
  const selected = selectedPieces();
  const [featured, ...otherStories] = featuredStories();
  // Seasonal first, then offers - the order the section reads in. Kept as one
  // list so the grid below can tell whether the count is odd.
  const campaignPanels = [...seasonalCampaigns(), ...offerCampaigns()];

  /*
    The house panel's three figures.

    Two are COUNTED from the catalogue rather than written down, so they cannot
    become wrong the moment a piece is added or an edit retired - the failure
    mode of a hardcoded "8 pieces" is that it silently turns into a lie. The
    third has no source in the code because it is a fact about the business, so
    it renders as the same `___` blank the offer figures use rather than a
    plausible guess.
  */
  /*
    The manifesto's two hand-broken lines, pulled apart so the closing rule can
    go between them - see the long note on that section. `content.ts` authors
    exactly two and its own comment says so; the fallbacks are here because
    `noUncheckedIndexedAccess` is on, and an empty string renders as a visibly
    missing line rather than as a crash on a page a customer is looking at.
  */
  const [firstLine = '', secondLine = ''] = site.manifesto.lines;

  const houseFigures = [
    { value: String(collections.length), label: site.house.stats.collections },
    { value: String(pieces.length), label: site.house.stats.pieces },
    { value: TODO_FIGURE, label: site.house.stats.years },
  ];

  return (
    <SiteShell>
      <main className="flex-1">
        {/*
          Minus the chrome's 8.3125rem (see site-shell.tsx): the announcement strip
          and the header are both in the flow, so a full `100dvh` here would
          push the fold that much past one screen. Together they come to exactly
          a viewport. Measured, not guessed - 133px at a 16px root.
        */}
        <HeroRotation className="relative isolate grid min-h-[calc(100dvh-8.3125rem)] lg:grid-cols-12">
          {/* `pt-16`, not `pt-32`: the old value existed to clear an overlaying
              header that no longer overlays. */}
          {/*
            SIX COLUMNS, NOT FIVE, AND THE HEADLINE IS WHY. `that remember` needs
            660px at the type's 6.4rem ceiling; five columns of a 1440px grid,
            minus this padding, gave it 514. So the h1 wrapped - into five visual
            lines instead of three - at every width from `lg` up to about 1776px,
            which is to say on every laptop anybody actually owns, and only
            looked correct on a very wide monitor. The masks made it worse rather
            than obvious: each one clips per AUTHORED line, so a wrapped line
            reveals two rows of type as a single unit and the break reads as a
            styling choice instead of as the overflow it is.

            The type ceiling stays where it was. What changed is that the column
            is now wide enough to hold the sentence it was given - and the vw
            term came down to 6.2 so the promise holds at 1024 too, where twelve
            columns are small and this 80px of padding is a large share of six of
            them.

            6.2 IS MEASURED, AND 1024 IS WHERE IT WAS MEASURED. `that remember`
            costs about 6.49px of line per px of type, against a column of
            `0.5vw - 80`; at 1024 that leaves room for 65px and 6.2vw asks for
            63.5. Every wider viewport has more slack, so this is the binding
            case. Re-measure here, not at your own screen size, if the headline
            copy or this column's padding ever changes - and note that a wider
            word than `remember` moves the number even if the line looks fine on
            a large monitor.
          */}
          <div className="flex flex-col justify-end px-6 pt-16 pb-16 lg:col-span-6 lg:px-10 lg:pb-24">
            <p className="sinhala text-sm text-ink-accent">{site.hero.sinhala}</p>
            {/*
              `accent` picks one word out of the headline in the brand's accent
              colour. The owner chose rose here, as the reference design had it.

              READ THIS BEFORE REUSING `text-brand-rose` ELSEWHERE. On this ivory
              ground rose measures 3.04:1, and `tokens.ts` lists it under
              DECORATIVE_ONLY for that reason. It is legitimate on THIS element
              and not in general: WCAG's 3:1 allowance applies to large text, and
              this headline never renders below `3.2rem` at any viewport. Move it
              onto body copy, or shrink this type scale, and it stops passing -
              which is why the rule stays on the token and this is the exception
              that names itself.
            */}
            <SplitReveal
              as="h1"
              onLoad
              lines={['The clothes', 'that remember', 'you.']}
              accent={site.hero.titleAccent}
              accentAlternates={site.hero.rotation.map((step) => step.word)}
              accentClassName="text-brand-rose italic"
              delay={0.12}
              className="mt-6 font-display text-[clamp(3.2rem,6.2vw,6.4rem)] leading-[0.92] text-ink-primary"
            />
            {/*
              `onLoad` on both: this copy and the buttons below it are always
              part of the hero, never something the user scrolls to reach, but a
              tall headline can push their scroll-trigger threshold below the
              85%-of-viewport line ScrollTrigger checks - which then only fires
              once the user scrolls, so the CTA sat invisible until they did.
              See the comment on `Reveal` for the measurement that found it.
            */}
            <Reveal onLoad delay={0.45} className="mt-8 max-w-md">
              <p className="text-base text-ink-secondary lg:text-lg">{site.hero.body}</p>
            </Reveal>
            <Reveal onLoad delay={0.6} className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/collections"
                className="inline-flex min-h-12 items-center border border-action-primary bg-action-primary px-7 label-caps text-xs text-action-on-primary transition-colors duration-300 hover:bg-transparent hover:text-action-primary"
              >
                {site.hero.primaryCta}
              </Link>
              <EnquireLink href={whatsappLink(site.enquire.message)} variant="line">
                {site.hero.secondaryCta}
              </EnquireLink>
            </Reveal>
          </div>

          {/*
            Below `lg` this is sized to the photo's own portrait proportions
            (`aspect-[3/4]`), not a fraction of viewport width. The hero shots
            are all ~3:4 portraits; the previous `min-h-[70vw]` gave a short,
            wide box instead (at a 390px phone, roughly 390x273 - landscape),
            so `object-cover` had to blow the image up to fill that width and
            cropped away most of the garment to do it. `lg:aspect-auto` lets
            the desktop layout go back to a plain viewport-height panel, where
            the wider column doesn't have this problem.
          */}
          <div className="relative aspect-[3/4] overflow-hidden bg-surface-inset lg:col-span-6 lg:aspect-auto lg:min-h-[calc(100dvh-8.3125rem)]">
            {/*
              NO PARALLAX HERE, ON PURPOSE. The hero photograph is deliberately
              still: it was tried, it did not earn its keep, and the owner asked
              for it gone. Do not reintroduce it without asking.

              Removing it also removes the reason the image was ever oversized -
              parallax needed the picture to overhang its frame so moving it
              never revealed bare container. With the movement gone there is
              nothing to hide, so the scale goes with it and the photograph is
              shown at its natural crop, which is the least cropped this has
              been.
            */}
            {/*
              THE STACK, IN THE ORDER IT PLAYS. The resting picture is in the
              markup at full opacity and the alternates are parked at zero, so a
              visitor whose JavaScript never runs sees the hero photograph rather
              than an empty panel - and nothing is lost, because the alternates
              are variants of one hero rather than content of their own.

              ONLY THE FIRST IS `priority`. It is the LCP element and it gets the
              preload; the others are ordinary lazy images that the browser
              fetches at its own, lower priority once they are in view, which is
              well inside the 3.6s before the first swap. Marking all three
              priority would put three full-height photographs in a race with
              each other and push LCP out for the sake of a picture nobody has
              looked at yet.

              ONLY THE FIRST CARRIES ALT TEXT, for the same reason it is the one
              that rests: a heading and an image whose accessible names churn on
              a timer are worse than a stable description of the hero the page
              settles on. The alternates keep their real descriptions in
              `content.ts` so the text travels with the image if the order ever
              changes.
            */}
            {[{ image: site.hero.image, imageAlt: site.hero.imageAlt }, ...site.hero.rotation].map(
              (step, index) => (
                <Image
                  key={step.image}
                  data-hero-picture=""
                  src={step.image}
                  alt={index === 0 ? step.imageAlt : ''}
                  fill
                  priority={index === 0}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  // The source file is already a hand-compressed WebP at the owner's
                  // chosen size and quality. Next's image optimizer still resizes it
                  // per viewport (needed, and cheap), but its default quality is 75 -
                  // re-encoding an already-lossy WebP a second time at that setting
                  // is a second, visible compression pass on top of a deliberate
                  // first one. 95 keeps the resizing and drops the second pass below
                  // where it shows. Requires 95 to be listed in `images.qualities` in
                  // next.config.ts; Next 16 silently ignores an unlisted value.
                  quality={95}
                  className={cn('object-cover object-[center_18%]', index > 0 && 'opacity-0')}
                />
              )
            )}

            {/*
              The featured-piece card, laid over the photograph.

              It names a piece that actually exists in `catalog.ts` and links to
              it, so the first product claim on the page is one the site can
              stand behind - and the card is a real link rather than decoration.

              Placed bottom-left because that is the calm side of this
              photograph; the model stands right of centre. Sized in `max-w`
              rather than a fixed width so it cannot overhang the frame on a
              narrow phone.

              `onLoad`: it sits low in the hero image, which put it below
              ScrollTrigger's 85%-of-viewport line at 1440x900 while still being
              inside the fold - same failure as the CTA row below the headline.
            */}
            <Reveal
              onLoad
              delay={0.75}
              className="absolute bottom-6 left-6 z-10 lg:bottom-10 lg:left-10"
            >
              {/*
                One card per slide, stacked. The resting one is in flow and sizes
                the box; the rest are laid over it, so the corner never resizes
                as the quotes change length.

                `invisible`, NOT JUST `opacity-0`, on the parked cards. These are
                real links: at zero opacity alone they stay in the tab order and
                stay clickable, so a keyboard visitor would tab into a card they
                cannot see and a stray click near the corner could open the wrong
                piece. `visibility: hidden` takes them out of the tab order AND
                out of the accessibility tree, and GSAP's `autoAlpha` drives
                opacity and visibility together - which is the whole reason the
                rotation uses `autoAlpha` here and plain opacity on the
                photographs.

                AND THAT IS WHY THERE IS NO `aria-hidden` OR `tabIndex` HERE.
                Both were tried and both are actively wrong: they are static
                server-rendered attributes on an element whose visibility moves
                on a timer, so one swap later the card the visitor can see is
                still the one marked hidden and untabbable, while the card that
                is now invisible is the only one still advertising `tabIndex=0`.
                Visibility already carries both meanings and stays correct on
                every frame; the attributes only get to disagree with it.
              */}
              <div className="relative">
                {[site.hero.featured, ...site.hero.rotation.map((step) => step.featured)].map(
                  (piece, index) => (
                    <Link
                      key={piece.href}
                      data-hero-card=""
                      href={piece.href}
                      className={cn(
                        'group block max-w-[16rem] bg-surface-page/95 p-5 shadow-overlay backdrop-blur-[2px] transition-colors duration-300 hover:bg-surface-page lg:max-w-[19rem] lg:p-6',
                        index > 0 && 'invisible absolute inset-0 opacity-0'
                      )}
                    >
                      <p className="eyebrow text-[0.6rem] text-ink-accent">
                        {site.hero.featured.eyebrow}
                      </p>
                      <p className="mt-2 font-display text-lg leading-snug text-ink-primary italic lg:text-xl">
                        {piece.quote}
                      </p>
                      <span className="mt-3 inline-block text-xs text-ink-secondary transition-colors duration-300 group-hover:text-ink-accent">
                        View the piece →
                      </span>
                    </Link>
                  )
                )}
              </div>
            </Reveal>
          </div>
        </HeroRotation>

        {/*
          THE IDEA - and the section is built out of the idea rather than around
          it, which is the thing to understand before changing anything here.

          `content.ts` says it outright: "Distance is the only thing standing
          between you and it. The house is not introducing anybody to anything -
          it is closing a gap." Two previous versions said that in words and then
          laid it out as a headline with a paragraph beside it, which is a section
          about closing a gap that does not close anything.

          So the section draws it. The two halves of the statement are separated -
          the trust the reader already has at the top left, where the reader is at
          the bottom right - and between them a rule reaches in from either edge of
          the window with a gap in the middle. On scroll the gap closes and the
          house's mark is on the join. The sentence, the composition and the motion
          are one gesture, and the reader gets the argument before they have
          finished reading it.

          THE SPLIT IS THE POINT. Do not close the two lines back up into one
          block to "fix" the space between them - that space is the distance, and
          the section has nothing left to say without it. The `ClosingRule`
          component carries the rest of the reasoning, including why the resting
          state is the closed one.

          NO PHOTOGRAPH, still. Between a full-bleed hero and a six-up grid of
          pictures this is the place the page stops showing you things and says
          one thing. The medallion at the join is a mark, not a picture, and it is
          load-bearing here for the first time: it is what the closing gap
          arrives at.

          THE SECTION IS RULED EDGE TO EDGE. The bronze rule runs the full window,
          and so do the three below it - the argument reads as a ruled manifest
          rather than as a page with boxes on it, which is what an importer's case
          should look like. That is why the beats sit outside the centred measure
          and carry their own padding.
        */}
        <section className="relative overflow-hidden border-t border-line-subtle">
          <div className="mx-auto max-w-[1440px] px-6 pt-24 lg:px-10 lg:pt-36">
            <Reveal>
              <p className="eyebrow text-[0.68rem] text-ink-accent">{site.manifesto.eyebrow}</p>
            </Reveal>

            {/*
              Set in the accent, the same treatment the hero gives the same
              phrase, so the page's two readings of it agree with each other.
              `leading-[1.3]` is looser than the Latin for a real reason: Sinhala
              carries marks above and below the baseline that a display size
              magnifies, and the tight leading display Latin wants would set them
              into each other.

              THE FLOOR IS 1.25rem, NOT 1.6rem, AND THAT IS THE POINT OF HAVING
              ONE. Above 588px the two sizes hold a steady 2:1 because both are
              driven by vw. At the phone end the English hits its own 1.8rem floor
              and stops shrinking, so a 1.6rem floor here closed the gap to
              1.125:1 - near enough to read as a mistake rather than as a step.
            */}
            <Reveal delay={0.1} className="mt-12 lg:mt-16">
              <p className="sinhala text-[clamp(1.25rem,3.4vw,2.75rem)] leading-[1.3] text-ink-accent">
                {site.manifesto.sinhala}
              </p>
            </Reveal>

            {/*
              THE TWO LINES ARE TWO ELEMENTS, NOT ONE MASKED PAIR, because the
              rule goes between them and a heading cannot legally contain a div.
              The first is the section's `h2`; the second is the paragraph that
              completes it. A screen reader gets "The clothes you trust." as the
              heading and "Wherever you are now." as the text under it, which is
              the same order and the same sense as the composition.

              THE FLOOR IS SET BY THE LONGEST AUTHORED LINE, NOT BY TASTE, and it
              has to be re-measured whenever this copy changes. "Wherever you are
              now." wants 331px at 2rem against 312px of column on a 360px phone,
              so it wrapped - and a wrapped line here is not cosmetic: it turns
              two hand-broken lines into three and renders the overflow inside
              the previous line's mask. 1.8rem fits it with 14px to spare.

              Nothing sits beside either line now, so the ceiling is the measure
              itself: at 7vw the longer line runs to 1033px of 1345px at 1440 and
              still clears its column at every width down to 360.
            */}
            <SplitReveal
              lines={[firstLine]}
              delay={0.2}
              className="mt-4 font-display text-[clamp(1.8rem,7vw,6rem)] leading-[1.05] text-ink-primary lg:mt-6"
            />

            {/*
              The gap, and then the gap closed. 16 on a phone rather than the
              desktop's 26/30: the distance still has to read as a pause, but a
              14rem hole between two lines of a sentence on a 360px screen is a
              scroll, not a composition.

              THE DESKTOP MARGINS ARE DELIBERATELY UNEQUAL, and equalising them is
              the change to resist. Line boxes are not ink: line one ends on a
              baseline with descender space under it plus `SplitReveal`'s 0.18em
              mask padding, while line two starts with a cap set below its own box
              top. Symmetric 28/28 margins measured out as 143px of visible cream
              above the rule against 128px below - the rule reads as sitting low
              on a gesture whose whole job is to look suspended exactly between
              the two halves. 26/30 puts the ink gaps within a pixel of each
              other. Re-measure if the type size or the mask padding changes; at
              the phone floor the same correction is under 5px and not worth
              spending a breakpoint on.
            */}
            <ClosingRule className="mt-16 mb-16 lg:mt-26 lg:mb-30">
              <Image
                src="/brand/motif.webp"
                alt=""
                width={1200}
                height={1200}
                quality={95}
                // A flat `136px`, not a `vw` expression with a zero branch. The
                // element is capped at `8.5rem` and the zero-width branch this
                // used to carry made the selection unresolvable, so the browser
                // fell back to the largest variant and pulled the 3840px file
                // for a slot this size.
                //
                // The 3.5rem floor is set against the headline, not against the
                // screen. Below 700px the vw term stops driving this and the
                // floor is what renders; at 4.5rem that left a 72px medallion
                // sitting on the rule beside 28.8px type - two and a half times
                // the size of the sentence it is meant to be punctuating.
                sizes="136px"
                className="h-auto w-[clamp(3.5rem,8vw,8.5rem)]"
              />
            </ClosingRule>

            {/*
              THE ARTWORK'S GROUND IS #FBF6F2, WHICH IS `surface-page` TO WITHIN
              ONE VALUE. That is why a flat opaque rectangle shows no edge on the
              cream, and here it does a second job: it masks the rule it is
              sitting on, so the mark covers the join rather than floating over a
              line that runs straight through it. Both of those stop being true
              the moment this moves onto `surface-panel`, the navy, or any other
              surface - a pale square appears and the rule reappears through it.
              Keep it on the page ground or have the asset re-cut with real
              transparency first.

              Right-aligned from `md` up, where the offset is worth having. On a
              phone the line nearly fills its column, so right-aligning it would
              shift it by single pixels and read as a rounding error.
            */}
            <SplitReveal
              as="p"
              lines={[secondLine]}
              delay={0.1}
              className="font-display text-[clamp(1.8rem,7vw,6rem)] leading-[1.05] text-ink-primary md:text-right"
            />
          </div>

          {/*
            THE ARGUMENT, IN THREE RULED BANDS.

            Rows, not a three-up grid. The beats are consecutive - what the reader
            already knows, what stands in the way, what this house does about it -
            and three equal columns present them as parallel, which is the one
            thing they are not. Stacked, each also gets a measure it can be read
            at instead of a 400px gutter of small grey text.

            The rules run the full window like the bronze one above, and there are
            no cards: a row of bordered boxes is the stock feature grid every site
            ships, and the cream staying continuous is what the rest of this page
            is built out of. That is why the list sits outside the centred measure
            and each row pads its own content back in.

            THE BODY IS CAPPED IN REM, NOT BY ITS COLUMN, and the number was
            measured rather than chosen. Eight columns of a 1440px row run to
            885px - about 105 characters a line, far past the point a reader can
            find the next line reliably. Narrowing the span instead fixed 1440 and
            starved 1024, where a 64px gutter leaves each of twelve columns barely
            20px and the measure falls to 57. A rem cap that sits inside the span
            at every width holds all three rows to the same ~70 characters.

            THE CAP IS TWO VALUES BECAUSE THE TYPE IS. The body steps 16px to 18px
            at `lg`, and the same 36rem that holds 70 characters at 18px holds 79
            at 16px - so the tablet band between 512px and 1024px, the one width
            where the cap binds and the larger type has not arrived yet, gets
            32rem instead. Change one and the other has to move.

            Do not swap this for a `ch` cap. Manrope's zero is much wider than its
            lowercase, so `68ch` measured out at 87 characters here - the unit
            reads like a character count and is not one.

            NO PER-INDEX STAGGER, and that is a change the layout forced rather
            than a preference. When the three sat in one row they entered together
            and 70ms apart said "read these in order". Stacked, each row crosses
            the trigger line on its own scroll, so an index delay stops being a
            stagger and becomes the third row answering its own cue 240ms late.
          */}
          <ul className="mt-24 pb-24 lg:mt-32 lg:pb-36">
            {site.manifesto.beats.map((beat) => (
              <li key={beat.title} className="border-t border-line-subtle">
                <div className="mx-auto max-w-[1440px] px-6 py-8 lg:px-10 lg:py-14">
                  <Reveal className="grid gap-y-4 lg:grid-cols-12 lg:gap-x-16">
                    <h3 className="font-display text-2xl text-balance text-ink-primary lg:col-span-4 lg:text-3xl">
                      {beat.title}
                    </h3>
                    <p className="max-w-[32rem] text-base text-pretty text-ink-secondary lg:col-span-8 lg:col-start-5 lg:max-w-[36rem] lg:text-lg lg:leading-relaxed">
                      {beat.body}
                    </p>
                  </Reveal>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="border-t border-line-subtle bg-surface-panel">
          <div className="mx-auto max-w-[1440px] px-6 py-24 lg:px-10 lg:py-32">
            <Reveal className="max-w-xl">
              <p className="eyebrow text-[0.68rem] text-ink-accent">{site.collections.eyebrow}</p>
              <h2 className="mt-4 font-display text-[clamp(2.2rem,4vw,3.6rem)] text-ink-primary">
                {site.collections.title}
              </h2>
              <p className="mt-4 text-ink-secondary">{site.collections.body}</p>
            </Reveal>

            {/*
              An index, not a hierarchy - six equal doors, because the headline
              promises six ways in and this is the page that has to deliver that.

              WHAT THIS REPLACED, SO NOBODY REBUILDS IT: a lead collection at
              `lg:col-span-7` beside three small thumbnails, then the remaining
              two rendered as bare text links with no photograph at all. Three
              treatments for one set of six, and the grid's `lg:items-end`
              bottom-aligned the short column against the tall image, leaving a
              couple of hundred pixels of empty cream directly under the heading.

              The numeral is doing real work rather than decorating: it counts the
              set the heading names, and it gives each card a fixed first line so
              titles of different lengths still start on the same baseline.

              `Reveal as="ul" stagger` animates the items rather than the block -
              one ScrollTrigger for the whole grid instead of six.
            */}
            <Reveal
              as="ul"
              stagger
              className="mt-16 grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12 lg:mt-20 lg:grid-cols-3 lg:gap-x-8 lg:gap-y-16"
            >
              {collections.map((item, index) => (
                <li key={item.slug}>
                  <Link href={`/collections/${item.slug}`} className="group block">
                    <div className="relative aspect-3/4 overflow-hidden bg-surface-inset">
                      {/* quality={95}: these are already-compressed WebPs, so
                          Next's default of 75 would be a second lossy pass. */}
                      <Image
                        src={item.image}
                        alt={item.imageAlt}
                        fill
                        quality={95}
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 30vw"
                        className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03]"
                      />
                    </div>

                    <div className="mt-5 flex items-baseline gap-2.5">
                      <span className="font-display numeric text-sm text-ink-accent">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="eyebrow text-[0.58rem] text-ink-accent">{item.eyebrow}</p>
                    </div>
                    {/* Two columns on a phone means a ~160px card, so the type
                        steps down with it - a 20px display face and 14px body
                        set that narrow wrap into ragged two-word lines. */}
                    <h3 className="mt-1.5 font-display text-base text-ink-primary transition-colors duration-300 group-hover:text-ink-accent sm:text-lg lg:text-2xl">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-xs text-ink-secondary sm:text-sm">{item.summary}</p>
                  </Link>
                </li>
              ))}
            </Reveal>
          </div>
        </section>

        {/*
          The arrivals rail. `ScrollRail` owns the heading row because the
          prev/next buttons sit on it, opposite the title - they need the same
          ref as the list, so the two cannot be split across components.

          The tile widths are deliberately fractions of the viewport rather than
          a whole one: the sliver of the next tile showing past the right edge is
          what tells the reader there is more, now that the scrollbar is hidden.
        */}
        <section className="border-t border-line-subtle">
          <ScrollRail
            label={site.arrivals.title}
            heading={
              <Reveal className="max-w-xl">
                <p className="eyebrow text-[0.68rem] text-ink-accent">{site.arrivals.eyebrow}</p>
                <h2 className="mt-4 font-display text-[clamp(2.2rem,4vw,3.6rem)] text-ink-primary">
                  {site.arrivals.title}
                </h2>
                <p className="mt-4 text-ink-secondary">{site.arrivals.body}</p>
              </Reveal>
            }
          >
            {arrivals.map((piece) => (
              // The cap is the point of `lg:max-w-[22rem]`. These tiles are 3:4
              // portraits, so a width in `vw` alone keeps growing taller with the
              // monitor - at 1866px wide a tile stood 547px before its caption,
              // which is what stopped the heading, the controls and one whole
              // tile from being on screen together. Capped, it stops at 352px.
              <li
                key={piece.slug}
                className="w-[72vw] shrink-0 snap-start sm:w-[42vw] lg:w-[22vw] lg:max-w-[22rem]"
              >
                <ProductTile piece={piece} />
              </li>
            ))}
          </ScrollRail>
        </section>

        <section className="border-t border-line-subtle bg-surface-page">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-6 py-24 lg:grid-cols-12 lg:gap-x-16 lg:px-10 lg:py-32">
            {/*
              THE INTRO STAYS. This is the one authored motion moment in the
              section, and it is a real device rather than a second entrance
              animation: on `lg` the heading pins while the four pieces travel
              past it, so the reader never loses what they are looking at or why
              it was chosen. Below `lg` it is an ordinary block - a sticky
              element on a phone would just eat the screen.

              `top-36` clears the 133px page chrome with a little air. `self-start`
              is load-bearing: a grid item stretches to the row by default, and a
              sticky element inside a full-height box has nowhere to travel, so
              without it this silently does nothing.
            */}
            <div className="lg:sticky lg:top-36 lg:col-span-4 lg:self-start">
              <Reveal>
                <p className="eyebrow text-[0.68rem] text-ink-accent">{site.selected.eyebrow}</p>
                <h2 className="mt-4 font-display text-[clamp(2.2rem,4vw,3.6rem)] text-ink-primary">
                  {site.selected.title}
                </h2>
                <p className="mt-5 max-w-[34ch] text-ink-secondary">{site.selected.body}</p>
              </Reveal>
            </div>

            {/*
            THE PIECES. A magazine spread, not another grid of tiles.

            The page already has a uniform six-up index above and a horizontal
            rail below; a third evenly-spaced grid of the same card would make
            three sections read as one long list. This is the curated moment -
            four pieces, chosen - so it earns the asymmetry: alternating 4:5 and
            3:4 crops and a half-column drop on the second column, which is what
            stops two images ever aligning into an accidental row.

            It also shows what the shared tile throws away. `fabric` and the
            availability label are already in `catalog.ts` and are exactly the
            two things somebody deciding whether to ask about a piece wants -
            "Batik cotton / Available to enquire" answers the question the photo
            raises. Hence bespoke markup here rather than `ProductTile`, which
            stays the right component for the index and the rail.
          */}
            <ul className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:col-span-8 lg:gap-x-10">
              {selected.map((piece, index) => (
                <li key={piece.slug} className={index % 2 === 1 ? 'sm:mt-16 lg:mt-24' : ''}>
                  {/* 60ms apart: enough to read as a sequence, short enough that
                    the last piece is not still waiting when the eye arrives. */}
                  <Reveal delay={index * 0.06}>
                    <Link href={`/pieces/${piece.slug}`} className="group block">
                      <div
                        className={cn(
                          'relative overflow-hidden bg-surface-inset',
                          index % 2 === 0 ? 'aspect-4/5' : 'aspect-3/4'
                        )}
                      >
                        <Image
                          src={piece.image}
                          alt={piece.imageAlt}
                          fill
                          quality={95}
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03]"
                        />
                      </div>

                      <h3 className="mt-5 font-display text-2xl text-ink-primary transition-colors duration-300 group-hover:text-ink-accent">
                        {piece.title}
                      </h3>
                      <p className="mt-1.5 text-sm text-ink-secondary">{piece.subtitle}</p>

                      {/*
                      The specification line. A hairline rule and two labels
                      pulling apart to the edges - the cloth on the left, what
                      you can do about it on the right. `items-baseline` so the
                      two sit on one optical line despite different colours.
                    */}
                      <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-line-subtle pt-3">
                        <span className="eyebrow text-[0.56rem] text-ink-secondary">
                          {piece.fabric}
                        </span>
                        <span className="eyebrow text-[0.56rem] text-ink-accent">
                          {AVAILABILITY_LABEL[piece.availability]}
                        </span>
                      </div>
                    </Link>
                  </Reveal>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/*
          The house panel. Navy, split, a photograph against three figures.

          Placed here on purpose: everything from the manifesto down to the
          selected pieces is a cream surface, and this is the point in the scroll
          where that run needs breaking. The campaign panels further down are the
          only other dark ground on the page.

          The shape is borrowed from a reference design; the content is not. That
          version was a craft story - artisans, generations, "woven by hand" - and
          this house imports rather than manufactures, so claiming a loom would be
          a lie told in a nice typeface. See the `house` block in content.ts.
        */}
        <section className="border-t border-line-subtle bg-surface-sidebar text-ink-on-sidebar">
          <div className="grid lg:grid-cols-12">
            <div className="relative aspect-4/3 lg:col-span-5 lg:aspect-auto lg:min-h-[34rem]">
              <Image
                src={site.house.image}
                alt={site.house.imageAlt}
                fill
                quality={95}
                sizes="(max-width: 1024px) 100vw, 42vw"
                className="object-cover"
              />
              {/*
                The hairline frame inset from the photograph's edge - the one
                piece of the reference's decoration worth keeping. It sat over a
                flat gradient there because there was no photograph; here it
                frames a real one. Decorative, so it is hidden from the
                accessibility tree.
              */}
              <div
                aria-hidden="true"
                /*
                  `rgb(232 185 175 / 0.35)` written out rather than
                  `border-brand-blush/35`, which is the same colour by value -
                  232,185,175 IS `--brand-blush` - but not the same pixel:
                  Tailwind 4 converts an opacity modifier to `oklab(... / .35)`,
                  and a translucent colour declared in oklab composites over the
                  photograph slightly differently from one declared in sRGB. The
                  reference stylesheet specifies `rgba(232,185,175,.35)`, so this
                  matches it exactly.
                */
                className="absolute inset-6 border border-[rgb(232_185_175_/_0.35)] lg:inset-10"
              />
            </div>

            <div className="flex flex-col justify-center px-6 py-20 lg:col-span-7 lg:px-16 lg:py-28">
              <Reveal>
                <p className="eyebrow text-[0.68rem] text-brand-blush">{site.house.eyebrow}</p>
              </Reveal>
              <SplitReveal
                lines={[...site.house.titleLines]}
                delay={0.1}
                className="mt-5 max-w-xl font-display text-[clamp(2rem,4vw,3.2rem)] leading-[1.08]"
              />
              <Reveal delay={0.25} className="mt-7 max-w-xl">
                <p className="text-ink-on-sidebar-muted">{site.house.body}</p>
              </Reveal>

              <Reveal delay={0.4} className="mt-14">
                {/*
                  A three-column grid rather than a wrapping flex row. These
                  labels are sentences, not words - "Pieces in the current edit"
                  alone is 143px - so on a 360px phone a flex row broke 2 + 1 and
                  read as a mistake. Fixed columns keep the three figures on one
                  line at every width and let the labels below them wrap instead,
                  which is the part that can afford to.
                */}
                <ul className="grid max-w-xl grid-cols-3 gap-x-5 sm:gap-x-10">
                  {houseFigures.map((figure) => (
                    <li key={figure.label}>
                      {/*
                        Brand rose on this navy measures 4.38:1 (scripts/contrast.mjs),
                        comfortably past the 3:1 WCAG allows for large text - and
                        these figures are ~2rem at their smallest. It is also the
                        accent the hero headline uses, so the page keeps one accent
                        rather than introducing a second.
                      */}
                      <p className="font-display text-[clamp(1.75rem,3.4vw,2.8rem)] leading-none text-brand-rose">
                        {figure.value}
                      </p>
                      <p className="mt-2 text-xs text-ink-on-sidebar-muted">{figure.label}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {featured ? (
          <section className="border-t border-line-subtle">
            <div className="mx-auto max-w-[1440px] px-6 py-24 lg:px-10 lg:py-32">
              <Reveal className="max-w-xl">
                <p className="eyebrow text-[0.68rem] text-ink-accent">{site.journal.eyebrow}</p>
                <h2 className="mt-4 font-display text-[clamp(2.2rem,4vw,3.6rem)] text-ink-primary">
                  {site.journal.title}
                </h2>
                <p className="mt-4 text-ink-secondary">{site.journal.body}</p>
              </Reveal>

              <div className="mt-16 grid gap-12 lg:grid-cols-12">
                <Link href={`/journal/${featured.slug}`} className="group lg:col-span-7">
                  <div className="relative aspect-4/3 overflow-hidden bg-surface-inset">
                    <Image
                      src={featured.image}
                      alt={featured.imageAlt}
                      fill
                      quality={95}
                      sizes="(max-width: 1024px) 100vw, 58vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="mt-5 eyebrow text-[0.62rem] text-ink-accent">{featured.eyebrow}</p>
                  <h3 className="mt-2 font-display text-3xl text-ink-primary">{featured.title}</h3>
                  <p className="mt-3 max-w-md text-sm text-ink-secondary">{featured.dek}</p>
                </Link>

                <div className="flex flex-col justify-between gap-10 lg:col-span-5">
                  {otherStories.map((story) => (
                    <Link
                      key={story.slug}
                      href={`/journal/${story.slug}`}
                      className="border-t border-line-subtle pt-6"
                    >
                      <p className="eyebrow text-[0.62rem] text-ink-accent">{story.eyebrow}</p>
                      <h3 className="mt-2 font-display text-2xl text-ink-primary">{story.title}</h3>
                      <p className="mt-2 text-sm text-ink-secondary">{story.dek}</p>
                    </Link>
                  ))}
                  <Link
                    href="/journal"
                    className="eyebrow text-[0.68rem] text-ink-primary underline-offset-4 hover:underline"
                  >
                    All notes
                  </Link>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/*
          One list rather than two loops, because the grid has to reason about
          the total. A two-column grid with an odd number of panels leaves a
          literal hole in the page - three offers rendered as 2 + 1 and the
          fourth cell sat there empty. Rather than rely on the count always
          being even, the last panel spans the full width whenever it is odd, so
          the section stays whole no matter how many campaigns the data holds.

          Two columns from `md` rather than `lg`: at tablet width the old
          single column made these 448px-tall panels an extremely long scroll.
        */}
        <section className="border-t border-line-subtle">
          <div className="grid md:grid-cols-2">
            {campaignPanels.map((campaign, index) => (
              <CampaignPanel
                key={campaign.slug}
                campaign={campaign}
                invert={campaign.kind === 'seasonal'}
                className={
                  campaignPanels.length % 2 === 1 && index === campaignPanels.length - 1
                    ? 'md:col-span-2'
                    : undefined
                }
              />
            ))}
          </div>
        </section>

        <section id="enquire" className="bg-brand-blush">
          <Reveal className="mx-auto max-w-2xl px-6 py-24 text-center lg:py-32">
            <p className="eyebrow text-[0.68rem] text-[#8a4d45]">{site.close.eyebrow}</p>
            <h2 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.8rem)] text-brand-navy">
              {site.close.title}
            </h2>
            <p className="mx-auto mt-6 max-w-lg text-brand-navy/80">{site.close.body}</p>
            <EnquireLink
              href={whatsappLink(site.enquire.message)}
              className="mt-10 border-brand-navy bg-brand-navy text-brand-ivory hover:bg-transparent hover:text-brand-navy"
            >
              {site.close.cta}
            </EnquireLink>
            <p className="mt-6 text-xs text-brand-navy/70">{site.close.note}</p>
          </Reveal>
        </section>
      </main>
    </SiteShell>
  );
}
