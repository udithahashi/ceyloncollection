import Image from 'next/image';
import { connection } from 'next/server';
import { ArrowRight, Heart, MessageCircle, Scissors, Truck } from 'lucide-react';

import { site, whatsappLink } from '@/features/site/content';
import { Marquee } from '@/features/site/components/marquee';
import { Offers } from '@/features/site/components/offers';
import { Parallax } from '@/features/site/components/parallax';
import { Reveal } from '@/features/site/components/reveal';
import { ScrollProgress } from '@/features/site/components/scroll-progress';
import { SiteFooter } from '@/features/site/components/site-footer';
import { SiteHeader } from '@/features/site/components/site-header';
import { SmoothScroll } from '@/features/site/components/smooth-scroll';
import { SplitReveal } from '@/features/site/components/split-reveal';

/**
 * The public homepage.
 *
 * A Server Component. Every image, every word and every link is rendered on the
 * server; the client components it uses exist only to carry motion, and the page
 * is complete and readable without any of them.
 *
 * WHAT IT SELLS: batik frocks, flower frocks, sarongs. Not sarees - the business
 * does not sell them, and an earlier revision of this page advertised them by
 * mistake. See `features/site/content.ts`.
 *
 * WHAT IT IS NOT: a shop. No basket, no price, no checkout, because there is no
 * product or stock schema behind it. Every call to action opens WhatsApp, which
 * is the real product here - a conversation that lands in the leads system.
 *
 * Section order is deliberate: what it is (hero) → why trust it (benefits) → why
 * it exists (statement) → what you can get (collections, lookbook) → why it is
 * good (craft) → how to get it (how) → why now (offers) → ask (enquire).
 */
