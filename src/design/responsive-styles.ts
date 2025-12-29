/**
 * Responsive Styles
 *
 * Generates responsive CSS, media queries, and layout utilities.
 */

import { logger } from '../utils/logger.js';
import type {
  Breakpoint,
  ComponentStyles,
  ResponsiveStyles,
  DesignTokens,
  SpacingScale,
} from './types.js';
import { BREAKPOINTS, DEFAULT_TOKENS } from './types.js';

const log = logger.child({ component: 'responsive-styles' });

/**
 * Media query type
 */
export type MediaQueryType = 'min' | 'max' | 'only' | 'between';

/**
 * Layout type
 */
export type LayoutType = 'flex' | 'grid' | 'container';

/**
 * Grid configuration
 */
export interface GridConfig {
  columns: number | Record<Breakpoint, number>;
  gap?: SpacingScale | Record<Breakpoint, SpacingScale>;
  autoFlow?: 'row' | 'column' | 'dense' | 'row dense' | 'column dense';
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  justifyItems?: 'start' | 'center' | 'end' | 'stretch';
}

/**
 * Flex configuration
 */
export interface FlexConfig {
  direction?: 'row' | 'row-reverse' | 'column' | 'column-reverse' | Record<Breakpoint, 'row' | 'row-reverse' | 'column' | 'column-reverse'>;
  wrap?: 'nowrap' | 'wrap' | 'wrap-reverse';
  gap?: SpacingScale | Record<Breakpoint, SpacingScale>;
  alignItems?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  justifyContent?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
}

/**
 * Container configuration
 */
export interface ContainerConfig {
  maxWidth?: Record<Breakpoint, string>;
  padding?: SpacingScale | Record<Breakpoint, SpacingScale>;
  centered?: boolean;
}

/**
 * Responsive Styles Generator
 */
export class ResponsiveStylesGenerator {
  private tokens: DesignTokens;

  constructor(tokens: DesignTokens = DEFAULT_TOKENS) {
    this.tokens = tokens;
  }

  /**
   * Generate media query
   */
  generateMediaQuery(breakpoint: Breakpoint, type: MediaQueryType = 'min'): string {
    const bp = BREAKPOINTS[breakpoint];

    switch (type) {
      case 'min':
        return `@media (min-width: ${bp.min}px)`;
      case 'max':
        return `@media (max-width: ${bp.max === Infinity ? '9999px' : `${bp.max}px`})`;
      case 'only':
        if (bp.max === Infinity) {
          return `@media (min-width: ${bp.min}px)`;
        }
        return `@media (min-width: ${bp.min}px) and (max-width: ${bp.max}px)`;
      case 'between':
        return `@media (min-width: ${bp.min}px) and (max-width: ${bp.max === Infinity ? '9999px' : `${bp.max}px`})`;
      default:
        return `@media (min-width: ${bp.min}px)`;
    }
  }

  /**
   * Generate all media query breakpoints
   */
  generateAllMediaQueries(): string {
    const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];

