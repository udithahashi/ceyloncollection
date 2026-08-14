/**
 * Design tokens: the single source of truth for how the product looks.
 *
 * WHY THIS IS TYPESCRIPT AND NOT ONLY CSS
 * The browser needs these as CSS custom properties, Chart.js needs the same
 * values as JavaScript, and the contrast tests need them as data. Defining them
 * here and mirroring them into `globals.css` is the only arrangement that serves
 * all three. `tokens.test.ts` parses that stylesheet and fails if the two ever
 * drift apart, so the duplication cannot rot silently.
 *
 * HOW TO USE THEM
 * Components reference SEMANTIC names (`surface.panel`, `ink.secondary`), never
 * brand names (`navy`, `gold`). That indirection is what makes a future re-theme
 * a change to this file rather than a change to every component.
 *
 * Names are chosen to read well as Tailwind utilities: `bg-surface-panel`,
 * `text-ink-secondary`, `border-line-subtle`. Hence `ink` rather than `text`,
 * which would produce `text-text-secondary`.
 *
 * TWO DESIGN SYSTEMS IN ONE FILE
 * A theme carries more than colour. The back office follows ordinary dashboard
 * convention - Inter, gentle 6px corners, sentence-case labels - because it is
 * a tool people work in for hours, and convention is what makes a tool feel
 * obvious. The public site keeps the brand's editorial character: serif
 * headings, square corners, wide uppercase labels. Those differences live in
 * the `typeface`, `corner`, `elevation` and `label` groups below, so a shared
 * component such as `Button` renders correctly in either world without ever
 * asking which one it is in.
 *
 * ACCESSIBILITY
 * Every foreground/background pairing the app uses is asserted against WCAG 2.1
 * AA in `tokens.test.ts`. Several colours from the palette document did not pass
 * and were darkened for text use; their originals are kept for fills, where
 * contrast rules do not apply, so the brand still looks like itself. Use
 * `node scripts/contrast.mjs` when picking a new colour.
 */

/**
 * The five brand colours, exactly as specified in the palette document. These
 * are identity, not UI, and must not change between themes.
 *
 * Gold and rose are NOT accessible as text on light backgrounds. For text use
 * the `ink.accent` token, a darkened variant.
 */
export const brand = {
  navy: '#142B49',
  gold: '#B77A17',
  rose: '#C77A73',
  blush: '#E8B9AF',
  ivory: '#FAF7F2',
} as const;

/**
 * Brand colours that may only be used as fills, gradients or decoration - never
 * as text, and never as a border that carries meaning.
 *
 * Recorded as data so the contrast test can prove they are excluded on purpose
 * rather than overlooked. The ratios are against the ivory page background.
 */
export const DECORATIVE_ONLY = {
  gold: brand.gold, // 3.38:1 - fails AA for text
  rose: brand.rose, // 3.04:1 - fails AA for text
  blush: brand.blush, // 1.53:1 - a background, never a foreground
} as const;

export type ThemeName = 'admin-dark' | 'admin-light' | 'public';

/** A semantic status colour: readable text, a tinted fill, and a border. */
export type StatusTone = {
  /** Text and icons. Readable on both `bg` below and on `surface.panel`. */
  ink: string;
  /** Tinted background for badges and callouts. */
  bg: string;
  /** Border for the same. */
  line: string;
};

