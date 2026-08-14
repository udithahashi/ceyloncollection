import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * The panel that holds almost everything in the back office.
 *
 * A hairline border, softly rounded corners and the faintest shadow - the
 * ordinary card of every dashboard, because a person who has used one admin
 * tool should not have to learn to see this one. On the public site the same
 * component renders square and flat, since `rounded-panel` and `shadow-panel`
 * both resolve to nothing there.
 *
 * Depth comes mostly from the surface ladder in the tokens rather than from drop
 * shadows, which look muddy on the dark theme.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'rounded-panel border border-line-subtle bg-surface-panel shadow-panel',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line-subtle px-5 py-4',
        className
      )}
      {...props}
    />
  );
}

/** 16px semibold. Large enough to anchor the panel, quiet enough to sit in a grid of them. */
export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-base font-semibold text-ink-primary', className)} {...props} />;
}

/**
 * The small label above a title. Sentence case in the back office; the brand's
 * wide gold uppercase on the public site.
 */
export function CardEyebrow({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('eyebrow text-xs text-ink-accent', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-ink-secondary', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-5 py-4', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        // The fill has to be clipped to the card's own corners, or it paints
        // square ones back over the bottom two.
        'flex items-center justify-end gap-3 rounded-b-panel border-t border-line-subtle',
        'bg-surface-inset px-5 py-3',
        className
      )}
      {...props}
    />
  );
}
