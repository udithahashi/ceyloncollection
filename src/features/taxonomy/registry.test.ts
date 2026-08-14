/**
 * The registry drives ten pages, ten forms and ten validation schemas, so a gap in
 * it is a gap in all of them. These tests keep it in step with the database:
 * an extra field the schema does not validate would be silently discarded, and a
 * column the registry does not declare would be invisible in the UI.
 */
import { getTableColumns } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  isTaxonomyKey,
  taxonomyKeys,
  taxonomyTables,
  type TaxonomyKey,
} from '@/db/schema/taxonomy';
import { badgeTones } from '@/lib/theme/tones';

import { extraOfKind, parentField, taxonomies, taxonomySections } from './registry';
import { taxonomyEditSchema, taxonomyValueSchema } from './schemas';

/** The columns every taxonomy shares, which the registry does not need to declare. */
const SHARED = new Set([
  'id',
  'name',
  'slug',
  'description',
  'sortOrder',
  'isActive',
  'createdAt',
  'updatedAt',
  'deletedAt',
]);

describe('the registry', () => {
  it('describes every taxonomy in the database and no others', () => {
    expect(Object.keys(taxonomies).sort()).toEqual([...taxonomyKeys].sort());
  });

  it.each(taxonomyKeys)('declares every extra column of %s', (key) => {
    const columns = Object.keys(getTableColumns(taxonomyTables[key])).filter(
      (column) => !SHARED.has(column)
    );
    const declared = taxonomies[key].extras.map((extra) => extra.column);

    expect(declared.sort(), `${key} has undeclared columns`).toEqual(columns.sort());
  });

  it('puts every taxonomy in exactly one section', () => {
    const listed = taxonomySections.flatMap((section) => section.keys);

    expect(listed.sort()).toEqual([...taxonomyKeys].sort());
    expect(new Set(listed).size, 'a taxonomy appears twice').toBe(listed.length);
  });

  it('writes a purpose worth reading', () => {
    for (const key of taxonomyKeys) {
      const { purpose, singular, plural } = taxonomies[key];

      expect(purpose.length, `${key} needs a real sentence`).toBeGreaterThan(30);
      expect(purpose.endsWith('.'), `${key} purpose should end in a full stop`).toBe(true);
      expect(singular).not.toBe('');
      expect(plural).not.toBe('');
    }
  });

  it('gives every extra field a hint, because none of them are self-explanatory', () => {
    for (const key of taxonomyKeys) {
      for (const extra of taxonomies[key].extras) {
        expect(extra.hint.length, `${key}.${extra.column} needs a hint`).toBeGreaterThan(10);
        expect(extra.label).not.toBe('');
      }
    }
  });

  it('finds only sub-categories hanging off a parent', () => {
    const withParent = taxonomyKeys.filter((key) => parentField(key) !== null);
    expect(withParent).toEqual(['subcategories']);
  });

  it('offers a badge colour on the two taxonomies that wear one', () => {
    const withTone = taxonomyKeys.filter((key) => extraOfKind(key, 'tone') !== null);
    expect(withTone.sort()).toEqual(['lead-statuses', 'urgency-levels']);
  });
});

describe('the URL segment', () => {
  it.each(taxonomyKeys)('%s is a valid key', (key) => {
    expect(isTaxonomyKey(key)).toBe(true);
  });

  it('rejects anything else, since the key chooses which table is written', () => {
    for (const attempt of ['', 'leads', 'app_user', '../categories', 'CATEGORIES']) {
      expect(isTaxonomyKey(attempt), `${attempt} should not be a taxonomy`).toBe(false);
    }
  });

  it('is safe in a path: lower case, letters and dashes only', () => {
    for (const key of taxonomyKeys) {
      expect(key).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    }
  });
});

