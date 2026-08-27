import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { collections, getCollection, piecesIn } from '@/features/site/catalog';
import { ProductTile } from '@/features/site/components/product-tile';
import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return { title: 'Collection' };
  return { title: collection.title, description: collection.summary };
}

export default async function CollectionPage({ params }: Props) {
  await connection();

  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const pieces = piecesIn(collection.slug);
  const others = collections.filter((item) => item.slug !== collection.slug).slice(0, 3);

  return (
    <SiteShell>
      <main className="flex-1">
        <div className="mx-auto grid max-w-[1440px] gap-12 px-6 pb-20 lg:grid-cols-12 lg:px-10">
          <Reveal className="lg:col-span-5">
            <p className="eyebrow text-[0.68rem] text-ink-accent">{collection.eyebrow}</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5rem)] text-ink-primary">
              {collection.title}
            </h1>
            <p className="mt-6 max-w-md text-ink-secondary">{collection.story}</p>
          </Reveal>
          <div className="relative aspect-3/4 overflow-hidden bg-surface-inset lg:col-span-7 lg:aspect-4/3">
            <Image
              src={collection.image}
              alt={collection.imageAlt}
              fill
              priority
              quality={95}
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover"
            />
          </div>
        </div>

        <div className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10 lg:pb-32">
          {pieces.length > 0 ? (
            <ul className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {pieces.map((piece) => (
                <li key={piece.slug}>
                  <ProductTile piece={piece} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-ink-secondary">Pieces for this edit are being photographed.</p>
          )}

          <div className="mt-24 border-t border-line-subtle pt-12">
            <p className="eyebrow text-[0.68rem] text-ink-accent">Continue</p>
            <ul className="mt-8 grid gap-8 sm:grid-cols-3">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link href={`/collections/${item.slug}`} className="group block">
                    <h2 className="font-display text-2xl text-ink-primary">{item.title}</h2>
                    <p className="mt-2 text-sm text-ink-secondary">{item.summary}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
