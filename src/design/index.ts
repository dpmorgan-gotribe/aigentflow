/**
 * Design System
 *
 * UI component types, HTML generation, and responsive styling.
 */

// Types
export type {
  Breakpoint,
  ComponentType,
  InputType,
  ButtonVariant,
  SizeVariant,
  HeadingLevel,
  Direction,
  Alignment,
  SpacingScale,
  AriaRole,
  AccessibilityAttributes,
  DesignTokens,
  ResponsiveStyles,
  ComponentStyles,
  ComponentDefinition,
  PageLayout,
  UIDesignOutput,
  FormField,
  FormDefinition,
  NavItem,
  NavigationDefinition,
  TableColumn,
  TableDefinition,
  CardDefinition,
  ModalDefinition,
  AlertDefinition,
  DesignRequest,
  ComponentLibraryEntry,
} from './types.js';

export { BREAKPOINTS, DEFAULT_TOKENS, DARK_TOKENS } from './types.js';

// HTML Generator
export { HtmlGenerator, createHtmlGenerator } from './html-generator.js';

// Responsive Styles
export type {
  MediaQueryType,
  LayoutType,
  GridConfig,
  FlexConfig,
  ContainerConfig,
} from './responsive-styles.js';

export {
  ResponsiveStylesGenerator,
  createResponsiveStylesGenerator,
} from './responsive-styles.js';
