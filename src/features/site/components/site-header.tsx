import Link from 'next/link';

import { BrandMark } from '@/components/layout/brand-mark';

import { site, whatsappLink } from '../content';

import { EnquireLink } from './enquire-link';
import { LogoMark } from './logo-mark';
import { MobileNav } from './mobile-nav';
import { SocialLinks } from './social-links';

/**
 * Minimal public header. Identity on the left, destinations in the middle,
 * a single action on the right. The logo square is a placeholder until the
 * designer delivers a mark - BrandMark stays the readable wordmark.
 */
export function SiteHeader() {
  const enquireHref = whatsappLink(site.enquire.message);

  return (
    // In the document flow, not floating over the page. A translucent header can
    // overlay a hero because you still see the picture through it; a solid one
    // just covers the top of it. So this now occupies its own space and the hero
    // begins underneath - which is also why every page below lost the top
    // padding it used to need to clear an overlay.
    <header className="relative z-40">
      {/*
        A solid band, not a fade.

        The header floats over a split hero - ivory on the left, a photograph on
        the right - and navy type on a photograph is only as legible as the
        pixels behind it. Measured on the current hero, navy scores 9.4:1 against
        the average of the image's top band but 1.47:1 against its darkest
        pixels, so legibility depended entirely on where hair and shadow happened
        to fall. A gradient fixed the numbers but read as haze over the picture.

        Solid `surface-page` removes the question altogether: the backdrop is a
        known colour, so contrast is fixed at 12.6:1 no matter which photograph
        is in place - and it does get swapped. It also squares the split hero
        off, letting the ivory column and the image start on one clean line
        under a hairline rule.
      */}
      {/*
        The announcement strip. Inside the header rather than a sibling, so the
        page chrome has exactly one height for the hero's viewport calc to
        subtract - see site-shell.tsx.
      */}
      <div className="bg-surface-sidebar">
        {/*
          Uppercase Outfit, not `label-caps` and not Fraunces italic - back to
          the family this site already uses for tracked labels, but opened up.
          Uppercase text reads as cramped and tense at tight tracking; the fix
          luxury/editorial sites reach for is more space between letters, not
          less, so this sits between `label-caps` (0.14em, built for buttons)
          and `eyebrow` (0.28em, the widest token) at 0.2em - enough air to read
          as considered rather than shouted.

          Fits one line down to 360px width, the narrowest phone this site
          targets - verified in the browser after picking the size, the same
          way the two treatments before this one were.
        */}
        <p className="mx-auto max-w-[1440px] px-6 py-2.5 text-center font-label text-[0.6rem] tracking-[0.2em] text-brand-blush uppercase sm:text-xs lg:px-10 lg:text-sm">
          {site.announcement}
        </p>
      </div>

      <div className="border-b border-line-subtle bg-surface-page">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-6 py-6 lg:px-10">
          <Link href="/" className="flex items-center gap-3 text-ink-primary">
            <LogoMark />
            <BrandMark className="hidden sm:inline" />
            <span className="sr-only">{site.name}</span>
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-9 lg:flex">
            {site.nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                /*
                Marcellus ships a single weight, so density here has to come
                from size and tracking rather than boldness: 0.68rem at 0.28em
                spread this thin over a photograph, which is most of why it read
                as faint. Slightly larger, slightly tighter, and each label now
                carries an underline that grows on hover - the affordance the
                previous colour-only hover never really gave.
              */
                className="group relative py-1 eyebrow text-[0.74rem] tracking-[0.2em] text-ink-primary transition-colors duration-300 hover:text-ink-accent"
              >
                {item.label}
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-ink-accent transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-x-100"
                />
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {/*
              On cream at `ink-primary`, which is where these became visible -
              blush on the navy strip above was too quiet to find. The hairline
              divider is doing real work: it keeps `Enquire` reading as the end
              of the row rather than the fourth of four equal icons.

              Desktop only. The phone gets them in the drawer, which has room to
              label them, and every width gets them in the footer.
            */}
            <SocialLinks className="hidden lg:flex" />
            <span aria-hidden="true" className="hidden h-6 w-px bg-line-subtle lg:block" />

            {/*
            Filled rather than outlined. A hairline border over a photograph is
            the first thing to disappear, and this is the one action the whole
            page exists to drive - it should be the most solid object up here.
          */}
            <EnquireLink
              href={enquireHref}
              variant="primary"
              // 44px, not the 40 it was: the design standard this project set for
              // itself is a 44px minimum target, and the header CTA had quietly
              // fallen under it.
              className="hidden min-h-11 px-6 lg:inline-flex"
            >
              {site.enquire.label}
            </EnquireLink>
            <MobileNav items={site.nav} whatsappHref={enquireHref} />
          </div>
        </div>
      </div>
    </header>
  );
}
