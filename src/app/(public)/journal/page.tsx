import Image from 'next/image';
import Link from 'next/link';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';
import { site } from '@/features/site/content';
import { stories } from '@/features/site/stories';

export const metadata: Metadata = {
  title: 'Journal',
  description: site.journal.body,
};

export default async function JournalPage() {
  await connection();

  return (
    <SiteShell>
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10 lg:pb-32">
          <Reveal className="max-w-xl">
            <p className="eyebrow text-[0.68rem] text-ink-accent">{site.journal.eyebrow}</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5rem)] text-ink-primary">
              {site.journal.title}
            </h1>
            <p className="mt-6 text-ink-secondary">{site.journal.body}</p>
          </Reveal>

          <ul className="mt-20 flex flex-col gap-20">
            {stories.map((story, index) => (
              <li key={story.slug}>
                <Link
                  href={`/journal/${story.slug}`}
                  className="group grid gap-8 lg:grid-cols-12 lg:items-center"
                >
                  <div
                    className={`relative aspect-4/3 overflow-hidden bg-surface-inset lg:col-span-6 ${
                      index % 2 === 1 ? 'lg:order-2' : ''
                    }`}
                  >
                    <Image
                      src={story.image}
                      alt={story.imageAlt}
                      fill
                      quality={95}
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="lg:col-span-5">
                    <p className="eyebrow text-[0.62rem] text-ink-accent">{story.eyebrow}</p>
                    <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] text-ink-primary">
                      {story.title}
                    </h2>
                    <p className="mt-4 max-w-md text-ink-secondary">{story.dek}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </SiteShell>
  );
}
