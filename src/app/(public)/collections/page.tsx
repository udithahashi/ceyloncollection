import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { collections } from '@/features/site/catalog';
import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';
import { site } from '@/features/site/content';

export const metadata: Metadata = {
  title: 'Collections',
  description: site.collections.body,
};

export default async function CollectionsPage() {
  await connection();

  return (
    <SiteShell>
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10 lg:pb-32">
          <Reveal className="max-w-xl">
            <p className="eyebrow text-[0.68rem] text-ink-accent">{site.collections.eyebrow}</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5rem)] text-ink-primary">
              {site.collections.title}
            </h1>
            <p className="mt-6 text-ink-secondary">{site.collections.body}</p>
          </Reveal>

          <ul className="mt-20 grid gap-x-8 gap-y-16 md:grid-cols-2">
            {collections.map((item, index) => (
              <li key={item.slug} className={index % 2 === 1 ? 'md:mt-16' : ''}>
                <Link href={`/collections/${item.slug}`} className="group block">
                  <div className="relative aspect-3/4 overflow-hidden bg-surface-inset">
                    <Image
                      src={item.image}
                      alt={item.imageAlt}
                      fill
                      quality={95}
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="mt-5 eyebrow text-[0.62rem] text-ink-accent">{item.eyebrow}</p>
                  <h2 className="mt-2 font-display text-3xl text-ink-primary">{item.title}</h2>
                  <p className="mt-2 max-w-md text-sm text-ink-secondary">{item.summary}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </SiteShell>
  );
}