describe('the generated schemas', () => {
  const minimal = (key: TaxonomyKey) => ({ key, name: 'Test value' });

  it.each(taxonomyKeys)('accepts a name alone for %s where nothing else is required', (key) => {
    const result = taxonomyValueSchema(key).safeParse(minimal(key));
    const requiresParent = parentField(key) !== null;
    const requiresChoice = extraOfKind(key, 'choice') !== null;
    const requiresTone = extraOfKind(key, 'tone') !== null;

    expect(result.success).toBe(!requiresParent && !requiresChoice && !requiresTone);
  });

  it('requires a category on a sub-category rather than failing in the database', () => {
    const result = taxonomyValueSchema('subcategories').safeParse(minimal('subcategories'));

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path.join('.'))).toContain('categoryId');
    }
  });

  it('strips an extra that belongs to a different taxonomy', () => {
    // A tone sent to `fabrics` is not a validation error - it is simply not a field
    // of that taxonomy, and Zod's default is to drop it. What matters is that it
    // never reaches the insert.
    const parsed = taxonomyValueSchema('fabrics').parse({
      key: 'fabrics',
      name: 'Cotton Voile',
      tone: 'success',
    });

    expect(parsed).not.toHaveProperty('tone');
  });

  it('accepts only the tones a badge can render', () => {
    for (const tone of badgeTones) {
      expect(
        taxonomyValueSchema('lead-statuses').safeParse({
          key: 'lead-statuses',
          name: 'Quoted',
          tone,
        }).success
      ).toBe(true);
    }

    expect(
      taxonomyValueSchema('lead-statuses').safeParse({
        key: 'lead-statuses',
        name: 'Quoted',
        tone: 'purple',
      }).success
    ).toBe(false);
  });

  it('reads a ticked checkbox, and an absent one as false', () => {
    // The parsed shape is decided at runtime by the taxonomy, so the extras are
    // only known by name here.
    const parse = (input: Record<string, unknown>) =>
      taxonomyValueSchema('platforms').parse(input) as Record<string, unknown>;

    expect(parse({ key: 'platforms', name: 'Threads', isSocial: 'on' }).isSocial).toBe(true);
    expect(parse({ key: 'platforms', name: 'Threads' }).isSocial).toBe(false);
  });

  it('trims a name and refuses one made only of spaces', () => {
    expect(taxonomyValueSchema('fabrics').parse({ key: 'fabrics', name: '  Linen  ' }).name).toBe(
      'Linen'
    );

    expect(taxonomyValueSchema('fabrics').safeParse({ key: 'fabrics', name: '   ' }).success).toBe(
      false
    );
  });

  it('turns an empty note into null rather than an empty string', () => {
    const parsed = taxonomyValueSchema('cities').parse({
      key: 'cities',
      name: 'Al Sailiya',
      description: '',
    });

    expect(parsed.description).toBeNull();
  });

  it('will not take a name that cannot fit in a dropdown', () => {
    const result = taxonomyValueSchema('tags').safeParse({
      key: 'tags',
      name: 'x'.repeat(81),
      tagGroup: 'details',
    });

    expect(result.success).toBe(false);
  });

  it('needs a row id to edit', () => {
    const withoutId = taxonomyEditSchema('fabrics').safeParse({ key: 'fabrics', name: 'Linen' });
    const withBadId = taxonomyEditSchema('fabrics').safeParse({
      key: 'fabrics',
      name: 'Linen',
      id: '7',
    });

    expect(withoutId.success).toBe(false);
    expect(withBadId.success).toBe(false);
  });

  it('never lets a form set the slug or the sort order', () => {
    // The slug is a machine key and the order is changed by the move buttons. If
    // either were a form field, an edit could break an integration or silently send
    // a row to the top of the list.
    const parsed = taxonomyValueSchema('fabrics').parse({
      key: 'fabrics',
      name: 'Linen',
      slug: 'something-else',
      sortOrder: '1',
    });

    expect(parsed).not.toHaveProperty('slug');
    expect(parsed).not.toHaveProperty('sortOrder');
  });
});
