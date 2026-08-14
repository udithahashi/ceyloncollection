import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * The panel that holds almost everything in the back office.
 *
 * Square, one hairline border, no shadow. Depth here comes from the surface
 * ladder in the tokens rather than from drop shadows, which look muddy on the
 * dark theme and are the first thing to make an interface feel dated.
 */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('border border-line-subtle bg-surface-panel', className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line-subtle px-6 py-4',
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={cn('text-xl text-ink-primary', className)} {...props} />;
}

/** The small gold uppercase label that sits above a title. */
export function CardEyebrow({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('eyebrow text-ink-accent', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={cn('text-sm text-ink-secondary', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-6 py-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 border-t border-line-subtle bg-surface-inset px-6 py-4',
        className
      )}
      {...props}
    />
  );
}
