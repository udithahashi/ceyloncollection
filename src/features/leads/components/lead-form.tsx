'use client';

/**
 * The lead form: recording one enquiry.
 *
 * This is the screen that will get used most, so the shape of it is deliberate.
 *
 * FOUR REQUIRED FIELDS, TEN OPTIONAL ONES
 * Phone, date, platform, status. Everything describing the garment can be left blank,
 * because a first message usually is: "do you have batik frocks?" is a real lead, and
 * forcing a size onto it would be inventing data the business then reports on.
 *
 * THE ORDER IS THE ORDER OF THE CONVERSATION
 * Who they are, where they came from, what they want, how urgent it is. Not the order
 * of the database columns and not alphabetical - the person typing has a WhatsApp
 * thread open beside them and is reading down it.
 *
 * IT STAYS OPEN AFTER SAVING
 * Leads arrive in batches: one Facebook post produces fifteen comments in an evening.
 * After a save the fields clear and a line confirms what was saved with a link to it,
 * so fifteen entries cost fifteen forms rather than fifteen round trips through a
 * list page.
 */
import Link from 'next/link';
import { useActionState, useState } from 'react';

import { buttonVariants } from '@/components/ui/button';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Field, fieldWiring, TextField, TextareaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';
import type { FieldErrors } from '@/lib/actions/result';

import { createLeadAction, updateLeadAction } from '../actions';
import type { LeadDetail, LeadFormOptions } from '../queries';
import { TagPicker } from './tag-picker';

export interface LeadFormProps {
  options: LeadFormOptions;
  /** Today in business time. Resolved on the server, so the client's clock is irrelevant. */
  today: string;
  defaultStatusId: string | null;
  /** Present when editing, absent when recording a new enquiry. */
  lead?: LeadDetail;
}

/**
 * Exactly what `LeadFields` reads off a lead - a narrow slice of `LeadDetail`, not the
 * whole thing, so a caller with no real lead yet (the intake review form, seeding a
 * blank one with an automated guess at the phone and platform) can build one without
 * faking every column a full read of the leads table happens to carry. `LeadDetail`
 * already has every field below, so `LeadForm` keeps passing it here unchanged.
 */
export interface LeadFormSeed {
  customerPhone: string;
  customerName: string | null;
  customerCityId: string | null;
  customerOnWhatsapp: boolean;
  contactedAt: string;
  platformId: string;
  statusId: string;
  urgencyId: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  clothGenderId: string | null;
  fabricId: string | null;
  sizeId: string | null;
  quantity: number | null;
  request: string | null;
  notes: string | null;
  tags: { id: string }[];
}

