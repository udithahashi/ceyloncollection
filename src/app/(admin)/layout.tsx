import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { AdminTopbar } from '@/components/layout/admin-topbar';
import { readTheme } from '@/lib/theme/cookie';

/**
 * The back office shell.
 *
 * `(admin)` is a route group: the parentheses keep it out of the URL, so this
 * layout wraps `/` and everything under it without adding an `/admin` segment.
 * The authentication gate lands here in Phase 2 - one check for the whole group,
 * rather than one per page, which is the kind of thing that gets forgotten.
 */
export default async function AdminLayout({ children }: LayoutProps<'/'>) {
  const theme = await readTheme();

  return (
    <div className="flex min-h-full flex-1">
      <AdminSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar theme={theme} />

        {/* `min-w-0` above matters: without it a wide data table stretches the
            flex column instead of scrolling inside it. */}
        <main className="flex-1 px-4 py-8 lg:px-8 lg:py-10">
          <div className="mx-auto flex max-w-7xl flex-col gap-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
