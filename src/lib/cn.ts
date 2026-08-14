import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Joins class names, letting later ones win over earlier conflicts.
 *
 * `clsx` flattens conditionals and arrays; `twMerge` then resolves Tailwind
 * conflicts, so `cn('px-4', 'px-6')` yields `px-6` rather than both. Without it,
 * a `className` passed into a component could not reliably override the
 * component's own padding, because CSS order would decide rather than intent.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
