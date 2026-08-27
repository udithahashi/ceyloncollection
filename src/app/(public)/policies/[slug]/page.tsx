import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import type { Metadata } from 'next';

import { EnquireLink } from '@/features/site/components/enquire-link';
import { Reveal } from '@/features/site/components/reveal';
import { SiteShell } from '@/features/site/components/site-shell';
import { site, whatsappLink } from '@/features/site/content';
import { getPolicy, policies } from '@/features/site/policies';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) return { title: 'Policy' };
  return { title: policy.title, description: policy.summary };
}

/**
 * One policy page: how to order, delivery, returns, privacy, terms.
 *
 * `await connection()` is load-bearing on every page under `(public)` - a
 * prerendered page ships with no CSP nonce and the browser refuses all of its
 * JavaScript. See the note on the public layout.
 *
 * A READING PAGE, SET LIKE ONE. One column, one measure, no photograph. The
 * homepage is the brand; this is the place someone comes with a question they
 * need answered, so the type is sized to be read straight through rather than
 * composed. That is also why the sections are plain ruled headings rather than
 * cards: this is a document.
 */
export default async function PolicyPage({ params }: Props) {
  await connection();

  const { slug } = await params;
  const policy = getPolicy(slug);
  if (!policy) notFound();

  const siblings = policies.filter(
    (item) => item.eyebrow === policy.eyebrow && item.slug !== policy.slug
  );

  return (
    <SiteShell>
      <main className="flex-1">
        <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-24 lg:px-10 lg:pt-24 lg:pb-32">
          {/*
            ONE MEASURE FOR THE WHOLE DOCUMENT, AND IT IS MEASURED. A policy is
            read in long runs rather than scanned, so it takes the wide end of
            the comfortable band where the homepage's beats take the narrow end
            - but "wide end" is about 75 characters a line, not "whatever the
            column gives you". `46rem` was tried first and rendered 85 to 93
            characters at 18px, which is past the point where the eye reliably
            finds the start of the next line. `38rem` holds it around 74.

            Same trap as the homepage: do not convert this to `ch`. Manrope's
            zero is far wider than its lowercase, so the unit reads like a
            character count and is not one.
          */}
          <div className="max-w-[38rem]">
            <Reveal>
              <p className="eyebrow text-[0.68rem] text-ink-accent">{policy.eyebrow}</p>
              <h1 className="mt-4 font-display text-[clamp(2.4rem,5vw,4rem)] leading-[1.05] text-ink-primary">
                {policy.title}
              </h1>
              <p className="mt-6 text-lg text-pretty text-ink-secondary lg:text-xl">
                {policy.summary}
              </p>
            </Reveal>

            {/*
              A rule over each section rather than a box around it - the same
              device the homepage's argument uses, and the same reason: a
              document should read as continuous cream, not as a stack of
              containers.
            */}
            <div className="mt-14 lg:mt-20">
              {policy.sections.map((section) => (
                <section
                  key={section.heading}
                  className="border-t border-line-subtle pt-8 pb-10 last:pb-0 lg:pt-10 lg:pb-14"
                >
                  <Reveal>
                    <h2 className="font-display text-2xl text-balance text-ink-primary lg:text-[1.75rem]">
                      {section.heading}
                    </h2>
                    <div className="mt-4 flex flex-col gap-4">
                      {section.body.map((paragraph) => (
                        <p
                          key={paragraph}
                          className="text-base text-pretty text-ink-secondary lg:text-lg lg:leading-relaxed"
                        >
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </Reveal>
                </section>
              ))}
            </div>

            {/*
              STILL BEING SETTLED - ONE NOTICE, NOT BLANKS THROUGH THE PROSE.

              The alternative was writing "returns are accepted within ___ days"
              into the body the way the offer figures render `TODO_FIGURE` on the
              homepage. That works for a number beside a label and fails badly
              here: a half-written sentence in a policy still reads as a policy,
              and "we accept returns within" is an admission on its own even with
              the number missing. Naming the open questions in one block instead
              says exactly what is and is not decided, and sends the reader to
              the one place that can answer today.

              It disappears by itself. Empty `pending` in `policies.ts` when the
              terms are agreed and nothing here has to change.
            */}
            {policy.pending.length > 0 ? (
              <Reveal className="mt-14 border-t border-line-strong pt-8 lg:mt-20 lg:pt-10">
                <p className="eyebrow text-[0.62rem] text-ink-accent">Still being settled</p>
                <p className="mt-4 max-w-[42rem] text-base text-pretty text-ink-secondary lg:text-lg">
                  These terms are not published yet, and this house would rather say so than print a
                  figure it has not agreed to keep. Until they are, ask and you will get a straight
                  answer for your order.
                </p>
                <ul className="mt-6 flex flex-col gap-2">
                  {policy.pending.map((item) => (
                    <li
                      key={item}
                      className="border-l border-line-strong pl-4 text-sm text-ink-secondary lg:text-base"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
                <EnquireLink href={whatsappLink(site.enquire.message)} className="mt-8">
                  {site.enquire.label}
                </EnquireLink>
              </Reveal>
            ) : null}

            {siblings.length > 0 ? (
              <Reveal className="mt-16 border-t border-line-subtle pt-8 lg:mt-24">
                <p className="eyebrow text-[0.62rem] text-ink-accent">{policy.eyebrow}</p>
                <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3">
                  {siblings.map((item) => (
                    <li key={item.slug}>
                      <Link
                        href={`/policies/${item.slug}`}
                        className="font-display text-lg text-ink-primary transition-colors duration-200 hover:text-ink-accent lg:text-xl"
                      >
                        {item.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ) : null}
          </div>
        </div>
      </main>
    </SiteShell>
  );
}
