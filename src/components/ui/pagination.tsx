/**
 * Pager for a server-rendered list.
 *
 * Plain links, so each page is a real URL that can be bookmarked, opened in a new tab
 * and prefetched by Next.js. A pair of buttons calling `router.push` would look the
 * same and do none of that.
 *
 * Deliberately not a numbered pager with an ellipsis. This list is worked by filtering
 * and sorting, not by leafing through to page 14, and the count that people actually
 * want - "1-25 of 312" - is stated in words instead.
 */
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { buttonVariants } from './button';

export interface PaginationProps {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  /** Builds the href for a page number, keeping whatever filters are applied. */
  hrefFor: (page: number) => string;
  /** What is being counted, for the summary line. */
  noun?: { one: string; many: string };
}

export function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  hrefFor,
  noun = { one: 'lead', many: 'leads' },
}: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-line-subtle px-4 py-3"
    >
      <p className="text-xs text-ink-secondary tabular-nums" aria-live="polite">
        {total === 0 ? (
          `No ${noun.many}`
        ) : (
          <>
            {first}–{last} of {total} {total === 1 ? noun.one : noun.many}
          </>
        )}
      </p>

      {pageCount > 1 ? (
        <div className="flex items-center gap-2">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="Previous">
            <ChevronLeft aria-hidden="true" />
            Previous
          </PageLink>

          <span className="text-xs text-ink-secondary tabular-nums">
            Page {page} of {pageCount}
          </span>

          <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} label="Next">
            Next
            <ChevronRight aria-hidden="true" />
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

/**
 * A page link that becomes inert at the ends of the list.
 *
 * A `<span>` rather than a disabled link, because there is no disabled state for an
 * anchor - `aria-disabled` on something still focusable and clickable is a promise the
 * markup does not keep.
 */
function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className = buttonVariants({ variant: 'secondary', size: 'sm' });

  if (disabled) {
    return (
      <span aria-hidden="true" className={`${className} pointer-events-none opacity-50`}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
