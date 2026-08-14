/**
 * The three typefaces, loaded through next/font.
 *
 * next/font downloads these at build time and serves them from our own origin.
 * That matters for three reasons: no request to fonts.googleapis.com on page
 * load, no third party learning who visits the back office, and no layout shift,
 * because Next.js measures each face and generates a matched fallback.
 *
 * The pairing comes from the reference homepage design:
 *
 *   Cormorant Garamond  headings. A high-contrast display serif; the italic
 *                       carries the "modern woman" emphasis in the hero.
 *   Jost                body text at weight 300. A geometric sans that stays
 *                       quiet next to the serif.
 *   Marcellus           small uppercase labels with wide letter-spacing -
 *                       eyebrows, buttons, table headers. This is the detail
 *                       that makes the brand read as a boutique rather than a
 *                       dashboard.
 *
 * `display: 'swap'` shows the fallback immediately and swaps when the real face
 * arrives. For an internal tool, text you can read at once beats text that is
 * perfectly styled a moment later.
 */
import { Cormorant_Garamond, Jost, Marcellus } from 'next/font/google';

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

/** All three font variables, for the <html> className. */
export const fontVariables = [fontDisplay.variable, fontBody.variable, fontLabel.variable].join(
  ' '
);
