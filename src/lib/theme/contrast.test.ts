import { describe, expect, it } from 'vitest';

import {
  AA,
  contrastRatio,
  contrastRatioRounded,
  meetsAA,
  parseHex,
  relativeLuminance,
} from './contrast';

describe('parseHex', () => {
  it('reads a six-digit hex', () => {
    expect(parseHex('#142B49')).toEqual({ r: 0x14, g: 0x2b, b: 0x49 });
  });

  it('expands a three-digit hex', () => {
    expect(parseHex('#fff')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex('#08f')).toEqual({ r: 0, g: 0x88, b: 0xff });
  });

  it('tolerates a missing hash and stray whitespace', () => {
    expect(parseHex('  B77A17 ')).toEqual({ r: 0xb7, g: 0x7a, b: 0x17 });
  });

  it('is case insensitive', () => {
    expect(parseHex('#b77a17')).toEqual(parseHex('#B77A17'));
  });

  it('rejects anything that is not a colour', () => {
    expect(() => parseHex('transparent')).toThrow(/Not a hex colour/);
    expect(() => parseHex('#12345')).toThrow(/Not a hex colour/);
    expect(() => parseHex('#gggggg')).toThrow(/Not a hex colour/);
  });
});

describe('relativeLuminance', () => {
  it('puts black at 0 and white at 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBe(1);
  });

  it('is not a naive channel average', () => {
    // Mid-grey is about 21% as luminous as white, not 50%. This is the gamma
    // correction doing its job; getting it wrong would silently overstate every
    // contrast ratio in the app.
    expect(relativeLuminance('#808080')).toBeCloseTo(0.2159, 3);
  });

  it('weights green far above blue', () => {
    expect(relativeLuminance('#00FF00')).toBeGreaterThan(relativeLuminance('#0000FF'));
    expect(relativeLuminance('#00FF00')).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance('#0000FF')).toBeCloseTo(0.0722, 4);
  });
});

describe('contrastRatio', () => {
  it('gives 21:1 for black on white', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });

  it('gives 1:1 for a colour against itself', () => {
    expect(contrastRatio('#142B49', '#142B49')).toBeCloseTo(1, 5);
  });

  it('does not depend on argument order', () => {
    expect(contrastRatio('#142B49', '#FAF7F2')).toBeCloseTo(
      contrastRatio('#FAF7F2', '#142B49'),
      10
    );
  });

  it('agrees with the published WCAG boundary greys', () => {
    // #767676 is the canonical darkest grey that still passes AA on white, and
    // #777777 the lightest that fails. If this drifts, the formula is wrong.
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });
});

describe('contrastRatioRounded', () => {
  it('truncates rather than rounds, so a reported 4.5 is genuinely 4.5', () => {
    // Rounding would report 4.5 for a ratio of 4.497, which is a failing value.
    expect(contrastRatioRounded('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('reports at most two decimals', () => {
    const value = contrastRatioRounded('#142B49', '#FAF7F2');
    expect(value).toBe(Math.floor(value * 100) / 100);
  });
});

describe('meetsAA', () => {
  it('defaults to the body-text threshold', () => {
    expect(AA.normalText).toBe(4.5);
    expect(meetsAA('#767676', '#FFFFFF')).toBe(true);
    expect(meetsAA('#777777', '#FFFFFF')).toBe(false);
  });

  it('applies the lower threshold to large text and UI components', () => {
    // Brand gold on ivory: too weak for body text, acceptable for a heading.
    expect(meetsAA('#B77A17', '#FAF7F2', 'normalText')).toBe(false);
    expect(meetsAA('#B77A17', '#FAF7F2', 'largeText')).toBe(true);
    expect(meetsAA('#B77A17', '#FAF7F2', 'uiComponent')).toBe(true);
  });
});
