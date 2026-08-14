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
 *   Public site   Cormorant Garamond for headings, Jost for body, Marcellus for
 *                 uppercase labels - the pairing from the reference homepage.
 *                 Editorial, high contrast, unmistakably the brand.
 *
 * Which set applies is decided by the theme, not by the component: see the
 * `typeface` group in tokens.ts. All faces load on every page because the
 * <html> element carries the variables, and the cost is small - Inter and Jost
 * are variable fonts, and unused faces are never requested by the browser
 * unless something actually renders in them.
 *
 * `display: 'swap'` shows the fallback immediately and swaps when the real face
 * arrives. For an internal tool, text you can read at once beats text that is
 * perfectly styled a moment later.
 */
import { Cormorant_Garamond, Inter, Jost, Marcellus } from 'next/font/google';

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

export const fontDisplay = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

/** Variable font, so every weight from 300 to 600 is available at no extra cost. */
export const fontBody = Jost({
  subsets: ['latin'],
  variable: '--font-jost',
  display: 'swap',
});

/** Marcellus ships in a single weight, which is all the label style needs. */
export const fontLabel = Marcellus({
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
].join(' ');
