/**
 * Fills the database with invented leads, so the charts can be looked at.
 *
 *   npm run db:demo          adds ~140 leads over the last 90 days
 *   npm run db:demo -- 400   adds that many instead
 *   npm run db:demo -- clear removes every demo lead and customer again
 *
 * WHY THIS EXISTS
 * A dashboard cannot be reviewed against an empty table: zero-filled gaps, folded long
 * tails, colour separation between eight series and the readability of a 90-day axis are
 * all invisible until there are rows. Guessing at them is how a chart that looks fine in
 * development turns out unreadable on real data.
 *
 * WHY IT IS SAFE
 * Refuses to run against a production deployment, and every row it writes is marked
 * `source = 'import'` with a `[demo]` note, so `clear` can find its own rows and nothing
 * else. It never touches the taxonomy.
 */
// Must come first: it populates process.env before the env module validates it.
import './load-env.mts';

import { eq, ilike } from 'drizzle-orm';

import { db, sql } from '../src/db/client';
import { customers } from '../src/db/schema/customers';
import { leads, leadTags } from '../src/db/schema/leads';
import {
  categories,
  cities,
  clothGenders,
  fabrics,
  leadStatuses,
  platforms,
  sizes,
  subcategories,
  tags,
  urgencyLevels,
} from '../src/db/schema/taxonomy';
import { isProductionDeployment } from '../src/lib/env';

const MARKER = '[demo]';

if (isProductionDeployment) {
  console.error('Refusing to write invented leads to a production deployment.');
  process.exit(1);
}

const argument = process.argv[2];
const clearing = argument === 'clear';
const count = clearing ? 0 : Number(argument ?? 140);

if (!clearing && (!Number.isInteger(count) || count < 1 || count > 5000)) {
  console.error('Give a whole number of leads between 1 and 5000, or "clear".');
  process.exit(1);
}

try {
  if (clearing) {
    // Leads first: the foreign key to customers is `restrict`, deliberately, so that a
    // customer with history cannot be deleted out from under it. Tags cascade from the
    // lead.
    const removedLeads = await db
      .delete(leads)
      .where(ilike(leads.notes, `${MARKER}%`))
      .returning({ id: leads.id });

    const removedCustomers = await db
      .delete(customers)
      .where(ilike(customers.notes, `${MARKER}%`))
      .returning({ id: customers.id });

    console.log(
      `Removed ${removedLeads.length} demo leads and ${removedCustomers.length} demo customers.`
    );
  } else {
    await generate(count);
  }
} catch (error) {
  console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}

async function generate(total: number) {
  const [
    statusRows,
    platformRows,
    cityRows,
    genderRows,
    fabricRows,
    sizeRows,
    urgencyRows,
    subcategoryRows,
    tagRows,
  ] = await Promise.all([
    db.select({ id: leadStatuses.id, name: leadStatuses.name }).from(leadStatuses),
    db.select({ id: platforms.id, name: platforms.name }).from(platforms),
    db.select({ id: cities.id }).from(cities),
    db.select({ id: clothGenders.id }).from(clothGenders),
    db.select({ id: fabrics.id }).from(fabrics),
    db.select({ id: sizes.id }).from(sizes),
    db.select({ id: urgencyLevels.id }).from(urgencyLevels),
    db
      .select({ id: subcategories.id, categoryId: subcategories.categoryId })
      .from(subcategories)
      .innerJoin(categories, eq(categories.id, subcategories.categoryId)),
    db.select({ id: tags.id }).from(tags),
  ]);

  if (statusRows.length === 0 || platformRows.length === 0) {
    throw new Error('Seed the taxonomy first: npm run db:seed');
  }

  /*
   * A deterministic generator, so two runs of the same size produce the same picture and
   * a chart that looked wrong can be looked at again.
   */
  let seed = 20260814;
  const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  /*
   * Weighted pick: a real distribution has a head and a long tail, not a flat line.
   *
   * The trailing comma on the type parameter is required in a .mts file, where `<T>` on
   * its own would be read as the start of JSX.
   */
  const pick = <T,>(rows: readonly T[]): T => {
    const skewed = Math.floor(rows.length * random() ** 2.2);
    return rows[Math.min(skewed, rows.length - 1)] as T;
  };

  const maybe = <T,>(rows: readonly T[], chance: number): T | null =>
    random() < chance ? pick(rows) : null;

  // Roughly three enquiries per person, so repeat-customer figures have something in
  // them. Numbers are in Qatar's mobile range but deliberately not anyone's: 33 000 000
  // upwards is unallocated.
  const people = Math.max(4, Math.round(total / 2.6));

  const customerIds: string[] = [];

  for (let index = 0; index < people; index += 1) {
    const number = `+9743${String(1000000 + index).slice(0, 7)}`;

    const [row] = await db
      .insert(customers)
      .values({
        phone: number,
        name: `${MARKER} Customer ${index + 1}`,
        cityId: maybe(cityRows, 0.85)?.id ?? null,
        onWhatsapp: random() < 0.8,
        notes: `${MARKER} invented row from npm run db:demo`,
      })
      .onConflictDoNothing()
      .returning({ id: customers.id });

    if (row !== undefined) customerIds.push(row.id);
  }

  if (customerIds.length === 0) {
    throw new Error('The demo customers already exist. Run "npm run db:demo -- clear" first.');
  }

  let written = 0;

  for (let index = 0; index < total; index += 1) {
    const customerId = customerIds[Math.floor(random() * customerIds.length)] as string;

    /*
     * Spread over 90 days, weighted towards recent weeks so the trend line has a shape,
     * with the occasional quiet day left empty to prove the zero-filling.
     */
    const daysAgo = Math.floor(90 * random() ** 1.6);
    const contactedAt = new Date(Date.now() - daysAgo * 86_400_000 - random() * 43_200_000);

    const subcategory = maybe(subcategoryRows, 0.85);

    const [lead] = await db
      .insert(leads)
      .values({
        customerId,
        contactedAt: contactedAt.toISOString(),
        platformId: pick(platformRows).id,
        statusId: pick(statusRows).id,
        subcategoryId: subcategory?.id ?? null,
        categoryId: subcategory?.categoryId ?? null,
        clothGenderId: maybe(genderRows, 0.7)?.id ?? null,
        fabricId: maybe(fabricRows, 0.6)?.id ?? null,
        sizeId: maybe(sizeRows, 0.55)?.id ?? null,
        urgencyId: maybe(urgencyRows, 0.75)?.id ?? null,
        quantity: random() < 0.5 ? 1 + Math.floor(random() * 4) : null,
        request: random() < 0.3 ? `${MARKER} asked about the one in the third photo` : null,
        notes: `${MARKER} invented row`,
        source: 'import',
      })
      .returning({ id: leads.id });

    if (lead === undefined) continue;
    written += 1;

    // Two or three tags on about half of them, which is what makes the tag chart
    // deliberately sum to more than the number of enquiries.
    if (tagRows.length > 0 && random() < 0.5) {
      const chosen = new Set<string>();
      const wanted = 1 + Math.floor(random() * 3);

      while (chosen.size < wanted) chosen.add(pick(tagRows).id);

      await db
        .insert(leadTags)
        .values([...chosen].map((tagId) => ({ leadId: lead.id, tagId })))
        .onConflictDoNothing();
    }
  }

  console.log(`Wrote ${written} demo leads across ${customerIds.length} customers.`);
  console.log('Open http://localhost:3000/analytics/demand to see them.');
  console.log('Remove them again with: npm run db:demo -- clear');
}
