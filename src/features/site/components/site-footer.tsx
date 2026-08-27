import Link from 'next/link';

import { BrandMark } from '@/components/layout/brand-mark';
import { businessDate } from '@/lib/time';

import { site, whatsappLink } from '../content';

import { EnquireLink } from './enquire-link';
import { LogoMark } from './logo-mark';
import { SocialLinks } from './social-links';

/**
 * The site footer.
 *
 * WHAT IT IS FOR. The footer is where someone goes with a question the page did
 * not answer: how ordering works, what happens if a piece is wrong, what this
 * house does with a phone number. It is the only part of the site with that job,
 * so completeness matters here more than composition - and the previous version
 * had five links of which three were unique, no policies at all, and no year.
 *
 * A SERVER COMPONENT, DELIBERATELY. Nothing here is interactive, so nothing here
 * ships JavaScript, and that is what lets the copyright year come from
 * `@/lib/time` - which is `server-only`. Adding `'use client'` to this file, or
 * importing it from a client component, breaks the build rather than failing
 * quietly. If this ever needs interactivity, extract the interactive part.
 */
export function SiteFooter() {
  /*
    THE YEAR IS QATAR'S, NOT THE SERVER'S. `businessDate` converts to the
    business timezone before taking the calendar date, which is the house rule
    for anything a person reads (see AGENTS.md). It matters exactly once a year:
    a container running UTC would show the old year for the first three hours of
    January in Doha. Cheap to get right, invisible when it is, and a wrong
    copyright year is the kind of small wrongness that makes a site look
    abandoned.
  */
  const year = businessDate(new Date()).slice(0, 4);

  return (
    <footer className="border-t border-line-subtle bg-surface-page">
      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-10 lg:py-24">
        <div className="grid gap-14 lg:grid-cols-12 lg:gap-x-16">
          {/*
            The house, on four columns. It is the only block here with a voice;
            everything to its right is apparatus, which is why the directory gets
            twice the width and half the weight.
          */}
          <div className="lg:col-span-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <LogoMark />
              <BrandMark />
            </Link>

            {/*
              THE THIRD AND LAST TIME THE PAGE SAYS අපේ කම, and it is set the way
              the other two are: display size, in the accent. The hero opens with
              it small, the manifesto makes it the argument, and the footer signs
              off with it. Three appearances in one colour reads as a refrain;
              three appearances in three treatments reads as three accidents.
            */}
            <p className="mt-10 sinhala text-[clamp(1.75rem,3vw,2.5rem)] leading-[1.3] text-ink-accent">
              {site.footer.sinhala}
            </p>
            <p className="mt-3 max-w-sm text-base text-ink-secondary">{site.footer.line}</p>

            <EnquireLink href={whatsappLink(site.enquire.message)} className="mt-8">
              {site.enquire.label}
            </EnquireLink>

            {/*
              The footer is where people go looking for these, and it is the only
              placement that reaches a phone - the strip above the header hides
              them below `sm`. `-ml-3` pulls the first 44px hit area back so the
              mark inside it lines up with the column's text edge rather than
              sitting three pixels proud of it.
            */}
            <div className="mt-12 border-t border-line-subtle pt-8">
              <p className="eyebrow text-[0.62rem] text-ink-accent">{site.footer.social}</p>
              <SocialLinks className="mt-3 -ml-3" />
            </div>
          </div>

          {/*
            The directory. `sm:grid-cols-3` rather than a stack: three short lists
            side by side are scanned in one movement, where three stacked lists on
            a tablet make the reader travel the height of the viewport to find
            out that `Legal` exists.
          */}
          <nav
            aria-label="Footer"
            className="grid gap-10 sm:grid-cols-3 lg:col-span-7 lg:col-start-6 lg:gap-x-12"
          >
            {site.footer.columns.map((column) => (
              <div key={column.title}>
                <p className="eyebrow text-[0.62rem] text-ink-accent">{column.title}</p>
                <ul className="mt-5 flex flex-col items-start gap-1.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <FooterLink href={link.href}>{link.label}</FooterLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/*
        The legal bar. Three facts, no navigation except the way back up: who owns
        the page, what year it is, and where the business runs between.
      */}
      <div className="border-t border-line-subtle">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-3 px-6 py-6 text-xs text-ink-secondary sm:flex-row sm:items-center sm:justify-between lg:px-10">
          <p>
            © {year} Ceylon Collection. {site.footer.legal}
          </p>
          <div className="flex items-center gap-5">
            <p className="label-caps text-[0.6rem] text-ink-secondary">{site.footer.region}</p>
            {/*
              `#top` needs no element to point at - browsers treat it as the top
              of the document - so this costs one anchor and no JavaScript. The
              page already sets `scroll-behavior: smooth`, and a visitor who asked
              for reduced motion has that honoured by the browser rather than by
              us.
            */}
            <a
              href="#top"
              className="transition-colors duration-200 hover:text-ink-accent focus-visible:text-ink-accent"
            >
              {site.footer.backToTop}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/**
 * One directory entry.
 *
 * THE RULE GROWS FROM THE LEFT, and it is a transform rather than an underline
 * appearing. `text-decoration` cannot be animated, so a hover underline either
 * pops in or does not move at all; a 1px pseudo-element scaled on X does the
 * same job on the compositor and gives the link a direction - it reads as
 * something being drawn rather than switched on. `origin-left` is what makes it
 * read that way; from the centre it looks like a progress bar.
 *
 * 200ms and `ease-out`. A footer link is hovered in passing, so the feedback has
 * to be immediate - `ease-out` puts most of the movement in the first half,
 * where the eye is. Anything past 250ms here starts to feel like the page is
 * thinking about it.
 *
 * `hover:` in Tailwind v4 already carries `@media (hover: hover)`, so a tap on a
 * phone does not leave a rule stuck under the last link touched.
 *
 * `motion-reduce` keeps the rule and drops the movement, which is the point of
 * reduced motion - fewer and gentler animations, not a stripped interface.
 *
 * `py-1` IS A TAP TARGET, NOT SPACING. At 14px the text box is 20px tall, which
 * is under the 24px minimum a pointer target is meant to meet - and this footer
 * is the ONLY place the social row and these links reach a phone at all, so it
 * is the last place to be stingy about it. The padding takes each link to 28px
 * and the list gap comes down to match, so the column is no taller than before
 * and every entry is easier to hit. `after:bottom-0.5` rather than
 * `-bottom-0.5` for the same reason: the rule has to stay against the text now
 * that the box is bigger than the text, or it drifts away from the word it
 * belongs to.
 */
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  /*
    INTERNAL IS DECIDED FROM THE HREF, not from a flag the caller passes and not
    from a literal comparison. The footer used to special-case `#enquire` and
    test for `http`; TypeScript proved that branch unreachable the moment the
    last external entry left the directory, which is a good sign it was carrying
    knowledge that belonged here instead. A leading slash is a route and takes
    `next/link` for client navigation; anything else - an absolute URL, a
    `wa.me` link, a `mailto:`, a fragment - is a plain anchor, and adding one to
    `content.ts` now needs no change in this file.
  */
  const internal = href.startsWith('/');

  const className =
    'group relative inline-block py-1 text-sm text-ink-primary transition-colors duration-200 hover:text-ink-accent focus-visible:text-ink-accent after:absolute after:bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-ink-accent after:transition-transform after:duration-200 after:ease-out hover:after:scale-x-100 focus-visible:after:scale-x-100 motion-reduce:after:transition-none';

  if (internal) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
