import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { AA, contrastRatioRounded, meetsAA } from './contrast';
import {
  ADMIN_THEMES,
  brand,
  DECORATIVE_ONLY,
  DEFAULT_ADMIN_THEME,
  isAdminTheme,
  themes,
  toCssVariableName,
  toCssVariables,
  type ThemeName,
  type ThemeTokens,
} from './tokens';

/*
 * These tests are the reason the palette can be trusted.
 *
 * Contrast is not something you can eyeball: a designer with a good monitor in a
 * dark room will pass colours that are unreadable on a phone in Doha sunlight.
 * So every pairing the interface actually renders is asserted here, and a colour
 * change that breaks one fails CI rather than shipping.
 */

type Requirement = keyof typeof AA;

type Pairing = {
  label: string;
  foreground: string;
  background: string;
  requirement: Requirement;
};

/**
 * Every foreground/background combination the interface can produce.
 *
 * Deliberately includes surfaces a colour only *sometimes* lands on - secondary
 * text sits on a plain panel most of the time, but on a hovered table row it
 * sits on `panelRaised`, and that is exactly the case that gets missed.
 */
function pairingsFor(theme: ThemeTokens): Pairing[] {
  const pairings: Pairing[] = [];

  const contentSurfaces = [
    ['page', theme.surface.page],
    ['panel', theme.surface.panel],
    ['panelRaised', theme.surface.panelRaised],
    ['inset', theme.surface.inset],
  ] as const;

  // Body copy, metadata and links, on every surface they can appear on.
  for (const [surfaceName, background] of contentSurfaces) {
    for (const inkName of ['primary', 'secondary', 'accent'] as const) {
      pairings.push({
        label: `ink.${inkName} on surface.${surfaceName}`,
        foreground: theme.ink[inkName],
        background,
        requirement: 'normalText',
      });
    }
  }

  // Navigation, which has its own darker surface in both admin themes.
  for (const [surfaceName, background] of [
    ['sidebar', theme.surface.sidebar],
    ['sidebarActive', theme.surface.sidebarActive],
  ] as const) {
    for (const inkName of ['onSidebar', 'onSidebarMuted'] as const) {
      pairings.push({
        label: `ink.${inkName} on surface.${surfaceName}`,
        foreground: theme.ink[inkName],
        background,
        requirement: 'normalText',
      });
    }
  }

  // Buttons, in both resting and hovered states. A label that becomes illegible
  // on hover is a real defect and an easy one to miss.
  pairings.push(
    {
      label: 'action.onPrimary on action.primary',
      foreground: theme.action.onPrimary,
      background: theme.action.primary,
      requirement: 'normalText',
    },
    {
      label: 'action.onPrimary on action.primaryHover',
      foreground: theme.action.onPrimary,
      background: theme.action.primaryHover,
      requirement: 'normalText',
    },
    {
      label: 'action.onSecondary on action.secondary',
      foreground: theme.action.onSecondary,
      background: theme.action.secondary,
      requirement: 'normalText',
    },
    {
      label: 'action.onSecondary on action.secondaryHover',
      foreground: theme.action.onSecondary,
      background: theme.action.secondaryHover,
      requirement: 'normalText',
    },
    {
      label: 'action.onSoft on action.soft',
      foreground: theme.action.onSoft,
      background: theme.action.soft,
      requirement: 'normalText',
    },
    {
      label: 'action.secondaryLine on action.secondary',
      foreground: theme.action.secondaryLine,
      background: theme.action.secondary,
      requirement: 'uiComponent',
    }
  );

  // Control edges and the focus ring. WCAG 1.4.11 asks 3:1 of these because a
  // border you cannot see is a control you cannot find.
  for (const [surfaceName, background] of contentSurfaces) {
    for (const lineName of ['strong', 'focus'] as const) {
      pairings.push({
        label: `line.${lineName} on surface.${surfaceName}`,
        foreground: theme.line[lineName],
        background,
        requirement: 'uiComponent',
      });
    }
  }

  // Status text, on panels and on its own tinted badge background.
  for (const toneName of ['success', 'warning', 'error', 'info'] as const) {
    const tone = theme.status[toneName];
    pairings.push(
      {
        label: `status.${toneName}.ink on surface.panel`,
        foreground: tone.ink,
        background: theme.surface.panel,
        requirement: 'normalText',
      },
      {
        label: `status.${toneName}.ink on surface.panelRaised`,
        foreground: tone.ink,
        background: theme.surface.panelRaised,
        requirement: 'normalText',
      },
      {
        label: `status.${toneName}.ink on its own status.${toneName}.bg`,
        foreground: tone.ink,
        background: tone.bg,
        requirement: 'normalText',
      }
    );
  }

  // Chart series. A bar or line is a graphic that conveys information, so the
  // 3:1 rule applies to it just as it does to a control border.
  theme.chart.forEach((colour, index) => {
    pairings.push({
      label: `chart[${index + 1}] on surface.panel`,
      foreground: colour,
      background: theme.surface.panel,
      requirement: 'uiComponent',
    });
  });

  return pairings;
}

