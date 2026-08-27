import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * The button styles, also exported on their own so a Next.js <Link> can wear them
 * without being wrapped in a <button>. A link that looks like a button should
 * still be a link: it navigates, it can be opened in a new tab, and screen
 * readers announce it correctly.
 *
 * Geometry is theme-driven. In the back office that means the 36px tall,
 * 6px-cornered, sentence-case button every dashboard user already knows how to
 * read; on the public site the same component becomes square with Outfit in
 * wide uppercase. `label-caps` and `rounded-control` are where that flip lives.
 *
 * Every variant carries a 1px border, filled or not, so swapping between them
 * never changes the box a button occupies.
 */
export const buttonVariants = cva(
  cn(
    'label-caps rounded-control inline-flex items-center justify-center gap-2 border whitespace-nowrap',
    'transition-colors duration-150 ease-out',
    'disabled:pointer-events-none disabled:opacity-50',
    // Icons inside buttons should not be tab stops or be squashed by flexbox.
    '[&_svg]:pointer-events-none [&_svg]:shrink-0'
  ),
  {
    variants: {
      variant: {
        primary: cn(
          'border-action-primary bg-action-primary text-action-on-primary',
          'hover:border-action-primary-hover hover:bg-action-primary-hover'
        ),
        secondary: cn(
          'border-action-secondary-line bg-action-secondary text-action-on-secondary',
          'hover:bg-action-secondary-hover'
        ),
        /** For toolbar and table-row actions, where a border would be noise. */
        ghost: cn(
          'border-transparent bg-transparent text-ink-secondary',
          'hover:bg-surface-panel-raised hover:text-ink-primary'
        ),
        /**
         * Destructive actions are outlined rather than filled. A wall of solid red
         * trains people to click through it; an outline that fills on hover asks
         * for a moment's attention instead.
         */
        danger: cn('border-error-line bg-transparent text-error-ink', 'hover:bg-error-bg'),
      },
      /**
       * Heights sit on the 4px grid and match the form controls in field.tsx,
       * so a button beside an input lines up without anyone nudging it.
       */
      size: {
        sm: 'h-8 px-3 text-[0.8125rem] [&_svg]:size-3.5',
        md: 'h-9 px-4 text-sm [&_svg]:size-4',
        lg: 'h-11 px-6 text-sm [&_svg]:size-4',
        /** Square, for a lone icon. Always pair with an accessible label. */
        icon: 'size-9 px-0 [&_svg]:size-4',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  }
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      // Defaults to `button`. HTML defaults to `submit`, which means a button
      // dropped inside a form silently submits it - a bug that is tedious to find.
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
