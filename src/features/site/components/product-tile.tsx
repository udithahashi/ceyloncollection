import Image from 'next/image';
import Link from 'next/link';

import { cn } from '@/lib/cn';

import { AVAILABILITY_LABEL, type Piece } from '../catalog';

/**
 * A piece, photographed as a campaign still rather than a catalogue card.
 * No price. No add-to-cart. The tile is a door into the story of the garment.
 */
export function ProductTile({
  piece,
  priority = false,
  className,
}: {
  piece: Piece;
  priority?: boolean;
  className?: string;
}) {
  return (
    <article className={cn('group flex flex-col', className)}>
      <Link
        href={`/pieces/${piece.slug}`}
        className="relative block overflow-hidden bg-surface-inset"
      >
        <div className="relative aspect-3/4">
          {/* quality={95}: `public/brand/` photos are already compressed WebP -
              the default quality of 75 would recompress them a second time.
              See next.config.ts's `images.qualities` for the allowed list. */}
          <Image
            src={piece.image}
            alt={piece.imageAlt}
            fill
            priority={priority}
            quality={95}
            sizes="(max-width: 768px) 80vw, 28vw"
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04]"
          />
        </div>
      </Link>

      <div className="flex flex-1 flex-col pt-5">
        <p className="eyebrow text-[0.62rem] text-ink-accent">
          {AVAILABILITY_LABEL[piece.availability]}
        </p>
        <h3 className="mt-2 font-display text-2xl leading-none text-ink-primary">
          <Link href={`/pieces/${piece.slug}`} className="hover:text-ink-accent">
            {piece.title}
          </Link>
        </h3>
        <p className="mt-2 text-sm text-ink-secondary">{piece.subtitle}</p>
      </div>
    </article>
  );
}
