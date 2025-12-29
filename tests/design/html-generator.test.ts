/**
 * HTML Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HtmlGenerator, createHtmlGenerator } from '../../src/design/html-generator.js';
import type {
  ComponentDefinition,
  PageLayout,
  FormDefinition,
  NavigationDefinition,
  DesignTokens,
} from '../../src/design/types.js';
import { DEFAULT_TOKENS } from '../../src/design/types.js';

describe('HtmlGenerator', () => {
  let generator: HtmlGenerator;

  beforeEach(() => {
    generator = new HtmlGenerator();
  });

  describe('Factory Function', () => {
    it('should create generator instance', () => {
      const gen = createHtmlGenerator();
      expect(gen).toBeInstanceOf(HtmlGenerator);
    });

    it('should accept custom tokens', () => {
      const customTokens: DesignTokens = {
        ...DEFAULT_TOKENS,
        colors: {
          ...DEFAULT_TOKENS.colors,
          primary: '#ff0000',
        },
      };
      const gen = createHtmlGenerator(customTokens);
      expect(gen).toBeInstanceOf(HtmlGenerator);
    });
  });

  describe('generatePage', () => {
    it('should generate complete HTML page', () => {
      const layout: PageLayout = {
        id: 'test-layout',
        name: 'Test Page',
        components: [],
      };

      const html = generator.generatePage(layout);

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('<html lang="en">');
      expect(html).toContain('<head>');
      expect(html).toContain('<body>');
      expect(html).toContain('</html>');
    });

    it('should include meta tags', () => {
      const layout: PageLayout = {
        id: 'test-layout',
        name: 'Test Page',
        components: [],
        meta: {
          title: 'My Test Page',
          description: 'A test description',
          charset: 'UTF-8',
          viewport: 'width=device-width, initial-scale=1.0',
        },
      };

      const html = generator.generatePage(layout);

      expect(html).toContain('<title>My Test Page</title>');
      expect(html).toContain('charset="UTF-8"');
      expect(html).toContain('content="A test description"');
    });

    it('should include CSS variables from tokens', () => {
      const layout: PageLayout = {
        id: 'test-layout',
        name: 'Test Page',
        components: [],
      };

      const html = generator.generatePage(layout);

      expect(html).toContain('--color-primary');
      expect(html).toContain('--font-family');
      expect(html).toContain('--spacing-md');
    });

    it('should include custom styles', () => {
      const layout: PageLayout = {
        id: 'test-layout',
        name: 'Test Page',
        components: [],
        styles: '.custom { color: red; }',
      };

      const html = generator.generatePage(layout);

      expect(html).toContain('.custom { color: red; }');
    });

    it('should include scripts', () => {
      const layout: PageLayout = {
        id: 'test-layout',
        name: 'Test Page',
        components: [],
        scripts: 'console.log("hello");',
      };

      const html = generator.generatePage(layout);

      expect(html).toContain('<script>console.log("hello");</script>');
    });
  });

  describe('generateComponent', () => {
    it('should generate container div', () => {
      const component: ComponentDefinition = {
        id: 'test-container',
        type: 'container',
        className: 'my-container',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<div');
      expect(html).toContain('id="test-container"');
      expect(html).toContain('class="my-container"');
      expect(html).toContain('</div>');
    });

    it('should generate heading', () => {
      const component: ComponentDefinition = {
        id: 'test-heading',
        type: 'heading',
        content: 'Hello World',
        props: { level: 1 },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<h1');
      expect(html).toContain('Hello World');
      expect(html).toContain('</h1>');
    });

    it('should generate button', () => {
      const component: ComponentDefinition = {
        id: 'test-button',
        type: 'button',
        content: 'Click Me',
        props: { variant: 'primary' },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<button');
      expect(html).toContain('Click Me');
      expect(html).toContain('btn-primary');
      expect(html).toContain('</button>');
    });

    it('should generate link', () => {
      const component: ComponentDefinition = {
        id: 'test-link',
        type: 'link',
        content: 'Visit',
        props: { href: 'https://example.com', target: '_blank' },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<a');
      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('target="_blank"');
    });

    it('should generate image', () => {
      const component: ComponentDefinition = {
        id: 'test-image',
        type: 'image',
        props: { src: '/image.jpg', alt: 'Test image' },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<img');
      expect(html).toContain('src="/image.jpg"');
      expect(html).toContain('alt="Test image"');
    });

    it('should generate list', () => {
      const component: ComponentDefinition = {
        id: 'test-list',
        type: 'list',
        props: { items: ['Item 1', 'Item 2', 'Item 3'] },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<ul');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<li>Item 3</li>');
      expect(html).toContain('</ul>');
    });

    it('should generate ordered list', () => {
      const component: ComponentDefinition = {
        id: 'test-list',
        type: 'list',
        props: { ordered: true, items: ['First', 'Second'] },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<ol');
      expect(html).toContain('</ol>');
    });

    it('should generate text', () => {
      const component: ComponentDefinition = {
        id: 'test-text',
        type: 'text',
        content: 'Some paragraph text',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<p');
      expect(html).toContain('Some paragraph text');
      expect(html).toContain('</p>');
    });
  });

  describe('Semantic Elements', () => {
    it('should generate header', () => {
      const component: ComponentDefinition = {
        id: 'test-header',
        type: 'header',
        content: 'Header content',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<header');
      expect(html).toContain('</header>');
    });

    it('should generate footer', () => {
      const component: ComponentDefinition = {
        id: 'test-footer',
        type: 'footer',
        content: 'Footer content',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<footer');
      expect(html).toContain('</footer>');
    });

    it('should generate nav', () => {
      const component: ComponentDefinition = {
        id: 'test-nav',
        type: 'nav',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<nav');
      expect(html).toContain('</nav>');
    });

    it('should generate main', () => {
      const component: ComponentDefinition = {
        id: 'test-main',
        type: 'main',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<main');
      expect(html).toContain('</main>');
    });

    it('should generate article', () => {
      const component: ComponentDefinition = {
        id: 'test-article',
        type: 'article',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<article');
      expect(html).toContain('</article>');
    });

    it('should generate section', () => {
      const component: ComponentDefinition = {
        id: 'test-section',
        type: 'section',
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<section');
      expect(html).toContain('</section>');
    });
  });

  describe('Form Generation', () => {
    it('should generate form with fields', () => {
      const component: ComponentDefinition = {
        id: 'test-form',
        type: 'form',
        props: {
          fields: [
            { id: 'email', name: 'email', label: 'Email', type: 'email', required: true },
            { id: 'password', name: 'password', label: 'Password', type: 'password', required: true },
          ],
          submitLabel: 'Sign In',
        } as FormDefinition,
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<form');
      expect(html).toContain('<label');
      expect(html).toContain('type="email"');
      expect(html).toContain('type="password"');
      expect(html).toContain('Sign In');
    });

    it('should generate textarea', () => {
      const component: ComponentDefinition = {
        id: 'test-form',
        type: 'form',
        props: {
          fields: [
            { id: 'bio', name: 'bio', label: 'Bio', type: 'textarea' },
          ],
        } as FormDefinition,
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<textarea');
    });

    it('should generate select', () => {
      const component: ComponentDefinition = {
        id: 'test-form',
        type: 'form',
        props: {
          fields: [
            {
              id: 'country',
              name: 'country',
              label: 'Country',
              type: 'select',
              options: [
                { value: 'us', label: 'United States' },
                { value: 'uk', label: 'United Kingdom' },
              ],
            },
          ],
        } as FormDefinition,
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<select');
      expect(html).toContain('<option');
      expect(html).toContain('United States');
    });
  });

  describe('Card Generation', () => {
    it('should generate card with title', () => {
      const component: ComponentDefinition = {
        id: 'test-card',
        type: 'card',
        props: {
          title: 'Card Title',
          subtitle: 'Card Subtitle',
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('card-header');
      expect(html).toContain('Card Title');
      expect(html).toContain('Card Subtitle');
    });

    it('should generate card with actions', () => {
      const component: ComponentDefinition = {
        id: 'test-card',
        type: 'card',
        props: {
          title: 'Card',
          actions: [
            { label: 'Edit', variant: 'primary' },
            { label: 'Delete', variant: 'danger' },
          ],
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('card-actions');
      expect(html).toContain('Edit');
      expect(html).toContain('Delete');
    });
  });

  describe('Alert Generation', () => {
    it('should generate info alert', () => {
      const component: ComponentDefinition = {
        id: 'test-alert',
        type: 'alert',
        props: {
          type: 'info',
          message: 'This is information',
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('alert');
      expect(html).toContain('alert-info');
      expect(html).toContain('This is information');
    });

    it('should generate dismissible alert', () => {
      const component: ComponentDefinition = {
        id: 'test-alert',
        type: 'alert',
        props: {
          type: 'warning',
          message: 'Warning message',
          dismissible: true,
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('alert-close');
    });
  });

  describe('Table Generation', () => {
    it('should generate table with data', () => {
      const component: ComponentDefinition = {
        id: 'test-table',
        type: 'table',
        props: {
          columns: [
            { id: 'name', header: 'Name', accessor: 'name' },
            { id: 'email', header: 'Email', accessor: 'email' },
          ],
          data: [
            { name: 'John', email: 'john@example.com' },
            { name: 'Jane', email: 'jane@example.com' },
          ],
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<table');
      expect(html).toContain('<thead');
      expect(html).toContain('<tbody');
      expect(html).toContain('<th>Name</th>');
      expect(html).toContain('John');
      expect(html).toContain('jane@example.com');
    });
  });

  describe('Tabs Generation', () => {
    it('should generate tabs', () => {
      const component: ComponentDefinition = {
        id: 'test-tabs',
        type: 'tabs',
        props: {
          tabs: [
            { id: 'tab1', label: 'Tab 1', content: 'Content 1', active: true },
            { id: 'tab2', label: 'Tab 2', content: 'Content 2' },
          ],
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('tab-list');
      expect(html).toContain('tab-button');
      expect(html).toContain('tab-panel');
      expect(html).toContain('Tab 1');
      expect(html).toContain('Tab 2');
    });
  });

  describe('Accordion Generation', () => {
    it('should generate accordion', () => {
      const component: ComponentDefinition = {
        id: 'test-accordion',
        type: 'accordion',
        props: {
          items: [
            { id: 'item1', title: 'Section 1', content: 'Content 1', expanded: true },
            { id: 'item2', title: 'Section 2', content: 'Content 2' },
          ],
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('accordion');
      expect(html).toContain('accordion-item');
      expect(html).toContain('accordion-header');
      expect(html).toContain('Section 1');
      expect(html).toContain('Section 2');
    });
  });

  describe('Modal Generation', () => {
    it('should generate modal', () => {
      const component: ComponentDefinition = {
        id: 'test-modal',
        type: 'modal',
        props: {
          title: 'Modal Title',
          size: 'md',
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('modal');
      expect(html).toContain('modal-header');
      expect(html).toContain('modal-body');
      expect(html).toContain('Modal Title');
      expect(html).toContain('aria-modal="true"');
    });
  });

  describe('Layout Components', () => {
    it('should generate grid', () => {
      const component: ComponentDefinition = {
        id: 'test-grid',
        type: 'grid',
        props: { cols: 3, gap: 'md' },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('grid');
      expect(html).toContain('grid-cols-3');
    });

    it('should generate flex', () => {
      const component: ComponentDefinition = {
        id: 'test-flex',
        type: 'flex',
        props: { direction: 'row', gap: 'md' },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('flex');
      expect(html).toContain('flex-row');
    });
  });

  describe('Accessibility Attributes', () => {
    it('should generate ARIA attributes', () => {
      const component: ComponentDefinition = {
        id: 'test-button',
        type: 'button',
        content: 'Submit',
        accessibility: {
          role: 'button',
          ariaLabel: 'Submit form',
          ariaExpanded: false,
          ariaDisabled: false,
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('role="button"');
      expect(html).toContain('aria-label="Submit form"');
      expect(html).toContain('aria-expanded="false"');
    });

    it('should generate tabindex', () => {
      const component: ComponentDefinition = {
        id: 'test-div',
        type: 'container',
        accessibility: {
          tabIndex: 0,
        },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('tabindex="0"');
    });
  });

  describe('Navigation Generation', () => {
    it('should generate navigation from definition', () => {
      const nav: NavigationDefinition = {
        id: 'main-nav',
        type: 'header',
        brand: {
          name: 'My App',
          href: '/',
        },
        items: [
          { id: 'home', label: 'Home', href: '/', active: true },
          { id: 'about', label: 'About', href: '/about' },
        ],
      };

      const html = generator.generateNavigation(nav);

      expect(html).toContain('<nav');
      expect(html).toContain('nav-brand');
      expect(html).toContain('My App');
      expect(html).toContain('Home');
      expect(html).toContain('About');
      expect(html).toContain('aria-current="page"');
    });
  });

  describe('Nested Components', () => {
    it('should generate nested children', () => {
      const component: ComponentDefinition = {
        id: 'parent',
        type: 'container',
        children: [
          { id: 'child1', type: 'heading', content: 'Title', props: { level: 1 } },
          { id: 'child2', type: 'text', content: 'Paragraph text' },
        ],
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('<h1');
      expect(html).toContain('Title');
      expect(html).toContain('<p');
      expect(html).toContain('Paragraph text');
    });
  });

  describe('HTML Escaping', () => {
    it('should escape HTML entities', () => {
      const component: ComponentDefinition = {
        id: 'test-text',
        type: 'text',
        content: '<script>alert("xss")</script>',
      };

      const html = generator.generateComponent(component);

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape quotes in attributes', () => {
      const component: ComponentDefinition = {
        id: 'test-link',
        type: 'link',
        content: 'Link',
        props: { href: '/path?a="b"' },
      };

      const html = generator.generateComponent(component);

      expect(html).toContain('&quot;');
    });
  });
});
