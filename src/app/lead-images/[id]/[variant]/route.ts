/**
 * Serving a lead's photos.
 *
 * WHY THIS EXISTS WHEN THE PROJECT HAS NO REST API
 * The rule everywhere else is that reads happen in Server Components and writes in
 * Server Actions, with no browser-facing endpoints. An `<img>` tag cannot be either of
 * those: the element issues its own HTTP GET, and there is no way for a component to
 * hand it bytes. The alternative is inlining every photo as a `data:` URL in the HTML,
 * which defeats caching, cannot be lazily loaded, and puts a megabyte of base64 into a
 * server-rendered page. So this is a deliberate, narrow exception: one route, read
 * only, returning bytes and nothing else.
 *
 * It is the same access control as the pages, applied in the same place - inside the
 * handler:
 *
 * - a session, and the `leads:read` permission, or it is a 404;
 * - the image must belong to a lead that is not soft-deleted;
 * - the object key comes from the database, never from the URL. The URL carries an id,
 *   which is looked up. That is what makes path traversal impossible here rather than
 *   merely difficult.
 *
 * Refusals are 404 rather than 403, so this route cannot be used to enumerate which
 * image ids exist.
 */
import { getServableImage } from '@/features/leads/images/queries';
import { can } from '@/lib/auth/roles';
import { getSession } from '@/lib/auth/session';
import { storage } from '@/lib/storage';

/** Both stored sizes. `thumb` for lists, `full` for a single photo on screen. */
const variants = ['full', 'thumb'] as const;
type Variant = (typeof variants)[number];

function isVariant(value: string): value is Variant {
  return (variants as readonly string[]).includes(value);
}

const notFound = () => new Response('Not found', { status: 404 });

export async function GET(
  _request: Request,
  { params }: RouteContext<'/lead-images/[id]/[variant]'>
) {
  const { id, variant } = await params;

  if (!isVariant(variant)) return notFound();

  /*
   * `getSession` rather than `requireUser`, because a redirect to the login page is
   * the wrong answer to an image request: the browser would cheerfully store the HTML
   * of the login form as the contents of an `<img>`. A signed-out request simply gets
   * nothing.
   */
  const session = await getSession();

  if (!session || session.user.disabledAt || !session.user.twoFactorEnabled) return notFound();
  if (!can(session.user.role, 'leads', 'read')) return notFound();

  const image = await getServableImage(id);
  if (image === null) return notFound();

  const object = await storage.read(variant === 'full' ? image.fullKey : image.thumbKey);

  // A row with no file behind it. Reported as missing to the browser, which is all it
  // can act on; the log entry from the upload path is where the cause will be.
  if (object === null) return notFound();

  return new Response(object.body, {
    headers: {
      // Always what we wrote, never what was uploaded: every stored variant is a WebP
      // produced by @/lib/images/prepare. Combined with the `nosniff` header set in
      // next.config.ts, the browser has no room to guess.
      'Content-Type': 'image/webp',
      'Content-Length': String(object.byteSize),
      /*
       * `private` keeps this out of any shared cache - these are customers' photos, and
       * a proxy that caches them would serve them to whoever asks next. `immutable`
       * with a long age is safe because the bytes behind an id never change: an edited
       * photo is a new upload with a new id.
       */
      'Cache-Control': 'private, max-age=604800, immutable',
      // Displayed, not downloaded, and never with a filename taken from the upload.
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
