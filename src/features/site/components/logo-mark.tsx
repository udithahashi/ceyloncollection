import { cn } from '@/lib/cn';

/**
 * Placeholder for the mark the designer has not delivered yet.
 *
 * A coded square, not a generated logo. HANDOVER.md is explicit: do not
 * invent the identity with AI. When a real file lands in `src/app/` as
 * `icon.png` or here as an <Image>, delete this component.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center border border-ink-primary',
        'font-label text-[0.62rem] tracking-[0.18em] text-ink-primary',
        className
      )}
    >
      CC
    </span>
  );
}
