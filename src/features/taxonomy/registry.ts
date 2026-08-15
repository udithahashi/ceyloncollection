/**
 * One description of the ten taxonomies, used by everything else.
 *
 * The alternative was ten near-identical pages, ten Zod schemas and ten sets of
 * Server Actions differing only in a table name and a label. That is a lot of
 * code to keep in step, and the day someone adds an eleventh taxonomy they would
 * have to find all of it.
 *
 * So the shape of each taxonomy is data. Everything the ten have in common -
 * name, description, order, active - is handled once. The few columns that differ
 * are declared here as `extras` and rendered generically.
 *
 * The key is the URL segment, so `/admin/taxonomy/lead-statuses` needs no lookup table.
 *
 * Safe to import in a client component: labels and field descriptions only, no
 * database.
 */
import {
  isTaxonomyKey,
  sizeGroups,
  tagGroupLabels,
  tagGroups,
  taxonomyKeys,
  type SizeGroup,
  type TaxonomyKey,
} from '@/db/schema/taxonomy';
import { badgeTones } from '@/lib/theme/tones';

/**
 * An extra column, beyond the five every taxonomy has.
 *
 * - `flag` a yes/no that changes how the value behaves, e.g. "counts as a sale".
 * - `choice` a fixed set of strings, e.g. which group a size belongs to.
 * - `tone` the colour a badge wears. A choice, but worth its own kind so the form
 *   can show the colour rather than the word.
 * - `parent` a reference to another taxonomy row. Only sub-categories have one.
 */
export type ExtraField =
  | {
      kind: 'flag';
      column: 'isTerminal' | 'isWon' | 'isSocial' | 'isReadyToBuy';
      label: string;
      hint: string;
    }
  | {
      kind: 'choice';
      column: 'sizeGroup' | 'tagGroup';
      label: string;
      hint: string;
      options: readonly { value: string; label: string }[];
    }
  | { kind: 'tone'; column: 'tone'; label: string; hint: string }
  | { kind: 'parent'; column: 'categoryId'; label: string; hint: string; parent: TaxonomyKey };

/** The column an extra field writes to. Used to build the Zod schema. */
export type ExtraColumn = ExtraField['column'];

export interface TaxonomyDefinition {
  key: TaxonomyKey;
  /** What one row is called, e.g. "status". Used in buttons and messages. */
  singular: string;
  /** What the set is called, e.g. "Statuses". The page title. */
  plural: string;
  /** One sentence explaining what the list is for. */
  purpose: string;
  /** Grouping on the taxonomy index, so ten lists read as three ideas. */
  section: 'Lead handling' | 'Product' | 'Customer';
  extras: readonly ExtraField[];
}

const sizeGroupLabels: Record<SizeGroup, string> = {
  adult: 'Adult',
  kids: 'Children',
  other: 'Other',
};

/** Tone choices for a badge colour field, in the order they read best. */
export const toneOptions = badgeTones.map((tone) => ({
  value: tone,
  label: tone.charAt(0).toUpperCase() + tone.slice(1),
}));