    return breakpoints.map((bp) => {
      const query = this.generateMediaQuery(bp, 'min');
      return `/* ${bp.charAt(0).toUpperCase() + bp.slice(1)} and up */
${query} {
  /* ${bp} styles */
}`;
    }).join('\n\n');
  }

  /**
   * Generate component styles with responsive variants
   */
  generateComponentStyles(className: string, styles: ComponentStyles): string {
    log.info('Generating component styles', { className });

    let css = '';

    // Base styles
    css += `.${className} {\n`;
    css += this.objectToCSS(styles.base);
    css += '}\n';

    // State styles
    if (styles.states) {
      if (styles.states.hover) {
        css += `.${className}:hover {\n`;
        css += this.objectToCSS(styles.states.hover);
        css += '}\n';
      }
      if (styles.states.active) {
        css += `.${className}:active {\n`;
        css += this.objectToCSS(styles.states.active);
        css += '}\n';
      }
      if (styles.states.focus) {
        css += `.${className}:focus {\n`;
        css += this.objectToCSS(styles.states.focus);
        css += '}\n';
      }
      if (styles.states.disabled) {
        css += `.${className}:disabled,\n.${className}.disabled {\n`;
        css += this.objectToCSS(styles.states.disabled);
        css += '}\n';
      }
    }

    // Responsive styles
    if (styles.responsive) {
      css += this.generateResponsiveCSS(className, styles.responsive);
    }

    // Variant styles
    if (styles.variants) {
      for (const [variantName, variantStyles] of Object.entries(styles.variants)) {
        css += `.${className}--${variantName} {\n`;
        css += this.objectToCSS(variantStyles);
        css += '}\n';
      }
    }

    return css;
  }

  /**
   * Generate responsive CSS from responsive styles
   */
  generateResponsiveCSS(className: string, responsive: ResponsiveStyles): string {
    const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];
    let css = '';

    for (const bp of breakpoints) {
      const bpStyles = responsive[bp];
      if (bpStyles) {
        const query = this.generateMediaQuery(bp, 'min');
        css += `${query} {\n`;
        css += `  .${className} {\n`;
        css += this.objectToCSS(bpStyles, '    ');
        css += '  }\n';
        css += '}\n';
      }
    }

    return css;
  }

  /**
   * Generate grid layout CSS
   */
  generateGridLayout(className: string, config: GridConfig): string {
    log.info('Generating grid layout', { className });

    let css = `.${className} {\n`;
    css += '  display: grid;\n';

    // Columns
    if (typeof config.columns === 'number') {
      css += `  grid-template-columns: repeat(${config.columns}, 1fr);\n`;
    }

    // Gap
    if (typeof config.gap === 'number') {
      const gapValue = this.getSpacingValue(config.gap);
      css += `  gap: ${gapValue};\n`;
    }

    // Auto flow
    if (config.autoFlow) {
      css += `  grid-auto-flow: ${config.autoFlow};\n`;
    }

    // Align items
    if (config.alignItems) {
      css += `  align-items: ${config.alignItems};\n`;
    }

    // Justify items
    if (config.justifyItems) {
      css += `  justify-items: ${config.justifyItems};\n`;
    }

    css += '}\n';

    // Responsive columns
    if (typeof config.columns === 'object') {
      const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];
      for (const bp of breakpoints) {
        const cols = config.columns[bp];
        if (cols !== undefined) {
          const query = this.generateMediaQuery(bp, 'min');
          css += `${query} {\n`;
          css += `  .${className} {\n`;
          css += `    grid-template-columns: repeat(${cols}, 1fr);\n`;
          css += '  }\n';
          css += '}\n';
        }
      }
    }

    // Responsive gap
    if (typeof config.gap === 'object') {
      const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];
      for (const bp of breakpoints) {
        const gap = config.gap[bp];
        if (gap !== undefined) {
          const gapValue = this.getSpacingValue(gap);
          const query = this.generateMediaQuery(bp, 'min');
          css += `${query} {\n`;
          css += `  .${className} {\n`;
          css += `    gap: ${gapValue};\n`;
          css += '  }\n';
          css += '}\n';
        }
      }
    }

    return css;
  }

  /**
   * Generate flex layout CSS
   */
  generateFlexLayout(className: string, config: FlexConfig): string {
    log.info('Generating flex layout', { className });

    let css = `.${className} {\n`;
    css += '  display: flex;\n';

    // Direction
    if (typeof config.direction === 'string') {
      css += `  flex-direction: ${config.direction};\n`;
    }

    // Wrap
    if (config.wrap) {
      css += `  flex-wrap: ${config.wrap};\n`;
    }

    // Gap
    if (typeof config.gap === 'number') {
      const gapValue = this.getSpacingValue(config.gap);
      css += `  gap: ${gapValue};\n`;
    }

    // Align items
    if (config.alignItems) {
      const alignValue = config.alignItems === 'start' ? 'flex-start'
        : config.alignItems === 'end' ? 'flex-end'
        : config.alignItems;
      css += `  align-items: ${alignValue};\n`;
    }

    // Justify content
    if (config.justifyContent) {
      const justifyValue = config.justifyContent === 'start' ? 'flex-start'
        : config.justifyContent === 'end' ? 'flex-end'
        : config.justifyContent === 'between' ? 'space-between'
        : config.justifyContent === 'around' ? 'space-around'
        : config.justifyContent === 'evenly' ? 'space-evenly'
        : config.justifyContent;
      css += `  justify-content: ${justifyValue};\n`;
    }

    css += '}\n';

    // Responsive direction
    if (typeof config.direction === 'object') {
      const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];
      for (const bp of breakpoints) {
        const dir = config.direction[bp];
        if (dir !== undefined) {
          const query = this.generateMediaQuery(bp, 'min');
          css += `${query} {\n`;
          css += `  .${className} {\n`;
          css += `    flex-direction: ${dir};\n`;
          css += '  }\n';
          css += '}\n';
        }
      }
    }

    // Responsive gap
    if (typeof config.gap === 'object') {
      const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];
      for (const bp of breakpoints) {
        const gap = config.gap[bp];
        if (gap !== undefined) {
          const gapValue = this.getSpacingValue(gap);
          const query = this.generateMediaQuery(bp, 'min');
          css += `${query} {\n`;
          css += `  .${className} {\n`;
          css += `    gap: ${gapValue};\n`;
          css += '  }\n';
          css += '}\n';
        }
      }
    }

    return css;
  }

  /**
   * Generate container CSS
   */
  generateContainer(className: string, config: ContainerConfig = {}): string {
    log.info('Generating container', { className });

    let css = `.${className} {\n`;
    css += '  width: 100%;\n';

    if (config.centered !== false) {
      css += '  margin-left: auto;\n';
      css += '  margin-right: auto;\n';
    }

    // Default padding
    if (typeof config.padding === 'number') {
      const padValue = this.getSpacingValue(config.padding);
      css += `  padding-left: ${padValue};\n`;
      css += `  padding-right: ${padValue};\n`;
    } else if (!config.padding) {
      css += '  padding-left: var(--spacing-md);\n';
      css += '  padding-right: var(--spacing-md);\n';
    }

    css += '}\n';

    // Responsive max-width and padding
    const defaultMaxWidths: Record<Breakpoint, string> = {
      mobile: '100%',
      tablet: '640px',
      desktop: '1024px',
      wide: '1280px',
    };

    const maxWidths = config.maxWidth || defaultMaxWidths;
    const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];

    for (const bp of breakpoints) {
      const maxWidth = maxWidths[bp];
      const query = this.generateMediaQuery(bp, 'min');

      css += `${query} {\n`;
      css += `  .${className} {\n`;

      if (maxWidth) {
        css += `    max-width: ${maxWidth};\n`;
      }

      // Responsive padding
      if (typeof config.padding === 'object') {
        const pad = config.padding[bp];
        if (pad !== undefined) {
          const padValue = this.getSpacingValue(pad);
          css += `    padding-left: ${padValue};\n`;
          css += `    padding-right: ${padValue};\n`;
        }
      }

      css += '  }\n';
      css += '}\n';
    }

    return css;
  }

  /**
   * Generate utility classes
   */
  generateUtilities(): string {
    log.info('Generating utility classes');

    let css = '/* Utility Classes */\n\n';

    // Display utilities
    css += '/* Display */\n';
    css += '.hidden { display: none !important; }\n';
    css += '.block { display: block; }\n';
    css += '.inline { display: inline; }\n';
    css += '.inline-block { display: inline-block; }\n';
    css += '.flex { display: flex; }\n';
    css += '.inline-flex { display: inline-flex; }\n';
    css += '.grid { display: grid; }\n\n';

    // Flex utilities
    css += '/* Flex */\n';
    css += '.flex-row { flex-direction: row; }\n';
    css += '.flex-col { flex-direction: column; }\n';
    css += '.flex-wrap { flex-wrap: wrap; }\n';
    css += '.flex-1 { flex: 1 1 0%; }\n';
    css += '.flex-auto { flex: 1 1 auto; }\n';
    css += '.flex-none { flex: none; }\n\n';

    // Alignment utilities
    css += '/* Alignment */\n';
    css += '.items-start { align-items: flex-start; }\n';
    css += '.items-center { align-items: center; }\n';
    css += '.items-end { align-items: flex-end; }\n';
    css += '.items-stretch { align-items: stretch; }\n';
    css += '.justify-start { justify-content: flex-start; }\n';
    css += '.justify-center { justify-content: center; }\n';
    css += '.justify-end { justify-content: flex-end; }\n';
    css += '.justify-between { justify-content: space-between; }\n';
    css += '.justify-around { justify-content: space-around; }\n\n';

    // Text utilities
    css += '/* Text */\n';
    css += '.text-left { text-align: left; }\n';
    css += '.text-center { text-align: center; }\n';
    css += '.text-right { text-align: right; }\n';
    css += '.text-sm { font-size: var(--font-size-small); }\n';
    css += '.text-base { font-size: var(--font-size-base); }\n';
    css += '.text-lg { font-size: var(--font-size-large); }\n';
    css += '.font-normal { font-weight: var(--font-weight-normal); }\n';
    css += '.font-medium { font-weight: var(--font-weight-medium); }\n';
    css += '.font-bold { font-weight: var(--font-weight-bold); }\n\n';

    // Spacing utilities
    css += '/* Spacing */\n';
    const spacingSizes: SpacingScale[] = [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
    for (const size of spacingSizes) {
      const value = this.getSpacingValue(size);
      css += `.m-${size} { margin: ${value}; }\n`;
      css += `.mt-${size} { margin-top: ${value}; }\n`;
      css += `.mr-${size} { margin-right: ${value}; }\n`;
      css += `.mb-${size} { margin-bottom: ${value}; }\n`;
      css += `.ml-${size} { margin-left: ${value}; }\n`;
      css += `.mx-${size} { margin-left: ${value}; margin-right: ${value}; }\n`;
      css += `.my-${size} { margin-top: ${value}; margin-bottom: ${value}; }\n`;
      css += `.p-${size} { padding: ${value}; }\n`;
      css += `.pt-${size} { padding-top: ${value}; }\n`;
      css += `.pr-${size} { padding-right: ${value}; }\n`;
      css += `.pb-${size} { padding-bottom: ${value}; }\n`;
      css += `.pl-${size} { padding-left: ${value}; }\n`;
      css += `.px-${size} { padding-left: ${value}; padding-right: ${value}; }\n`;
      css += `.py-${size} { padding-top: ${value}; padding-bottom: ${value}; }\n`;
    }
    css += '\n';

    // Gap utilities
    css += '/* Gap */\n';
    for (const size of spacingSizes) {
      const value = this.getSpacingValue(size);
      css += `.gap-${size} { gap: ${value}; }\n`;
    }
    css += '\n';

    // Width utilities
    css += '/* Width */\n';
    css += '.w-full { width: 100%; }\n';
    css += '.w-auto { width: auto; }\n';
    css += '.w-screen { width: 100vw; }\n';
    css += '.max-w-full { max-width: 100%; }\n';
    css += '.min-w-0 { min-width: 0; }\n\n';

    // Height utilities
    css += '/* Height */\n';
    css += '.h-full { height: 100%; }\n';
    css += '.h-auto { height: auto; }\n';
    css += '.h-screen { height: 100vh; }\n';
    css += '.min-h-0 { min-height: 0; }\n';
    css += '.min-h-screen { min-height: 100vh; }\n\n';

    // Border radius utilities
    css += '/* Border Radius */\n';
    css += '.rounded-none { border-radius: var(--radius-none); }\n';
    css += '.rounded-sm { border-radius: var(--radius-sm); }\n';
    css += '.rounded { border-radius: var(--radius-md); }\n';
    css += '.rounded-lg { border-radius: var(--radius-lg); }\n';
    css += '.rounded-full { border-radius: var(--radius-full); }\n\n';

    // Shadow utilities
    css += '/* Shadows */\n';
    css += '.shadow-none { box-shadow: var(--shadow-none); }\n';
    css += '.shadow-sm { box-shadow: var(--shadow-sm); }\n';
    css += '.shadow { box-shadow: var(--shadow-md); }\n';
    css += '.shadow-lg { box-shadow: var(--shadow-lg); }\n';
    css += '.shadow-xl { box-shadow: var(--shadow-xl); }\n\n';

    // Color utilities
    css += '/* Colors */\n';
    css += '.text-primary { color: var(--color-primary); }\n';
    css += '.text-secondary { color: var(--color-secondary); }\n';
    css += '.text-muted { color: var(--color-text-muted); }\n';
    css += '.text-error { color: var(--color-error); }\n';
    css += '.text-success { color: var(--color-success); }\n';
    css += '.text-warning { color: var(--color-warning); }\n';
    css += '.bg-primary { background-color: var(--color-primary); }\n';
    css += '.bg-secondary { background-color: var(--color-secondary); }\n';
    css += '.bg-surface { background-color: var(--color-surface); }\n';
    css += '.bg-error { background-color: var(--color-error); }\n';
    css += '.bg-success { background-color: var(--color-success); }\n';
    css += '.bg-warning { background-color: var(--color-warning); }\n\n';

    // Visibility utilities
    css += '/* Visibility */\n';
    css += '.visible { visibility: visible; }\n';
    css += '.invisible { visibility: hidden; }\n\n';

    // Position utilities
    css += '/* Position */\n';
    css += '.relative { position: relative; }\n';
    css += '.absolute { position: absolute; }\n';
    css += '.fixed { position: fixed; }\n';
    css += '.sticky { position: sticky; }\n\n';

    // Overflow utilities
    css += '/* Overflow */\n';
    css += '.overflow-auto { overflow: auto; }\n';
    css += '.overflow-hidden { overflow: hidden; }\n';
    css += '.overflow-scroll { overflow: scroll; }\n';
    css += '.overflow-x-auto { overflow-x: auto; }\n';
    css += '.overflow-y-auto { overflow-y: auto; }\n\n';

    // Responsive utilities
    css += this.generateResponsiveUtilities();

    return css;
  }

  /**
   * Generate responsive visibility utilities
   */
  generateResponsiveUtilities(): string {
    let css = '/* Responsive Utilities */\n\n';
    const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];

    for (const bp of breakpoints) {
      const query = this.generateMediaQuery(bp, 'min');

      css += `${query} {\n`;

      // Hidden/visible at breakpoint
      css += `  .${bp}\\:hidden { display: none !important; }\n`;
      css += `  .${bp}\\:block { display: block; }\n`;
      css += `  .${bp}\\:flex { display: flex; }\n`;
      css += `  .${bp}\\:grid { display: grid; }\n`;

      // Flex direction
      css += `  .${bp}\\:flex-row { flex-direction: row; }\n`;
      css += `  .${bp}\\:flex-col { flex-direction: column; }\n`;

      // Text alignment
      css += `  .${bp}\\:text-left { text-align: left; }\n`;
      css += `  .${bp}\\:text-center { text-align: center; }\n`;
      css += `  .${bp}\\:text-right { text-align: right; }\n`;

      css += '}\n\n';
    }

    return css;
  }

  /**
   * Generate grid column utilities
   */
  generateGridUtilities(maxColumns: number = 12): string {
    log.info('Generating grid utilities', { maxColumns });

    let css = '/* Grid Utilities */\n\n';

    // Grid columns
    for (let i = 1; i <= maxColumns; i++) {
      css += `.grid-cols-${i} { grid-template-columns: repeat(${i}, 1fr); }\n`;
    }
    css += '\n';

    // Column span
    for (let i = 1; i <= maxColumns; i++) {
      css += `.col-span-${i} { grid-column: span ${i} / span ${i}; }\n`;
    }
    css += '.col-span-full { grid-column: 1 / -1; }\n\n';

    // Row span
    for (let i = 1; i <= 6; i++) {
      css += `.row-span-${i} { grid-row: span ${i} / span ${i}; }\n`;
    }
    css += '.row-span-full { grid-row: 1 / -1; }\n\n';

    // Responsive grid
    const breakpoints: Breakpoint[] = ['mobile', 'tablet', 'desktop', 'wide'];

    for (const bp of breakpoints) {
      const query = this.generateMediaQuery(bp, 'min');
      css += `${query} {\n`;

      for (let i = 1; i <= maxColumns; i++) {
        css += `  .${bp}\\:grid-cols-${i} { grid-template-columns: repeat(${i}, 1fr); }\n`;
      }

      for (let i = 1; i <= maxColumns; i++) {
        css += `  .${bp}\\:col-span-${i} { grid-column: span ${i} / span ${i}; }\n`;
      }

      css += '}\n\n';
    }

    return css;
  }

  /**
   * Convert spacing scale to CSS value
   */
  private getSpacingValue(scale: SpacingScale): string {
    const unit = this.tokens.spacing.unit;
    return scale === 0 ? '0' : `${scale * unit}px`;
  }

  /**
   * Convert object to CSS properties
   */
  private objectToCSS(obj: Record<string, string>, indent: string = '  '): string {
    return Object.entries(obj)
      .map(([key, value]) => `${indent}${this.camelToKebab(key)}: ${value};`)
      .join('\n') + '\n';
  }

  /**
   * Convert camelCase to kebab-case
   */
  private camelToKebab(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }
}

/**
 * Factory function
 */
export function createResponsiveStylesGenerator(tokens?: DesignTokens): ResponsiveStylesGenerator {
  return new ResponsiveStylesGenerator(tokens);
}
