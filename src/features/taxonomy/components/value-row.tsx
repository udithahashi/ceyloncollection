'use client';

/**
 * One row of a taxonomy, and everything that can be done to it.
 *
 * Each control is its own `<form>` posting to its own action. That is deliberate:
 * a single form wrapping the whole table would make "retire this platform" and
 * "rename that one" the same submission, and a row would be able to save changes
 * the user did not make. Separate forms also mean each button gets its own pending
 * state, so the one you pressed is the one that shows it.
 *
 * Editing expands in place rather than opening a dialogue. There is one field to
 * change in the common case, and a modal for that is a heavier promise than the
 * task deserves.
 */
import { ArrowDown, ArrowUp, Check, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { useActionState, useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ComboboxOption } from '@/components/ui/combobox';
import { TextField, TextareaField } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import type { TaxonomyKey } from '@/db/schema/taxonomy';
import { idleActionState, initialActionState, type ActionResult } from '@/lib/actions/result';
import { isBadgeTone } from '@/lib/theme/tones';

import {
  deleteTaxonomyValueAction,
  moveTaxonomyValueAction,
  setTaxonomyActiveAction,
  updateTaxonomyValueAction,
  type SavedValue,
} from '../actions';
import type { TaxonomyDefinition } from '../registry';
import type { TaxonomyListRow } from '../queries';
import { ExtraFields } from './extra-fields';

export interface ValueRowProps {
  row: TaxonomyListRow;
  definition: TaxonomyDefinition;
  categoryOptions?: readonly ComboboxOption[];
  canUpdate: boolean;
  canDelete: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export function ValueRow({
  row,
  definition,
  categoryOptions = [],
  canUpdate,
  canDelete,
  isFirst,
  isLast,
}: ValueRowProps) {
  const [editing, setEditing] = useState(false);
  const stopEditing = useCallback(() => setEditing(false), []);

  return (
    <tr className="border-b border-line-subtle last:border-b-0">
      <td className="px-4 py-3 align-top">
        {editing ? (
          <EditForm
            row={row}
            definition={definition}
            categoryOptions={categoryOptions}
            onDone={stopEditing}
          />
        ) : (
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-ink-primary">{row.name}</span>
              {!row.isActive ? <Badge tone="neutral">Retired</Badge> : null}
              <RowExtras row={row} definition={definition} />
            </div>
            {row.description ? (
              <p className="max-w-prose text-xs text-ink-secondary">{row.description}</p>
            ) : null}
            <code className="text-[0.6875rem] text-ink-secondary">{row.slug}</code>
          </div>
        )}
      </td>

      {row.parentName !== null ? (
        <td className="px-4 py-3 align-top text-sm text-ink-secondary">{row.parentName}</td>
      ) : null}

      <td className="px-4 py-3 align-top">
        <div className="flex items-center justify-end gap-1">
          {canUpdate ? (
            <>
              <MoveButton
                row={row}
                taxonomyKey={definition.key}
                direction="up"
                disabled={isFirst}
              />
              <MoveButton
                row={row}
                taxonomyKey={definition.key}
                direction="down"
                disabled={isLast}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={editing ? `Stop editing ${row.name}` : `Edit ${row.name}`}
                onClick={() => setEditing((was) => !was)}
              >
                {editing ? <X aria-hidden="true" /> : <Pencil aria-hidden="true" />}
              </Button>

              <ActiveButton row={row} taxonomyKey={definition.key} />
            </>
          ) : null}

          {canDelete ? <DeleteButton row={row} definition={definition} /> : null}
        </div>
      </td>
    </tr>
  );
}

/** The extra columns as badges, so a status's behaviour is visible at a glance. */
function RowExtras({ row, definition }: { row: TaxonomyListRow; definition: TaxonomyDefinition }) {
  return (
    <>
      {definition.extras.map((extra) => {
        const value = row.extras[extra.column];

        switch (extra.kind) {
          case 'tone':
            return isBadgeTone(value) ? (
              <Badge key={extra.column} tone={value}>
                {value}
              </Badge>
            ) : null;

          case 'flag':
            return value === true ? (
              <Badge key={extra.column} tone="info">
                {extra.label}
              </Badge>
            ) : null;

          case 'choice': {
            const option = extra.options.find((candidate) => candidate.value === value);
            return option ? (
              <span key={extra.column} className="text-xs text-ink-secondary">
                {option.label}
              </span>
            ) : null;
          }

          default:
            return null;
        }
      })}
    </>
  );
}

function EditForm({
  row,
  definition,
  categoryOptions,
  onDone,
}: {
  row: TaxonomyListRow;
  definition: TaxonomyDefinition;
  categoryOptions: readonly ComboboxOption[];
  onDone: () => void;
}) {
  const [state, action] = useActionState(
    updateTaxonomyValueAction,
    initialActionState<SavedValue>()
  );

  const fieldErrors = state.ok ? {} : (state.fieldErrors ?? {});
  const idPrefix = `edit-${row.id}`;

  // The action returns the saved row, which is how a success is told apart from the
  // untouched initial state. Closing the editor is the confirmation; the row behind
  // it has already been re-rendered from the database.
  const saved = state.ok && state.data !== undefined;

  useEffect(() => {
    if (saved) onDone();
  }, [saved, onDone]);

  return (
    <form action={action} className="flex flex-col gap-3 pb-1">
      <input type="hidden" name="key" value={definition.key} />
      <input type="hidden" name="id" value={row.id} />
      {/* Retiring has its own button; keep the current state so saving a rename
          cannot retire the value as a side effect. */}
      <input type="hidden" name="isActive" value={row.isActive ? 'true' : 'false'} />

      <TextField
        id={`${idPrefix}-name`}
        name="name"
        label="Name"
        defaultValue={row.name}
        required
        maxLength={80}
        autoComplete="off"
        hint="The slug stays as it is, so nothing that already points at this value breaks."
        error={fieldErrors.name?.[0]}
      />

      <TextareaField
        id={`${idPrefix}-description`}
        name="description"
        label="Note"
        rows={2}
        maxLength={300}
        defaultValue={row.description ?? ''}
        error={fieldErrors.description?.[0]}
      />

      <ExtraFields
        extras={definition.extras}
        values={{ ...row.extras, ...(row.parentId ? { categoryId: row.parentId } : {}) }}
        fieldErrors={fieldErrors}
        categoryOptions={categoryOptions}
        idPrefix={idPrefix}
      />

      {!state.ok ? (
        <p role="alert" className="text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <SubmitButton variant="primary" size="sm">
          <Check aria-hidden="true" />
          Save
        </SubmitButton>

        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function MoveButton({
  row,
  taxonomyKey,
  direction,
  disabled,
}: {
  row: TaxonomyListRow;
  taxonomyKey: TaxonomyKey;
  direction: 'up' | 'down';
  disabled: boolean;
}) {
  const [, action] = useActionState(moveTaxonomyValueAction, idleActionState);
  const Icon = direction === 'up' ? ArrowUp : ArrowDown;

  return (
    <form action={action}>
      <RowInputs row={row} taxonomyKey={taxonomyKey} />
      <input type="hidden" name="direction" value={direction} />

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={disabled}
        aria-label={`Move ${row.name} ${direction}`}
      >
        <Icon aria-hidden="true" />
      </Button>
    </form>
  );
}

function ActiveButton({ row, taxonomyKey }: { row: TaxonomyListRow; taxonomyKey: TaxonomyKey }) {
  const [state, action] = useActionState(setTaxonomyActiveAction, idleActionState);

  return (
    <form action={action}>
      <RowInputs row={row} taxonomyKey={taxonomyKey} />
      <input type="hidden" name="isActive" value={row.isActive ? 'false' : 'true'} />

      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={row.isActive ? `Retire ${row.name}` : `Restore ${row.name}`}
        title={
          row.isActive
            ? 'Stop offering this value. Leads that already use it keep it.'
            : 'Offer this value again.'
        }
      >
        {row.isActive ? <X aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
      </Button>

      <FormError state={state} />
    </form>
  );
}

function DeleteButton({
  row,
  definition,
}: {
  row: TaxonomyListRow;
  definition: TaxonomyDefinition;
}) {
  const [state, action] = useActionState(deleteTaxonomyValueAction, idleActionState);

  return (
    <form
      action={action}
      onSubmit={(event) => {
        // The one action here with no button to undo it, so it asks first. Retiring
        // is what people usually mean, hence the sentence about it.
        const confirmed = window.confirm(
          `Delete the ${definition.singular} "${row.name}"?\n\n` +
            'Use Retire instead if this value was ever real - retiring keeps it on ' +
            'the leads that already use it.'
        );

        if (!confirmed) event.preventDefault();
      }}
    >
      <RowInputs row={row} taxonomyKey={definition.key} />

      <Button type="submit" variant="ghost" size="icon" aria-label={`Delete ${row.name}`}>
        <Trash2 aria-hidden="true" className="text-error-ink" />
      </Button>

      <FormError state={state} />
    </form>
  );
}

/** The two fields every row action needs to know which row of which list. */
function RowInputs({ row, taxonomyKey }: { row: TaxonomyListRow; taxonomyKey: TaxonomyKey }) {
  return (
    <>
      <input type="hidden" name="key" value={taxonomyKey} />
      <input type="hidden" name="id" value={row.id} />
    </>
  );
}

/**
 * A failure from one of the icon buttons.
 *
 * These have no field to attach a message to, and the messages matter - "this
 * category still holds 11 sub-categories" is the whole answer to why nothing
 * happened. Positioned out of flow so an error cannot shift the row's buttons.
 */
function FormError({ state }: { state: ActionResult<undefined> }) {
  if (state.ok) return null;

  return (
    <p role="alert" className="mt-1 max-w-56 text-right text-xs text-error-ink">
      {state.error}
    </p>
  );
}
