import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/cn';

/**
 * Form fields, with the label, hint, error and control wired together.
 *
 * The wiring is the whole point. A red border tells a sighted user something is
 * wrong; `aria-describedby` and `aria-invalid` are what tell everyone else, and
 * they are the first thing to be forgotten when each form is assembled by hand.
 * So the field components below own that wiring and there is nothing to remember
 * at the call site.
 *
 * These are deliberately NOT client components. Nothing here needs state, and
 * keeping them on the server means a page of form fields ships no JavaScript for
 * them. It does mean no `useId`, so ids come from the field's `name` - which a
 * form needs anyway, and which is unique within a form by definition. Pass `id`
 * explicitly if two forms with the same field names ever share a page.
 */

/**
 * 13px, medium weight, sentence case in the back office - the label style of
 * every form you have filled in on a dashboard. `eyebrow` is what makes the same
 * component come out as the brand's tracked-out capitals on the public site.
 */
export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label className={cn('eyebrow text-[0.8125rem] text-ink-primary', className)} {...props} />
  );
}

/**
 * Shared styling for every control, so a form does not look like three different
 * form libraries. Exported for the odd control this file does not cover.
 *
 * `line-strong` rather than `line-subtle` is deliberate: WCAG asks 3:1 of the
 * boundary of an interactive control, and the quiet divider colour does not reach
 * it. An input whose edge you cannot see is an input you cannot find.
 */
export const controlClasses = cn(
  'rounded-control w-full border border-line-strong bg-surface-panel px-3 text-sm text-ink-primary',
  'transition-colors duration-150 ease-out',
  'placeholder:text-ink-secondary',
  'hover:border-ink-secondary',
  'disabled:cursor-not-allowed disabled:bg-surface-inset disabled:opacity-60',
  // `aria-invalid` is what assistive technology reads, so the visual error state
  // is driven by the same attribute rather than a separate prop that could drift.
  'aria-invalid:border-error-line aria-invalid:bg-error-bg'
);

/** The ids and ARIA attributes that tie a control to its hint and error text. */
export function fieldWiring({ id, hint, error }: { id: string; hint?: string; error?: string }): {
  hintId?: string;
  errorId?: string;
  control: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true };
} {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return {
    hintId,
    errorId,
    control: {
      id,
      // Error first: it is the most urgent thing to hear.
      'aria-describedby': [errorId, hintId].filter(Boolean).join(' ') || undefined,
      'aria-invalid': error ? true : undefined,
    },
  };
}

type FieldShellProps = {
  id: string;
  label: string;
  /** Guidance under the control. Kept to a sentence; a form is not documentation. */
  hint?: string;
  /** Validation message. Its presence is what puts the control in an error state. */
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * The label/control/message layout, for a control this file does not cover -
 * a checkbox group, or the searchable combobox that arrives with the taxonomy.
 * Use `fieldWiring` to get the attributes for the control itself.
 */
export function Field({ id, label, hint, error, required, className, children }: FieldShellProps) {
  const { hintId, errorId } = fieldWiring({ id, hint, error });

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required ? (
          <>
            {' '}
            <span aria-hidden="true" className="text-error-ink">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </Label>

      {children}

      {error ? (
        // `role="alert"` so it is announced when it appears after a failed
        // submission, not only when the control happens to be focused.
        <p id={errorId} role="alert" className="text-xs text-error-ink">
          {error}
        </p>
      ) : null}

      {hint ? (
        <p id={hintId} className="text-xs text-ink-secondary">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type CommonProps = {
  /** Also used as the control's id unless `id` is given. */
  name: string;
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  /** Classes for the wrapper. Use `controlClassName` for the control itself. */
  className?: string;
  controlClassName?: string;
};

export function TextField({
  name,
  label,
  hint,
  error,
  id = name,
  className,
  controlClassName,
  required,
  type = 'text',
  ...props
}: CommonProps & Omit<ComponentProps<'input'>, 'id' | 'name' | 'className'>) {
  const { control } = fieldWiring({ id, hint, error });

  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <input
        {...control}
        name={name}
        type={type}
        required={required}
        className={cn(controlClasses, 'h-9', controlClassName)}
        {...props}
      />
    </Field>
  );
}

export function TextareaField({
  name,
  label,
  hint,
  error,
  id = name,
  className,
  controlClassName,
  required,
  rows = 4,
  ...props
}: CommonProps & Omit<ComponentProps<'textarea'>, 'id' | 'name' | 'className'>) {
  const { control } = fieldWiring({ id, hint, error });

  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <textarea
        {...control}
        name={name}
        rows={rows}
        required={required}
        className={cn(controlClasses, 'py-2', controlClassName)}
        {...props}
      />
    </Field>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  id = name,
  className,
  controlClassName,
  required,
  children,
  ...props
}: CommonProps & Omit<ComponentProps<'select'>, 'id' | 'name' | 'className'>) {
  const { control } = fieldWiring({ id, hint, error });

  return (
    <Field
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
    >
      <select
        {...control}
        name={name}
        required={required}
        className={cn(controlClasses, 'h-9 pr-8', controlClassName)}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
