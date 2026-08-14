'use client';

import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * A submit button that disables itself and shows a spinner while its form is
 * submitting.
 *
 * `useFormStatus` reads the state of the enclosing form, so this works without
 * being told anything about the action. Two problems it removes: the double-submit
 * that creates duplicate records, and the moment of silence after a click on a slow
 * connection where nothing appears to have happened.
 */
export interface SubmitButtonProps extends Omit<ButtonProps, 'type'> {
  /** Replaces the label while submitting, e.g. "Signing in...". */
  pendingLabel?: string;
}

export function SubmitButton({ children, pendingLabel, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
