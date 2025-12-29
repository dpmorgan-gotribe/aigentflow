# Step 07: Design Tokens

> **Checkpoint:** CP1 - Design System
> **Previous Step:** 06-UI-DESIGNER-AGENT.md
> **Next Step:** 08-USER-FLOWS.md

---

## Overview

Design tokens are the foundational visual design values that ensure consistency across the application. This step implements a token system that:

- Defines a comprehensive token schema
- Generates CSS variables from tokens
- Creates component-specific style sheets
- Supports dark/light theme variants
- Stores tokens in project configuration

---

## Deliverables

1. `src/design/tokens/schema.ts` - Token schema definitions
2. `src/design/tokens/generator.ts` - CSS generator from tokens
3. `src/design/tokens/defaults.ts` - Default token values
4. `src/design/tokens/theme.ts` - Theme variant support
5. `src/design/tokens/index.ts` - Public exports

---

## File Structure

```
src/design/
├── tokens/
│   ├── schema.ts       # Token type definitions
│   ├── generator.ts    # CSS generation logic
│   ├── defaults.ts     # Default token values
│   ├── theme.ts        # Theme management
│   └── index.ts        # Public exports
└── components/         # Component-specific styles (future)
    └── .gitkeep
```

---

## 1. Token Schema (`src/design/tokens/schema.ts`)

