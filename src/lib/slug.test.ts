import { describe, expect, it } from 'vitest';

import { slugify, uniqueSlug } from './slug';

describe('slugify', () => {
  it('lowercases and joins words with a dash', () => {
    expect(slugify('New Inquiry')).toBe('new-inquiry');
    expect(slugify('Ready to Buy')).toBe('ready-to-buy');
  });

  it('spells out an ampersand rather than dropping it', () => {
    // Dropping it would turn both "Sarongs & Sarams" and "Sarongs Sarams" into
    // the same slug, and collisions in a machine key are expensive to unpick.
    expect(slugify('Sarongs & Sarams')).toBe('sarongs-and-sarams');
    expect(slugify('Ethnic & Kurta Sets')).toBe('ethnic-and-kurta-sets');
  });

  it('handles the punctuation in the real taxonomy', () => {
    expect(slugify('Lost/Cancelled')).toBe('lost-cancelled');
    expect(slugify('Skirt (Long)')).toBe('skirt-long');
    expect(slugify('3/4 Sleeve')).toBe('3-4-sleeve');
    expect(slugify('Urgent - This Week')).toBe('urgent-this-week');
    expect(slugify('Kids 11-12Y')).toBe('kids-11-12y');
  });

  it('closes up an apostrophe rather than making it a dash', () => {
    expect(slugify("Men's Wear")).toBe('mens-wear');
    // A pasted curly apostrophe has to behave the same, or the same name typed
    // in two places produces two rows.
    expect(slugify('Men\u2019s Wear')).toBe('mens-wear');
  });

  it('strips accents instead of encoding them', () => {
    expect(slugify('Café Crème')).toBe('cafe-creme');
  });

  it('never returns an empty string', () => {
    // An empty slug would violate NOT NULL in a way that is hard to trace back
    // to the name that caused it.
    expect(slugify('!!!')).toBe('item');
    expect(slugify('')).toBe('item');
  });

  it('is idempotent, so re-slugging a slug changes nothing', () => {
    const once = slugify('Nightwear & Loungewear');
    expect(slugify(once)).toBe(once);
  });
});

describe('uniqueSlug', () => {
  it('returns the plain slug when it is free', () => {
    expect(uniqueSlug('Cotton', [])).toBe('cotton');
    expect(uniqueSlug('Cotton', ['linen'])).toBe('cotton');
  });

  it('numbers from two upward on a clash', () => {
    expect(uniqueSlug('Cotton', ['cotton'])).toBe('cotton-2');
    expect(uniqueSlug('Cotton', ['cotton', 'cotton-2'])).toBe('cotton-3');
  });

  it('skips a gap rather than reusing it', () => {
    // `cotton-2` is taken by a row that may still be referenced, so the next
    // free number is what is wanted, not the lowest unused one.
    expect(uniqueSlug('Cotton', ['cotton', 'cotton-2', 'cotton-4'])).toBe('cotton-3');
  });
});
