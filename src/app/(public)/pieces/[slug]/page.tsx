import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { AVAILABILITY_LABEL, getCollection, getPiece, piecesIn } from '@/features/site/catalog';
import { EnquireLink } from '@/features/site/components/enquire-link';
import { ProductTile } from '@/features/site/components/product-tile';
import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';
import { whatsappLink } from '@/features/site/content';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const piece = getPiece(slug);
  if (!piece) return { title: 'Piece' };
  return { title: piece.title, description: piece.subtitle };
}

export default async function PiecePage({ params }: Props) {
  await connection();

  const { slug } = await params;
  const piece = getPiece(slug);
  if (!piece) notFound();

  const collection = getCollection(piece.collection);
  const related = piecesIn(piece.collection).filter((item) => item.slug !== piece.slug);

  return (
    <SiteShell>
      <main className="flex-1">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-6 pb-24 lg:grid-cols-12 lg:px-10 lg:pb-32">
          <div className="relative aspect-3/4 overflow-hidden bg-surface-inset lg:col-span-7">
            {/* quality={95}: `public/brand/` photos are already compressed
                WebP - the default quality of 75 would recompress them again.
                See next.config.ts's `images.qualities` for the allowed list. */}
            <Image
              src={piece.image}
              alt={piece.imageAlt}
              fill
              priority
              quality={95}
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          </div>

          <Reveal className="flex flex-col lg:col-span-5 lg:pt-8">
            {collection ? (
              <Link
                href={`/collections/${collection.slug}`}
                className="eyebrow text-[0.68rem] text-ink-accent"
              >
                {collection.title}
              </Link>
            ) : null}
            <h1 className="mt-4 font-display text-[clamp(2.6rem,5vw,4.2rem)] text-ink-primary">
              {piece.title}
            </h1>
            <p className="mt-3 text-ink-secondary">{piece.subtitle}</p>
            <p className="mt-8 text-ink-secondary">{piece.description}</p>

            <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-line-subtle pt-8 text-sm">
              <div>
                <dt className="eyebrow text-[0.62rem] text-ink-accent">Cloth</dt>
                <dd className="mt-2 text-ink-primary">{piece.fabric}</dd>
              </div>
              <div>
                <dt className="eyebrow text-[0.62rem] text-ink-accent">Status</dt>
                <dd className="mt-2 text-ink-primary">{AVAILABILITY_LABEL[piece.availability]}</dd>
              </div>
            </dl>

            <EnquireLink href={whatsappLink(piece.whatsappMessage)} className="mt-10 self-start">
              Enquire about this piece
            </EnquireLink>
            <p className="mt-4 text-xs text-ink-secondary">
              No basket yet. A conversation about size, cloth, and timing.
            </p>
          </Reveal>
        </div>

        {related.length > 0 ? (
          <div className="border-t border-line-subtle">
            <div className="mx-auto max-w-[1440px] px-6 py-20 lg:px-10">
              <p className="eyebrow text-[0.68rem] text-ink-accent">In the same edit</p>
              <ul className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((item) => (
                  <li key={item.slug}>
                    <ProductTile piece={item} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </main>
    </SiteShell>
  );
}
