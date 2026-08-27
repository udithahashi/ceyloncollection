import Image from 'next/image';

import { cn } from '@/lib/cn';

import type { Campaign } from '../campaigns';
import { whatsappLink } from '../content';

import { EnquireLink } from './enquire-link';

/**
 * Promotional surface. Visually distinct from the permanent brand story:
 * a figure, a deadline if there is one, and a ground that is artwork rather
 * than photography. Sample figures are blanks until the owner fills them.
 */
export function CampaignPanel({
  campaign,
  invert = false,
  className,
}: {
  campaign: Campaign;
  invert?: boolean;
  /** Grid placement from the caller - see the odd-count note on the homepage. */
  className?: string;
}) {
  return (
    <article
      className={cn(
        'relative isolate overflow-hidden',
        invert ? 'bg-surface-sidebar text-ink-on-sidebar' : 'bg-surface-panel text-ink-primary',
        className
      )}
    >
      <div className="absolute inset-0 -z-10">
        {/* quality={95}: `public/brand/` photos are already compressed WebP -
            the default quality of 75 would recompress them a second time.
            See next.config.ts's `images.qualities` for the allowed list. */}
        <Image
          src={campaign.image}
          alt={campaign.imageAlt}
          fill
          quality={95}
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover opacity-40"
        />
      </div>

      <div className="flex min-h-[28rem] flex-col justify-end p-8 lg:p-12">
        <p
          className={cn('eyebrow text-[0.62rem]', invert ? 'text-brand-blush' : 'text-ink-accent')}
        >
          {campaign.eyebrow}
          {campaign.kind === 'offer' ? ' · Sample offer' : ''}
        </p>
        <h3 className="mt-4 font-display text-[clamp(2rem,4vw,3.25rem)] leading-none">
          {campaign.title}
        </h3>
        <p
          className={cn(
            'mt-4 max-w-md text-sm',
            invert ? 'text-ink-on-sidebar-muted' : 'text-ink-secondary'
          )}
        >
          {campaign.body}
        </p>
        <p className="mt-8 font-display text-5xl leading-none">{campaign.figure}</p>
        <EnquireLink
          href={whatsappLink(`Hello — I am writing about ${campaign.title}`)}
          variant={invert ? 'line' : 'primary'}
          className={cn(
            'mt-8 self-start',
            invert &&
              'border-ink-on-sidebar text-ink-on-sidebar hover:bg-ink-on-sidebar hover:text-surface-sidebar'
          )}
        >
          {campaign.cta}
        </EnquireLink>
      </div>
    </article>
  );
}
