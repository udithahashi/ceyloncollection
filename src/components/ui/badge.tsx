import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * A small status pill: lead status, customer type, urgency.
 *
 * Every tone pairs a tinted background with its own darker or lighter text, both
 * checked against WCAG AA in the token tests. The label always carries the
 * meaning in words - colour is a second signal, never the only one, because
 * roughly one man in twelve cannot rely on it.
 */
export const badgeVariants = cva(
  cn(
    'inline-flex items-center gap-1.5 border px-2.5 py-1',
    'font-[family-name:var(--font-label)] text-[0.68rem] tracking-[0.1em] uppercase',
    'whitespace-nowrap'
  ),
  {
    variants: {
      tone: {
        neutral: 'border-line-subtle bg-surface-inset text-ink-secondary',
        accent: 'border-line-focus/40 bg-action-soft text-action-on-soft',
        success: 'border-success-line bg-success-bg text-success-ink',
        warning: 'border-warning-line bg-warning-bg text-warning-ink',
        error: 'border-error-line bg-error-bg text-error-ink',
        info: 'border-info-line bg-info-bg text-info-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  }
);

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
