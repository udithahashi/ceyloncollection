'use client';

/**
 * The fields that differ between taxonomies, rendered from the registry.
 *
 * Shared by the add form and the row editor so a new extra field appears in both
 * without being written twice - the two places a field can go out of step.
 */
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Field, SelectField, fieldWiring } from '@/components/ui/field';
import { cn } from '@/lib/cn';

import { toneOptions, type ExtraField } from '../registry';

export interface ExtraFieldsProps {
  extras: readonly ExtraField[];
  /** Current values, keyed by column. Empty when adding. */
  values?: Record<string, string | boolean | null>;
  /** Per-field messages from the action, keyed by column. */
  fieldErrors?: Record<string, string[] | undefined>;
  /** The categories a sub-category can be filed under. */
  categoryOptions?: readonly ComboboxOption[];
  /** Prefix so two forms on one page cannot produce duplicate ids. */
  idPrefix: string;
}

export function ExtraFields({
  extras,
  values = {},
  fieldErrors = {},
  categoryOptions = [],
  idPrefix,
}: ExtraFieldsProps) {
  if (extras.length === 0) return null;

  return (
    <>
      {extras.map((extra) => {
        const id = `${idPrefix}-${extra.column}`;
        const error = fieldErrors[extra.column]?.[0];
        const current = values[extra.column];

        switch (extra.kind) {
          case 'flag':
            return (
              <Checkbox
                key={extra.column}
                id={id}
                name={extra.column}
                label={extra.label}
                hint={extra.hint}
                defaultChecked={current === true}
              />
            );

          case 'tone':
            return (
              <SelectField
                key={extra.column}
                id={id}
                name={extra.column}
                label={extra.label}
                hint={extra.hint}
                error={error}
                defaultValue={typeof current === 'string' ? current : 'neutral'}
              >
                {toneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            );

          case 'choice':
            return (
              <SelectField
                key={extra.column}
                id={id}
                name={extra.column}
                label={extra.label}
                hint={extra.hint}
                error={error}
                defaultValue={typeof current === 'string' ? current : extra.options[0]?.value}
              >
                {extra.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            );

          case 'parent': {
            const { control } = fieldWiring({ id, hint: extra.hint, error });

            return (
              <Field
                key={extra.column}
                id={id}
                label={extra.label}
                hint={extra.hint}
                error={error}
                required
              >
                <Combobox
                  id={id}
                  name={extra.column}
                  options={categoryOptions}
                  defaultValue={typeof current === 'string' ? current : ''}
                  placeholder="Search categories..."
                  describedBy={control['aria-describedby']}
                  invalid={error !== undefined}
                  required
                  emptyMessage="No category by that name."
                />
              </Field>
            );
          }
        }
      })}
    </>
  );
}

/**
 * A checkbox with its explanation.
 *
 * Not in `field.tsx` because a checkbox reads the other way round from every other
 * control - the label sits after the box, and the hint belongs under both - and
 * forcing it into the same shape as a text field made both worse.
 */
export function Checkbox({
  id,
  name,
  label,
  hint,
  defaultChecked,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id={id}
          name={name}
          defaultChecked={defaultChecked}
          aria-describedby={`${id}-hint`}
          className={cn(
            'size-4 shrink-0 appearance-none rounded-control border border-line-strong',
            'bg-surface-panel checked:border-action-primary checked:bg-action-primary',
            'checked:bg-[url("data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%27http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%27%20viewBox%3D%270%200%2016%2016%27%20fill%3D%27none%27%20stroke%3D%27white%27%20stroke-width%3D%272.5%27%3E%3Cpath%20d%3D%27M3%208.5l3.5%203.5L13%205%27%2F%3E%3C%2Fsvg%3E")] checked:bg-center checked:bg-no-repeat',
            'focus-visible:ring-action-ring focus-visible:ring-2 focus-visible:ring-offset-2',
            'focus-visible:ring-offset-surface-page focus-visible:outline-none'
          )}
        />
        <label htmlFor={id} className="text-sm text-ink-primary">
          {label}
        </label>
      </div>
      <p id={`${id}-hint`} className="pl-6 text-xs text-ink-secondary">
        {hint}
      </p>
    </div>
  );
}