```typescript
/**
 * Design Token Schema
 *
 * Defines the structure for all design tokens used in the system.
 * Based on the Design Tokens Community Group specification.
 */

import { z } from 'zod';

// ============================================================================
// Color Tokens
// ============================================================================

/**
 * Color value - supports hex, rgb, rgba, hsl, hsla
 */
export const ColorValueSchema = z.string().regex(
  /^(#[0-9a-fA-F]{3,8}|rgb\(|rgba\(|hsl\(|hsla\()/,
  'Invalid color format'
);

export type ColorValue = z.infer<typeof ColorValueSchema>;

/**
 * Color scale - numbered variants from 50-900
 */
export const ColorScaleSchema = z.object({
  50: ColorValueSchema,
  100: ColorValueSchema,
  200: ColorValueSchema,
  300: ColorValueSchema,
  400: ColorValueSchema,
  500: ColorValueSchema,
  600: ColorValueSchema,
  700: ColorValueSchema,
  800: ColorValueSchema,
  900: ColorValueSchema,
});

export type ColorScale = z.infer<typeof ColorScaleSchema>;

/**
 * Semantic color tokens
 */
export const SemanticColorsSchema = z.object({
  // Brand colors
  primary: ColorScaleSchema,
  secondary: ColorScaleSchema,
  accent: ColorScaleSchema,

  // Feedback colors
  success: ColorScaleSchema,
  warning: ColorScaleSchema,
  error: ColorScaleSchema,
  info: ColorScaleSchema,

  // Neutral colors
  neutral: ColorScaleSchema,

  // Surface colors
  background: z.object({
    default: ColorValueSchema,
    subtle: ColorValueSchema,
    muted: ColorValueSchema,
  }),
  surface: z.object({
    default: ColorValueSchema,
    raised: ColorValueSchema,
    overlay: ColorValueSchema,
  }),

  // Text colors
  text: z.object({
    default: ColorValueSchema,
    muted: ColorValueSchema,
    subtle: ColorValueSchema,
    inverse: ColorValueSchema,
    link: ColorValueSchema,
    linkHover: ColorValueSchema,
  }),

  // Border colors
  border: z.object({
    default: ColorValueSchema,
    muted: ColorValueSchema,
    focus: ColorValueSchema,
  }),
});

export type SemanticColors = z.infer<typeof SemanticColorsSchema>;

// ============================================================================
// Typography Tokens
// ============================================================================

/**
 * Font family token
 */
export const FontFamilySchema = z.object({
  sans: z.string(),
  serif: z.string().optional(),
  mono: z.string(),
  heading: z.string().optional(),
});

export type FontFamily = z.infer<typeof FontFamilySchema>;

/**
 * Font size scale
 */
export const FontSizeSchema = z.object({
  xs: z.string(),
  sm: z.string(),
  base: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  '3xl': z.string(),
  '4xl': z.string(),
  '5xl': z.string(),
  '6xl': z.string(),
});

export type FontSize = z.infer<typeof FontSizeSchema>;

/**
 * Font weight scale
 */
export const FontWeightSchema = z.object({
  thin: z.number(),
  light: z.number(),
  normal: z.number(),
  medium: z.number(),
  semibold: z.number(),
  bold: z.number(),
  extrabold: z.number(),
});

export type FontWeight = z.infer<typeof FontWeightSchema>;

/**
 * Line height scale
 */
export const LineHeightSchema = z.object({
  none: z.number(),
  tight: z.number(),
  snug: z.number(),
  normal: z.number(),
  relaxed: z.number(),
  loose: z.number(),
});

export type LineHeight = z.infer<typeof LineHeightSchema>;

/**
 * Letter spacing scale
 */
export const LetterSpacingSchema = z.object({
  tighter: z.string(),
  tight: z.string(),
  normal: z.string(),
  wide: z.string(),
  wider: z.string(),
  widest: z.string(),
});

export type LetterSpacing = z.infer<typeof LetterSpacingSchema>;

/**
 * Complete typography tokens
 */
export const TypographyTokensSchema = z.object({
  fontFamily: FontFamilySchema,
  fontSize: FontSizeSchema,
  fontWeight: FontWeightSchema,
  lineHeight: LineHeightSchema,
  letterSpacing: LetterSpacingSchema,
});

export type TypographyTokens = z.infer<typeof TypographyTokensSchema>;

// ============================================================================
// Spacing Tokens
// ============================================================================

/**
 * Spacing scale
 */
export const SpacingScaleSchema = z.object({
  0: z.string(),
  px: z.string(),
  0.5: z.string(),
  1: z.string(),
  1.5: z.string(),
  2: z.string(),
  2.5: z.string(),
  3: z.string(),
  3.5: z.string(),
  4: z.string(),
  5: z.string(),
  6: z.string(),
  7: z.string(),
  8: z.string(),
  9: z.string(),
  10: z.string(),
  11: z.string(),
  12: z.string(),
  14: z.string(),
  16: z.string(),
  20: z.string(),
  24: z.string(),
  28: z.string(),
  32: z.string(),
  36: z.string(),
  40: z.string(),
  44: z.string(),
  48: z.string(),
  52: z.string(),
  56: z.string(),
  60: z.string(),
  64: z.string(),
  72: z.string(),
  80: z.string(),
  96: z.string(),
});

export type SpacingScale = z.infer<typeof SpacingScaleSchema>;

// ============================================================================
// Border Tokens
// ============================================================================

/**
 * Border radius scale
 */
export const BorderRadiusSchema = z.object({
  none: z.string(),
  sm: z.string(),
  default: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  '3xl': z.string(),
  full: z.string(),
});

export type BorderRadius = z.infer<typeof BorderRadiusSchema>;

/**
 * Border width scale
 */
export const BorderWidthSchema = z.object({
  0: z.string(),
  default: z.string(),
  2: z.string(),
  4: z.string(),
  8: z.string(),
});

export type BorderWidth = z.infer<typeof BorderWidthSchema>;

// ============================================================================
// Shadow Tokens
// ============================================================================

/**
 * Box shadow scale
 */
export const BoxShadowSchema = z.object({
  none: z.string(),
  sm: z.string(),
  default: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
  inner: z.string(),
});

export type BoxShadow = z.infer<typeof BoxShadowSchema>;

// ============================================================================
// Animation Tokens
// ============================================================================

/**
 * Duration scale
 */
export const DurationSchema = z.object({
  0: z.string(),
  75: z.string(),
  100: z.string(),
  150: z.string(),
  200: z.string(),
  300: z.string(),
  500: z.string(),
  700: z.string(),
  1000: z.string(),
});

export type Duration = z.infer<typeof DurationSchema>;

/**
 * Easing functions
 */
export const EasingSchema = z.object({
  linear: z.string(),
  in: z.string(),
  out: z.string(),
  inOut: z.string(),
});

export type Easing = z.infer<typeof EasingSchema>;

// ============================================================================
// Breakpoint Tokens
// ============================================================================

/**
 * Responsive breakpoints
 */
export const BreakpointsSchema = z.object({
  sm: z.string(),
  md: z.string(),
  lg: z.string(),
  xl: z.string(),
  '2xl': z.string(),
});

export type Breakpoints = z.infer<typeof BreakpointsSchema>;

// ============================================================================
// Z-Index Tokens
// ============================================================================

/**
 * Z-index scale
 */
export const ZIndexSchema = z.object({
  auto: z.string(),
  0: z.number(),
  10: z.number(),
  20: z.number(),
  30: z.number(),
  40: z.number(),
  50: z.number(),
  dropdown: z.number(),
  sticky: z.number(),
  fixed: z.number(),
  modal: z.number(),
  popover: z.number(),
  tooltip: z.number(),
});

export type ZIndex = z.infer<typeof ZIndexSchema>;

// ============================================================================
// Complete Design Tokens
// ============================================================================

/**
 * Complete design token set
 */
export const DesignTokensSchema = z.object({
  name: z.string(),
  version: z.string(),
  colors: SemanticColorsSchema,
  typography: TypographyTokensSchema,
  spacing: SpacingScaleSchema,
  borderRadius: BorderRadiusSchema,
  borderWidth: BorderWidthSchema,
  boxShadow: BoxShadowSchema,
  duration: DurationSchema,
  easing: EasingSchema,
  breakpoints: BreakpointsSchema,
  zIndex: ZIndexSchema,
});

export type DesignTokens = z.infer<typeof DesignTokensSchema>;

/**
 * Theme mode
 */
export type ThemeMode = 'light' | 'dark' | 'auto';

/**
 * Theme tokens (subset that changes between themes)
 */
export interface ThemeTokens {
  colors: SemanticColors;
}
```

---

## 2. Default Tokens (`src/design/tokens/defaults.ts`)