export const taxonomies: Record<TaxonomyKey, TaxonomyDefinition> = {
  'lead-statuses': {
    key: 'lead-statuses',
    singular: 'status',
    plural: 'Statuses',
    purpose:
      'Where a lead has reached. The order here is the order of the funnel, so it is worth keeping it true to how you actually work.',
    section: 'Lead handling',
    extras: [
      {
        kind: 'tone',
        column: 'tone',
        label: 'Badge colour',
        hint: 'How this status is coloured wherever it appears.',
      },
      {
        kind: 'flag',
        column: 'isTerminal',
        label: 'Closes the lead',
        hint: 'Nothing further is expected, so the lead stops counting as open.',
      },
      {
        kind: 'flag',
        column: 'isWon',
        label: 'Counts as a sale',
        hint: 'Used by the conversion figures. Normally only one status has this.',
      },
    ],
  },
  platforms: {
    key: 'platforms',
    singular: 'platform',
    plural: 'Platforms',
    purpose:
      'Where the enquiry came from. This is what tells you which channel is worth your time.',
    section: 'Lead handling',
    extras: [
      {
        kind: 'flag',
        column: 'isSocial',
        label: 'Social channel',
        hint: 'Separates the channels you post on from word of mouth in the reports.',
      },
    ],
  },
  'urgency-levels': {
    key: 'urgency-levels',
    singular: 'urgency level',
    plural: 'Urgency',
    purpose: 'How ready the customer is to buy, in their terms rather than yours.',
    section: 'Lead handling',
    extras: [
      {
        kind: 'tone',
        column: 'tone',
        label: 'Badge colour',
        hint: 'How this level is coloured wherever it appears.',
      },
      {
        kind: 'flag',
        column: 'isReadyToBuy',
        label: 'Ready to buy',
        hint: 'Counted in the "ready to buy" figure on the customer list.',
      },
    ],
  },
  categories: {
    key: 'categories',
    singular: 'category',
    plural: 'Categories',
    purpose: 'The top level of the product list. Each one holds its own sub-categories.',
    section: 'Product',
    extras: [],
  },
  subcategories: {
    key: 'subcategories',
    singular: 'sub-category',
    plural: 'Sub-categories',
    purpose:
      'The specific garment. A name may repeat under a different category - Batik Saree is both a batik piece and a saree - and that is intended.',
    section: 'Product',
    extras: [
      {
        kind: 'parent',
        column: 'categoryId',
        label: 'Category',
        hint: 'Which category this garment belongs under.',
        parent: 'categories',
      },
    ],
  },
  fabrics: {
    key: 'fabrics',
    singular: 'fabric',
    plural: 'Fabrics',
    purpose:
      'The material. It is the reason the business exists, so this is the list to keep closest to what customers actually say.',
    section: 'Product',
    extras: [],
  },
  'cloth-genders': {
    key: 'cloth-genders',
    singular: 'garment gender',
    plural: 'Garment gender',
    purpose: 'Who the garment is for. Not the customer - the clothing.',
    section: 'Product',
    extras: [],
  },
  sizes: {
    key: 'sizes',
    singular: 'size',
    plural: 'Sizes',
    purpose: 'Adult sizes, children by age, and the two cases that are neither.',
    section: 'Product',
    extras: [
      {
        kind: 'choice',
        column: 'sizeGroup',
        label: 'Group',
        hint: 'Keeps adult and children sizes apart in the dropdowns.',
        options: sizeGroups.map((group) => ({ value: group, label: sizeGroupLabels[group] })),
      },
    ],
  },
  tags: {
    key: 'tags',
    singular: 'tag',
    plural: 'Tags',
    purpose:
      'Everything else worth recording about a garment: print, cut, length, neckline, sleeve, occasion, detail, origin.',
    section: 'Product',
    extras: [
      {
        kind: 'choice',
        column: 'tagGroup',
        label: 'Group',
        hint: 'Which heading this tag appears under when picking tags.',
        options: tagGroups.map((group) => ({ value: group, label: tagGroupLabels[group] })),
      },
    ],
  },
  cities: {
    key: 'cities',
    singular: 'city or area',
    plural: 'Cities and areas',
    purpose: 'Where in Qatar the customer is. Municipalities, plus the districts people name.',
    section: 'Customer',
    extras: [],
  },
};

/** The taxonomies grouped for the index page, in reading order. */
export const taxonomySections = (['Lead handling', 'Product', 'Customer'] as const).map(
  (heading) => ({
    heading,
    keys: taxonomyKeys.filter((key) => taxonomies[key].section === heading),
  })
);

/** The definition for a URL segment, or null if it names nothing. */
export function taxonomyFromSlug(slug: string): TaxonomyDefinition | null {
  return isTaxonomyKey(slug) ? taxonomies[slug] : null;
}

/** The parent field of a taxonomy, if its rows hang off another taxonomy. */
export function parentField(key: TaxonomyKey): Extract<ExtraField, { kind: 'parent' }> | null {
  return taxonomies[key].extras.find((extra) => extra.kind === 'parent') ?? null;
}

/** The extra field of a given kind, if this taxonomy has one. */
export function extraOfKind<K extends ExtraField['kind']>(
  key: TaxonomyKey,
  kind: K
): Extract<ExtraField, { kind: K }> | null {
  return (taxonomies[key].extras.find((extra) => extra.kind === kind) ?? null) as Extract<
    ExtraField,
    { kind: K }
  > | null;
}

export type { TaxonomyKey };
