import { Moon, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { setThemeAction } from '@/lib/theme/actions';
import type { AdminThemeName } from '@/lib/theme/tokens';

/**
 * Theme switch, as a plain form posting to a Server Action.
 *
 * No `useState`, no `useEffect`, no client JavaScript at all: the server already
 * knows the theme, so the switch is a one-field form and the next render comes
 * back in the other theme. It therefore works before JavaScript has loaded, and
 * there is no possibility of the button and the page disagreeing about which
 * theme is active.
 */
export function ThemeToggle({ current }: { current: AdminThemeName }) {
  const next: AdminThemeName = current === 'admin-dark' ? 'admin-light' : 'admin-dark';
  const goingLight = next === 'admin-light';
  const Icon = goingLight ? Sun : Moon;

  return (
    <form action={setThemeAction}>
      <input type="hidden" name="theme" value={next} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        // The icon alone has no accessible name, and "toggle theme" would not say
        // which way it goes.
        aria-label={goingLight ? 'Switch to light theme' : 'Switch to dark theme'}
        title={goingLight ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        <Icon aria-hidden="true" />
      </Button>
    </form>
  );
}
