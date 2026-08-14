'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Copies a string to the clipboard and confirms it did.
 *
 * The confirmation matters more than it looks: without it, someone who mis-clicks
 * pastes the previous contents of their clipboard into a message and cannot tell
 * which of the two things went wrong.
 *
 * `navigator.clipboard` needs a secure context, which localhost counts as. If it is
 * unavailable the button reports the failure rather than pretending, so the value can
 * still be selected by hand.
 */
export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }, [value]);

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={copy}
      aria-label={label}
      className="shrink-0"
    >
      {state === 'copied' ? (
        <Check aria-hidden="true" className="size-4" />
      ) : (
        <Copy aria-hidden="true" className="size-4" />
      )}
      {/* Announced on change, so the outcome reaches a screen reader too. */}
      <span aria-live="polite">
        {state === 'copied' ? 'Copied' : state === 'failed' ? 'Press Ctrl+C' : 'Copy'}
      </span>
    </Button>
  );
}
