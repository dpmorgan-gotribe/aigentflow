/**
 * HTML Generator
 *
 * Generates HTML mockups from component definitions.
 */

import { logger } from '../utils/logger.js';
import type {
  ComponentDefinition,
  ComponentType,
  PageLayout,
  DesignTokens,
  AccessibilityAttributes,
  FormField,
  FormDefinition,
  NavItem,
  NavigationDefinition,
  TableDefinition,
  CardDefinition,
  AlertDefinition,
  InputType,
  HeadingLevel,
  ButtonVariant,
} from './types.js';
import { DEFAULT_TOKENS } from './types.js';

const log = logger.child({ component: 'html-generator' });

/**
 * HTML Generator class
 */
export class HtmlGenerator {
  private tokens: DesignTokens;
  private indent = 0;

  constructor(tokens: DesignTokens = DEFAULT_TOKENS) {
    this.tokens = tokens;
  }

  /**
   * Generate complete HTML page
   */
  generatePage(layout: PageLayout): string {
    log.info('Generating HTML page', { layoutId: layout.id, name: layout.name });

    const tokens = { ...this.tokens, ...layout.tokens };
    const css = this.generateCssVariables(tokens);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="${layout.meta?.charset || 'UTF-8'}">
  <meta name="viewport" content="${layout.meta?.viewport || 'width=device-width, initial-scale=1.0'}">
  <title>${this.escapeHtml(layout.meta?.title || layout.name)}</title>
  ${layout.meta?.description ? `<meta name="description" content="${this.escapeHtml(layout.meta.description)}">` : ''}
  <style>
${css}
${layout.styles || ''}
  </style>
</head>
<body>
${this.generateComponents(layout.components)}
${layout.scripts ? `<script>${layout.scripts}</script>` : ''}
</body>
</html>`;

    log.info('HTML page generated', { size: html.length });
    return html;
  }

  /**
   * Generate CSS variables from tokens
   */
  generateCssVariables(tokens: DesignTokens): string {
    return `:root {
  /* Colors */
  --color-primary: ${tokens.colors.primary};
  --color-secondary: ${tokens.colors.secondary};
  --color-accent: ${tokens.colors.accent};
  --color-background: ${tokens.colors.background};
  --color-surface: ${tokens.colors.surface};
  --color-text: ${tokens.colors.text};
  --color-text-muted: ${tokens.colors.textMuted};
  --color-border: ${tokens.colors.border};
  --color-error: ${tokens.colors.error};
  --color-warning: ${tokens.colors.warning};
  --color-success: ${tokens.colors.success};
  --color-info: ${tokens.colors.info};

  /* Typography */
  --font-family: ${tokens.typography.fontFamily};
  --font-family-mono: ${tokens.typography.fontFamilyMono};
  --font-size-base: ${tokens.typography.fontSizeBase};
  --font-size-small: ${tokens.typography.fontSizeSmall};
  --font-size-large: ${tokens.typography.fontSizeLarge};
  --font-weight-normal: ${tokens.typography.fontWeightNormal};
  --font-weight-medium: ${tokens.typography.fontWeightMedium};
  --font-weight-bold: ${tokens.typography.fontWeightBold};
  --line-height: ${tokens.typography.lineHeight};

  /* Spacing */
  --spacing-unit: ${tokens.spacing.unit}px;
  --spacing-xs: ${tokens.spacing.xs};
  --spacing-sm: ${tokens.spacing.sm};
  --spacing-md: ${tokens.spacing.md};
  --spacing-lg: ${tokens.spacing.lg};
  --spacing-xl: ${tokens.spacing.xl};

  /* Border Radius */
  --radius-none: ${tokens.borderRadius.none};
  --radius-sm: ${tokens.borderRadius.sm};
  --radius-md: ${tokens.borderRadius.md};
  --radius-lg: ${tokens.borderRadius.lg};
  --radius-full: ${tokens.borderRadius.full};

  /* Shadows */
  --shadow-none: ${tokens.shadows.none};
  --shadow-sm: ${tokens.shadows.sm};
  --shadow-md: ${tokens.shadows.md};
  --shadow-lg: ${tokens.shadows.lg};
  --shadow-xl: ${tokens.shadows.xl};

  /* Transitions */
  --transition-fast: ${tokens.transitions.fast};
  --transition-normal: ${tokens.transitions.normal};
  --transition-slow: ${tokens.transitions.slow};

  /* Z-Index */
  --z-dropdown: ${tokens.zIndex.dropdown};
  --z-sticky: ${tokens.zIndex.sticky};
  --z-fixed: ${tokens.zIndex.fixed};
  --z-modal: ${tokens.zIndex.modal};
  --z-popover: ${tokens.zIndex.popover};
  --z-tooltip: ${tokens.zIndex.tooltip};
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-base);
  line-height: var(--line-height);
  color: var(--color-text);
  background-color: var(--color-background);
}`;
  }

  /**
   * Generate multiple components
   */
  generateComponents(components: ComponentDefinition[]): string {
    return components.map((c) => this.generateComponent(c)).join('\n');
  }

  /**
   * Generate single component
   */
  generateComponent(component: ComponentDefinition): string {
    const generator = this.getComponentGenerator(component.type);
    return generator(component);
  }

  /**
   * Get component generator function
   */
  private getComponentGenerator(type: ComponentType): (c: ComponentDefinition) => string {
    const generators: Record<ComponentType, (c: ComponentDefinition) => string> = {
      page: (c) => this.generateContainer(c, 'div'),
      section: (c) => this.generateSection(c),
      header: (c) => this.generateSemanticElement(c, 'header'),
      footer: (c) => this.generateSemanticElement(c, 'footer'),
      nav: (c) => this.generateSemanticElement(c, 'nav'),
      sidebar: (c) => this.generateSemanticElement(c, 'aside'),
      main: (c) => this.generateSemanticElement(c, 'main'),
      article: (c) => this.generateSemanticElement(c, 'article'),
      card: (c) => this.generateCard(c),
      form: (c) => this.generateForm(c),
      input: (c) => this.generateInput(c),
      button: (c) => this.generateButton(c),
      link: (c) => this.generateLink(c),
      image: (c) => this.generateImage(c),
      icon: (c) => this.generateIcon(c),
      text: (c) => this.generateText(c),
      heading: (c) => this.generateHeading(c),
      list: (c) => this.generateList(c),
      table: (c) => this.generateTable(c),
      modal: (c) => this.generateModal(c),
      dropdown: (c) => this.generateDropdown(c),
      tabs: (c) => this.generateTabs(c),
      accordion: (c) => this.generateAccordion(c),
      alert: (c) => this.generateAlert(c),
      badge: (c) => this.generateBadge(c),
      avatar: (c) => this.generateAvatar(c),
      divider: (c) => this.generateDivider(c),
      container: (c) => this.generateContainer(c, 'div'),
      grid: (c) => this.generateGrid(c),
      flex: (c) => this.generateFlex(c),
      custom: (c) => this.generateCustom(c),
    };

    return generators[type] || generators.custom;
  }

  /**
   * Generate attributes string
   */
  private generateAttributes(component: ComponentDefinition): string {
    const attrs: string[] = [];

    if (component.id) {
      attrs.push(`id="${this.escapeHtml(component.id)}"`);
    }

    if (component.className) {
      attrs.push(`class="${this.escapeHtml(component.className)}"`);
    }

    if (component.accessibility) {
      attrs.push(...this.generateAriaAttributes(component.accessibility));
    }

    // Add custom props
    if (component.props) {
      for (const [key, value] of Object.entries(component.props)) {
        if (value !== undefined && value !== null) {
          const attrName = key.startsWith('data-') ? key : `data-${key}`;
          attrs.push(`${attrName}="${this.escapeHtml(String(value))}"`);
        }
      }
    }

    return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
  }

  /**
   * Generate ARIA attributes
   */
  private generateAriaAttributes(accessibility: AccessibilityAttributes): string[] {
    const attrs: string[] = [];

    if (accessibility.role) {
      attrs.push(`role="${accessibility.role}"`);
    }
    if (accessibility.ariaLabel) {
      attrs.push(`aria-label="${this.escapeHtml(accessibility.ariaLabel)}"`);
    }
    if (accessibility.ariaLabelledBy) {
      attrs.push(`aria-labelledby="${this.escapeHtml(accessibility.ariaLabelledBy)}"`);
    }
    if (accessibility.ariaDescribedBy) {
      attrs.push(`aria-describedby="${this.escapeHtml(accessibility.ariaDescribedBy)}"`);
    }
    if (accessibility.ariaExpanded !== undefined) {
      attrs.push(`aria-expanded="${accessibility.ariaExpanded}"`);
    }
    if (accessibility.ariaHidden !== undefined) {
      attrs.push(`aria-hidden="${accessibility.ariaHidden}"`);
    }
    if (accessibility.ariaDisabled !== undefined) {
      attrs.push(`aria-disabled="${accessibility.ariaDisabled}"`);
    }
    if (accessibility.ariaRequired !== undefined) {
      attrs.push(`aria-required="${accessibility.ariaRequired}"`);
    }
    if (accessibility.ariaInvalid !== undefined) {
      attrs.push(`aria-invalid="${accessibility.ariaInvalid}"`);
    }
    if (accessibility.ariaLive) {
      attrs.push(`aria-live="${accessibility.ariaLive}"`);
    }
    if (accessibility.ariaCurrent) {
      attrs.push(`aria-current="${accessibility.ariaCurrent}"`);
    }
    if (accessibility.ariaHasPopup) {
      attrs.push(`aria-haspopup="${accessibility.ariaHasPopup}"`);
    }
    if (accessibility.ariaPressed !== undefined) {
      attrs.push(`aria-pressed="${accessibility.ariaPressed}"`);
    }
    if (accessibility.ariaSelected !== undefined) {
      attrs.push(`aria-selected="${accessibility.ariaSelected}"`);
    }
    if (accessibility.ariaChecked !== undefined) {
      attrs.push(`aria-checked="${accessibility.ariaChecked}"`);
    }
    if (accessibility.tabIndex !== undefined) {
      attrs.push(`tabindex="${accessibility.tabIndex}"`);
    }

    return attrs;
  }

  /**
   * Generate semantic element
   */
  private generateSemanticElement(component: ComponentDefinition, tag: string): string {
    const attrs = this.generateAttributes(component);
    const content = component.content || '';
    const children = component.children
      ? this.generateComponents(component.children)
      : '';

    return `<${tag}${attrs}>
${content}${children}
</${tag}>`;
  }

  /**
   * Generate section element
   */
  private generateSection(component: ComponentDefinition): string {
    return this.generateSemanticElement(component, 'section');
  }

  /**
   * Generate container div
   */
  private generateContainer(component: ComponentDefinition, tag: string): string {
    return this.generateSemanticElement(component, tag);
  }

  /**
   * Generate card component
   */
  private generateCard(component: ComponentDefinition): string {
    const attrs = this.generateAttributes(component);
    const cardProps = component.props as CardDefinition | undefined;

    let content = '';

    if (cardProps?.image && cardProps.image.position === 'top') {
      content += `<img src="${this.escapeHtml(cardProps.image.src)}" alt="${this.escapeHtml(cardProps.image.alt)}" class="card-image">\n`;
    }

    if (cardProps?.title || cardProps?.subtitle) {
      content += '<div class="card-header">\n';
      if (cardProps.title) {
        content += `  <h3 class="card-title">${this.escapeHtml(cardProps.title)}</h3>\n`;
      }
      if (cardProps.subtitle) {
        content += `  <p class="card-subtitle">${this.escapeHtml(cardProps.subtitle)}</p>\n`;
      }
      content += '</div>\n';
    }

    if (cardProps?.content || component.children) {
      content += '<div class="card-body">\n';
      if (cardProps?.content) {
        content += `  <p>${this.escapeHtml(cardProps.content)}</p>\n`;
      }
      if (component.children) {
        content += this.generateComponents(component.children);
      }
      content += '</div>\n';
    }

    if (cardProps?.actions && cardProps.actions.length > 0) {
      content += '<div class="card-actions">\n';
      for (const action of cardProps.actions) {
        const variant = action.variant || 'primary';
        content += `  <button class="btn btn-${variant}">${this.escapeHtml(action.label)}</button>\n`;
      }
      content += '</div>\n';
    }

    if (cardProps?.footer) {
      content += `<div class="card-footer">${this.escapeHtml(cardProps.footer)}</div>\n`;
    }

    return `<div${attrs} class="${component.className || ''} card">\n${content}</div>`;
  }

  /**
   * Generate form component
   */
  private generateForm(component: ComponentDefinition): string {
    const attrs = this.generateAttributes(component);
    const formProps = component.props as FormDefinition | undefined;

    let content = '';

    if (formProps?.fields) {
      for (const field of formProps.fields) {
        content += this.generateFormField(field);
      }
    }

    if (component.children) {
      content += this.generateComponents(component.children);
    }

    const submitLabel = formProps?.submitLabel || 'Submit';
    const cancelLabel = formProps?.cancelLabel;

    content += '<div class="form-actions">\n';
    content += `  <button type="submit" class="btn btn-primary">${this.escapeHtml(submitLabel)}</button>\n`;
    if (cancelLabel) {
      content += `  <button type="button" class="btn btn-secondary">${this.escapeHtml(cancelLabel)}</button>\n`;
    }
    content += '</div>\n';

    const action = formProps?.action ? ` action="${this.escapeHtml(formProps.action)}"` : '';
    const method = formProps?.method ? ` method="${formProps.method}"` : '';

    return `<form${attrs}${action}${method}>\n${content}</form>`;
  }

  /**
   * Generate form field
   */
  private generateFormField(field: FormField): string {
    const inputHtml = this.generateInputElement(field);
    const labelHtml = field.label
      ? `<label for="${this.escapeHtml(field.id)}" class="form-label">${this.escapeHtml(field.label)}${field.required ? ' <span class="required">*</span>' : ''}</label>\n`
      : '';

    return `<div class="form-field">
${labelHtml}${inputHtml}
</div>\n`;
  }

  /**
   * Generate input element for form field
   */
  private generateInputElement(field: FormField): string {
    const commonAttrs = [
      `id="${this.escapeHtml(field.id)}"`,
      `name="${this.escapeHtml(field.name)}"`,
      field.required ? 'required' : '',
      field.disabled ? 'disabled' : '',
      field.placeholder ? `placeholder="${this.escapeHtml(field.placeholder)}"` : '',
    ].filter(Boolean).join(' ');

    const ariaAttrs = field.accessibility
      ? this.generateAriaAttributes(field.accessibility).join(' ')
      : '';

    const attrs = [commonAttrs, ariaAttrs].filter(Boolean).join(' ');

    switch (field.type) {
      case 'textarea':
        return `<textarea ${attrs} class="form-input">${this.escapeHtml(field.defaultValue || '')}</textarea>`;

      case 'select':
        const options = (field.options || [])
          .map((o) => `<option value="${this.escapeHtml(o.value)}"${o.disabled ? ' disabled' : ''}>${this.escapeHtml(o.label)}</option>`)
          .join('\n    ');
        return `<select ${attrs} class="form-select">\n    ${options}\n  </select>`;

      case 'checkbox':
      case 'radio':
        return `<input type="${field.type}" ${attrs} class="form-${field.type}"${field.defaultValue === 'checked' ? ' checked' : ''}>`;

      default:
        const value = field.defaultValue ? ` value="${this.escapeHtml(field.defaultValue)}"` : '';
        return `<input type="${field.type}" ${attrs}${value} class="form-input">`;
    }
  }

  /**
   * Generate input component
   */
  private generateInput(component: ComponentDefinition): string {
    const props = component.props as { type?: InputType; name?: string; placeholder?: string } | undefined;
    const type = props?.type || 'text';
    const attrs = this.generateAttributes(component);

    return `<input type="${type}"${attrs} class="${component.className || ''} form-input">`;
  }

  /**
   * Generate button component
   */
  private generateButton(component: ComponentDefinition): string {
    const props = component.props as { variant?: ButtonVariant; type?: string; disabled?: boolean } | undefined;
    const variant = props?.variant || 'primary';
    const type = props?.type || 'button';
    const disabled = props?.disabled ? ' disabled' : '';
    const attrs = this.generateAttributes(component);
    const content = component.content || 'Button';

    return `<button type="${type}"${attrs}${disabled} class="${component.className || ''} btn btn-${variant}">${this.escapeHtml(content)}</button>`;
  }

  /**
   * Generate link component
   */
  private generateLink(component: ComponentDefinition): string {
    const props = component.props as { href?: string; target?: string } | undefined;
    const href = props?.href || '#';
    const target = props?.target ? ` target="${props.target}"` : '';
    const attrs = this.generateAttributes(component);
    const content = component.content || component.children
      ? this.generateComponents(component.children || [])
      : 'Link';

    return `<a href="${this.escapeHtml(href)}"${target}${attrs}>${content}</a>`;
  }

  /**
   * Generate image component
   */
  private generateImage(component: ComponentDefinition): string {
    const props = component.props as { src?: string; alt?: string; width?: string; height?: string } | undefined;
    const src = props?.src || '';
    const alt = props?.alt || '';
    const width = props?.width ? ` width="${props.width}"` : '';
    const height = props?.height ? ` height="${props.height}"` : '';
    const attrs = this.generateAttributes(component);

    return `<img src="${this.escapeHtml(src)}" alt="${this.escapeHtml(alt)}"${width}${height}${attrs}>`;
  }

  /**
   * Generate icon component
   */
  private generateIcon(component: ComponentDefinition): string {
    const props = component.props as { name?: string } | undefined;
    const name = props?.name || 'icon';
    const attrs = this.generateAttributes(component);

    return `<span${attrs} class="${component.className || ''} icon icon-${name}" aria-hidden="true"></span>`;
  }

  /**
   * Generate text component
   */
  private generateText(component: ComponentDefinition): string {
    const props = component.props as { tag?: string } | undefined;
    const tag = props?.tag || 'p';
    const attrs = this.generateAttributes(component);
    const content = component.content || '';

    return `<${tag}${attrs}>${this.escapeHtml(content)}</${tag}>`;
  }

  /**
   * Generate heading component
   */
  private generateHeading(component: ComponentDefinition): string {
    const props = component.props as { level?: HeadingLevel } | undefined;
    const level = props?.level || 2;
    const tag = `h${level}`;
    const attrs = this.generateAttributes(component);
    const content = component.content || '';

    return `<${tag}${attrs}>${this.escapeHtml(content)}</${tag}>`;
  }

  /**
   * Generate list component
   */
  private generateList(component: ComponentDefinition): string {
    const props = component.props as { ordered?: boolean; items?: string[] } | undefined;
    const tag = props?.ordered ? 'ol' : 'ul';
    const attrs = this.generateAttributes(component);

    let items = '';
    if (props?.items) {
      items = props.items.map((item) => `  <li>${this.escapeHtml(item)}</li>`).join('\n');
    } else if (component.children) {
      items = this.generateComponents(component.children);
    }

    return `<${tag}${attrs}>\n${items}\n</${tag}>`;
  }

  /**
   * Generate table component
   */
  private generateTable(component: ComponentDefinition): string {
    const props = component.props as TableDefinition | undefined;
    const attrs = this.generateAttributes(component);

    if (!props?.columns || !props?.data) {
      return `<table${attrs}></table>`;
    }

    let thead = '<thead>\n  <tr>\n';
    for (const col of props.columns) {
      thead += `    <th>${this.escapeHtml(col.header)}</th>\n`;
    }
    thead += '  </tr>\n</thead>';

    let tbody = '<tbody>\n';
    for (const row of props.data) {
      tbody += '  <tr>\n';
      for (const col of props.columns) {
        const value = row[col.accessor];
        tbody += `    <td>${this.escapeHtml(String(value ?? ''))}</td>\n`;
      }
      tbody += '  </tr>\n';
    }
    tbody += '</tbody>';

    return `<table${attrs}>\n${thead}\n${tbody}\n</table>`;
  }

  /**
   * Generate modal component
   */
  private generateModal(component: ComponentDefinition): string {
    const props = component.props as { title?: string; size?: string } | undefined;
    const attrs = this.generateAttributes(component);
    const size = props?.size || 'md';

    let content = `<div class="modal-header">
  <h2 class="modal-title">${this.escapeHtml(props?.title || 'Modal')}</h2>
  <button type="button" class="modal-close" aria-label="Close">&times;</button>
</div>
<div class="modal-body">
`;

    if (component.children) {
      content += this.generateComponents(component.children);
    }

    content += '\n</div>';

    return `<div${attrs} class="${component.className || ''} modal modal-${size}" role="dialog" aria-modal="true">
<div class="modal-backdrop"></div>
<div class="modal-content">
${content}
</div>
</div>`;
  }

  /**
   * Generate dropdown component
   */
  private generateDropdown(component: ComponentDefinition): string {
    const props = component.props as { label?: string; items?: Array<{ label: string; value: string }> } | undefined;
    const attrs = this.generateAttributes(component);

    let items = '';
    if (props?.items) {
      items = props.items
        .map((item) => `  <li><button type="button" class="dropdown-item" data-value="${this.escapeHtml(item.value)}">${this.escapeHtml(item.label)}</button></li>`)
        .join('\n');
    }

    return `<div${attrs} class="${component.className || ''} dropdown">
<button type="button" class="dropdown-toggle" aria-haspopup="true" aria-expanded="false">
  ${this.escapeHtml(props?.label || 'Dropdown')}
</button>
<ul class="dropdown-menu" role="menu">
${items}
</ul>
</div>`;
  }

  /**
   * Generate tabs component
   */
  private generateTabs(component: ComponentDefinition): string {
    const props = component.props as { tabs?: Array<{ id: string; label: string; content?: string; active?: boolean }> } | undefined;
    const attrs = this.generateAttributes(component);

    if (!props?.tabs) {
      return `<div${attrs} class="${component.className || ''} tabs"></div>`;
    }

    let tabList = '<div class="tab-list" role="tablist">\n';
    let tabPanels = '';

    for (const tab of props.tabs) {
      const active = tab.active ? ' active' : '';
      const selected = tab.active ? 'true' : 'false';

      tabList += `  <button type="button" class="tab-button${active}" role="tab" aria-selected="${selected}" aria-controls="panel-${tab.id}" id="tab-${tab.id}">${this.escapeHtml(tab.label)}</button>\n`;

      tabPanels += `<div class="tab-panel${active}" role="tabpanel" id="panel-${tab.id}" aria-labelledby="tab-${tab.id}"${tab.active ? '' : ' hidden'}>
  ${tab.content ? this.escapeHtml(tab.content) : ''}
</div>\n`;
    }

    tabList += '</div>';

    return `<div${attrs} class="${component.className || ''} tabs">
${tabList}
${tabPanels}</div>`;
  }

  /**
   * Generate accordion component
   */
  private generateAccordion(component: ComponentDefinition): string {
    const props = component.props as { items?: Array<{ id: string; title: string; content: string; expanded?: boolean }> } | undefined;
    const attrs = this.generateAttributes(component);

    if (!props?.items) {
      return `<div${attrs} class="${component.className || ''} accordion"></div>`;
    }

    let items = '';
    for (const item of props.items) {
      const expanded = item.expanded ? 'true' : 'false';
      const hidden = item.expanded ? '' : ' hidden';

      items += `<div class="accordion-item">
  <h3 class="accordion-header">
    <button type="button" class="accordion-button" aria-expanded="${expanded}" aria-controls="accordion-${item.id}">
      ${this.escapeHtml(item.title)}
    </button>
  </h3>
  <div class="accordion-panel" id="accordion-${item.id}"${hidden}>
    ${this.escapeHtml(item.content)}
  </div>
</div>\n`;
    }

    return `<div${attrs} class="${component.className || ''} accordion">\n${items}</div>`;
  }

  /**
   * Generate alert component
   */
  private generateAlert(component: ComponentDefinition): string {
    const props = component.props as AlertDefinition | undefined;
    const attrs = this.generateAttributes(component);
    const type = props?.type || 'info';

    let content = '';
    if (props?.title) {
      content += `<h4 class="alert-title">${this.escapeHtml(props.title)}</h4>\n`;
    }
    content += `<p class="alert-message">${this.escapeHtml(props?.message || component.content || '')}</p>`;

    if (props?.dismissible) {
      content += '\n<button type="button" class="alert-close" aria-label="Dismiss">&times;</button>';
    }

    return `<div${attrs} class="${component.className || ''} alert alert-${type}" role="alert">\n${content}\n</div>`;
  }

  /**
   * Generate badge component
   */
  private generateBadge(component: ComponentDefinition): string {
    const props = component.props as { variant?: string } | undefined;
    const variant = props?.variant || 'default';
    const attrs = this.generateAttributes(component);
    const content = component.content || '';

    return `<span${attrs} class="${component.className || ''} badge badge-${variant}">${this.escapeHtml(content)}</span>`;
  }

  /**
   * Generate avatar component
   */
  private generateAvatar(component: ComponentDefinition): string {
    const props = component.props as { src?: string; alt?: string; initials?: string; size?: string } | undefined;
    const attrs = this.generateAttributes(component);
    const size = props?.size || 'md';

    if (props?.src) {
      return `<img${attrs} src="${this.escapeHtml(props.src)}" alt="${this.escapeHtml(props.alt || '')}" class="${component.className || ''} avatar avatar-${size}">`;
    }

    const initials = props?.initials || '?';
    return `<span${attrs} class="${component.className || ''} avatar avatar-${size}">${this.escapeHtml(initials)}</span>`;
  }

  /**
   * Generate divider component
   */
  private generateDivider(component: ComponentDefinition): string {
    const props = component.props as { vertical?: boolean } | undefined;
    const orientation = props?.vertical ? 'vertical' : 'horizontal';
    const attrs = this.generateAttributes(component);

    return `<hr${attrs} class="${component.className || ''} divider divider-${orientation}">`;
  }

  /**
   * Generate grid component
   */
  private generateGrid(component: ComponentDefinition): string {
    const props = component.props as { cols?: number; gap?: string } | undefined;
    const cols = props?.cols || 12;
    const gap = props?.gap || 'md';
    const attrs = this.generateAttributes(component);
    const children = component.children
      ? this.generateComponents(component.children)
      : '';

    return `<div${attrs} class="${component.className || ''} grid grid-cols-${cols} gap-${gap}">\n${children}\n</div>`;
  }

  /**
   * Generate flex component
   */
  private generateFlex(component: ComponentDefinition): string {
    const props = component.props as { direction?: string; align?: string; justify?: string; gap?: string } | undefined;
    const direction = props?.direction || 'row';
    const align = props?.align || 'stretch';
    const justify = props?.justify || 'start';
    const gap = props?.gap || 'md';
    const attrs = this.generateAttributes(component);
    const children = component.children
      ? this.generateComponents(component.children)
      : '';

    return `<div${attrs} class="${component.className || ''} flex flex-${direction} items-${align} justify-${justify} gap-${gap}">\n${children}\n</div>`;
  }

  /**
   * Generate custom component
   */
  private generateCustom(component: ComponentDefinition): string {
    const props = component.props as { tag?: string } | undefined;
    const tag = props?.tag || 'div';
    return this.generateSemanticElement(component, tag);
  }

  /**
   * Generate navigation from definition
   */
  generateNavigation(nav: NavigationDefinition): string {
    log.info('Generating navigation', { id: nav.id, type: nav.type });

    const attrs = `id="${nav.id}" class="nav nav-${nav.type}"`;
    let content = '';

    if (nav.brand) {
      content += `<a href="${this.escapeHtml(nav.brand.href || '/')}" class="nav-brand">
  ${nav.brand.logo ? `<img src="${this.escapeHtml(nav.brand.logo)}" alt="" class="nav-logo">` : ''}
  <span>${this.escapeHtml(nav.brand.name)}</span>
</a>\n`;
    }

    content += this.generateNavItems(nav.items);

    return `<nav ${attrs} role="navigation">\n${content}</nav>`;
  }

  /**
   * Generate navigation items
   */
  private generateNavItems(items: NavItem[], depth = 0): string {
    const indent = '  '.repeat(depth);
    let html = `${indent}<ul class="nav-list">\n`;

    for (const item of items) {
      const activeClass = item.active ? ' active' : '';
      const disabledClass = item.disabled ? ' disabled' : '';
      const hasChildren = item.children && item.children.length > 0;

      html += `${indent}  <li class="nav-item${activeClass}${disabledClass}">\n`;

      if (item.href && !item.disabled) {
        html += `${indent}    <a href="${this.escapeHtml(item.href)}" class="nav-link"${item.active ? ' aria-current="page"' : ''}>${this.escapeHtml(item.label)}</a>\n`;
      } else {
        html += `${indent}    <span class="nav-text">${this.escapeHtml(item.label)}</span>\n`;
      }

      if (hasChildren) {
        html += this.generateNavItems(item.children!, depth + 2);
      }

      html += `${indent}  </li>\n`;
    }

    html += `${indent}</ul>\n`;
    return html;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(str: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return str.replace(/[&<>"']/g, (char) => htmlEscapes[char]);
  }
}

/**
 * Factory function
 */
export function createHtmlGenerator(tokens?: DesignTokens): HtmlGenerator {
  return new HtmlGenerator(tokens);
}
