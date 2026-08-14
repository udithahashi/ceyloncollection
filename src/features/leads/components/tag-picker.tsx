'use client';

/**
 * Choosing tags on a lead.
 *
 * There are 122 tags in eight groups, and a lead usually carries two or three. That
 * ratio decides the interface: the common case must be "type three words", not "scroll
 * through a hundred checkboxes".
 *
 * So: a search box that filters the whole vocabulary, chosen tags shown as removable
 * pills above it, and the groups collapsed until searched or expanded. A plain
 * checkbox grid was the first version and it was unusable - eight screens tall, and
 * finding "Boat Neck" meant knowing it lives under Neckline.
 *
 * WHAT GETS SUBMITTED
 * One hidden input per selected tag, all named `tags`, which is exactly what a
 * checkbox group would produce. The action sees no difference, and the schema already
 * accepts one value or many.
 */
import { Check, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Label } from '@/components/ui/field';
import { cn } from '@/lib/cn';

import type { Option } from '../queries';

/** Ignores case, spaces and punctuation, so "vneck" finds "V-Neck". */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function TagPicker({
  options,
  selected: initial,
}: {
  options: readonly Option[];
  selected: readonly string[];
}) {
  const [selected, setSelected] = useState<string[]>([...initial]);
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(options.map((option) => [option.value, option])), [options]);

  const matches = useMemo(() => {
    const needle = normalise(query);
    if (needle === '') return [];

    return options.filter((option) => normalise(option.label).includes(needle)).slice(0, 40);
  }, [options, query]);

  /** Grouped in the taxonomy's own order, for browsing when nobody is searching. */
  const groups = useMemo(() => {
    const map = new Map<string, Option[]>();

    for (const option of options) {
      const key = option.group ?? 'Other';
      const list = map.get(key);
      if (list) list.push(option);
      else map.set(key, [option]);
    }

    return [...map];
  }, [options]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {selected.map((id) => (
        <input key={id} type="hidden" name="tags" value={id} />
      ))}

      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor="tag-search">Tags</Label>
        <span className="text-xs text-ink-secondary">
          {selected.length === 0 ? 'None chosen' : `${selected.length} chosen`}
        </span>
      </div>

      {selected.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((id) => {
            const option = byId.get(id);

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-control border border-line-focus/40 bg-action-soft',
                    'px-2 py-0.5 text-xs text-action-on-soft',
                    'hover:bg-surface-panel-raised',
                    'focus-visible:ring-action-ring focus-visible:ring-2 focus-visible:outline-none'
                  )}
                >
                  {option?.label ?? 'Unknown tag'}
                  <X aria-hidden="true" className="size-3" />
                  <span className="sr-only">Remove</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <input
        id="tag-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search tags - batik, v-neck, eid..."
        autoComplete="off"
        className={cn(
          'h-9 w-full rounded-control border border-line-strong bg-surface-panel px-3 text-sm',
          'text-ink-primary placeholder:text-ink-secondary',
          'focus-visible:ring-action-ring focus-visible:ring-2 focus-visible:outline-none'
        )}
      />

      {query === '' ? (
        <div className="flex flex-col gap-1.5">
          {groups.map(([group, groupOptions]) => (
            <details key={group} className="rounded-panel border border-line-subtle">
              <summary className="cursor-pointer px-3 py-1.5 text-xs text-ink-secondary">
                {group}
                <span className="text-ink-secondary/70"> · {groupOptions.length}</span>
              </summary>

              <ul className="flex flex-wrap gap-1.5 px-3 pt-1 pb-3">
                {groupOptions.map((option) => (
                  <TagChip
                    key={option.value}
                    option={option}
                    active={selected.includes(option.value)}
                    onToggle={toggle}
                  />
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {matches.length === 0 ? (
            <li className="text-xs text-ink-secondary">
              No tag matches that. Add it under Taxonomy if it is missing.
            </li>
          ) : (
            matches.map((option) => (
              <TagChip
                key={option.value}
                option={option}
                active={selected.includes(option.value)}
                onToggle={toggle}
                showGroup
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
}

function TagChip({
  option,
  active,
  onToggle,
  showGroup = false,
}: {
  option: Option;
  active: boolean;
  onToggle: (id: string) => void;
  showGroup?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onToggle(option.value)}
        className={cn(
          'inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-xs transition-colors',
          'focus-visible:ring-action-ring focus-visible:ring-2 focus-visible:outline-none',
          active
            ? 'border-line-focus/40 bg-action-soft text-action-on-soft'
            : 'border-line-subtle bg-surface-inset text-ink-secondary hover:text-ink-primary'
        )}
      >
        {active ? <Check aria-hidden="true" className="size-3" /> : null}
        {option.label}
        {showGroup && option.group ? (
          <span className="text-ink-secondary/70">· {option.group}</span>
        ) : null}
      </button>
    </li>
  );
}
