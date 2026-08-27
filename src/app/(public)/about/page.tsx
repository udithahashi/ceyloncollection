import Image from 'next/image';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { EnquireLink } from '@/features/site/components/enquire-link';
import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';
import { SplitReveal } from '@/features/site/components/split-reveal';
import { site, whatsappLink } from '@/features/site/content';

export const metadata: Metadata = {
  title: 'The house',
  description: site.about.dek,
};

export default async function AboutPage() {
  await connection();

  return (
    <SiteShell>
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-6 pb-24 lg:px-10 lg:pb-32">
          <Reveal>
            <p className="eyebrow text-[0.68rem] text-ink-accent">{site.about.eyebrow}</p>
            <p className="mt-6 sinhala text-xl text-ink-primary">{site.about.sinhala}</p>
          </Reveal>
          <SplitReveal
            as="h1"
            lines={['A piece of home,', 'worn.']}
            className="mt-6 max-w-4xl font-display text-[clamp(2.8rem,6vw,5.4rem)] text-ink-primary"
          />
          <Reveal className="mt-8 max-w-xl">
            <p className="text-lg text-ink-secondary">{site.about.dek}</p>
          </Reveal>

          <div className="relative mt-16 aspect-4/3 overflow-hidden bg-surface-inset lg:aspect-[21/9]">
            <Image
              src="/brand/craft-dye.webp"
              alt="Indigo-dyed cotton being lifted from a dye vat."
              fill
              priority
              quality={95}
              sizes="100vw"
              className="object-cover"
            />
          </div>

          <div className="mt-20 grid gap-16 lg:grid-cols-3">
            {site.about.sections.map((section) => (
              <Reveal key={section.title}>
                <h2 className="font-display text-2xl text-ink-primary">{section.title}</h2>
                <p className="mt-4 text-sm text-ink-secondary">{section.body}</p>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-24 border-t border-line-subtle pt-12">
            <h2 className="font-display text-3xl text-ink-primary">{site.close.title}</h2>
            <p className="mt-4 max-w-lg text-ink-secondary">{site.close.body}</p>
            <EnquireLink href={whatsappLink(site.enquire.message)} className="mt-8">
              {site.close.cta}
            </EnquireLink>
          </Reveal>
        </div>
      </main>
    </SiteShell>
  );
}
