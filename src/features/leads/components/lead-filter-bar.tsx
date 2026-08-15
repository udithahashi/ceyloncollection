'use client';

/**
 * The filter bar over the leads list.
 *
 * A real `<form method="get">`, which matters for two reasons. It works with JavaScript
 * disabled or still loading - the filters are the primary way to use this page, so they
 * should not depend on a bundle arriving. And the result is a URL, which means a
 * filtered view can be bookmarked and sent to someone.
 *
 * The one enhancement on top is the submit handler: it rebuilds the query string with
 * the empty fields dropped, so a filtered URL reads `?status=...&open=1` rather than
 * `?q=&status=...&platform=&category=&...`. Without JavaScript the browser submits
 * everything, including the blanks, and the page still renders correctly - the filter
 * parser treats an empty value as absent.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Field, controlClasses, fieldWiring } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { cn } from '@/lib/cn';

import { activeFilterCount, leadSorts, pageSizes, type LeadFilters } from '../filters';
import type { LeadFormOptions } from '../queries';

export function LeadFilterBar({
  options,
  filters,
  today,
}: {
  options: LeadFormOptions;
  filters: LeadFilters;
  today: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  /** Extra filters are folded away until wanted: five is the common case, sixteen is not. */
  const [showAll, setShowAll] = useState(
    filters.fabric !== undefined ||
      filters.gender !== undefined ||
      filters.size !== undefined ||
      filters.tag !== undefined ||
      filters.from !== undefined ||
      filters.to !== undefined
  );

  const active = activeFilterCount(filters);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
      if (typeof value !== 'string' || value === '') continue;
      // Any change to a filter belongs on page one; keeping the page number usually
      // lands on an empty page, which reads as "no results" rather than "wrong page".
      if (key === 'page') continue;
      params.set(key, value);
    }

    params.sort();
    const query = params.toString();
    router.push(query === '' ? '/admin/leads' : `/admin/leads?${query}`);
  }

  return (
    <form
      ref={formRef}
      method="get"
      action="/admin/leads"
      onSubmit={submit}
      className="flex flex-col gap-4"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="q" label="Search" className="sm:col-span-2">
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q ?? ''}
            placeholder="Name, number, request, or lead number"
            className={cn(controlClasses, 'h-9')}
          />
        </Field>

        <Select
          name="status"
          label="Status"
          defaultValue={filters.status}
          options={options.statuses}
        />

        <Select
          name="platform"
          label="Platform"
          defaultValue={filters.platform}
          options={options.platforms}
        />

        <Picker
          name="category"
          label="Category"
          defaultValue={filters.category}
          options={options.categories}
        />

        <Picker
          name="subcategory"
          label="Product"
          defaultValue={filters.subcategory}
          options={options.subcategories}
        />

        <Select
          name="urgency"
          label="Urgency"
          defaultValue={filters.urgency}
          options={options.urgencies}
        />

        <Select name="city" label="City" defaultValue={filters.city} options={options.cities} />
      </div>

      {showAll ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Picker
            name="fabric"
            label="Fabric"
            defaultValue={filters.fabric}
            options={options.fabrics}
          />

          <Select
            name="gender"
            label="Who it is for"
            defaultValue={filters.gender}
            options={options.genders}
          />

          <Picker name="size" label="Size" defaultValue={filters.size} options={options.sizes} />

          <Picker name="tag" label="Tag" defaultValue={filters.tag} options={options.tags} />

          <Field id="from" label="Contacted from">
            <input
              id="from"
              name="from"
              type="date"
              max={today}
              defaultValue={filters.from ?? ''}
              className={cn(controlClasses, 'h-9')}
            />
          </Field>

          <Field id="to" label="Contacted up to">
            <input
              id="to"
              name="to"
              type="date"
              max={today}
              defaultValue={filters.to ?? ''}
              className={cn(controlClasses, 'h-9')}
            />
          </Field>

          <Select
            name="sort"
            label="Order"
            defaultValue={filters.sort}
            options={Object.entries(leadSorts).map(([value, label]) => ({ value, label }))}
            includeBlank={false}
          />

          <Select
            name="per"
            label="Rows per page"
            defaultValue={String(filters.per)}
            options={pageSizes.map((size) => ({ value: String(size), label: `${size} rows` }))}
            includeBlank={false}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton variant="primary" size="sm">
          Apply
        </SubmitButton>

        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {showAll ? 'Fewer filters' : 'More filters'}
        </button>

        {active > 0 ? (
          <>
            <Link href="/admin/leads" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              Clear
            </Link>

            <span className="text-xs text-ink-secondary">
              {active} {active === 1 ? 'filter' : 'filters'} applied
            </span>
          </>
        ) : null}

        <label className="ml-auto flex items-center gap-2 text-sm text-ink-primary">
          <input
            type="checkbox"
            name="open"
            value="1"
            defaultChecked={filters.open}
            className="size-4 rounded-control border-line-strong"
          />
          Open only
        </label>

        <label className="flex items-center gap-2 text-sm text-ink-primary">
          <input
            type="checkbox"
            name="ready"
            value="1"
            defaultChecked={filters.ready}
            className="size-4 rounded-control border-line-strong"
          />
          Ready to buy
        </label>
      </div>

      {/* Carried across so applying a filter does not silently reset a chosen order. */}
      {showAll ? null : (
        <>
          <input type="hidden" name="sort" value={filters.sort} />
          <input type="hidden" name="per" value={String(filters.per)} />
        </>
      )}
    </form>
  );
}

/**
 * A native select, for a list short enough to scroll.
 *
 * Native rather than the combobox on purpose: for eleven statuses it is faster, needs
 * no JavaScript, and on a phone it opens the platform's own picker.
 */
function Select({
  name,
  label,
  defaultValue,
  options,
  includeBlank = true,
}: {
  name: string;
  label: string;
  defaultValue: string | undefined;
  options: readonly { value: string; label: string }[];
  includeBlank?: boolean;
}) {
  const { control } = fieldWiring({ id: `filter-${name}` });

  return (
    <Field id={`filter-${name}`} label={label}>
      <select
        {...control}
        name={name}
        defaultValue={defaultValue ?? ''}
        className={cn(controlClasses, 'h-9 pr-8')}
      >
        {includeBlank ? <option value="">Any</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** A searchable picker, for the lists that run to hundreds of values. */
function Picker({
  name,
  label,
  defaultValue,
  options,
}: {
  name: string;
  label: string;
  defaultValue: string | undefined;
  options: readonly { value: string; label: string; group?: string }[];
}) {
  const id = `filter-${name}`;
  const { control } = fieldWiring({ id });

  return (
    <Field id={id} label={label}>
      <Combobox
        name={name}
        id={control.id}
        options={options}
        defaultValue={defaultValue ?? ''}
        clearLabel="Any"
        placeholder="Any"
        emptyMessage="Nothing matched."
      />
    </Field>
  );
}