```typescript
/**
 * Default Design Tokens
 *
 * Provides sensible defaults for all design tokens.
 * Based on modern design system conventions.
 */

import { DesignTokens, ColorScale, SemanticColors, TypographyTokens } from './schema';

/**
 * Generate a color scale from a base color
 */
function generateColorScale(base: string): ColorScale {
  // In production, use a color library like chroma.js
  // This is a simplified version
  return {
    50: adjustLightness(base, 0.95),
    100: adjustLightness(base, 0.9),
    200: adjustLightness(base, 0.8),
    300: adjustLightness(base, 0.7),
    400: adjustLightness(base, 0.6),
    500: base,
    600: adjustLightness(base, 0.4),
    700: adjustLightness(base, 0.3),
    800: adjustLightness(base, 0.2),
    900: adjustLightness(base, 0.1),
  };
}

/**
 * Adjust lightness of a hex color (simplified)
 */
function adjustLightness(hex: string, factor: number): string {
  // Simplified - in production use proper color manipulation
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  const adjust = (c: number) => Math.round(c + (255 - c) * factor);

  if (factor > 0.5) {
    return `#${adjust(r).toString(16).padStart(2, '0')}${adjust(g).toString(16).padStart(2, '0')}${adjust(b).toString(16).padStart(2, '0')}`;
  }

  const darken = (c: number) => Math.round(c * factor * 2);
  return `#${darken(r).toString(16).padStart(2, '0')}${darken(g).toString(16).padStart(2, '0')}${darken(b).toString(16).padStart(2, '0')}`;
}

/**
 * Default light theme colors
 */
export const DEFAULT_LIGHT_COLORS: SemanticColors = {
  primary: generateColorScale('#3b82f6'),      // Blue
  secondary: generateColorScale('#6366f1'),    // Indigo
  accent: generateColorScale('#8b5cf6'),       // Violet

  success: generateColorScale('#22c55e'),      // Green
  warning: generateColorScale('#f59e0b'),      // Amber
  error: generateColorScale('#ef4444'),        // Red
  info: generateColorScale('#06b6d4'),         // Cyan

  neutral: generateColorScale('#6b7280'),      // Gray

  background: {
    default: '#ffffff',
    subtle: '#f9fafb',
    muted: '#f3f4f6',
  },

  surface: {
    default: '#ffffff',
    raised: '#ffffff',
    overlay: 'rgba(0, 0, 0, 0.5)',
  },

  text: {
    default: '#111827',
    muted: '#6b7280',
    subtle: '#9ca3af',
    inverse: '#ffffff',
    link: '#3b82f6',
    linkHover: '#2563eb',
  },

  border: {
    default: '#e5e7eb',
    muted: '#f3f4f6',
    focus: '#3b82f6',
  },
};

/**
 * Default dark theme colors
 */
export const DEFAULT_DARK_COLORS: SemanticColors = {
  primary: generateColorScale('#60a5fa'),
  secondary: generateColorScale('#818cf8'),
  accent: generateColorScale('#a78bfa'),

  success: generateColorScale('#4ade80'),
  warning: generateColorScale('#fbbf24'),
  error: generateColorScale('#f87171'),
  info: generateColorScale('#22d3ee'),

  neutral: generateColorScale('#9ca3af'),

  background: {
    default: '#111827',
    subtle: '#1f2937',
    muted: '#374151',
  },

  surface: {
    default: '#1f2937',
    raised: '#374151',
    overlay: 'rgba(0, 0, 0, 0.75)',
  },

  text: {
    default: '#f9fafb',
    muted: '#9ca3af',
    subtle: '#6b7280',
    inverse: '#111827',
    link: '#60a5fa',
    linkHover: '#93c5fd',
  },

  border: {
    default: '#374151',
    muted: '#1f2937',
    focus: '#60a5fa',
  },
};

/**
 * Default typography tokens
 */
export const DEFAULT_TYPOGRAPHY: TypographyTokens = {
  fontFamily: {
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    heading: undefined, // Uses sans by default
  },

  fontSize: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
  },

  fontWeight: {
    thin: 100,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

/**
 * Default spacing scale (based on 4px)
 */
export const DEFAULT_SPACING = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
  44: '11rem',       // 176px
  48: '12rem',       // 192px
  52: '13rem',       // 208px
  56: '14rem',       // 224px
  60: '15rem',       // 240px
  64: '16rem',       // 256px
  72: '18rem',       // 288px
  80: '20rem',       // 320px
  96: '24rem',       // 384px
};

/**
 * Complete default design tokens
 */
export const DEFAULT_TOKENS: DesignTokens = {
  name: 'default',
  version: '1.0.0',

  colors: DEFAULT_LIGHT_COLORS,
  typography: DEFAULT_TYPOGRAPHY,
  spacing: DEFAULT_SPACING,

  borderRadius: {
    none: '0',
    sm: '0.125rem',   // 2px
    default: '0.25rem', // 4px
    md: '0.375rem',   // 6px
    lg: '0.5rem',     // 8px
    xl: '0.75rem',    // 12px
    '2xl': '1rem',    // 16px
    '3xl': '1.5rem',  // 24px
    full: '9999px',
  },

  borderWidth: {
    0: '0',
    default: '1px',
    2: '2px',
    4: '4px',
    8: '8px',
  },

  boxShadow: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    default: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  },

  duration: {
    0: '0ms',
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms',
  },

  easing: {
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  zIndex: {
    auto: 'auto',
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  },
};
```

---

## 3. CSS Generator (`src/design/tokens/generator.ts`)

```typescript
/**
 * CSS Generator
 *
 * Generates CSS custom properties from design tokens.
 * Supports themes, component styles, and responsive utilities.
 */

