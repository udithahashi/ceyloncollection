import Image from 'next/image';
import { ArrowRight, MessageCircle } from 'lucide-react';

import { site, whatsappLink } from '@/features/site/content';
import { HeroMotion } from '@/features/site/components/hero-motion';
import { Marquee } from '@/features/site/components/marquee';
import { Reveal } from '@/features/site/components/reveal';
import { SiteFooter } from '@/features/site/components/site-footer';
import { SiteHeader } from '@/features/site/components/site-header';

/**
 * The public homepage.
 *
 * A Server Component that ships no JavaScript of its own; the four small client
 * components it uses (`HeroMotion`, `Marquee`, `Reveal`) exist only to carry
 * GSAP, and everything else - text, images, links - is rendered on the server and
 * readable with scripting disabled.
 *
 * The design follows `reference/public-website.html`. The copy deliberately does
 * not: that file was written for a Colombo boutique selling finished stock in LKR,
 * and this business sources to order for Qatar. See `features/site/content.ts`.
 *
 * There is no basket, no price and no checkout, and that is the design rather
 * than an unfinished piece of one. Every call to action opens WhatsApp, because
 * a conversation is the actual product here and it lands in the leads system.
 */
export default function HomePage() {
  const { hero, collections, how, craft, enquire } = site;

  return (
    <>
      <p className="bg-surface-sidebar px-4 py-2.5 text-center label-caps text-[0.7rem] text-brand-blush">
        {site.announcement}
      </p>

      <SiteHeader />

      <main className="flex-1">
        {/* ---------------------------------------------------------- hero */}
        <section className="mx-auto grid max-w-[1180px] items-center gap-10 px-6 py-16 lg:grid-cols-[1.05fr_.95fr] lg:gap-16 lg:px-10 lg:py-24">
          <HeroMotion>
            <div className="flex flex-col items-start">
              <p data-hero className="eyebrow text-xs text-ink-accent">
                {hero.eyebrow}
              </p>

              <h1
                data-hero
                className="mt-5 max-w-xl text-[clamp(2.5rem,6vw,4.2rem)] text-ink-primary"
              >
                {hero.titleBefore} <em className="text-brand-rose italic">{hero.titleEmphasis}</em>
                {hero.titleAfter}
              </h1>

              <p data-hero className="mt-6 max-w-md text-base text-ink-secondary">
                {hero.body}
              </p>

              <div data-hero className="mt-9 flex flex-wrap gap-4">
                <a
                  href={whatsappLink(hero.whatsappMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 border border-action-primary bg-action-primary px-8 label-caps text-xs text-action-on-primary transition-colors duration-250 hover:bg-transparent hover:text-action-primary"
                >
                  <MessageCircle aria-hidden="true" className="size-4" />
                  {hero.primaryCta}
                </a>

                <a
                  href="#collections"
                  className="inline-flex min-h-11 items-center gap-2 border border-action-secondary-line px-8 label-caps text-xs text-action-on-secondary transition-colors duration-250 hover:bg-action-primary hover:text-action-on-primary"
                >
                  {hero.secondaryCta}
                </a>
              </div>
            </div>

            <div data-hero-image className="relative">
              <Image
                src="/brand/hero.webp"
                alt={hero.imageAlt}
                width={1200}
                height={1490}
                // The only image above the fold, so it is the one worth
                // preloading rather than lazy-loading.
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="h-full w-full object-cover"
              />

              <figcaption className="absolute bottom-6 left-6 max-w-[15rem] bg-surface-page px-6 py-5 shadow-overlay">
                <span className="eyebrow text-[0.62rem] text-ink-accent">Featured weave</span>
                <p className="mt-2 font-display text-lg text-ink-primary italic">{hero.caption}</p>
              </figcaption>
            </div>
          </HeroMotion>
        </section>

        <Marquee items={site.marquee} />

        {/* --------------------------------------------------- collections */}
        <section id="collections" className="mx-auto max-w-[1180px] px-6 py-20 lg:px-10 lg:py-28">
          <Reveal className="mx-auto mb-14 max-w-xl text-center">
            <p className="eyebrow text-xs text-ink-accent">{collections.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.6rem)] text-ink-primary">
              {collections.title}
            </h2>
            <p className="mt-4 text-ink-secondary">{collections.body}</p>
          </Reveal>

          <Reveal stagger className="grid gap-7 md:grid-cols-3">
            {collections.items.map((item) => (
              <article key={item.slug} className="group flex flex-col bg-surface-panel">
                <div className="relative aspect-4/5 overflow-hidden">
                  <Image
                    src={item.image}
                    alt={item.imageAlt}
                    width={900}
                    height={1117}
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </div>

                <div className="flex flex-1 flex-col p-7">
                  <p className="eyebrow text-[0.62rem] text-ink-accent">{item.eyebrow}</p>
                  <h3 className="mt-2 text-2xl text-ink-primary">{item.title}</h3>
                  <p className="mt-3 flex-1 text-sm text-ink-secondary">{item.body}</p>

                  {/* The rule sits on an inner span so it hugs the text, while
                      the anchor itself is a 44px tap target. Padding the anchor
                      directly would drop the underline well below the words. */}
                  <a
                    href={whatsappLink(item.whatsappMessage)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center self-start text-sm text-ink-accent transition-colors duration-200 hover:text-ink-primary"
                  >
                    <span className="inline-flex items-center gap-2 border-b border-brand-gold pb-1">
                      Ask about {item.title.toLowerCase()}
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </span>
                  </a>
                </div>
              </article>
            ))}
          </Reveal>
        </section>

        {/* ---------------------------------------------------- how it works */}
        <section id="how" className="bg-surface-panel">
          <div className="mx-auto max-w-[1180px] px-6 py-20 lg:px-10 lg:py-28">
            <Reveal className="mx-auto mb-14 max-w-xl text-center">
              <p className="eyebrow text-xs text-ink-accent">{how.eyebrow}</p>
              <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.6rem)] text-ink-primary">{how.title}</h2>
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
          </div>
        </section>

        {/* --------------------------------------------------------- craft */}
        <section id="craft" className="grid bg-surface-sidebar lg:grid-cols-[.9fr_1.1fr]">
          <div className="relative min-h-[22rem] lg:min-h-[34rem]">
            <Image
              src="/brand/loom.webp"
              alt={craft.imageAlt}
              width={1600}
              height={1195}
              sizes="(max-width: 1024px) 100vw, 45vw"
              className="h-full w-full object-cover"
            />
          </div>

          <Reveal className="flex flex-col justify-center px-6 py-16 lg:px-16 lg:py-24">
            <p className="eyebrow text-xs text-brand-blush">{craft.eyebrow}</p>
            <h2 className="mt-4 max-w-lg text-[clamp(1.9rem,4vw,2.6rem)] text-ink-on-sidebar">
              {craft.title}
            </h2>
            <p className="mt-6 max-w-lg text-ink-on-sidebar-muted">{craft.body}</p>

            <dl className="mt-11 flex flex-wrap gap-x-12 gap-y-6">
              {craft.stats.map((stat) => (
                // `flex-col-reverse` so the value reads above its label visually,
                // while the markup keeps `dt` before `dd` as a definition list
                // requires. Rendering the label twice - once visually and once
                // sr-only - would make a screen reader announce it twice.
                <div key={stat.label} className="flex flex-col-reverse">
                  <dt className="mt-1 text-xs text-ink-on-sidebar-muted">{stat.label}</dt>
                  <dd className="font-display text-2xl text-brand-gold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </section>

        {/* ------------------------------------------------------- enquire */}
        <section id="enquire" className="bg-brand-blush">
          <Reveal className="mx-auto max-w-2xl px-6 py-20 text-center lg:py-28">
            <p className="eyebrow text-xs text-[#8a4d45]">{enquire.eyebrow}</p>
            <h2 className="mt-4 text-[clamp(1.9rem,4vw,2.6rem)] text-brand-navy">
              {enquire.title}
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-brand-navy/80">{enquire.body}</p>

            <a
              href={whatsappLink(enquire.whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-9 inline-flex min-h-11 items-center gap-2 border border-brand-navy bg-brand-navy px-9 label-caps text-xs text-brand-ivory transition-colors duration-250 hover:bg-transparent hover:text-brand-navy"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              {enquire.cta}
            </a>

            <p className="mt-5 text-xs text-brand-navy/70">{enquire.note}</p>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
