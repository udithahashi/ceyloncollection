import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * The only call to action the public site can honestly make: open WhatsApp.
 * There is no basket. A button that pretends otherwise would be a lie.
 */
export function EnquireLink({
  href,
  children,
  variant = 'primary',
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'ghost' | 'line';
  className?: string;
}) {
  const styles = {
    primary:
      'border-action-primary bg-action-primary text-action-on-primary hover:bg-transparent hover:text-action-primary',
    ghost: 'border-transparent text-ink-primary hover:border-action-secondary-line',
    line: 'border-action-secondary-line text-action-on-secondary hover:bg-action-primary hover:text-action-on-primary',
  } as const;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex min-h-12 items-center justify-center gap-2 border px-7 label-caps text-xs',
        'transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        'active:scale-[0.98]',
        styles[variant],
        className
      )}
    >
      {children}
    </a>
  );
}
