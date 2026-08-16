import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

import { cn } from '@/lib/cn';

import { site, whatsappLink } from '../content';

/**
 * The offer cards.
 *
 * THE TEXT HERE IS HTML, NOT PART OF THE IMAGE, AND THAT IS THE WHOLE POINT.
 * The panels behind these cards were generated deliberately empty in the middle
 * (see docs/ASSETS.md) so every word can be rendered on top. Baking "20% off"
 * into a picture would mean an image model deciding how to spell it, no way to
 * change a figure without regenerating art, nothing for a screen reader to
 * read, and nothing a search engine can index. Generated artwork, real
 * typography.
 *
 * Every figure in these cards is a placeholder from `content.ts` until the
 * owner confirms the real terms - a discount is a promise, and this file must
 * not be where one gets invented.
 *
 * A Server Component: it is images and links, and none of it needs JavaScript.
 */
export function Offers() {
  const { offers } = site;

  const tone = {
    navy: 'text-brand-ivory',
    rose: 'text-brand-navy',
    gold: 'text-brand-navy',
  } as const;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {offers.items.map((item) => (
        <article
          key={item.slug}
          className="group relative isolate flex min-h-[22rem] flex-col justify-between overflow-hidden p-8 lg:p-10"
        >
          <Image
            src={item.image}
            alt=""
            // Decorative: the card's meaning is entirely in the text above it,
            // so describing the wallpaper would only add noise for a screen
            // reader. Hence empty alt and aria-hidden rather than a caption.
            aria-hidden="true"
            fill
            sizes="(max-width: 1024px) 100vw, 33vw"
            className="-z-10 object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />

          <div className={cn('flex flex-col gap-3', tone[item.tone])}>
            <p className="eyebrow text-[0.62rem] opacity-80">{item.kicker}</p>
            <p className="font-display text-3xl lg:text-4xl">{item.headline}</p>
            <p className="max-w-[22rem] text-sm opacity-85">{item.detail}</p>
          </div>

          <a
            href={whatsappLink(item.whatsappMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'mt-8 inline-flex min-h-11 items-center self-start text-sm transition-opacity duration-200 hover:opacity-70',
              tone[item.tone]
            )}
          >
            <span className="inline-flex items-center gap-2 border-b border-current pb-1">
              {item.cta}
              <ArrowRight aria-hidden="true" className="size-4" />
            </span>
          </a>
        </article>
      ))}
    </div>
  );
}
