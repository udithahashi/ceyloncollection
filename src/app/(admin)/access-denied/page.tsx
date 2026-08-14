import { ShieldX } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { roleLabels } from '@/lib/auth/roles';
import { requireUser } from '@/lib/auth/session';

/**
 * Shown when a role does not permit the page that was requested.
 *
 * Names the missing permission rather than saying only "denied". The people using
 * this system work together; "you need Taxonomy access, ask an owner" gets someone
 * moving, while a bare refusal generates a message to you instead.
 */
export default async function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string; action?: string }>;
}) {
  const [{ resource, action }, user] = await Promise.all([searchParams, requireUser()]);

  return (
    <>
      <PageHeader eyebrow="Permissions" title="You do not have access to that page" />

      <Card>
        <CardContent className="flex flex-col items-start gap-5 py-8">
          <ShieldX aria-hidden className="size-8 text-ink-accent" />

          <div className="flex flex-col gap-2">
            <p className="text-sm text-ink-primary">
              You are signed in as <strong className="font-medium">{user.name}</strong> with the{' '}
              {roleLabels[user.role]} role, which does not include
              {resource && action ? (
                <>
                  {' '}
                  permission to <strong className="font-medium">{action}</strong>{' '}
                  <strong className="font-medium">{resource}</strong>.
                </>
              ) : (
                ' access to that page.'
              )}
            </p>
            <p className="text-sm text-ink-secondary">
              If you need it for your work, ask an owner to change your role.
            </p>
          </div>

          <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
            Back to the dashboard
          </Link>
        </CardContent>
      </Card>
    </>
  );
}
