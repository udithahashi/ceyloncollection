/**
 * Form-level feedback.
 *
 * Distinct from the per-field messages that `Field` renders: this is for the
 * errors that belong to the submission as a whole, such as bad credentials or a
 * rate limit.
 */
import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

const tones = {
  error: {
    box: 'border-error-line bg-error-bg text-error-ink',
    Icon: AlertCircle,
  },
  success: {
    box: 'border-success-line bg-success-bg text-success-ink',
    Icon: CheckCircle2,
  },
  info: {
    box: 'border-info-line bg-info-bg text-info-ink',
    Icon: Info,
  },
} as const;

export interface FormMessageProps extends ComponentProps<'div'> {
  tone?: keyof typeof tones;
}

export function FormMessage({ tone = 'error', className, children, ...props }: FormMessageProps) {
  const { box, Icon } = tones[tone];

  return (
    <div
      // `alert` makes a screen reader announce the message when it appears, which
      // is the whole point of showing an error after a submission.
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 border px-3.5 py-3 text-sm', box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
