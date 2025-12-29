/**
 * Responsive Styles Generator Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResponsiveStylesGenerator,
  createResponsiveStylesGenerator,
} from '../../src/design/responsive-styles.js';
import type { ComponentStyles } from '../../src/design/types.js';

describe('ResponsiveStylesGenerator', () => {
  let generator: ResponsiveStylesGenerator;

  beforeEach(() => {
    generator = new ResponsiveStylesGenerator();
  });

  describe('Factory Function', () => {
    it('should create generator instance', () => {
      const gen = createResponsiveStylesGenerator();
      expect(gen).toBeInstanceOf(ResponsiveStylesGenerator);
    });
  });

  describe('generateMediaQuery', () => {
    it('should generate min-width query', () => {
      const query = generator.generateMediaQuery('tablet', 'min');
      expect(query).toBe('@media (min-width: 640px)');
    });

    it('should generate max-width query', () => {
      const query = generator.generateMediaQuery('mobile', 'max');
      expect(query).toBe('@media (max-width: 639px)');
    });

    it('should generate only query', () => {
      const query = generator.generateMediaQuery('tablet', 'only');
      expect(query).toBe('@media (min-width: 640px) and (max-width: 1023px)');
    });

    it('should generate between query', () => {
      const query = generator.generateMediaQuery('desktop', 'between');
      expect(query).toBe('@media (min-width: 1024px) and (max-width: 1439px)');
    });

    it('should handle wide breakpoint', () => {
      const query = generator.generateMediaQuery('wide', 'min');
      expect(query).toBe('@media (min-width: 1440px)');
    });
  });

  describe('generateAllMediaQueries', () => {
    it('should generate queries for all breakpoints', () => {
      const css = generator.generateAllMediaQueries();

      expect(css).toContain('/* Mobile and up */');
      expect(css).toContain('/* Tablet and up */');
      expect(css).toContain('/* Desktop and up */');
      expect(css).toContain('/* Wide and up */');
    });
  });

  describe('generateComponentStyles', () => {
    it('should generate base styles', () => {
      const styles: ComponentStyles = {
        base: {
          display: 'flex',
          alignItems: 'center',
        },
      };

      const css = generator.generateComponentStyles('test-component', styles);

      expect(css).toContain('.test-component');
      expect(css).toContain('display: flex');
      expect(css).toContain('align-items: center');
    });

    it('should generate hover state', () => {
      const styles: ComponentStyles = {
        base: { color: 'black' },
        states: {
          hover: { color: 'blue' },
        },
      };

      const css = generator.generateComponentStyles('test-component', styles);

      expect(css).toContain('.test-component:hover');
      expect(css).toContain('color: blue');
    });

    it('should generate focus state', () => {
      const styles: ComponentStyles = {
        base: { outline: 'none' },
        states: {
          focus: { outline: '2px solid blue' },
        },
      };

      const css = generator.generateComponentStyles('test-component', styles);

      expect(css).toContain('.test-component:focus');
      expect(css).toContain('outline: 2px solid blue');
    });

    it('should generate disabled state', () => {
      const styles: ComponentStyles = {
        base: { opacity: '1' },
        states: {
          disabled: { opacity: '0.5' },
        },
      };

      const css = generator.generateComponentStyles('test-component', styles);

      expect(css).toContain('.test-component:disabled');
      expect(css).toContain('.test-component.disabled');
    });

    it('should generate responsive styles', () => {
      const styles: ComponentStyles = {
        base: { fontSize: '14px' },
        responsive: {
          tablet: { fontSize: '16px' },
          desktop: { fontSize: '18px' },
        },
      };

      const css = generator.generateComponentStyles('test-component', styles);

      expect(css).toContain('@media (min-width: 640px)');
      expect(css).toContain('@media (min-width: 1024px)');
    });

    it('should generate variant styles', () => {
      const styles: ComponentStyles = {
        base: { backgroundColor: 'gray' },
        variants: {
          primary: { backgroundColor: 'blue' },
          secondary: { backgroundColor: 'green' },
        },
      };

      const css = generator.generateComponentStyles('btn', styles);

      expect(css).toContain('.btn--primary');
      expect(css).toContain('.btn--secondary');
      expect(css).toContain('background-color: blue');
    });
  });

  describe('generateGridLayout', () => {
    it('should generate basic grid', () => {
      const css = generator.generateGridLayout('grid-container', {
        columns: 3,
        gap: 4,
      });

      expect(css).toContain('display: grid');
      expect(css).toContain('grid-template-columns: repeat(3, 1fr)');
      expect(css).toContain('gap: 16px');
    });

    it('should generate responsive columns', () => {
      const css = generator.generateGridLayout('grid-container', {
        columns: {
          mobile: 1,
          tablet: 2,
          desktop: 3,
          wide: 4,
        },
      });

      expect(css).toContain('@media (min-width: 0px)');
      expect(css).toContain('repeat(1, 1fr)');
      expect(css).toContain('repeat(2, 1fr)');
      expect(css).toContain('repeat(3, 1fr)');
      expect(css).toContain('repeat(4, 1fr)');
    });

    it('should include grid-auto-flow', () => {
      const css = generator.generateGridLayout('grid-container', {
        columns: 3,
        autoFlow: 'dense',
      });

      expect(css).toContain('grid-auto-flow: dense');
    });

    it('should include alignment', () => {
      const css = generator.generateGridLayout('grid-container', {
        columns: 3,
        alignItems: 'center',
        justifyItems: 'stretch',
      });

      expect(css).toContain('align-items: center');
      expect(css).toContain('justify-items: stretch');
    });
  });

  describe('generateFlexLayout', () => {
    it('should generate basic flex layout', () => {
      const css = generator.generateFlexLayout('flex-container', {
        direction: 'row',
        wrap: 'wrap',
        gap: 4,
      });

      expect(css).toContain('display: flex');
      expect(css).toContain('flex-direction: row');
      expect(css).toContain('flex-wrap: wrap');
      expect(css).toContain('gap: 16px');
    });

    it('should generate flex alignment', () => {
      const css = generator.generateFlexLayout('flex-container', {
        alignItems: 'center',
        justifyContent: 'between',
      });

      expect(css).toContain('align-items: center');
      expect(css).toContain('justify-content: space-between');
    });

    it('should generate responsive direction', () => {
      const css = generator.generateFlexLayout('flex-container', {
        direction: {
          mobile: 'column',
          tablet: 'row',
          desktop: 'row',
          wide: 'row',
        },
      });

      expect(css).toContain('flex-direction: column');
      expect(css).toContain('flex-direction: row');
    });
  });

  describe('generateContainer', () => {
    it('should generate basic container', () => {
      const css = generator.generateContainer('container');

      expect(css).toContain('width: 100%');
      expect(css).toContain('margin-left: auto');
      expect(css).toContain('margin-right: auto');
    });

    it('should generate responsive max-width', () => {
      const css = generator.generateContainer('container', {
        maxWidth: {
          mobile: '100%',
          tablet: '640px',
          desktop: '960px',
          wide: '1200px',
        },
      });

      expect(css).toContain('max-width: 100%');
      expect(css).toContain('max-width: 640px');
      expect(css).toContain('max-width: 960px');
      expect(css).toContain('max-width: 1200px');
    });

    it('should generate container padding', () => {
      const css = generator.generateContainer('container', {
        padding: 4,
      });

      expect(css).toContain('padding-left: 16px');
      expect(css).toContain('padding-right: 16px');
    });
  });

  describe('generateUtilities', () => {
    it('should generate display utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.hidden');
      expect(css).toContain('.block');
      expect(css).toContain('.flex');
      expect(css).toContain('.grid');
    });

    it('should generate flex utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.flex-row');
      expect(css).toContain('.flex-col');
      expect(css).toContain('.flex-wrap');
    });

    it('should generate alignment utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.items-center');
      expect(css).toContain('.justify-between');
    });

    it('should generate spacing utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.m-0');
      expect(css).toContain('.p-4');
      expect(css).toContain('.mt-');
      expect(css).toContain('.mx-');
    });

    it('should generate text utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.text-center');
      expect(css).toContain('.font-bold');
    });

    it('should generate color utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.text-primary');
      expect(css).toContain('.bg-primary');
    });

    it('should generate border radius utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.rounded');
      expect(css).toContain('.rounded-full');
    });

    it('should generate shadow utilities', () => {
      const css = generator.generateUtilities();

      expect(css).toContain('.shadow');
      expect(css).toContain('.shadow-lg');
    });
  });

  describe('generateResponsiveUtilities', () => {
    it('should generate responsive display utilities', () => {
      const css = generator.generateResponsiveUtilities();

      expect(css).toContain('mobile\\:hidden');
      expect(css).toContain('tablet\\:flex');
      expect(css).toContain('desktop\\:grid');
    });

    it('should generate responsive flex utilities', () => {
      const css = generator.generateResponsiveUtilities();

      expect(css).toContain('mobile\\:flex-col');
      expect(css).toContain('tablet\\:flex-row');
    });
  });

  describe('generateGridUtilities', () => {
    it('should generate column utilities', () => {
      const css = generator.generateGridUtilities();

      expect(css).toContain('.grid-cols-1');
      expect(css).toContain('.grid-cols-12');
    });

    it('should generate column span utilities', () => {
      const css = generator.generateGridUtilities();

      expect(css).toContain('.col-span-1');
      expect(css).toContain('.col-span-full');
    });

    it('should generate row span utilities', () => {
      const css = generator.generateGridUtilities();

      expect(css).toContain('.row-span-1');
      expect(css).toContain('.row-span-full');
    });

    it('should generate responsive grid utilities', () => {
      const css = generator.generateGridUtilities();

      expect(css).toContain('tablet\\:grid-cols-');
      expect(css).toContain('desktop\\:col-span-');
    });

    it('should accept custom max columns', () => {
      const css = generator.generateGridUtilities(6);

      expect(css).toContain('.grid-cols-6');
      expect(css).not.toContain('.grid-cols-12');
    });
  });
});