export type ThemeTokens = {
  /** Backgrounds, ordered from furthest back to most raised. */
  surface: {
    /** The application background. */
    page: string;
    /** Cards, tables, modals - the main content surface. */
    panel: string;
    /** A hovered panel, or one a level more prominent. */
    panelRaised: string;
    /** Recessed areas: table headers, wells, empty states. */
    inset: string;
    /** The navigation rail. */
    sidebar: string;
    /** The active item in the navigation rail. */
    sidebarActive: string;
  };
  /** Foreground (text and icon) colours. */
  ink: {
    /** Body copy and headings. */
    primary: string;
    /** Metadata, descriptions, column labels. */
    secondary: string;
    /** Links and emphasis. A contrast-safe variant of the brand gold. */
    accent: string;
    /** On the sidebar surface. */
    onSidebar: string;
    /** Secondary text on the sidebar surface. */
    onSidebarMuted: string;
  };
  /** Borders and dividers. */
  line: {
    /** Decorative dividers. No contrast requirement, so it can be quiet. */
    subtle: string;
    /** The edge of an interactive control - input, checkbox, button. Must reach
     *  3:1 against its surface, per WCAG 1.4.11 Non-text Contrast. */
    strong: string;
    /** Focus ring. Also 3:1 minimum, and deliberately loud. */
    focus: string;
  };
  action: {
    /** Primary button background. */
    primary: string;
    primaryHover: string;
    /** Text on the primary button. */
    onPrimary: string;
    /** Secondary button background. */
    secondary: string;
    secondaryHover: string;
    /** Text on the secondary button. */
    onSecondary: string;
    /** Secondary button border. */
    secondaryLine: string;
    /** A soft accent tint: selected rows, subtle emphasis. */
    soft: string;
    /** Text on `soft`. */
    onSoft: string;
  };
  status: {
    success: StatusTone;
    warning: StatusTone;
    error: StatusTone;
    info: StatusTone;
  };
  /** Chart series colours in order. Each reaches 3:1 against `surface.panel`,
   *  which WCAG requires of graphics that carry meaning. */
  chart: readonly string[];
  /** Font stacks. The back office uses one face for all three roles. */
  typeface: {
    /** Headings and large figures. */
    display: string;
    /** Body copy, table cells, form controls. */
    body: string;
    /** Small labels: eyebrows, column headers, button text. */
    label: string;
  };
  /** Border radius. Named `corner` so it does not collide with Tailwind's own
   *  `--radius-*` namespace, which this feeds. */
  corner: {
    /** Buttons, inputs, badges - anything the size of a control. */
    control: string;
    /** Cards, tables, dialogs. Slightly softer than a control. */
    panel: string;
  };
  /** Drop shadows. The dark theme leans on the surface ladder instead, so its
   *  values are faint; `none` is legitimate. */
  elevation: {
    /** A resting card. */
    panel: string;
    /** Something floating above the page: menu, popover, dialog. */
    overlay: string;
  };
  /**
   * How a small label is set. This is the single largest difference between the
   * two design systems: the brand's signature is wide uppercase tracking, and a
   * dashboard's is a quiet sentence-case label you can read at a glance.
   */
  label: {
    /** `uppercase` for the brand, `none` for the back office. */
    transform: string;
    /** Numeric CSS weight, as a string. */
    weight: string;
    /** Tracking for eyebrows and column headers. */
    tracking: string;
    /** Tracking at button and badge scale, where the brand runs tighter. */
    trackingTight: string;
  };
};

/**
 * Inter for every role in the back office.
 *
 * One face, four weights. Mixing a serif into a data table is a way of making
 * columns of numbers harder to compare, which is the opposite of the job.
 */
const UI_TYPEFACE: ThemeTokens['typeface'] = {
  display: "var(--font-inter), 'Inter', ui-sans-serif, system-ui, sans-serif",
  body: "var(--font-inter), 'Inter', ui-sans-serif, system-ui, sans-serif",
  label: "var(--font-inter), 'Inter', ui-sans-serif, system-ui, sans-serif",
};

/** Ordinary dashboard geometry: 6px on controls, 8px on panels. */
const UI_CORNER: ThemeTokens['corner'] = {
  control: '0.375rem',
  panel: '0.5rem',
};

/** Sentence case, medium weight, no tracking. The dashboard default. */
const UI_LABEL: ThemeTokens['label'] = {
  transform: 'none',
  weight: '500',
  tracking: '0',
  trackingTight: '0',
};

/**
 * Status colours shared by the two light-surface themes.
 *
 * The inks run darker than the palette document proposes, because they have to
 * stay readable on three different backgrounds: a white panel, their own tinted
 * badge fill, and the public site's cream panel. The lightest of those is what
 * sets the limit.
 */
const LIGHT_STATUS: ThemeTokens['status'] = {
  success: { ink: '#347556', bg: '#E8F3EE', line: '#A8CFBC' },
  warning: { ink: '#8C621A', bg: '#FBF1DC', line: '#E0C48A' },
  error: { ink: '#A74D4D', bg: '#FBEAEA', line: '#E5B4B4' },
  info: { ink: '#2E6DA5', bg: '#E7F0F8', line: '#A9C8E0' },
};

/**
 * Back office, dark - the default. This is an operational tool used for long
 * stretches, and the palette document intends gold to read best against
 * midnight navy.
 */
