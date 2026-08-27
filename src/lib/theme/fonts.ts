/**
 * The typefaces, loaded through next/font.
 *
 * next/font downloads these at build time and serves them from our own origin.
 * That matters for three reasons: no request to fonts.googleapis.com on page
 * load, no third party learning who visits the back office, and no layout shift,
 * because Next.js measures each face and generates a matched fallback.
 *
 * TWO TYPE SYSTEMS, ON PURPOSE
 *
 * The back office and the public site are read in completely different ways. A
 * shop window is glanced at; an operations tool is stared at for an hour while
 * comparing numbers in a table. So they get different type:
 *
 *   Back office   Inter, and only Inter. A UI face designed for small sizes on
 *                 screen, with tabular figures and unambiguous 1/l/I. This is
 *                 the same choice GitHub, Linear and Stripe's dashboard make.
 *
 *   Public site   Fraunces for display, Manrope for body, Outfit for labels.
 *                 Fraunces is a soft optical serif - editorial without the
 *                 costume of a high-contrast Bodoni. Manrope is the readable
 *                 supporting face (not Inter: that belongs to the tool). Outfit
 *                 carries the wide uppercase labels. Noto Serif Sinhala is
 *                 loaded only for the moments of Sinhala the brand actually
 *                 uses; Marcellus stays exclusively on BrandMark.
 *
 * Which set applies is decided by the theme, not by the component: see the
 * `typeface` group in tokens.ts. All faces load on every page because the
 * <html> element carries the variables, and unused faces are never requested
 * by the browser unless something actually renders in them.
 *
 * `display: 'swap'` shows the fallback immediately and swaps when the real face
 * arrives. For an internal tool, text you can read at once beats text that is
 * perfectly styled a moment later.
 */
import { Fraunces, Inter, Manrope, Marcellus, Noto_Serif_Sinhala, Outfit } from 'next/font/google';

/**
 * The back office face. Variable, so every weight from 400 to 700 costs one
 * download, and we use four of them: 400 body, 500 labels, 600 headings and
 * table emphasis, 700 for the rare figure that must shout.
 */
export const fontUi = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const fontDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-fraunces',
  display: 'swap',
});

/** Variable font, so every weight from 400 to 600 is available at no extra cost. */
export const fontBody = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
});

export const fontLabel = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
});

/**
 * Loaded for the handful of Sinhala words the public site actually sets
 * (අපේ කම, and nothing else by default). Not a theme token - it is a language
 * face, not a role - so components name the variable directly the same way
 * BrandMark names Marcellus.
 */
export const fontSinhala = Noto_Serif_Sinhala({
  subsets: ['sinhala'],
  weight: ['400', '500', '600'],
  variable: '--font-sinhala',
  display: 'swap',
});

/**
 * Identity only. BrandMark is the one place that names a typeface directly;
 * the public site's labels no longer use Marcellus, but the wordmark still does
 * until the designer delivers a real mark.
 */
export const fontMark = Marcellus({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-marcellus',
  display: 'swap',
});

/** Every font variable, for the <html> className. */
export const fontVariables = [
  fontUi.variable,
  fontDisplay.variable,
  fontBody.variable,
  fontLabel.variable,
  fontSinhala.variable,
  fontMark.variable,
].join(' ');
