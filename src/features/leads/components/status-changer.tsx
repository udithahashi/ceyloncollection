'use client';

/**
 * Moving one lead to another status, with an optional line about why.
 *
 * The most frequent write in the whole system - a WhatsApp reply arrives and the lead
 * goes from Contacted to Interested - so it is one select and one button rather than
 * the full edit form. Loading fifteen fields to change one word is the difference
 * between a status that stays current and a status nobody updates.
 *
 * The note is appended to the lead's notes by the action, dated. That is deliberate:
 * "she asked for a photo first" is history, and history that overwrites itself is
 * worth very little three weeks later.
 */
import { useActionState, useState } from 'react';

import { Button } from '@/components/ui/button';
import { controlClasses } from '@/components/ui/field';
import { SubmitButton } from '@/components/ui/submit-button';
import { cn } from '@/lib/cn';
import { idleActionState } from '@/lib/actions/result';

import { changeLeadStatusAction } from '../actions';
import type { LeadFormOptions } from '../queries';

export function StatusChanger({
  leadId,
  statusId,
  statuses,
}: {
  leadId: string;
  statusId: string;
  statuses: LeadFormOptions['statuses'];
}) {
  const [state, action] = useActionState(changeLeadStatusAction, idleActionState);
  const [chosen, setChosen] = useState(statusId);
  const [showNote, setShowNote] = useState(false);

  const changed = chosen !== statusId;

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="id" value={leadId} />

      <label htmlFor="statusId" className="eyebrow text-[0.8125rem] text-ink-primary">
        Status
      </label>

      <select
        id="statusId"
        name="statusId"
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
        className={cn(controlClasses, 'h-9 pr-8')}
      >
        {statuses.map((status) => (
          <option key={status.value} value={status.value}>
            {status.label}
          </option>
        ))}
      </select>

      {showNote ? (
        <textarea
          name="note"
          rows={2}
          maxLength={500}
          autoFocus
          placeholder="What happened? Added to the notes, dated."
          className={cn(controlClasses, 'py-2')}
        />
      ) : null}

      {!state.ok ? (
        <p role="alert" className="text-xs text-error-ink">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <SubmitButton
          variant={changed ? 'primary' : 'secondary'}
          size="sm"
          disabled={!changed && !showNote}
        >
          {changed ? 'Move it' : 'Add the note'}
        </SubmitButton>

        {showNote ? null : (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowNote(true)}>
            Add a note
          </Button>
        )}
      </div>
    </form>
  );
}
