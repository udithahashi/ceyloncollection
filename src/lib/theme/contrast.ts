/**
 * WCAG 2.1 contrast calculation.
 *
 * This exists so colour choices can be checked rather than assumed. Several
 * pairings in the brand palette look fine and are not: mid-tone gold on a light
 * background is the classic example, reading as "clearly visible" to a designer
 * while failing the 4.5:1 threshold that people with reduced contrast
 * sensitivity actually need.
 *
 * The thresholds, from WCAG 2.1 AA:
 *   4.5:1  normal body text
 *   3.0:1  large text (>=24px, or >=18.66px bold)
 *   3.0:1  borders and icons that convey meaning, and focus indicators
 */

/** WCAG AA minimum contrast ratios. */
export const AA = {
  /** Body text and anything below 24px. */
  normalText: 4.5,
  /** Text at 24px+, or 18.66px+ and bold. */
  largeText: 3,
  /** Interactive component boundaries, focus rings, meaningful icons. */
  uiComponent: 3,
} as const;

/** Expands `#abc` and `#aabbcc` into 0-255 channel values. */
export function parseHex(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.trim().replace(/^#/, '');

  const expanded =
    cleaned.length === 3
      ? cleaned
          .split('')
          .map((char) => char + char)
          .join('')
      : cleaned;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    throw new Error(`Not a hex colour: "${hex}"`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

/**
 * Relative luminance per WCAG 2.1.
 *
 * The per-channel transform undoes sRGB gamma encoding, which is why this is not
 * a simple average: a mid-grey pixel is not half as bright as white to the eye.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex);

  const linearise = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * Contrast ratio between two colours, from 1 (identical) to 21 (black on white).
 * Order does not matter.
 */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounds down to 2 decimals, so a reported 4.5 is never actually 4.497. */
export function contrastRatioRounded(foreground: string, background: string): number {
  return Math.floor(contrastRatio(foreground, background) * 100) / 100;
}

export function meetsAA(
  foreground: string,
  background: string,
  usage: keyof typeof AA = 'normalText'
): boolean {
  return contrastRatio(foreground, background) >= AA[usage];
}
