'use client';

/**
 * A select you can type into.
 *
 * The lists behind this run to 165 sub-categories and 122 tags. A native `select`
 * of that length is a scroll bar, and picking the wrong garment because two names
 * differ by one word is exactly the kind of error that poisons a demand report.
 *
 * Built from a button, an input and a listbox rather than taken from a library:
 * the whole behaviour is one keyboard map and one filter, and a dependency here
 * would be larger than the component and would style itself its own way.
 *
 * ACCESSIBILITY
 * The markup follows the ARIA combobox pattern: `role="combobox"` on the input,
 * `aria-expanded`, `aria-controls`, and `aria-activedescendant` pointing at the
 * highlighted option so a screen reader announces the choice as you arrow through
 * it. Selection is committed to a hidden input, so the form works exactly like one
 * containing a `select` - including without JavaScript, where it degrades to that.
 */
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { cn } from '@/lib/cn';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Shown after the label, dimmed: the category a sub-category belongs to, say. */
  hint?: string;
  /** An optional heading this option sits under, e.g. a tag group. */
  group?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  name: string;
  options: readonly ComboboxOption[];
  defaultValue?: string;
  placeholder?: string;
  /** Wired by `Field`, so the label and error message point at the right control. */
  id?: string;
  describedBy?: string;
  invalid?: boolean;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Text for the "nothing matched" line, in the caller's own words. */
  emptyMessage?: string;
  /**
   * Adds an option that clears the choice, labelled with this text.
   *
   * Needed wherever blank is a meaningful answer - on a lead, "they did not say which
   * fabric" is information, and a picker you cannot empty makes it unrecordable.
   */
  clearLabel?: string;
  /**
   * Told when the selection changes.
   *
   * The component stays uncontrolled: this is for a caller that needs to react to a
   * choice, such as narrowing a second list, not for owning the value.
   */
  onValueChange?: (value: string) => void;
}

/** Case- and punctuation-insensitive contains, so "mens" finds "Men's Wear". */
function matches(option: ComboboxOption, query: string): boolean {
  if (query === '') return true;

  const needle = normalise(query);
  return normalise(option.label).includes(needle) || normalise(option.hint ?? '').includes(needle);
}

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function Combobox({
  name,
  options,
  defaultValue = '',
  placeholder = 'Search...',
  id,
  describedBy,
  invalid = false,
  required = false,
  disabled = false,
  className,
  emptyMessage = 'Nothing matched.',
  clearLabel,
  onValueChange,
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? `${name}-${generatedId}`;
  const listId = `${inputId}-list`;

  const [selected, setSelected] = useState(defaultValue);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * The clear entry is prepended rather than being a separate control beside the
   * input: it is then reachable by the same arrow keys and the same search box as
   * every other choice, instead of being a button only a mouse user finds.
   */
  const choices = useMemo(
    () =>
      clearLabel === undefined || selected === ''
        ? options
        : [{ value: '', label: clearLabel }, ...options],
    [clearLabel, options, selected]
  );

  const visible = useMemo(
    () => choices.filter((option) => matches(option, query)),
    [choices, query]
  );

  const selectedOption = options.find((option) => option.value === selected && option.value !== '');

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Clicking anywhere else commits nothing and closes, which is what a native
  // select does.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) close();
    }

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);

  // Keep the highlighted option in view when arrowing past the edge of the list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function commit(option: ComboboxOption) {
    if (option.disabled) return;
    setSelected(option.value);
    onValueChange?.(option.value);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          setOpen(true);
          setActiveIndex(0);
          return;
        }
        setActiveIndex((index) => Math.min(index + 1, visible.length - 1));
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!open) return;
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      case 'Enter': {
        if (!open) return;
        // Only swallow the key when it is choosing an option; otherwise the form
        // should still submit on Enter.
        const option = visible[activeIndex];
        if (option) {
          event.preventDefault();
          commit(option);
        }
        return;
      }
      case 'Escape':
        if (open) {
          event.preventDefault();
          close();
        }
        return;
      case 'Tab':
        close();
        return;
      default:
        return;
    }
  }

  let lastGroup: string | undefined;

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* What the form actually submits. Named, so the action reads a plain value. */}
      <input type="hidden" name={name} value={selected} />

      <div
        className={cn(
          'flex h-9 items-center gap-2 rounded-control border bg-surface-panel px-3',
          'focus-within:ring-action-ring focus-within:ring-2 focus-within:ring-offset-2',
          'focus-within:ring-offset-surface-page',
          invalid ? 'border-error-line' : 'border-line-strong',
          disabled && 'cursor-not-allowed opacity-60'
        )}
      >
        <Search aria-hidden="true" className="size-4 shrink-0 text-ink-secondary" />

        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          type="text"
          autoComplete="off"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
          value={open ? query : (selectedOption?.label ?? '')}
          placeholder={selectedOption ? selectedOption.label : placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-sm text-ink-primary outline-none',
            'placeholder:text-ink-secondary'
          )}
        />

        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-ink-secondary" />
      </div>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Options"
          className={cn(
            'absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-panel shadow-overlay',
            'border border-line-subtle bg-surface-panel py-1'
          )}
        >
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-sm text-ink-secondary">{emptyMessage}</li>
          ) : (
            visible.map((option, index) => {
              const heading = option.group !== lastGroup ? option.group : undefined;
              lastGroup = option.group;
              const isActive = index === activeIndex;
              const isSelected = option.value === selected;

              return (
                <li key={option.value}>
                  {heading ? (
                    <p className="px-3 pt-2 pb-1 eyebrow text-[0.6875rem] text-ink-secondary">
                      {heading}
                    </p>
                  ) : null}

                  <div
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    // Pointer down rather than click: click fires after the input
                    // has already lost focus and closed the list.
                    onPointerDown={(event) => {
                      event.preventDefault();
                      commit(option);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm',
                      isActive ? 'bg-surface-inset text-ink-primary' : 'text-ink-secondary',
                      option.disabled && 'pointer-events-none opacity-50'
                    )}
                  >
                    <Check
                      aria-hidden="true"
                      className={cn('size-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')}
                    />
                    <span className="truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="ml-auto truncate text-xs text-ink-secondary">
                        {option.hint}
                      </span>
                    ) : null}
                  </div>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
