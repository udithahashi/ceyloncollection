/**
 * These tests read the real seed data, because the risk is not the algorithm - it
 * is the several hundred names transcribed by hand. A duplicate slug inside one
 * table is a constraint violation halfway through a seed on a live database;
 * caught here it is a red line in CI.
 *
 * No database is involved: `buildRows` is a pure function.
 */
import { describe, expect, it } from 'vitest';

import { slugify } from '@/lib/slug';

import { buildRows } from './taxonomy';
import {
  seedCategories,
  seedCities,
  seedClothGenders,
  seedFabrics,
  seedLeadStatuses,
  seedPlatforms,
  seedSizes,
  seedTags,
  seedUrgencyLevels,
} from './taxonomy-data';

const flatTables = [
  ['lead statuses', seedLeadStatuses],
  ['platforms', seedPlatforms],
  ['cloth genders', seedClothGenders],
  ['sizes', seedSizes],
  ['cities', seedCities],
  ['urgency levels', seedUrgencyLevels],
  ['fabrics', seedFabrics],
  ['tags', seedTags],
] as const;

describe('buildRows', () => {
  it('numbers in tens so a value can be slotted in later', () => {
    const rows = buildRows([{ name: 'First' }, { name: 'Second' }, { name: 'Third' }], 'test');

    expect(rows.map((row) => row.sortOrder)).toEqual([10, 20, 30]);
  });

  it('names the offending pair when two values collide', () => {
    expect(() =>
      buildRows([{ name: 'Ready to Buy' }, { name: 'Ready To Buy' }], 'urgency')
    ).toThrow(/urgency: "Ready To Buy" and "Ready to Buy" both slugify to "ready-to-buy"/);
  });

  it('keeps the fields the caller supplied', () => {
    const [row] = buildRows([{ name: 'Delivered', tone: 'success' as const }], 'test');

    expect(row).toMatchObject({ name: 'Delivered', tone: 'success', slug: 'delivered' });
  });
});

describe('the seed data', () => {
  it.each(flatTables)('gives %s a unique slug per row', (label, values) => {
    expect(() => buildRows(values, label)).not.toThrow();
  });

  it('gives every category a unique slug', () => {
    expect(() => buildRows(seedCategories, 'categories')).not.toThrow();
  });

  it.each(seedCategories.map((category) => [category.name, category] as const))(
    'gives every sub-category of %s a unique slug',
    (label, category) => {
      expect(() =>
        buildRows(
          category.subcategories.map((name) => ({ name })),
          label
        )
      ).not.toThrow();
    }
  );

  it('produces slugs that are safe in a URL', () => {
    const everyName = [
      ...flatTables.flatMap(([, values]) => values.map((value) => value.name)),
      ...seedCategories.flatMap((category) => [category.name, ...category.subcategories]),
    ];

    for (const name of everyName) {
      expect(slugify(name), `${name} should slugify to a-z0-9 and dashes`).toMatch(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      );
    }
  });

  it('repeats a sub-category name across parents on purpose', () => {
    // "Batik Saree" belongs under both the craft and the garment type. The schema
    // allows it because sub-category slugs are unique per category, and this test
    // exists so that constraint is never "tightened" by mistake.
    const parentsOfBatikSaree = seedCategories
      .filter((category) => category.subcategories.includes('Batik Saree'))
      .map((category) => category.name);

    expect(parentsOfBatikSaree).toEqual(['Batik Wear', 'Sarees & Osari']);
  });

  it('covers the whole vocabulary the business gave us', () => {
    // Counts, not contents: if a list is edited these numbers should be updated
    // deliberately, which is the point. They are a guard against a silent
    // truncation - a stray comma deleting fifty tags.
    expect(seedLeadStatuses).toHaveLength(10);
    expect(seedPlatforms).toHaveLength(9);
    expect(seedCities).toHaveLength(13);
    expect(seedUrgencyLevels).toHaveLength(5);
    expect(seedFabrics).toHaveLength(23);
    expect(seedCategories).toHaveLength(18);
    expect(seedCategories.flatMap((category) => category.subcategories)).toHaveLength(165);
    expect(seedTags).toHaveLength(122);
  });

  it('marks exactly one status as the sale', () => {
    expect(seedLeadStatuses.filter((status) => status.isWon)).toHaveLength(1);
  });

  it('marks the statuses a lead can end on', () => {
    const terminal = seedLeadStatuses.filter((status) => status.isTerminal).map((s) => s.name);

    expect(terminal).toEqual(['Delivered', 'Lost/Cancelled']);
  });

  it('marks the urgencies that mean a customer is ready', () => {
    const ready = seedUrgencyLevels.filter((level) => level.isReadyToBuy).map((l) => l.name);

    expect(ready).toEqual(['Ready to Buy', 'Urgent - This Week']);
  });
});
