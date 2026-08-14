/**
 * Slugs: the stable machine name for a taxonomy value.
 *
 * Every taxonomy row has one, and it matters more than it looks. The display
 * name is the business's to change - "Lost/Cancelled" may well become "Closed"
 * one day - but three other things need a name that never moves:
 *
 *   - the seed script, which must be safe to re-run without duplicating rows;
 *   - the n8n intake, which arrives with text like "whatsapp" and has to resolve
 *     it to a row without a human in the loop;
 *   - CSV import of the existing spreadsheet.
 *
 * So the slug is generated once from the name and then left alone.
 */

/**
 * `Sarongs & Sarams` becomes `sarongs-and-sarams`, `Skirt (Long)` becomes
 * `skirt-long`, `3/4 Sleeve` becomes `3-4-sleeve`.
 *
 * `&` becomes `and` rather than being dropped, because dropping it would collide
 * two genuinely different names more often than you would expect. Apostrophes go
 * the other way and are deleted, so `Men's Wear` reads `mens-wear` rather than
 * `men-s-wear`. Accents are decomposed and stripped so a pasted `Café` cannot
 * produce a slug that no keyboard can reproduce.
 */
export function slugify(value: string): string {
  return (
    value
      .normalize('NFKD')
      // Strip the combining accents left behind by NFKD.
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      // Straight and curly apostrophes, closed up rather than turned into a dash.
      .replace(/['\u2019]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

/**
 * A slug that does not already exist in `taken`, by appending `-2`, `-3` and so
 * on. For the rare genuine clash: two fabrics both named "Cotton" in different
 * letter case, say.
 */
export function uniqueSlug(value: string, taken: Iterable<string>): string {
  const existing = new Set(taken);
  const base = slugify(value);

  if (!existing.has(base)) return base;

  for (let suffix = 2; ; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
}
