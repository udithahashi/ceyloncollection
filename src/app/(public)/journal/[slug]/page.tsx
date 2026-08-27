import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';
import { getStory, stories } from '@/features/site/stories';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const story = getStory(slug);
  if (!story) return { title: 'Journal' };
  return { title: story.title, description: story.dek };
}

export default async function StoryPage({ params }: Props) {
  await connection();

  const { slug } = await params;
  const story = getStory(slug);
  if (!story) notFound();

  const others = stories.filter((item) => item.slug !== story.slug);

  return (
    <SiteShell>
      <main className="flex-1">
        <article className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10 lg:pb-32">
          <Reveal className="max-w-3xl">
            <p className="eyebrow text-[0.68rem] text-ink-accent">{story.eyebrow}</p>
            <h1 className="mt-4 font-display text-[clamp(2.8rem,6vw,5.2rem)] text-ink-primary">
              {story.title}
            </h1>
            <p className="mt-6 max-w-xl text-lg text-ink-secondary">{story.dek}</p>
          </Reveal>

          <div className="relative mt-14 aspect-4/3 overflow-hidden bg-surface-inset lg:aspect-[21/9]">
            <Image
              src={story.image}
              alt={story.imageAlt}
              fill
              priority
              quality={95}
              sizes="100vw"
              className="object-cover"
            />
          </div>

          <div className="mx-auto mt-16 max-w-2xl space-y-6 text-lg text-ink-secondary">
            {story.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </article>

        <div className="border-t border-line-subtle">
          <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-10">
            <p className="eyebrow text-[0.68rem] text-ink-accent">Continue reading</p>
            <ul className="mt-8 grid gap-8 sm:grid-cols-2">
              {others.map((item) => (
                <li key={item.slug}>
                  <Link href={`/journal/${item.slug}`}>
                    <h2 className="font-display text-2xl text-ink-primary">{item.title}</h2>
                    <p className="mt-2 text-sm text-ink-secondary">{item.dek}</p>
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
