import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The heading block at the top of every page: an eyebrow for context, the title,
 * an optional sentence of explanation, and room for the page's primary actions.
 *
 * Kept as a component so every page agrees on the spacing and on where the
 * primary action lives. Consistency about that is most of what makes a back
 * office feel calm.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}
    >
      <div className="flex flex-col gap-1">
        {eyebrow ? <p className="eyebrow text-xs text-ink-accent">{eyebrow}</p> : null}
        {/* 24px. A page title in a tool needs to be findable, not grand; the
         * display size that suits the public site's hero is shouting here. */}
        <h1 className="text-2xl text-ink-primary">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-ink-secondary">{description}</p> : null}
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </div>
  );
}
