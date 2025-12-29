/**
 * Design System Types
 *
 * Type definitions for UI components, layouts, and design tokens.
 */

/**
 * Responsive breakpoints
 */
export type Breakpoint = 'mobile' | 'tablet' | 'desktop' | 'wide';

export const BREAKPOINTS: Record<Breakpoint, { min: number; max: number }> = {
  mobile: { min: 0, max: 639 },
  tablet: { min: 640, max: 1023 },
  desktop: { min: 1024, max: 1439 },
  wide: { min: 1440, max: Infinity },
};

/**
 * Component types in the hierarchy
 */
export type ComponentType =
  | 'page'
  | 'section'
  | 'header'
  | 'footer'
  | 'nav'
  | 'sidebar'
  | 'main'
  | 'article'
  | 'card'
  | 'form'
  | 'input'
  | 'button'
  | 'link'
  | 'image'
  | 'icon'
  | 'text'
  | 'heading'
  | 'list'
  | 'table'
  | 'modal'
  | 'dropdown'
  | 'tabs'
  | 'accordion'
  | 'alert'
  | 'badge'
  | 'avatar'
  | 'divider'
  | 'container'
  | 'grid'
  | 'flex'
  | 'custom';

/**
 * Input types for form components
 */
export type InputType =
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'tel'
  | 'url'
  | 'search'
  | 'date'
  | 'time'
  | 'datetime'
  | 'file'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'textarea'
  | 'hidden';

/**
 * Button variants
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'danger';

/**
 * Size variants
 */
export type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Heading levels
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Layout direction
 */
export type Direction = 'horizontal' | 'vertical';

/**
 * Alignment
 */
export type Alignment = 'start' | 'center' | 'end' | 'stretch' | 'between' | 'around' | 'evenly';

/**
 * Spacing scale
 */
export type SpacingScale = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64;

/**
 * ARIA roles for accessibility
 */
export type AriaRole =
  | 'alert'
  | 'alertdialog'
  | 'application'
  | 'article'
  | 'banner'
  | 'button'
  | 'cell'
  | 'checkbox'
  | 'columnheader'
  | 'combobox'
  | 'complementary'
  | 'contentinfo'
  | 'definition'
  | 'dialog'
  | 'directory'
  | 'document'
  | 'feed'
  | 'figure'
  | 'form'
  | 'grid'
  | 'gridcell'
  | 'group'
  | 'heading'
  | 'img'
  | 'link'
  | 'list'
  | 'listbox'
  | 'listitem'
  | 'log'
  | 'main'
  | 'marquee'
  | 'math'
  | 'menu'
  | 'menubar'
  | 'menuitem'
  | 'menuitemcheckbox'
  | 'menuitemradio'
  | 'navigation'
  | 'none'
  | 'note'
  | 'option'
  | 'presentation'
  | 'progressbar'
  | 'radio'
  | 'radiogroup'
  | 'region'
  | 'row'
  | 'rowgroup'
  | 'rowheader'
  | 'scrollbar'
  | 'search'
  | 'searchbox'
  | 'separator'
  | 'slider'
  | 'spinbutton'
  | 'status'
  | 'switch'
  | 'tab'
  | 'table'
  | 'tablist'
  | 'tabpanel'
  | 'term'
  | 'textbox'
  | 'timer'
  | 'toolbar'
  | 'tooltip'
  | 'tree'
  | 'treegrid'
  | 'treeitem';

/**
 * Accessibility attributes
 */
export interface AccessibilityAttributes {
  role?: AriaRole;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  ariaHidden?: boolean;
  ariaDisabled?: boolean;
  ariaRequired?: boolean;
  ariaInvalid?: boolean;
  ariaLive?: 'off' | 'polite' | 'assertive';
  ariaCurrent?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true' | 'false';
  ariaHasPopup?: 'menu' | 'listbox' | 'tree' | 'grid' | 'dialog' | 'true' | 'false';
  ariaPressed?: boolean;
  ariaSelected?: boolean;
  ariaChecked?: boolean | 'mixed';
  tabIndex?: number;
}

/**
 * Design tokens
 */
export interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    textMuted: string;
    border: string;
    error: string;
    warning: string;
    success: string;
    info: string;
  };
  typography: {
    fontFamily: string;
    fontFamilyMono: string;
    fontSizeBase: string;
    fontSizeSmall: string;
    fontSizeLarge: string;
    fontWeightNormal: number;
    fontWeightMedium: number;
    fontWeightBold: number;
    lineHeight: number;
  };
  spacing: {
    unit: number;
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  borderRadius: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    full: string;
  };
  shadows: {
    none: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  transitions: {
    fast: string;
    normal: string;
    slow: string;
  };
  zIndex: {
    dropdown: number;
    sticky: number;
    fixed: number;
    modal: number;
    popover: number;
    tooltip: number;
  };
}

/**
 * Default design tokens (light theme)
 */
export const DEFAULT_TOKENS: DesignTokens = {
  colors: {
    primary: '#3b82f6',
    secondary: '#6366f1',
    accent: '#8b5cf6',
    background: '#ffffff',
    surface: '#f8fafc',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    error: '#ef4444',
    warning: '#f59e0b',
    success: '#22c55e',
    info: '#0ea5e9',
  },
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontFamilyMono: 'ui-monospace, "SF Mono", Monaco, monospace',
    fontSizeBase: '16px',
    fontSizeSmall: '14px',
    fontSizeLarge: '18px',
    fontWeightNormal: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    lineHeight: 1.5,
  },
  spacing: {
    unit: 4,
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  borderRadius: {
    none: '0',
    sm: '4px',
    md: '8px',
    lg: '12px',
    full: '9999px',
  },
  shadows: {
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 25px 50px rgba(0, 0, 0, 0.25)',
  },
  transitions: {
    fast: '150ms ease-in-out',
    normal: '300ms ease-in-out',
    slow: '500ms ease-in-out',
  },
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modal: 1040,
    popover: 1050,
    tooltip: 1060,
  },
};

/**
 * Dark theme tokens
 */
export const DARK_TOKENS: DesignTokens = {
  ...DEFAULT_TOKENS,
  colors: {
    primary: '#60a5fa',
    secondary: '#818cf8',
    accent: '#a78bfa',
    background: '#0f172a',
    surface: '#1e293b',
    text: '#f8fafc',
    textMuted: '#94a3b8',
    border: '#334155',
    error: '#f87171',
    warning: '#fbbf24',
    success: '#4ade80',
    info: '#38bdf8',
  },
};

/**
 * Responsive styles
 */
export interface ResponsiveStyles {
  mobile?: Record<string, string>;
  tablet?: Record<string, string>;
  desktop?: Record<string, string>;
  wide?: Record<string, string>;
}

/**
 * Component style definition
 */
export interface ComponentStyles {
  base: Record<string, string>;
  responsive?: ResponsiveStyles;
  variants?: Record<string, Record<string, string>>;
  states?: {
    hover?: Record<string, string>;
    active?: Record<string, string>;
    focus?: Record<string, string>;
    disabled?: Record<string, string>;
  };
}

/**
 * Component definition
 */
export interface ComponentDefinition {
  id: string;
  type: ComponentType;
  name?: string;
  className?: string;
  styles?: ComponentStyles;
  props?: Record<string, unknown>;
  accessibility?: AccessibilityAttributes;
  children?: ComponentDefinition[];
  content?: string;
  responsive?: {
    hidden?: Breakpoint[];
    visible?: Breakpoint[];
  };
}

/**
 * Page layout definition
 */
export interface PageLayout {
  id: string;
  name: string;
  description?: string;
  tokens?: Partial<DesignTokens>;
  components: ComponentDefinition[];
  styles?: string;
  scripts?: string;
  meta?: {
    title?: string;
    description?: string;
    viewport?: string;
    charset?: string;
  };
}

/**
 * UI Design output from the agent
 */
export interface UIDesignOutput {
  layout: PageLayout;
  html: string;
  css: string;
  components: ComponentDefinition[];
  tokens: DesignTokens;
  accessibility: {
    score: number;
    issues: Array<{
      component: string;
      issue: string;
      severity: 'error' | 'warning' | 'info';
      suggestion: string;
    }>;
  };
  responsive: {
    breakpoints: Breakpoint[];
    mediaQueries: string;
  };
}