export function LeadForm({ options, today, defaultStatusId, lead }: LeadFormProps) {
  const editing = lead !== undefined;

  const [state, action] = useActionState(
    editing ? updateLeadAction : createLeadAction,
    idleActionState
  );

  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  const saved = state.ok && state.data !== undefined ? state.data : null;

  /**
   * Remounts the fields after a lead is recorded, so every control goes back to blank.
   *
   * React clears an uncontrolled form when an action succeeds, but the comboboxes and
   * the tag picker keep their choice in React state, which that reset does not reach.
   * Without the remount, the platform and status from the previous enquiry would carry
   * silently into the next one - and a wrong platform on a lead is invisible until the
   * channel report is wrong.
   *
   * Editing keeps a constant key: remounting there would discard values someone is
   * still working on.
   */
  const resetKey = editing ? 'edit' : (saved?.reference ?? 'new');

  return (
    <form action={action} className="flex flex-col gap-6">
      {editing ? <input type="hidden" name="id" value={lead.id} /> : null}

      <LeadFields
        key={resetKey}
        options={options}
        today={today}
        defaultStatusId={defaultStatusId}
        lead={lead}
        fieldErrors={fieldErrors}
      />

      {!state.ok ? (
        <p role="alert" className="text-sm text-error-ink">
          {state.error}
        </p>
      ) : null}

      {saved !== null ? (
        <p role="status" className="text-sm text-success-ink">
          {editing ? (
            'Changes saved.'
          ) : (
            <>
              Saved as lead {saved.reference}.{' '}
              <Link href={`/admin/leads/${saved.reference}`} className="underline">
                Open it
              </Link>
              , or start typing the next one.
            </>
          )}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton variant="primary">{editing ? 'Save changes' : 'Record lead'}</SubmitButton>

        {editing ? (
          <Link
            href={`/admin/leads/${lead.reference}`}
            className={buttonVariants({ variant: 'ghost' })}
          >
            Cancel
          </Link>
        ) : null}
      </div>
    </form>
  );
}

export interface LeadFieldsProps {
  options: LeadFormOptions;
  today: string;
  defaultStatusId: string | null;
  lead?: LeadFormSeed;
  fieldErrors: FieldErrors;
}

/**
 * Every control on the form.
 *
 * Separate from `LeadForm` so that remounting it resets the whole thing, including the
 * category state below and the state inside each picker - and so the intake review
 * form (@/features/leads/intake/components/intake-review-form) can reuse exactly this,
 * wrapped in its own `<form>` and its own promote/reject actions instead of `LeadForm`'s
 * "stays open and clears after saving" behaviour, which is right for typing leads one
 * after another and wrong for working through a queue.
 */
export function LeadFields({
  options,
  today,
  defaultStatusId,
  lead,
  fieldErrors,
}: LeadFieldsProps) {
  /**
   * The chosen category, tracked only to shorten the product list.
   *
   * The form is otherwise uncontrolled - the browser holds the values and the action
   * reads them from the FormData - which is what lets a successful save clear it. This
   * one piece of state exists because 165 products is a lot to search when the category
   * is already known.
   */
  const [categoryId, setCategoryId] = useState(lead?.categoryId ?? '');

  const error = (name: string) => fieldErrors[name]?.[0];

  const products: ComboboxOption[] = options.subcategories
    .filter((option) => categoryId === '' || option.categoryId === categoryId)
    .map((option) => ({ value: option.value, label: option.label, group: option.group }));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Customer" hint="The phone number is what links repeat enquiries together.">
        <TextField
          name="phone"
          label="Contact number"
          required
          inputMode="tel"
          autoComplete="off"
          placeholder="5512 3456"
          defaultValue={lead?.customerPhone ?? ''}
          hint="A Qatari number can be typed without +974."
          error={error('phone')}
        />

        <TextField
          name="customerName"
          label="Name"
          maxLength={80}
          autoComplete="off"
          defaultValue={lead?.customerName ?? ''}
          error={error('customerName')}
        />

        <Picker
          name="cityId"
          label="City or area"
          options={options.cities}
          defaultValue={lead?.customerCityId ?? ''}
          error={error('cityId')}
        />

        <div className="flex items-center pt-6">
          <label className="flex items-center gap-2 text-sm text-ink-primary">
            <input
              type="checkbox"
              name="onWhatsapp"
              defaultChecked={lead?.customerOnWhatsapp ?? true}
              className="size-4 rounded-control border-line-strong"
            />
            Reachable on WhatsApp
          </label>
        </div>
      </Section>

      <Section title="The enquiry">
        <TextField
          name="contactedOn"
          label="Date of contact"
          type="date"
          max={today}
          defaultValue={lead === undefined ? today : lead.contactedAt.slice(0, 10)}
          hint="When they messaged, not when you are typing this in."
          error={error('contactedOn')}
        />

        <Picker
          name="platformId"
          label="Platform"
          required
          options={options.platforms}
          defaultValue={lead?.platformId ?? ''}
          error={error('platformId')}
        />

        <Picker
          name="statusId"
          label="Status"
          required
          options={options.statuses}
          defaultValue={lead?.statusId ?? defaultStatusId ?? ''}
          error={error('statusId')}
        />

        <Picker
          name="urgencyId"
          label="Urgency"
          options={options.urgencies}
          defaultValue={lead?.urgencyId ?? ''}
          hint="How close they are to buying."
          error={error('urgencyId')}
        />
      </Section>

      <Section title="What they asked for" hint="Leave blank anything they did not say.">
        <Picker
          name="categoryId"
          label="Category"
          options={options.categories}
          defaultValue={lead?.categoryId ?? ''}
          onValueChange={setCategoryId}
          error={error('categoryId')}
        />

        <Picker
          name="subcategoryId"
          label="Product"
          options={products}
          defaultValue={lead?.subcategoryId ?? ''}
          hint={
            categoryId === ''
              ? 'Every product. Pick a category to shorten the list.'
              : 'Narrowed to the chosen category.'
          }
          error={error('subcategoryId')}
        />

        <Picker
          name="clothGenderId"
          label="Who it is for"
          options={options.genders}
          defaultValue={lead?.clothGenderId ?? ''}
          error={error('clothGenderId')}
        />

        <Picker
          name="fabricId"
          label="Fabric"
          options={options.fabrics}
          defaultValue={lead?.fabricId ?? ''}
          error={error('fabricId')}
        />

        <Picker
          name="sizeId"
          label="Size"
          options={options.sizes}
          defaultValue={lead?.sizeId ?? ''}
          error={error('sizeId')}
        />

        <TextField
          name="quantity"
          label="Quantity"
          type="number"
          min={1}
          max={5000}
          inputMode="numeric"
          defaultValue={lead?.quantity ?? ''}
          hint="Blank if they did not say."
          error={error('quantity')}
        />
      </Section>

      <TextareaField
        name="request"
        label="In their words"
        rows={2}
        maxLength={500}
        defaultValue={lead?.request ?? ''}
        hint="Anything the lists above have no word for. Often the most useful line on the record."
        error={error('request')}
      />

      <TagPicker options={options.tags} selected={lead?.tags.map((tag) => tag.id) ?? []} />

      <TextareaField
        name="notes"
        label="Internal notes"
        rows={3}
        maxLength={2000}
        defaultValue={lead?.notes ?? ''}
        error={error('notes')}
      />
    </div>
  );
}

/** A titled group of fields, two per row on a wide screen. */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-ink-primary">{title}</span>
        {hint ? <span className="text-xs text-ink-secondary">{hint}</span> : null}
      </legend>

      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * A searchable picker wired into a Field.
 *
 * Every taxonomy choice on this form goes through here, so they behave alike and all
 * get the same label, hint and error wiring. Optional pickers offer a way back to
 * blank, because on a lead "they did not say" is information worth recording.
 */
function Picker({
  name,
  label,
  options,
  defaultValue,
  hint,
  error,
  required = false,
  onValueChange,
}: {
  name: string;
  label: string;
  options: readonly ComboboxOption[];
  defaultValue: string;
  hint?: string;
  error?: string;
  required?: boolean;
  onValueChange?: (value: string) => void;
}) {
  const { control } = fieldWiring({ id: name, hint, error });

  return (
    <Field id={name} label={label} hint={hint} error={error} required={required}>
      <Combobox
        name={name}
        id={control.id}
        describedBy={control['aria-describedby']}
        invalid={error !== undefined}
        required={required}
        options={options}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        clearLabel={required ? undefined : 'Not specified'}
        placeholder={required ? 'Choose one' : 'Not specified'}
        emptyMessage="Nothing matched. Add it under Taxonomy if it is missing."
      />
    </Field>
  );
}