export default async function HomePage() {
  /*
   * WHY A MARKETING PAGE IS DELIBERATELY NOT STATIC.
   *
   * This is the one route in the application that looks like it should be
   * prerendered, and for a while it was. It is also the change that silently
   * broke it in production - a development server cannot show you this.
   *
   * `src/proxy.ts` issues a fresh CSP nonce per request, and Next stamps that
   * nonce onto every script and style tag it emits. A prerendered page is built
   * once, at build time, when there is no request and therefore no nonce, so its
   * HTML ships with none - while the proxy still sends a nonce-and-
   * `strict-dynamic` policy at runtime. The browser then refuses every script on
   * the page. Measured on a real production build: 28 script tags, zero nonces,
   * all blocked; the dynamic `/login` had 20 tags and 20 nonces and was fine.
   *
   * The visible result is not "no animation". It is a homepage that never
   * hydrates: no GSAP, no smooth scroll, and a mobile menu button that does
   * nothing at all.
   *
   * `connection()` is what Next 16 documents for this - it waits for an incoming
   * request, which is what makes the render dynamic and the nonce available.
   * `export const dynamic = 'force-dynamic'` is NOT sufficient here: the route
   * still reported `x-nextjs-prerender: 1` and served a cached shell with no
   * nonces. Do not swap this back.
   */
  await connection();

  const { hero, benefits, statement, collections, lookbook, craft, how, offers, enquire } = site;

  const benefitIcons = { truck: Truck, scissors: Scissors, heart: Heart } as const;

  return (
    <>
      <ScrollProgress />
      <SmoothScroll />
      <SiteHeader />

      <main className="flex-1">
        {/* ------------------------------------------------------------ hero */}
        <section className="relative isolate flex min-h-[100svh] items-end overflow-hidden">
          <Parallax strength={6} className="absolute inset-0 -z-10">
            <Image
              src="/brand/hero.webp"
              alt={hero.imageAlt}
              fill
              // The only image above the fold, so the only one worth preloading.
              priority
              sizes="100vw"
              // `scale-110` gives the parallax somewhere to travel without
              // exposing the edge of the image at either end of the movement.
              className="scale-110 object-cover object-right"
            />
          </Parallax>

          {/* Readability wash. The hero photograph is a pale cream wall on the
              left, and ivory type on it would vanish without this. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-gradient-to-r from-surface-page via-surface-page/85 to-transparent"
          />

          <div className="mx-auto w-full max-w-[1240px] px-6 pt-32 pb-20 lg:px-10 lg:pb-28">
            <Reveal className="max-w-2xl">
              <p className="eyebrow text-xs text-ink-accent">{hero.eyebrow}</p>
            </Reveal>

            <SplitReveal
              as="h1"
              lines={[hero.titleBefore, `${hero.titleEmphasis} ${hero.titleAfter}`]}
              delay={0.15}
              className="mt-6 max-w-3xl text-[clamp(2.75rem,8vw,6rem)] leading-[1.02] text-ink-primary"
            />

            <Reveal delay={0.5} className="mt-8 max-w-lg">
              <p className="text-base text-ink-secondary lg:text-lg">{hero.body}</p>
            </Reveal>

            <Reveal delay={0.65} className="mt-10 flex flex-wrap gap-4">
              <a
                href={whatsappLink(hero.whatsappMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 border border-action-primary bg-action-primary px-8 label-caps text-xs text-action-on-primary transition-colors duration-250 hover:bg-transparent hover:text-action-primary"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                {hero.primaryCta}
              </a>

              <a
                href="#collections"
                className="inline-flex min-h-12 items-center gap-2 border border-action-secondary-line px-8 label-caps text-xs text-action-on-secondary transition-colors duration-250 hover:bg-action-primary hover:text-action-on-primary"
              >
                {hero.secondaryCta}
              </a>
            </Reveal>
          </div>
        </section>

        <Marquee items={site.marquee} />

        {/* -------------------------------------------------------- benefits */}
        <section aria-label="What you get" className="border-b border-line-subtle">
          <Reveal
            stagger
            className="mx-auto grid max-w-[1240px] gap-10 px-6 py-14 md:grid-cols-3 lg:px-10"
          >
            {benefits.map((benefit) => {
              const Icon = benefitIcons[benefit.icon];
              return (
                <div key={benefit.title} className="flex gap-4">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-gold" />
                  <div>
                    <h2 className="font-display text-lg text-ink-primary">{benefit.title}</h2>
                    <p className="mt-1 text-sm text-ink-secondary">{benefit.body}</p>
                  </div>
                </div>
              );
            })}
          </Reveal>
        </section>

        {/* ------------------------------------------------------- statement */}
        <section className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-36">
          <Reveal>
            <p className="eyebrow text-xs text-ink-accent">{statement.eyebrow}</p>
          </Reveal>

          <SplitReveal
            lines={statement.lines}
            className="mt-8 max-w-4xl font-display text-[clamp(1.9rem,5vw,3.5rem)] leading-[1.15] text-ink-primary"
          />

          <Reveal delay={0.3} className="mt-10 max-w-md">
            <p className="text-ink-secondary">{statement.body}</p>
          </Reveal>
        </section>

        {/* ----------------------------------------------------- collections */}
        <section id="collections" className="bg-surface-panel">
          <div className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32">
            <Reveal className="mb-16 max-w-xl">
              <p className="eyebrow text-xs text-ink-accent">{collections.eyebrow}</p>
              <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.8rem)] text-ink-primary">
                {collections.title}
              </h2>
              <p className="mt-4 text-ink-secondary">{collections.body}</p>
            </Reveal>

            <div className="grid gap-x-8 gap-y-16 md:grid-cols-3">
              {collections.items.map((item, index) => (
                <Reveal
                  key={item.slug}
                  delay={index * 0.1}
                  // Staggered vertical offsets turn three equal cards into a
                  // composition. Flat on mobile, where there is one column and
                  // the offset would just look like inconsistent spacing.
                  className={cnColumn(index)}
                >
                  <article className="group flex flex-col">
                    <div className="relative aspect-3/4 overflow-hidden bg-surface-inset">
                      <Parallax strength={5} className="absolute inset-0">
                        <Image
                          src={item.image}
                          alt={item.imageAlt}
                          fill
                          sizes="(max-width: 768px) 100vw, 33vw"
                          className="scale-110 object-cover transition-transform duration-700 ease-out group-hover:scale-[1.16]"
                        />
                      </Parallax>
                    </div>

                    <div className="flex flex-1 flex-col pt-6">
                      <div className="flex items-baseline gap-3">
                        <span className="font-display numeric text-sm text-brand-gold">
                          {item.index}
                        </span>
                        <p className="eyebrow text-[0.62rem] text-ink-accent">{item.eyebrow}</p>
                      </div>

                      <h3 className="mt-2 text-2xl text-ink-primary">{item.title}</h3>
                      <p className="mt-3 flex-1 text-sm text-ink-secondary">{item.body}</p>

                      <a
                        href={whatsappLink(item.whatsappMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex min-h-11 items-center self-start text-sm text-ink-accent transition-colors duration-200 hover:text-ink-primary"
                      >
                        <span className="inline-flex items-center gap-2 border-b border-brand-gold pb-1">
                          Ask about {item.title.toLowerCase()}
                          <ArrowRight aria-hidden="true" className="size-4" />
                        </span>
                      </a>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- lookbook */}
        <section className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32">
          <Reveal className="mb-14 max-w-xl">
            <p className="eyebrow text-xs text-ink-accent">{lookbook.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.8rem)] text-ink-primary">
              {lookbook.title}
            </h2>
            <p className="mt-4 text-ink-secondary">{lookbook.body}</p>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-3">
            {lookbook.items.map((item, index) => (
              <Reveal key={item.image} delay={index * 0.12}>
                <figure className="group">
                  <div className="relative aspect-3/4 overflow-hidden bg-surface-inset">
                    <Parallax strength={7} className="absolute inset-0">
                      <Image
                        src={item.image}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="scale-110 object-cover"
                      />
                    </Parallax>
                  </div>
                  <figcaption className="mt-4 eyebrow text-[0.62rem] text-ink-secondary">
                    {item.caption}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-12">
            <a
              href={whatsappLink(lookbook.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center gap-2 border border-action-secondary-line px-8 label-caps text-xs text-action-on-secondary transition-colors duration-250 hover:bg-action-primary hover:text-action-on-primary"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              {lookbook.cta}
            </a>
          </Reveal>
        </section>

        {/* ----------------------------------------------------------- craft */}
        <section id="craft" className="bg-surface-sidebar text-ink-on-sidebar">
          <div className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32">
            <Reveal className="max-w-2xl">
              <p className="eyebrow text-xs text-brand-blush">{craft.eyebrow}</p>
              <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.8rem)] text-ink-on-sidebar">
                {craft.title}
              </h2>
              <p className="mt-6 text-ink-on-sidebar-muted">{craft.body}</p>
            </Reveal>

            <div className="mt-16 grid gap-10 md:grid-cols-3">
              {craft.steps.map((step, index) => (
                <Reveal key={step.number} delay={index * 0.1}>
                  <div className="relative aspect-4/3 overflow-hidden">
                    <Parallax strength={6} className="absolute inset-0">
                      <Image
                        src={step.image}
                        alt={step.imageAlt}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="scale-110 object-cover"
                      />
                    </Parallax>
                  </div>

                  <p className="mt-6 font-display numeric text-2xl text-brand-gold">
                    {step.number}
                  </p>
                  <h3 className="mt-1 text-xl text-ink-on-sidebar">{step.title}</h3>
                  <p className="mt-2 text-sm text-ink-on-sidebar-muted">{step.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- how it works */}
        <section id="how" className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32">
          <Reveal className="mb-16 max-w-xl">
            <p className="eyebrow text-xs text-ink-accent">{how.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.8rem)] text-ink-primary">{how.title}</h2>
            <p className="mt-4 text-ink-secondary">{how.body}</p>
          </Reveal>

          <Reveal stagger className="grid gap-10 md:grid-cols-3">
            {how.steps.map((step) => (
              <div key={step.number} className="border-t border-line-subtle pt-6">
                <p className="font-display numeric text-3xl text-brand-gold">{step.number}</p>
                <h3 className="mt-3 text-xl text-ink-primary">{step.title}</h3>
                <p className="mt-3 text-sm text-ink-secondary">{step.body}</p>
              </div>
            ))}
          </Reveal>
        </section>

        {/* ---------------------------------------------------------- offers */}
        <section id="offers" className="bg-surface-panel">
          <div className="mx-auto max-w-[1240px] px-6 py-24 lg:px-10 lg:py-32">
            <Reveal className="mb-14 max-w-xl">
              <p className="eyebrow text-xs text-ink-accent">{offers.eyebrow}</p>
              <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.8rem)] text-ink-primary">
                {offers.title}
              </h2>
              <p className="mt-4 text-ink-secondary">{offers.body}</p>
            </Reveal>

            <Reveal>
              <Offers />
            </Reveal>
          </div>
        </section>

        {/* --------------------------------------------------------- enquire */}
        <section id="enquire" className="bg-brand-blush">
          <Reveal className="mx-auto max-w-2xl px-6 py-24 text-center lg:py-32">
            <p className="eyebrow text-xs text-[#8a4d45]">{enquire.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(2rem,5vw,3.25rem)] text-brand-navy">{enquire.title}</h2>
            <p className="mx-auto mt-6 max-w-lg text-brand-navy/80">{enquire.body}</p>

            <a
              href={whatsappLink(enquire.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex min-h-12 items-center gap-2 border border-brand-navy bg-brand-navy px-10 label-caps text-xs text-brand-ivory transition-colors duration-250 hover:bg-transparent hover:text-brand-navy"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              {enquire.cta}
            </a>

            <p className="mt-6 text-xs text-brand-navy/70">{enquire.note}</p>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}

/**
 * Vertical offset for the collection cards, so three equal columns read as a
 * composition rather than a row. Only from `md` up - on one column an offset is
 * indistinguishable from a spacing bug.
 */
function cnColumn(index: number): string {
  if (index === 1) return 'md:mt-16';
  if (index === 2) return 'md:mt-8';
  return '';
}
