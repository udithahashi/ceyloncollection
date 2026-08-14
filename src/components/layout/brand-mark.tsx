import { cn } from '@/lib/cn';

/**
 * The wordmark, with the gold interpunct from the reference design. Text rather
 * than an image, so it stays crisp at any size, respects the theme, and is
 * readable by search and assistive technology.
 *
 * This is the one place that names a typeface directly instead of following the
 * theme. A logotype is identity, not interface: the back office is set in Inter,
 * but the mark in the corner stays Marcellus, the way a company's logo stays
 * itself on every screen it appears on.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-[family-name:var(--font-marcellus),'Marcellus',Georgia,serif]",
        'text-sm tracking-[0.14em] whitespace-nowrap',
        className
      )}
    >
      CEYLON<span className="text-brand-gold">·</span>COLLECTION
    </span>
  );
}