describe.each(Object.keys(themes) as ThemeName[])('theme "%s" meets WCAG AA', (themeName) => {
  const theme = themes[themeName];

  it.each(pairingsFor(theme).map((pairing) => [pairing.label, pairing] as const))(
    '%s',
    (_label, pairing) => {
      const ratio = contrastRatioRounded(pairing.foreground, pairing.background);
      const required = AA[pairing.requirement];

      expect(
        meetsAA(pairing.foreground, pairing.background, pairing.requirement),
        `${pairing.foreground} on ${pairing.background} is ${ratio}:1, ` +
          `below the ${required}:1 required for ${pairing.requirement}. ` +
          `Run: node scripts/contrast.mjs ${pairing.foreground} ${pairing.background} --target ${required}`
      ).toBe(true);
    }
  );
});

describe('chart series are distinguishable from each other', () => {
  it.each(Object.keys(themes) as ThemeName[])('%s', (themeName) => {
    const { chart } = themes[themeName];

    expect(new Set(chart).size, 'a duplicate series colour makes two series look identical').toBe(
      chart.length
    );

    // Adjacent series sit next to each other in legends and stacked bars, where
    // near-identical neighbours are hardest to tell apart.
    for (let index = 1; index < chart.length; index++) {
      const ratio = contrastRatioRounded(chart[index]!, chart[index - 1]!);
      expect(ratio, `series ${index} and ${index + 1} are only ${ratio}:1 apart`).toBeGreaterThan(
        1.15
      );
    }
  });
});

describe('decorative brand colours are excluded from text use on purpose', () => {
  it('gold and rose genuinely fail as body text, which is why ink.accent exists', () => {
    // If a future palette change makes these pass, the darkened `ink.accent`
    // variants are no longer needed and this test should be revisited.
    for (const [name, colour] of Object.entries(DECORATIVE_ONLY)) {
      expect(
        meetsAA(colour, brand.ivory, 'normalText'),
        `${name} (${colour}) now passes as text; DECORATIVE_ONLY may be stale`
      ).toBe(false);
    }
  });

  it('no theme uses a decorative-only colour as an ink', () => {
    const decorative = new Set(Object.values(DECORATIVE_ONLY).map((c) => c.toLowerCase()));

    for (const [themeName, theme] of Object.entries(themes)) {
      for (const [inkName, value] of Object.entries(theme.ink)) {
        // The public theme's muted sidebar text is blush on navy, which is 8.14:1
        // and therefore fine - the restriction is about light backgrounds.
        if (themeName === 'public' && inkName === 'onSidebarMuted') continue;

        expect(
          decorative.has(value.toLowerCase()),
          `${themeName}.ink.${inkName} uses the decorative colour ${value}`
        ).toBe(false);
      }
    }
  });
});

describe('the active navigation indicator', () => {
  // The sidebar uses brand gold for the bar marking the current page, in both
  // themes, because the theme's own `action.primary` is navy in the light theme -
  // invisible against a navy sidebar. Gold is the one accent that works on both.
  it.each(['admin-dark', 'admin-light'] as const)('is visible on the %s sidebar', (themeName) => {
    const theme = themes[themeName];

    for (const surface of [theme.surface.sidebar, theme.surface.sidebarActive]) {
      const ratio = contrastRatioRounded(brand.gold, surface);
      expect(
        meetsAA(brand.gold, surface, 'uiComponent'),
        `brand gold is only ${ratio}:1 on ${surface}`
      ).toBe(true);
    }
  });
});