const adminDark: ThemeTokens = {
  surface: {
    page: '#0F1825',
    panel: '#1A2738',
    panelRaised: '#213247',
    inset: '#0B121C',
    sidebar: '#121F31',
    sidebarActive: '#1E2E43',
  },
  ink: {
    primary: '#F5F1EB',
    secondary: '#AAB3BF',
    accent: '#D2A34A',
    onSidebar: '#F5F1EB',
    onSidebarMuted: '#AAB3BF',
  },
  line: {
    subtle: '#2B394A',
    // Reaches 3:1 against page, panel and panelRaised alike - a control keeps its
    // visible edge wherever it sits.
    strong: '#757E8A',
    focus: '#D2A34A',
  },
  action: {
    primary: '#D2A34A',
    primaryHover: '#E0B45E',
    onPrimary: '#0F1825',
    secondary: '#1A2738',
    secondaryHover: '#213247',
    onSecondary: '#F5F1EB',
    secondaryLine: '#757E8A',
    soft: '#2A2415',
    onSoft: '#E8C888',
  },
  status: {
    // Lightened from the palette document so they stay readable on a hovered
    // row (`panelRaised`), not just on a resting panel.
    success: { ink: '#5AAA81', bg: '#16302A', line: '#2E6B50' },
    warning: { ink: '#D4A449', bg: '#33290F', line: '#6B5520' },
    error: { ink: '#D98282', bg: '#34191B', line: '#7A3B3B' },
    info: { ink: '#7FB3DD', bg: '#12283A', line: '#2F5B7D' },
  },
  /*
   * A deliberate luminance ladder, not just eight pleasant colours.
   *
   * Hue alone is not enough: roughly one man in twelve cannot reliably separate
   * red from green, and a chart is often screenshotted into a message or printed
   * in grey. So each series steps about 20% in luminance from the last, which
   * keeps them separable with no colour vision at all. The order starts on brand
   * gold, because a single-series chart uses the first entry.
   */
  chart: [
    '#D2A34A', // gold
    '#93C6B8', // teal
    '#B6D59E', // green
    '#F1D6D0', // blush
    '#F7ECD5', // cream
    '#A76661', // deep rose
    '#6688C3', // blue
    '#A38CC7', // lavender
  ],
  typeface: UI_TYPEFACE,
  corner: UI_CORNER,
  // Barely there. On a dark surface a shadow reads as dirt, so the border and
  // the surface ladder do the work and this only softens the panel edge.
  elevation: {
    panel: '0 1px 2px 0 rgb(0 0 0 / 0.32)',
    overlay: '0 16px 40px -12px rgb(0 0 0 / 0.64)',
  },
  label: UI_LABEL,
};

/** Back office, light: navy sidebar, light workspace, white cards. */
const adminLight: ThemeTokens = {
  surface: {
    page: '#F8F9FA',
    panel: '#FFFFFF',
    panelRaised: '#F2F4F6',
    inset: '#F2F4F6',
    sidebar: '#18304D',
    // Kept dark enough that the brand-gold active marker still reaches 3:1 on it.
    // The palette's lighter #22415F washed the marker out to 2.92:1.
    sidebarActive: '#1E3752',
  },
  ink: {
    primary: '#202733',
    // Darkened from the palette's #697386, which fails on a hovered row.
    secondary: '#656E81',
    // Darkened from brand gold #B77A17, which reaches only 3.61:1 on white.
    accent: '#966413',
    onSidebar: '#FAF7F2',
    onSidebarMuted: '#AAB3BF',
  },
  line: {
    subtle: '#E2E6EA',
    // The palette's #E2E6EA is 1.25:1 on white - effectively invisible as a
    // control edge. Darkened for inputs and buttons only; dividers keep it.
    strong: '#878A8C',
    focus: '#9C6814',
  },
  action: {
    primary: '#18304D',
    primaryHover: '#10243B',
    onPrimary: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryHover: '#F2F4F6',
    onSecondary: '#18304D',
    secondaryLine: '#878A8C',
    soft: '#F5E9CE',
    onSoft: '#202733',
  },
  status: LIGHT_STATUS,
  /** The same luminance ladder as the dark theme, inverted for a white panel. */
  chart: [
    '#8D5E12', // gold
    '#567C6E', // sage
    '#957F59', // bronze
    '#112135', // navy
    '#3C2949', // aubergine
    '#1D4735', // teal
    '#6D433F', // deep rose
    '#345F86', // blue
  ],
  typeface: UI_TYPEFACE,
  corner: UI_CORNER,
  elevation: {
    panel: '0 1px 2px 0 rgb(16 24 40 / 0.06)',
    overlay: '0 16px 40px -12px rgb(16 24 40 / 0.18)',
  },
  label: UI_LABEL,
};