import { DesignTokens, SemanticColors, ThemeMode } from './schema';
import { DEFAULT_TOKENS, DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from './defaults';

/**
 * Generator options
 */
export interface GeneratorOptions {
  prefix?: string;              // CSS variable prefix (default: '')
  includeReset?: boolean;       // Include CSS reset
  includeUtilities?: boolean;   // Include utility classes
  minify?: boolean;             // Minify output
  theme?: ThemeMode;            // Theme mode
}

/**
 * CSS Generator class
 */
export class CSSGenerator {
  private tokens: DesignTokens;
  private options: Required<GeneratorOptions>;

  constructor(tokens: DesignTokens = DEFAULT_TOKENS, options: GeneratorOptions = {}) {
    this.tokens = tokens;
    this.options = {
      prefix: options.prefix || '',
      includeReset: options.includeReset ?? true,
      includeUtilities: options.includeUtilities ?? false,
      minify: options.minify ?? false,
      theme: options.theme ?? 'auto',
    };
  }

  /**
   * Generate complete CSS
   */
  generate(): string {
    const parts: string[] = [];

    // CSS Reset
    if (this.options.includeReset) {
      parts.push(this.generateReset());
    }

    // CSS Variables
    parts.push(this.generateVariables());

    // Theme variants
    if (this.options.theme === 'auto') {
      parts.push(this.generateDarkTheme());
    }

    // Utilities
    if (this.options.includeUtilities) {
      parts.push(this.generateUtilities());
    }

    const css = parts.join('\n\n');
    return this.options.minify ? this.minifyCSS(css) : css;
  }

  /**
   * Generate only CSS variables
   */
  generateVariables(): string {
    const prefix = this.options.prefix ? `${this.options.prefix}-` : '';
    const lines: string[] = [':root {'];

    // Colors
    lines.push(...this.generateColorVariables(this.tokens.colors, prefix));

    // Typography
    lines.push(...this.generateTypographyVariables(prefix));

    // Spacing
    lines.push(...this.generateSpacingVariables(prefix));

    // Border
    lines.push(...this.generateBorderVariables(prefix));

    // Shadows
    lines.push(...this.generateShadowVariables(prefix));

    // Animation
    lines.push(...this.generateAnimationVariables(prefix));

    // Breakpoints
    lines.push(...this.generateBreakpointVariables(prefix));

    // Z-Index
    lines.push(...this.generateZIndexVariables(prefix));

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Generate color CSS variables
   */
  private generateColorVariables(colors: SemanticColors, prefix: string): string[] {
    const lines: string[] = ['  /* Colors */'];

    // Color scales
    const scales = ['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info', 'neutral'] as const;
    for (const scale of scales) {
      const colorScale = colors[scale];
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(`  --${prefix}color-${scale}-${shade}: ${value};`);
      }
    }

    // Background colors
    lines.push('  /* Background */');
    for (const [name, value] of Object.entries(colors.background)) {
      lines.push(`  --${prefix}bg-${name}: ${value};`);
    }

    // Surface colors
    lines.push('  /* Surface */');
    for (const [name, value] of Object.entries(colors.surface)) {
      lines.push(`  --${prefix}surface-${name}: ${value};`);
    }

    // Text colors
    lines.push('  /* Text */');
    for (const [name, value] of Object.entries(colors.text)) {
      lines.push(`  --${prefix}text-${name}: ${value};`);
    }

    // Border colors
    lines.push('  /* Border */');
    for (const [name, value] of Object.entries(colors.border)) {
      lines.push(`  --${prefix}border-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate typography CSS variables
   */
  private generateTypographyVariables(prefix: string): string[] {
    const { typography } = this.tokens;
    const lines: string[] = ['  /* Typography */'];

    // Font families
    for (const [name, value] of Object.entries(typography.fontFamily)) {
      if (value) {
        lines.push(`  --${prefix}font-${name}: ${value};`);
      }
    }

    // Font sizes
    for (const [name, value] of Object.entries(typography.fontSize)) {
      lines.push(`  --${prefix}text-${name}: ${value};`);
    }

    // Font weights
    for (const [name, value] of Object.entries(typography.fontWeight)) {
      lines.push(`  --${prefix}font-${name}: ${value};`);
    }

    // Line heights
    for (const [name, value] of Object.entries(typography.lineHeight)) {
      lines.push(`  --${prefix}leading-${name}: ${value};`);
    }

    // Letter spacing
    for (const [name, value] of Object.entries(typography.letterSpacing)) {
      lines.push(`  --${prefix}tracking-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate spacing CSS variables
   */
  private generateSpacingVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Spacing */'];

    for (const [name, value] of Object.entries(this.tokens.spacing)) {
      const varName = name.toString().replace('.', '_');
      lines.push(`  --${prefix}space-${varName}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate border CSS variables
   */
  private generateBorderVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Border */'];

    // Border radius
    for (const [name, value] of Object.entries(this.tokens.borderRadius)) {
      lines.push(`  --${prefix}rounded-${name}: ${value};`);
    }

    // Border width
    for (const [name, value] of Object.entries(this.tokens.borderWidth)) {
      lines.push(`  --${prefix}border-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate shadow CSS variables
   */
  private generateShadowVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Shadows */'];

    for (const [name, value] of Object.entries(this.tokens.boxShadow)) {
      lines.push(`  --${prefix}shadow-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate animation CSS variables
   */
  private generateAnimationVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Animation */'];

    // Duration
    for (const [name, value] of Object.entries(this.tokens.duration)) {
      lines.push(`  --${prefix}duration-${name}: ${value};`);
    }

    // Easing
    for (const [name, value] of Object.entries(this.tokens.easing)) {
      lines.push(`  --${prefix}ease-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate breakpoint CSS variables
   */
  private generateBreakpointVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Breakpoints */'];

    for (const [name, value] of Object.entries(this.tokens.breakpoints)) {
      lines.push(`  --${prefix}screen-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate z-index CSS variables
   */
  private generateZIndexVariables(prefix: string): string[] {
    const lines: string[] = ['  /* Z-Index */'];

    for (const [name, value] of Object.entries(this.tokens.zIndex)) {
      lines.push(`  --${prefix}z-${name}: ${value};`);
    }

    return lines;
  }

  /**
   * Generate dark theme CSS
   */
  private generateDarkTheme(): string {
    const prefix = this.options.prefix ? `${this.options.prefix}-` : '';
    const lines: string[] = [
      '@media (prefers-color-scheme: dark) {',
      '  :root {',
    ];

    // Override color variables with dark theme colors
    const darkColors = DEFAULT_DARK_COLORS;

    // Color scales
    const scales = ['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info', 'neutral'] as const;
    for (const scale of scales) {
      const colorScale = darkColors[scale];
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(`    --${prefix}color-${scale}-${shade}: ${value};`);
      }
    }

    // Background colors
    for (const [name, value] of Object.entries(darkColors.background)) {
      lines.push(`    --${prefix}bg-${name}: ${value};`);
    }

    // Surface colors
    for (const [name, value] of Object.entries(darkColors.surface)) {
      lines.push(`    --${prefix}surface-${name}: ${value};`);
    }

    // Text colors
    for (const [name, value] of Object.entries(darkColors.text)) {
      lines.push(`    --${prefix}text-${name}: ${value};`);
    }

    // Border colors
    for (const [name, value] of Object.entries(darkColors.border)) {
      lines.push(`    --${prefix}border-${name}: ${value};`);
    }

    lines.push('  }');
    lines.push('}');

    // Manual dark mode class
    lines.push('');
    lines.push('[data-theme="dark"] {');
    // Same overrides for manual toggle
    for (const [name, value] of Object.entries(darkColors.background)) {
      lines.push(`  --${prefix}bg-${name}: ${value};`);
    }
    // ... (abbreviated for space, same pattern as above)
    lines.push('}');

    return lines.join('\n');
  }

  /**
   * Generate CSS reset
   */
  private generateReset(): string {
    return `/* CSS Reset */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-sans);
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--text-default);
  background-color: var(--bg-default);
}

img, picture, video, canvas, svg {
  display: block;
  max-width: 100%;
}

input, button, textarea, select {
  font: inherit;
}

p, h1, h2, h3, h4, h5, h6 {
  overflow-wrap: break-word;
}

a {
  color: var(--text-link);
  text-decoration: none;
}

a:hover {
  color: var(--text-link-hover);
  text-decoration: underline;
}

button {
  cursor: pointer;
}

:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}`;
  }

  /**
   * Generate utility classes (abbreviated)
   */
  private generateUtilities(): string {
    const prefix = this.options.prefix ? `${this.options.prefix}-` : '';
    return `/* Utility Classes */

/* Display */
.hidden { display: none; }
.block { display: block; }
.inline { display: inline; }
.inline-block { display: inline-block; }
.flex { display: flex; }
.inline-flex { display: inline-flex; }
.grid { display: grid; }

/* Flex */
.flex-row { flex-direction: row; }
.flex-col { flex-direction: column; }
.flex-wrap { flex-wrap: wrap; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.items-end { align-items: flex-end; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.justify-around { justify-content: space-around; }

/* Spacing (sample) */
.p-0 { padding: var(--${prefix}space-0); }
.p-1 { padding: var(--${prefix}space-1); }
.p-2 { padding: var(--${prefix}space-2); }
.p-4 { padding: var(--${prefix}space-4); }
.p-8 { padding: var(--${prefix}space-8); }
.m-0 { margin: var(--${prefix}space-0); }
.m-1 { margin: var(--${prefix}space-1); }
.m-2 { margin: var(--${prefix}space-2); }
.m-4 { margin: var(--${prefix}space-4); }
.m-auto { margin: auto; }

/* Text */
.text-xs { font-size: var(--${prefix}text-xs); }
.text-sm { font-size: var(--${prefix}text-sm); }
.text-base { font-size: var(--${prefix}text-base); }
.text-lg { font-size: var(--${prefix}text-lg); }
.text-xl { font-size: var(--${prefix}text-xl); }
.text-2xl { font-size: var(--${prefix}text-2xl); }
.font-normal { font-weight: var(--${prefix}font-normal); }
.font-medium { font-weight: var(--${prefix}font-medium); }
.font-bold { font-weight: var(--${prefix}font-bold); }

/* Border Radius */
.rounded-none { border-radius: var(--${prefix}rounded-none); }
.rounded-sm { border-radius: var(--${prefix}rounded-sm); }
.rounded { border-radius: var(--${prefix}rounded-default); }
.rounded-md { border-radius: var(--${prefix}rounded-md); }
.rounded-lg { border-radius: var(--${prefix}rounded-lg); }
.rounded-full { border-radius: var(--${prefix}rounded-full); }

/* Shadows */
.shadow-none { box-shadow: var(--${prefix}shadow-none); }
.shadow-sm { box-shadow: var(--${prefix}shadow-sm); }
.shadow { box-shadow: var(--${prefix}shadow-default); }
.shadow-md { box-shadow: var(--${prefix}shadow-md); }
.shadow-lg { box-shadow: var(--${prefix}shadow-lg); }
.shadow-xl { box-shadow: var(--${prefix}shadow-xl); }`;
  }

  /**
   * Simple CSS minification
   */
  private minifyCSS(css: string): string {
    return css
      .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove comments
      .replace(/\s+/g, ' ')               // Collapse whitespace
      .replace(/\s*([{}:;,])\s*/g, '$1')  // Remove space around special chars
      .replace(/;}/g, '}')                // Remove trailing semicolons
      .trim();
  }

  /**
   * Generate JSON export of tokens
   */
  toJSON(): string {
    return JSON.stringify(this.tokens, null, 2);
  }
}

/**
 * Create a CSS generator with custom tokens
 */
export function createGenerator(
  tokens?: Partial<DesignTokens>,
  options?: GeneratorOptions
): CSSGenerator {
  const mergedTokens: DesignTokens = {
    ...DEFAULT_TOKENS,
    ...tokens,
  };
  return new CSSGenerator(mergedTokens, options);
}
```

---

## 4. Theme Manager (`src/design/tokens/theme.ts`)

```typescript
/**
 * Theme Manager
 *
 * Manages theme variants and runtime theme switching.
 */

import { SemanticColors, ThemeMode, ThemeTokens } from './schema';
import { DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from './defaults';

/**
 * Theme configuration
 */
export interface ThemeConfig {
  name: string;
  mode: ThemeMode;
  colors: SemanticColors;
}

/**
 * Theme manager class
 */
export class ThemeManager {
  private themes: Map<string, ThemeConfig> = new Map();
  private currentTheme: string = 'light';
  private systemPreference: ThemeMode = 'light';

  constructor() {
    // Register default themes
    this.registerTheme({
      name: 'light',
      mode: 'light',
      colors: DEFAULT_LIGHT_COLORS,
    });

    this.registerTheme({
      name: 'dark',
      mode: 'dark',
      colors: DEFAULT_DARK_COLORS,
    });

    // Detect system preference (in browser context)
    if (typeof window !== 'undefined' && window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemPreference = darkModeQuery.matches ? 'dark' : 'light';

      // Listen for changes
      darkModeQuery.addEventListener('change', (e) => {
        this.systemPreference = e.matches ? 'dark' : 'light';
        if (this.currentTheme === 'auto') {
          this.applyTheme('auto');
        }
      });
    }
  }

  /**
   * Register a custom theme
   */
  registerTheme(config: ThemeConfig): void {
    this.themes.set(config.name, config);
  }

  /**
   * Get all registered theme names
   */
  getThemeNames(): string[] {
    return Array.from(this.themes.keys());
  }

  /**
   * Get a theme by name
   */
  getTheme(name: string): ThemeConfig | undefined {
    return this.themes.get(name);
  }

  /**
   * Get current theme name
   */
  getCurrentTheme(): string {
    return this.currentTheme;
  }

  /**
   * Get effective theme (resolves 'auto')
   */
  getEffectiveTheme(): ThemeConfig {
    if (this.currentTheme === 'auto') {
      return this.themes.get(this.systemPreference) || this.themes.get('light')!;
    }
    return this.themes.get(this.currentTheme) || this.themes.get('light')!;
  }

  /**
   * Set the current theme
   */
  setTheme(name: string | 'auto'): void {
    if (name !== 'auto' && !this.themes.has(name)) {
      throw new Error(`Theme not found: ${name}`);
    }
    this.currentTheme = name;
    this.applyTheme(name);
  }

  /**
   * Apply theme to document
   */
  private applyTheme(name: string | 'auto'): void {
    if (typeof document === 'undefined') return;

    const effectiveTheme = name === 'auto'
      ? this.systemPreference
      : name;

    // Set data attribute for CSS targeting
    document.documentElement.setAttribute('data-theme', effectiveTheme);

    // Emit custom event
    const event = new CustomEvent('themechange', {
      detail: { theme: effectiveTheme, isAuto: name === 'auto' },
    });
    document.dispatchEvent(event);
  }

  /**
   * Toggle between light and dark
   */
  toggle(): void {
    const effective = this.getEffectiveTheme();
    const newTheme = effective.mode === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  /**
   * Generate CSS variables for a theme
   */
  generateThemeCSS(themeName: string): string {
    const theme = this.themes.get(themeName);
    if (!theme) {
      throw new Error(`Theme not found: ${themeName}`);
    }

    const lines: string[] = [`[data-theme="${themeName}"] {`];

    // Color scales
    const scales = ['primary', 'secondary', 'accent', 'success', 'warning', 'error', 'info', 'neutral'] as const;
    for (const scale of scales) {
      const colorScale = theme.colors[scale];
      for (const [shade, value] of Object.entries(colorScale)) {
        lines.push(`  --color-${scale}-${shade}: ${value};`);
      }
    }

    // Background colors
    for (const [name, value] of Object.entries(theme.colors.background)) {
      lines.push(`  --bg-${name}: ${value};`);
    }

    // Surface colors
    for (const [name, value] of Object.entries(theme.colors.surface)) {
      lines.push(`  --surface-${name}: ${value};`);
    }

    // Text colors
    for (const [name, value] of Object.entries(theme.colors.text)) {
      lines.push(`  --text-${name}: ${value};`);
    }

    // Border colors
    for (const [name, value] of Object.entries(theme.colors.border)) {
      lines.push(`  --border-${name}: ${value};`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Create a custom theme from base
   */
  createTheme(name: string, baseName: string, overrides: Partial<SemanticColors>): ThemeConfig {
    const base = this.themes.get(baseName);
    if (!base) {
      throw new Error(`Base theme not found: ${baseName}`);
    }

    const newTheme: ThemeConfig = {
      name,
      mode: base.mode,
      colors: this.deepMerge(base.colors, overrides) as SemanticColors,
    };

    this.registerTheme(newTheme);
    return newTheme;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }
}

/**
 * Get singleton theme manager
 */
let themeManager: ThemeManager | null = null;

export function getThemeManager(): ThemeManager {
  if (!themeManager) {
    themeManager = new ThemeManager();
  }
  return themeManager;
}
```

---

## 5. Public Exports (`src/design/tokens/index.ts`)

```typescript
/**
 * Design Tokens Public Exports
 */

// Schema
export * from './schema';

// Defaults
export { DEFAULT_TOKENS, DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from './defaults';

// Generator
export { CSSGenerator, createGenerator, GeneratorOptions } from './generator';

// Theme
export { ThemeManager, ThemeConfig, getThemeManager } from './theme';
```

---

## Test Scenarios

### Test 1: Token Schema Validation

```typescript
// tests/design/tokens/schema.test.ts
import { describe, it, expect } from 'vitest';
import { DesignTokensSchema, ColorValueSchema, ColorScaleSchema } from '../../../src/design/tokens/schema';
import { DEFAULT_TOKENS } from '../../../src/design/tokens/defaults';

describe('Token Schema', () => {
  it('should validate hex color', () => {
    expect(ColorValueSchema.safeParse('#ff0000').success).toBe(true);
    expect(ColorValueSchema.safeParse('#f00').success).toBe(true);
    expect(ColorValueSchema.safeParse('#ff000080').success).toBe(true);
  });

  it('should validate rgb color', () => {
    expect(ColorValueSchema.safeParse('rgb(255, 0, 0)').success).toBe(true);
    expect(ColorValueSchema.safeParse('rgba(255, 0, 0, 0.5)').success).toBe(true);
  });

  it('should reject invalid color', () => {
    expect(ColorValueSchema.safeParse('red').success).toBe(false);
    expect(ColorValueSchema.safeParse('not-a-color').success).toBe(false);
  });

  it('should validate color scale', () => {
    const scale = {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      300: '#fca5a5',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
      800: '#991b1b',
      900: '#7f1d1d',
    };
    expect(ColorScaleSchema.safeParse(scale).success).toBe(true);
  });

  it('should validate complete default tokens', () => {
    const result = DesignTokensSchema.safeParse(DEFAULT_TOKENS);
    expect(result.success).toBe(true);
  });
});
```

### Test 2: CSS Generation

```typescript
// tests/design/tokens/generator.test.ts
import { describe, it, expect } from 'vitest';
import { CSSGenerator, createGenerator } from '../../../src/design/tokens/generator';
import { DEFAULT_TOKENS } from '../../../src/design/tokens/defaults';

describe('CSSGenerator', () => {
  it('should generate CSS with :root selector', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS);
    const css = generator.generateVariables();

    expect(css).toContain(':root {');
    expect(css).toContain('}');
  });

  it('should include color variables', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS);
    const css = generator.generateVariables();

    expect(css).toContain('--color-primary-500');
    expect(css).toContain('--color-secondary-500');
    expect(css).toContain('--bg-default');
    expect(css).toContain('--text-default');
  });

  it('should include typography variables', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS);
    const css = generator.generateVariables();

    expect(css).toContain('--font-sans');
    expect(css).toContain('--text-base');
    expect(css).toContain('--font-bold');
    expect(css).toContain('--leading-normal');
  });

  it('should include spacing variables', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS);
    const css = generator.generateVariables();

    expect(css).toContain('--space-0');
    expect(css).toContain('--space-4');
    expect(css).toContain('--space-8');
  });

  it('should apply prefix when specified', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS, { prefix: 'af' });
    const css = generator.generateVariables();

    expect(css).toContain('--af-color-primary-500');
    expect(css).toContain('--af-text-base');
  });

  it('should generate complete CSS with reset', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS, { includeReset: true });
    const css = generator.generate();

    expect(css).toContain('box-sizing: border-box');
    expect(css).toContain(':root {');
  });

  it('should minify CSS when option set', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS, { minify: true });
    const css = generator.generate();

    expect(css).not.toContain('  '); // No indentation
    expect(css).not.toContain('/* '); // No comments
  });

  it('should export JSON', () => {
    const generator = new CSSGenerator(DEFAULT_TOKENS);
    const json = generator.toJSON();
    const parsed = JSON.parse(json);

    expect(parsed.name).toBe('default');
    expect(parsed.colors).toBeDefined();
    expect(parsed.typography).toBeDefined();
  });
});
```

### Test 3: Theme Management

```typescript
// tests/design/tokens/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeManager, getThemeManager } from '../../../src/design/tokens/theme';

describe('ThemeManager', () => {
  let manager: ThemeManager;

  beforeEach(() => {
    manager = new ThemeManager();
  });

  it('should have default light and dark themes', () => {
    const themes = manager.getThemeNames();
    expect(themes).toContain('light');
    expect(themes).toContain('dark');
  });

  it('should default to light theme', () => {
    expect(manager.getCurrentTheme()).toBe('light');
  });

  it('should get theme by name', () => {
    const light = manager.getTheme('light');
    expect(light).toBeDefined();
    expect(light?.mode).toBe('light');
  });

  it('should set current theme', () => {
    manager.setTheme('dark');
    expect(manager.getCurrentTheme()).toBe('dark');
  });

  it('should throw for unknown theme', () => {
    expect(() => manager.setTheme('unknown')).toThrow('Theme not found');
  });

  it('should toggle between light and dark', () => {
    expect(manager.getEffectiveTheme().mode).toBe('light');
    manager.toggle();
    expect(manager.getEffectiveTheme().mode).toBe('dark');
    manager.toggle();
    expect(manager.getEffectiveTheme().mode).toBe('light');
  });

  it('should register custom theme', () => {
    manager.registerTheme({
      name: 'custom',
      mode: 'light',
      colors: manager.getTheme('light')!.colors,
    });

    expect(manager.getThemeNames()).toContain('custom');
  });

  it('should create theme from base', () => {
    const custom = manager.createTheme('brand', 'light', {
      primary: manager.getTheme('dark')!.colors.primary,
    });

    expect(custom.name).toBe('brand');
    expect(manager.getTheme('brand')).toBeDefined();
  });

  it('should generate theme CSS', () => {
    const css = manager.generateThemeCSS('dark');

    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('--color-primary');
    expect(css).toContain('--bg-default');
  });
});
```

### Test 4: Default Tokens

```typescript
// tests/design/tokens/defaults.test.ts
import { describe, it, expect } from 'vitest';
import { DEFAULT_TOKENS, DEFAULT_LIGHT_COLORS, DEFAULT_DARK_COLORS } from '../../../src/design/tokens/defaults';

describe('Default Tokens', () => {
  it('should have valid structure', () => {
    expect(DEFAULT_TOKENS.name).toBe('default');
    expect(DEFAULT_TOKENS.version).toBe('1.0.0');
    expect(DEFAULT_TOKENS.colors).toBeDefined();
    expect(DEFAULT_TOKENS.typography).toBeDefined();
    expect(DEFAULT_TOKENS.spacing).toBeDefined();
  });

  it('should have complete color scales', () => {
    const shades = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];

    for (const shade of shades) {
      expect(DEFAULT_LIGHT_COLORS.primary[shade as keyof typeof DEFAULT_LIGHT_COLORS.primary]).toBeDefined();
      expect(DEFAULT_DARK_COLORS.primary[shade as keyof typeof DEFAULT_DARK_COLORS.primary]).toBeDefined();
    }
  });

  it('should have semantic color groups', () => {
    expect(DEFAULT_LIGHT_COLORS.background).toBeDefined();
    expect(DEFAULT_LIGHT_COLORS.surface).toBeDefined();
    expect(DEFAULT_LIGHT_COLORS.text).toBeDefined();
    expect(DEFAULT_LIGHT_COLORS.border).toBeDefined();
  });

  it('should have typography scales', () => {
    expect(DEFAULT_TOKENS.typography.fontSize.base).toBe('1rem');
    expect(DEFAULT_TOKENS.typography.fontWeight.bold).toBe(700);
    expect(DEFAULT_TOKENS.typography.lineHeight.normal).toBe(1.5);
  });

  it('should have spacing scale', () => {
    expect(DEFAULT_TOKENS.spacing[0]).toBe('0');
    expect(DEFAULT_TOKENS.spacing[4]).toBe('1rem');
    expect(DEFAULT_TOKENS.spacing[8]).toBe('2rem');
  });

  it('should have breakpoints', () => {
    expect(DEFAULT_TOKENS.breakpoints.sm).toBe('640px');
    expect(DEFAULT_TOKENS.breakpoints.md).toBe('768px');
    expect(DEFAULT_TOKENS.breakpoints.lg).toBe('1024px');
  });
});
```

---

## Validation Checklist

```
□ Token Schema
  □ Color tokens with scales
  □ Typography tokens
  □ Spacing scale
  □ Border tokens
  □ Shadow tokens
  □ Animation tokens
  □ Breakpoint tokens
  □ Z-index tokens

□ Default Tokens
  □ Light theme colors
  □ Dark theme colors
  □ Typography defaults
  □ Spacing scale (4px base)
  □ Complete token set

□ CSS Generator
  □ Generates valid CSS
  □ All token types included
  □ Prefix support
  □ Minification option
  □ Reset styles option
  □ Utility classes option

□ Theme Manager
  □ Light/dark themes built-in
  □ Custom theme registration
  □ Theme switching
  □ Auto theme support
  □ CSS generation per theme

□ All tests pass
  □ npm run test -- tests/design/tokens/
```

---

## Next Step

Proceed to **08-USER-FLOWS.md** to implement user flow generation and approval gates.