describe('theme selection', () => {
  it('offers exactly the two back office themes', () => {
    expect(ADMIN_THEMES).toEqual(['admin-dark', 'admin-light']);
  });

  it('defaults to dark, as specified for the back office', () => {
    expect(DEFAULT_ADMIN_THEME).toBe('admin-dark');
  });

  it('accepts only known admin theme names', () => {
    expect(isAdminTheme('admin-dark')).toBe(true);
    expect(isAdminTheme('admin-light')).toBe(true);
    // The public theme is not selectable in the back office.
    expect(isAdminTheme('public')).toBe(false);
    expect(isAdminTheme('dark')).toBe(false);
    expect(isAdminTheme(undefined)).toBe(false);
    expect(isAdminTheme(null)).toBe(false);
    expect(isAdminTheme(42)).toBe(false);
  });
});

describe('toCssVariableName', () => {
  it('converts camelCase segments to kebab-case', () => {
    expect(toCssVariableName(['surface', 'panelRaised'])).toBe('--surface-panel-raised');
    expect(toCssVariableName(['ink', 'onSidebarMuted'])).toBe('--ink-on-sidebar-muted');
    expect(toCssVariableName(['action', 'secondaryLine'])).toBe('--action-secondary-line');
    expect(toCssVariableName(['status', 'success', 'ink'])).toBe('--status-success-ink');
  });
});

/*
 * The stylesheet mirrors these tokens by hand, because Tailwind needs them as CSS
 * and Chart.js needs them as JavaScript. This is where that duplication is kept
 * honest.
 */
describe('globals.css matches the tokens', () => {
  const stylesheet = readFileSync(
    path.resolve(import.meta.dirname, '../../app/globals.css'),
    'utf8'
  ).replace(/\/\*[\s\S]*?\*\//g, ''); // strip comments so they cannot be mistaken for rules

  /** Pulls the custom properties out of the rule whose selector contains `selector`. */
  function customPropertiesIn(selector: string): Record<string, string> {
    const selectorAt = stylesheet.indexOf(selector);
    expect(selectorAt, `globals.css has no rule for ${selector}`).toBeGreaterThan(-1);

    const open = stylesheet.indexOf('{', selectorAt);
    let depth = 0;
    let close = -1;

    for (let index = open; index < stylesheet.length; index++) {
      if (stylesheet[index] === '{') depth++;
      else if (stylesheet[index] === '}') {
        depth--;
        if (depth === 0) {
          close = index;
          break;
        }
      }
    }
    expect(close, `unbalanced braces after ${selector}`).toBeGreaterThan(open);

    const declarations: Record<string, string> = {};
    for (const match of stylesheet.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      declarations[match[1]!] = match[2]!.trim().toLowerCase();
    }
    return declarations;
  }

  it.each(Object.keys(themes) as ThemeName[])('theme "%s"', (themeName) => {
    const declared = customPropertiesIn(`[data-theme='${themeName}']`);
    const expected = toCssVariables(themes[themeName]);

    for (const [name, value] of expected) {
      expect(declared[name], `globals.css is missing ${name} for ${themeName}`).toBeDefined();
      expect(
        declared[name],
        `${name} is ${declared[name]} in globals.css but ${value} in tokens.ts`
      ).toBe(value.toLowerCase());
    }

    // Catches the opposite mistake: a variable removed from tokens.ts but left
    // behind in the stylesheet, where it would look supported but be unmanaged.
    const expectedNames = new Set(expected.map(([name]) => name));
    for (const name of Object.keys(declared)) {
      expect(expectedNames.has(name), `${name} exists in globals.css but not in tokens.ts`).toBe(
        true
      );
    }
  });

  it('declares the brand palette', () => {
    const declared = customPropertiesIn(':root {');

    for (const [name, value] of Object.entries(brand)) {
      expect(declared[`--brand-${name}`]).toBe(value.toLowerCase());
    }
  });

  it('exposes every theme token to Tailwind', () => {
    const mapped = customPropertiesIn('@theme inline');

    // Tailwind only generates a utility for a variable it knows about, so a token
    // missing here is a token no component can reach.
    for (const [name] of toCssVariables(themes[DEFAULT_ADMIN_THEME])) {
      const referenced = Object.values(mapped).some((value) => value === `var(${name})`);
      expect(referenced, `${name} is never mapped into @theme, so it has no utility class`).toBe(
        true
      );
    }
  });
});
