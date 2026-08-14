import { cn } from '@/lib/cn';

/**
 * The wordmark, set in Marcellus with the gold interpunct from the reference
 * design. Text rather than an image, so it stays crisp at any size, respects the
 * theme, and is readable by search and assistive technology.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-[family-name:var(--font-label)] text-base tracking-[0.14em] whitespace-nowrap',
        className
      )}
    >
      CEYLON<span className="text-brand-gold">·</span>COLLECTION
    </span>
  );
}
