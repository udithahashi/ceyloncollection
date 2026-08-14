'use client';

/**
 * Adding a value to a taxonomy.
 *
 * One form for all ten lists: the shared fields are written here and the rest come
 * from the registry. It stays open after a successful save and returns focus to
 * the name box, because these values are almost always added several at a time.
 */
import { useActionState } from 'react';

import type { ComboboxOption } from '@/components/ui/combobox';
import { TextField, TextareaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { idleActionState } from '@/lib/actions/result';

import { createTaxonomyValueAction } from '../actions';
import type { TaxonomyDefinition } from '../registry';
import { ExtraFields } from './extra-fields';

export function AddValueForm({
  definition,
  categoryOptions = [],
}: {
  definition: TaxonomyDefinition;
  categoryOptions?: readonly ComboboxOption[];
}) {
  const [state, action] = useActionState(createTaxonomyValueAction, idleActionState);
  const nameId = `add-${definition.key}-name`;

  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});

  return (
    <form
      action={action}
      className="flex flex-col gap-4"
      onSubmit={() => {
        // React clears an uncontrolled form once the action resolves; this only puts
        // the cursor back in the name box, because these values are nearly always
        // added several at a time.
        requestAnimationFrame(() => document.getElementById(nameId)?.focus());
      }}
    >
      <input type="hidden" name="key" value={definition.key} />

      <TextField
        id={nameId}
        name="name"
        label="Name"
        required
        maxLength={80}
        autoComplete="off"
        placeholder={`New ${definition.singular}`}
        error={fieldErrors.name?.[0]}
      />

      <TextareaField
        id={`add-${definition.key}-description`}
        name="description"
        label="Note"
        rows={2}
        maxLength={300}
        hint="Optional. Shown as a hint when this value is being chosen."
        error={fieldErrors.description?.[0]}
      />

      <ExtraFields
        extras={definition.extras}
        fieldErrors={fieldErrors}
        categoryOptions={categoryOptions}
        idPrefix={`add-${definition.key}`}
      />

      {/* Ticked by default: a value you just added is a value you want to use. */}
      <input type="hidden" name="isActive" value="true" />

      {!state.ok && state.code !== 'validation' ? (
        <p role="alert" className="text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}

      <SubmitButton variant="primary" className="self-start">
        Add {definition.singular}
      </SubmitButton>
    </form>
  );
}
