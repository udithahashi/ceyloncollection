import { BrandMark } from '@/components/layout/brand-mark';

import { site } from '../content';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-surface-sidebar text-ink-on-sidebar">
      <div className="mx-auto max-w-[1180px] px-6 pt-16 pb-8 lg:px-10">
        <div className="grid gap-10 border-b border-white/12 pb-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="flex flex-col gap-4">
            <BrandMark className="text-base text-ink-on-sidebar" />
            <p className="max-w-xs text-sm text-ink-on-sidebar-muted">{site.footer.blurb}</p>
          </div>

          {site.footer.columns.map((column) => (
            <div key={column.heading}>
              <h2 className="mb-4 eyebrow text-[0.7rem] text-brand-blush">{column.heading}</h2>
              <ul className="flex flex-col">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {/* `inline-flex` with a minimum height rather than a gap on
                        the list: it makes each link its own comfortable tap
                        target on a phone instead of a thin line of text with
                        dead space between. */}
                    <a
                      href={link.href}
                      {...(link.href.startsWith('http')
                        ? { target: '_blank', rel: 'noopener noreferrer' }
                        : {})}
                      className="inline-flex min-h-10 items-center text-sm text-ink-on-sidebar-muted transition-colors duration-200 hover:text-brand-gold"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-6 text-xs text-ink-on-sidebar-muted">
          <span>
            © {year} {site.name}. All rights reserved.
          </span>
          <span>{site.footer.location}</span>
        </div>
      </div>
    </footer>
  );
}
