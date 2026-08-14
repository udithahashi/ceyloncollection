/**
 * The design tokens a chart needs, read from CSS at runtime.
 *
 * Chart.js draws to a canvas, and a canvas knows nothing about CSS: `var(--chart-1)` in
 * a colour option is simply an invalid colour. So the values have to be resolved to real
 * hex strings before they are handed over.
 *
 * Reading them from the live stylesheet rather than importing `themes` from
 * `@/lib/theme/tokens` is deliberate. It keeps the token file out of the client bundle,
 * and - more importantly - it means a chart cannot disagree with the page around it: if
 * a colour is changed in one place, the charts follow, including for a theme that does
 * not exist yet.
 */
import { badgeTones, type BadgeTone } from '@/lib/theme/tones';

export interface ChartPalette {
  /** The eight-step series ladder, in order. */
  series: string[];
  /** Per-tone colour, so a status bar matches its badge. */
  tone: Record<BadgeTone, string>;
  ink: string;
  muted: string;
  grid: string;
  surface: string;
  fontFamily: string;
}

/** Sensible values for the server render, before any CSS has been measured. */
export const fallbackPalette: ChartPalette = {
  series: ['#d2a34a'],
  tone: {
    neutral: '#aab3bf',
    accent: '#d2a34a',
    success: '#5AAA81',
    warning: '#D4A449',
    error: '#D98282',
    info: '#7FB3DD',
  },
  ink: '#f5f1eb',
  muted: '#aab3bf',
  grid: '#2A3A4F',
  surface: '#1a2738',
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
};

/**
 * Resolves the palette against the document.
 *
 * Client-only: there is no `getComputedStyle` on the server, which is why every chart
 * starts from the fallback and re-reads once mounted.
 */
export function readPalette(element: Element): ChartPalette {
  const styles = getComputedStyle(element);
  const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;

  const series = Array.from({ length: 8 }, (_, index) =>
    read(`--chart-${index + 1}`, fallbackPalette.series[0] ?? '#d2a34a')
  ).filter((colour) => colour !== '');

  const tone = Object.fromEntries(
    badgeTones.map((name) => [
      name,
      name === 'neutral'
        ? read('--ink-secondary', fallbackPalette.tone.neutral)
        : name === 'accent'
          ? read('--ink-accent', fallbackPalette.tone.accent)
          : read(`--status-${name}-ink`, fallbackPalette.tone[name]),
    ])
  ) as Record<BadgeTone, string>;

  return {
    series: series.length > 0 ? series : fallbackPalette.series,
    tone,
    ink: read('--ink-primary', fallbackPalette.ink),
    muted: read('--ink-secondary', fallbackPalette.muted),
    grid: read('--line-subtle', fallbackPalette.grid),
    surface: read('--surface-panel-raised', fallbackPalette.surface),
    // The typeface is a token too, so the axis labels are in the same face as the
    // table beside them rather than Chart.js's built-in Helvetica.
    fontFamily: read('--typeface-body', fallbackPalette.fontFamily),
  };
}