/**
 * Form field definition
 */
export interface FormField {
  id: string;
  name: string;
  label: string;
  type: InputType;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
  validation?: {
    pattern?: string;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    message?: string;
  };
  options?: Array<{
    value: string;
    label: string;
    disabled?: boolean;
  }>;
  accessibility?: AccessibilityAttributes;
}

/**
 * Form definition
 */
export interface FormDefinition {
  id: string;
  name: string;
  action?: string;
  method?: 'GET' | 'POST';
  fields: FormField[];
  submitLabel?: string;
  cancelLabel?: string;
  layout?: 'vertical' | 'horizontal' | 'inline';
}

/**
 * Navigation item
 */
export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: string;
  active?: boolean;
  disabled?: boolean;
  children?: NavItem[];
  accessibility?: AccessibilityAttributes;
}

/**
 * Navigation definition
 */
export interface NavigationDefinition {
  id: string;
  type: 'header' | 'sidebar' | 'footer' | 'breadcrumb' | 'tabs';
  items: NavItem[];
  brand?: {
    name: string;
    logo?: string;
    href?: string;
  };
  responsive?: {
    mobileMenu?: boolean;
    collapseAt?: Breakpoint;
  };
}

/**
 * Table column definition
 */
export interface TableColumn {
  id: string;
  header: string;
  accessor: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: 'text' | 'link' | 'badge' | 'image' | 'actions';
}

/**
 * Table definition
 */
export interface TableDefinition {
  id: string;
  columns: TableColumn[];
  data: Record<string, unknown>[];
  pagination?: {
    enabled: boolean;
    pageSize: number;
    currentPage?: number;
  };
  sorting?: {
    enabled: boolean;
    defaultSort?: string;
    defaultDirection?: 'asc' | 'desc';
  };
  selection?: {
    enabled: boolean;
    multiple: boolean;
  };
  responsive?: {
    stackAt?: Breakpoint;
    horizontalScroll?: boolean;
  };
}

/**
 * Card definition
 */
export interface CardDefinition {
  id: string;
  title?: string;
  subtitle?: string;
  content?: string;
  image?: {
    src: string;
    alt: string;
    position?: 'top' | 'left' | 'right' | 'background';
  };
  actions?: Array<{
    label: string;
    variant?: ButtonVariant;
    href?: string;
    onClick?: string;
  }>;
  footer?: string;
}

/**
 * Modal definition
 */
export interface ModalDefinition {
  id: string;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closable?: boolean;
  content: ComponentDefinition[];
  footer?: ComponentDefinition[];
  overlay?: boolean;
  centered?: boolean;
}

/**
 * Alert definition
 */
export interface AlertDefinition {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title?: string;
  message: string;
  dismissible?: boolean;
  icon?: boolean;
  actions?: Array<{
    label: string;
    variant?: ButtonVariant;
    onClick?: string;
  }>;
}

/**
 * Design request from PM/Architect
 */
export interface DesignRequest {
  type: 'page' | 'component' | 'form' | 'layout';
  name: string;
  description?: string;
  requirements?: string[];
  wireframe?: string;
  constraints?: {
    maxWidth?: string;
    colorScheme?: 'light' | 'dark' | 'system';
    accessibility?: 'AA' | 'AAA';
    responsive?: Breakpoint[];
  };
  components?: ComponentType[];
  forms?: FormDefinition[];
  navigation?: NavigationDefinition;
  tables?: TableDefinition[];
  existingTokens?: Partial<DesignTokens>;
}

/**
 * Component library entry
 */
export interface ComponentLibraryEntry {
  id: string;
  name: string;
  description: string;
  type: ComponentType;
  category: 'layout' | 'navigation' | 'form' | 'display' | 'feedback' | 'overlay';
  definition: ComponentDefinition;
  variations?: Array<{
    id: string;
    name: string;
    definition: ComponentDefinition;
  }>;
  usage?: string;
  accessibility?: string;
}
