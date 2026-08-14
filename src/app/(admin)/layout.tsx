import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminTopbar } from '@/components/layout/admin-topbar';
import { requireUser } from '@/lib/auth/session';
import { readTheme } from '@/lib/theme/cookie';

/**
 * The back office shell.
 *
 * `(admin)` is a route group: the parentheses keep it out of the URL, so this
 * layout wraps `/` and everything under it without adding an `/admin` segment.
 *
 * `requireUser` here authenticates every page in the group in one place. It is not,
 * however, the whole story: a layout does not re-run for a Server Action, and
 * Next.js is explicit that a Server Function is a POST to its own route. So each
 * action calls `authorize()` for itself, and each page that needs more than
 * "signed in" calls `requirePermission`. This check is the floor, not the ceiling.
 */
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const [user, theme] = await Promise.all([requireUser(), readTheme()]);

  return (
    <div className="flex min-h-full flex-1">
      <AdminSidebar role={user.role} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar theme={theme} user={user} />

        {/* `min-w-0` above matters: without it a wide data table stretches the
            flex column instead of scrolling inside it. */}
        <main className="flex-1 px-4 py-6 lg:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