/**
 * Public site. Unused for now - there is no customer-facing site yet - but
 * defined so the brand palette lives in exactly one place when it arrives.
 */
const publicSite: ThemeTokens = {
  surface: {
    page: brand.ivory,
    panel: '#F2ECE4',
    panelRaised: '#FFFFFF',
    inset: '#F2ECE4',
    sidebar: brand.navy,
    sidebarActive: '#29415F',
  },
  ink: {
    primary: brand.navy,
    secondary: '#706A64',
    // Darkened from brand gold: the eyebrow labels are around 11px, so they need
    // the full 4.5:1 rather than the large-text allowance.
    accent: '#8F5F12',
    onSidebar: brand.ivory,
    onSidebarMuted: brand.blush,
  },
  line: {
    subtle: '#DED5CC',
    strong: '#89837E',
    focus: '#8F5F12',
  },
  action: {
    primary: brand.navy,
    primaryHover: '#29415F',
    onPrimary: brand.ivory,
    secondary: '#F2ECE4',
    secondaryHover: '#DED5CC',
    onSecondary: '#29415F',
    secondaryLine: '#89837E',
    soft: '#F5E9CE',
    onSoft: brand.navy,
  },
  status: LIGHT_STATUS,
  chart: adminLight.chart,
  /** The pairing from the reference homepage. */
  typeface: {
    display: "var(--font-cormorant), 'Cormorant Garamond', Georgia, serif",
    body: "var(--font-jost), 'Jost', ui-sans-serif, system-ui, sans-serif",
    label: "var(--font-marcellus), 'Marcellus', Georgia, serif",
  },
  /** Square throughout. Corners are part of the brand's signature. */
  corner: {
    control: '0',
    panel: '0',
  },
  /** Flat. Depth comes from the cream surface ladder and hairline rules. */
  elevation: {
    panel: 'none',
    overlay: '0 24px 60px -20px rgb(20 43 73 / 0.24)',
  },
  /** Wide uppercase tracking - the detail that reads as boutique. */
  label: {
    transform: 'uppercase',
    weight: '400',
    tracking: '0.28em',
    trackingTight: '0.14em',
  },
};

export const themes: Record<ThemeName, ThemeTokens> = {
  'admin-dark': adminDark,
  'admin-light': adminLight,
  public: publicSite,
};

/** Themes the back office can switch between. */
export const ADMIN_THEMES = ['admin-dark', 'admin-light'] as const;

export type AdminThemeName = (typeof ADMIN_THEMES)[number];

/** Used when nobody has expressed a preference. */
export const DEFAULT_ADMIN_THEME: AdminThemeName = 'admin-dark';

export function isAdminTheme(value: unknown): value is AdminThemeName {
  return typeof value === 'string' && (ADMIN_THEMES as readonly string[]).includes(value);
}

/**
 * Converts a token path to its CSS custom property name.
 * `['surface', 'panelRaised']` becomes `--surface-panel-raised`.
 */
export function toCssVariableName(path: readonly string[]): string {
  return (
    '--' +
    path.map((segment) => segment.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()).join('-')
  );
}

/**
 * Every token in a theme as `[cssVariableName, value]`, chart colours included
 * and numbered from 1. The stylesheet drift test compares against this.
 */
export function toCssVariables(theme: ThemeTokens): Array<[string, string]> {
  const entries: Array<[string, string]> = [];

  const walk = (node: unknown, path: readonly string[]) => {
    if (typeof node === 'string') {
      entries.push([toCssVariableName(path), node]);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((value, index) => {
        if (typeof value === 'string') {
          entries.push([toCssVariableName([...path, String(index + 1)]), value]);
        }
      });
      return;
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) {
        walk(value, [...path, key]);
      }
    }
  };

  walk(theme, []);
  return entries;
}
