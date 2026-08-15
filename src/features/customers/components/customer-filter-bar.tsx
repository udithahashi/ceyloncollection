'use client';

/**
 * The filter bar over the customers list.
 *
 * Same construction as the one over the leads list: a real GET form, so it works before
 * the JavaScript arrives and produces a URL that can be shared; the submit handler only
 * exists to drop the empty fields from that URL.
 *
 * The presets are the part worth noticing. "Ready to buy" and "Quiet for a week" are
 * where this page earns its place - three questions get asked of a customer list, and
 * two of them should be one click.
 */
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Field, controlClasses, fieldWiring } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { cn } from '@/lib/cn';

import {
  activeFilterCount,
  customerSorts,
  pageSizes,
  toSearchParams,
  type CustomerFilters,
} from '../filters';
import { FOLLOW_UP_AFTER_DAYS } from '../summary';
import type { CustomerFilterOptions } from '../queries';

export function CustomerFilterBar({
  options,
  filters,
}: {
  options: CustomerFilterOptions;
  filters: CustomerFilters;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const active = activeFilterCount(filters);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const data = new FormData(event.currentTarget);
    const params = new URLSearchParams();

    for (const [key, value] of data.entries()) {
      if (typeof value !== 'string' || value === '') continue;
      if (key === 'page') continue;
      params.set(key, value);
    }

    params.sort();
    const query = params.toString();
    router.push(query === '' ? '/admin/customers' : `/admin/customers?${query}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink-secondary">Start from</span>

        <Preset href={`/admin/customers${toSearchParams({ ready: true, sort: 'ready' })}`}>
          Ready to buy
        </Preset>

        <Preset
          href={`/admin/customers${toSearchParams({
            open: true,
            quiet: FOLLOW_UP_AFTER_DAYS,
            sort: 'oldest',
          })}`}
        >
          Needs a follow-up
        </Preset>

        <Preset href={`/admin/customers${toSearchParams({ repeat: true, sort: 'requests' })}`}>
          Repeat customers
        </Preset>

        <Preset href="/admin/customers">Everyone</Preset>
      </div>

      <form
        ref={formRef}
        method="get"
        action="/admin/customers"
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
              placeholder="Name or number"
              className={cn(controlClasses, 'h-9')}
            />
          </Field>

          <Select
            name="platform"
            label="Came from"
            defaultValue={filters.platform}
            options={options.platforms}
          />

          <Select name="city" label="City" defaultValue={filters.city} options={options.cities} />

          <Select
            name="status"
            label="Latest status"
            defaultValue={filters.status}
            options={options.statuses}
          />

          <Field id="quiet" label="Quiet for at least" hint="Days since their last message.">
            <input
              id="quiet"
              name="quiet"
              type="number"
              min={1}
              max={3650}
              inputMode="numeric"
              defaultValue={filters.quiet ?? ''}
              placeholder="Any"
              className={cn(controlClasses, 'h-9')}
            />
          </Field>

          <Select
            name="sort"
            label="Order"
            defaultValue={filters.sort}
            options={Object.entries(customerSorts).map(([value, label]) => ({ value, label }))}
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

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="primary" size="sm">
            Apply
          </SubmitButton>

          {active > 0 ? (
            <>
              <Link
                href="/admin/customers"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
              >
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
            Has an open enquiry
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

          <label className="flex items-center gap-2 text-sm text-ink-primary">
            <input
              type="checkbox"
              name="repeat"
              value="1"
              defaultChecked={filters.repeat}
              className="size-4 rounded-control border-line-strong"
            />
            Came back
          </label>
        </div>
      </form>
    </div>
  );
}

/** A one-click view. A link, not a button, so it can be opened in a new tab. */
function Preset({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={buttonVariants({ variant: 'secondary', size: 'sm' })}>
      {children}
    </Link>
  );
}

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
