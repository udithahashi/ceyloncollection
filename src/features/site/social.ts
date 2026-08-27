/**
 * The house's social channels.
 *
 * WHY THIS IS A LIST AND NOT THREE HARDCODED LINKS
 * This is the shape a settings table will fill. When the back office grows a
 * "Social channels" page, the component reading this should not have to change:
 * a row becomes `{ platform, label, href, handle }`, the query returns them in
 * `order`, and the array below is replaced by that query. Adding a fourth
 * channel - TikTok, a Facebook page for a second market - must be a data change,
 * never a JSX change. See docs/HANDOVER.md.
 *
 * NOT `server-only`, deliberately, and it must stay that way. The header renders
 * inside a client boundary, so anything reached from here that touched
 * `@/lib/env` would drag the config validator into the browser and fail the
 * build - the trap AGENTS.md rule 2 describes. Plain constants only.
 *
 * `platform` is a closed union rather than a free string on purpose: the icon
 * lookup is a `Record<SocialPlatform, ...>`, so adding a channel here without
 * drawing its mark is a type error rather than a blank space on the page.
 */
import { site, whatsappLink } from './content';

export type SocialPlatform = 'instagram' | 'facebook' | 'whatsapp';

export type SocialChannel = {
  platform: SocialPlatform;
  /** The accessible name. Icon-only links have no visible text to announce. */
  label: string;
  href: string;
};

/**
 * PLACEHOLDER HANDLES. These point at the platforms' own pages, not at the
 * business, because the real accounts have not been given to this repository
 * yet - the same reason `WHATSAPP_NUMBER` is still a placeholder. Replace them
 * with the real profiles, or the icons are three links to nowhere useful.
 */
export const socialChannels: SocialChannel[] = [
  {
    platform: 'instagram',
    label: 'Ceylon Collection on Instagram',
    href: 'https://instagram.com/',
  },
  {
    platform: 'facebook',
    label: 'Ceylon Collection on Facebook',
    href: 'https://facebook.com/',
  },
  {
    // Kept last on purpose. WhatsApp is already the page's primary call to
    // action in several places; here it is a quiet third option rather than a
    // competing one.
    //
    // Its href is BUILT from `WHATSAPP_NUMBER` rather than written out, so the
    // number still lives in exactly one place. Fill that constant in and this
    // icon starts working with it.
    platform: 'whatsapp',
    label: 'Message Ceylon Collection on WhatsApp',
    href: whatsappLink(site.enquire.message),
  },
];
