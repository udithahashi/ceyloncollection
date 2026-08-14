import { ChevronDown, LogOut } from 'lucide-react';

import { signOutAction } from '@/features/auth/actions';
import { roleLabels } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/session';

/**
 * Who you are signed in as, and how to stop being signed in as them.
 *
 * A native `<details>` disclosure and a plain form, so this works with no client
 * JavaScript at all. Sign-out in particular should never depend on hydration: it is
 * the one control someone reaches for when the page is misbehaving.
 */
export function AccountMenu({ user }: { user: SessionUser }) {
  /** Initials, for the avatar. Two letters at most, from the first and last word. */
  const words = user.name.trim().split(/\s+/);
  const initials = [words[0], words.length > 1 ? words.at(-1) : undefined]
    .filter(Boolean)
    .map((word) => word?.[0]?.toUpperCase())
    .join('');

  return (
    <details className="group relative">
      <summary
        className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-control px-2 text-ink-secondary transition-colors hover:bg-surface-panel-raised hover:text-ink-primary [&::-webkit-details-marker]:hidden"
        aria-label={`Account menu for ${user.name}`}
      >
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-control border border-line-strong bg-surface-inset text-[0.6875rem] font-semibold text-ink-primary"
        >
          {initials}
        </span>
        <span className="hidden text-sm sm:inline">{user.name}</span>
        <ChevronDown
          aria-hidden="true"
          className="size-3.5 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="absolute right-0 z-40 mt-1 w-60 overflow-hidden rounded-panel border border-line-subtle bg-surface-panel-raised shadow-overlay">
        <div className="flex flex-col gap-0.5 border-b border-line-subtle px-3 py-2.5">
          <p className="truncate text-sm font-medium text-ink-primary">{user.name}</p>
          {/* Title attribute so a long address is readable without breaking layout. */}
          <p className="truncate text-xs text-ink-secondary" title={user.email}>
            {user.email}
          </p>
          <p className="mt-1 eyebrow text-[0.6875rem] text-ink-accent">{roleLabels[user.role]}</p>
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-ink-secondary transition-colors hover:bg-surface-inset hover:text-ink-primary"
          >
            <LogOut aria-hidden="true" className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
