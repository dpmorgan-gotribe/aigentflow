# Step 32: GenUI Output Style

> **Checkpoint:** CP7 - Platform Infrastructure
> **Previous Step:** 31-FEATURE-FLAGS.md
> **Next Step:** Complete

---

## Overview

GenUI Output Style defines consistent, structured output formatting for all agent responses. This ensures predictable, parseable outputs that can be rendered appropriately in CLI, web, or API contexts.

Key responsibilities:
- Structured output schemas for all agents
- Consistent formatting patterns
- CLI-optimized rendering
- Progress indicators and streaming
- Error presentation standards
- Component-based output structure

---

## Deliverables

1. `src/platform/output/renderer.ts` - Output renderer
2. `src/platform/output/formatters/` - Format-specific renderers
3. `src/platform/output/components/` - Output components
4. `src/platform/output/themes.ts` - Theming support
5. `orchestrator-data/system/output/` - Output configurations

---

## 1. Output Schema

### 1.1 Universal Output Structure

```typescript
/**
 * GenUI Output Schema
 *
 * All agent outputs conform to this structure.
 */

import { z } from 'zod';

// Content block types
export const ContentBlockSchema = z.discriminatedUnion('type', [
  // Text content
  z.object({
    type: z.literal('text'),
    text: z.string(),
    style: z.enum(['normal', 'emphasis', 'code', 'heading', 'subheading']).optional(),
  }),

  // Code block
  z.object({
    type: z.literal('code'),
    code: z.string(),
    language: z.string().optional(),
    filename: z.string().optional(),
    highlightLines: z.array(z.number()).optional(),
  }),

  // List
  z.object({
    type: z.literal('list'),
    style: z.enum(['bullet', 'numbered', 'checkbox']),
    items: z.array(z.object({
      text: z.string(),
      checked: z.boolean().optional(),
      children: z.array(z.lazy(() => ContentBlockSchema)).optional(),
    })),
  }),

  // Table
  z.object({
    type: z.literal('table'),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
    alignment: z.array(z.enum(['left', 'center', 'right'])).optional(),
  }),

  // Tree structure
  z.object({
    type: z.literal('tree'),
    root: z.string(),
    children: z.array(z.lazy(() => TreeNodeSchema)),
  }),

  // Progress indicator
  z.object({
    type: z.literal('progress'),
    label: z.string(),
    current: z.number(),
    total: z.number(),
    status: z.enum(['pending', 'running', 'success', 'error']).optional(),
  }),

  // Status badge
  z.object({
    type: z.literal('status'),
    label: z.string(),
    status: z.enum(['success', 'warning', 'error', 'info', 'pending']),
    message: z.string().optional(),
  }),

  // Callout/alert
  z.object({
    type: z.literal('callout'),
    style: z.enum(['info', 'warning', 'error', 'success', 'tip']),
    title: z.string().optional(),
    content: z.string(),
  }),

  // Diff view
  z.object({
    type: z.literal('diff'),
    filename: z.string(),
    hunks: z.array(z.object({
      oldStart: z.number(),
      oldLines: z.number(),
      newStart: z.number(),
      newLines: z.number(),
      lines: z.array(z.object({
        type: z.enum(['context', 'add', 'remove']),
        content: z.string(),
      })),
    })),
  }),

  // Collapsible section
  z.object({
    type: z.literal('collapsible'),
    title: z.string(),
    expanded: z.boolean().default(false),
    content: z.array(z.lazy(() => ContentBlockSchema)),
  }),

  // Separator
  z.object({
    type: z.literal('separator'),
    style: z.enum(['line', 'space', 'double']).optional(),
  }),

  // Action prompt
  z.object({
    type: z.literal('action'),
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    options: z.array(z.object({
      key: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })),
  }),
]);

export type ContentBlock = z.infer<typeof ContentBlockSchema>;

const TreeNodeSchema: z.ZodType<TreeNode> = z.object({
  label: z.string(),
  children: z.array(z.lazy(() => TreeNodeSchema)).optional(),
});

interface TreeNode {
  label: string;
  children?: TreeNode[];
}

// Complete output schema
export const OutputSchema = z.object({
  // Metadata
  version: z.literal('1.0'),
  agent: z.string(),
  timestamp: z.string(),

  // Header
  header: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    icon: z.string().optional(),
  }).optional(),

  // Content blocks
  content: z.array(ContentBlockSchema),

  // Footer
  footer: z.object({
    duration: z.number().optional(),
    tokens: z.number().optional(),
    actions: z.array(z.object({
      label: z.string(),
      command: z.string(),
    })).optional(),
  }).optional(),
});

export type Output = z.infer<typeof OutputSchema>;
```

---

## 2. Output Renderer

### 2.1 Base Renderer

```typescript
/**
 * Output Renderer
 *
 * Renders structured output to various formats.
 */

import chalk from 'chalk';
import { Output, ContentBlock } from './schema';

export abstract class OutputRenderer {
  abstract render(output: Output): string;
  abstract renderBlock(block: ContentBlock): string;
}

/**
 * CLI Renderer
 *
 * Renders output for terminal display.
 */
export class CLIRenderer extends OutputRenderer {
  private width: number;
  private theme: Theme;

  constructor(config: { width?: number; theme?: Theme } = {}) {
    super();
    this.width = config.width || process.stdout.columns || 80;
    this.theme = config.theme || defaultTheme;
  }

  render(output: Output): string {
    const lines: string[] = [];

    // Header
    if (output.header) {
      lines.push(this.renderHeader(output.header));
      lines.push('');
    }

    // Content blocks
    for (const block of output.content) {
      lines.push(this.renderBlock(block));
    }

    // Footer
    if (output.footer) {
      lines.push('');
      lines.push(this.renderFooter(output.footer));
    }

    return lines.join('\n');
  }

  renderBlock(block: ContentBlock): string {
    switch (block.type) {
      case 'text':
        return this.renderText(block);
      case 'code':
        return this.renderCode(block);
      case 'list':
        return this.renderList(block);
      case 'table':
        return this.renderTable(block);
      case 'tree':
        return this.renderTree(block);
      case 'progress':
        return this.renderProgress(block);
      case 'status':
        return this.renderStatus(block);
      case 'callout':
        return this.renderCallout(block);
      case 'diff':
        return this.renderDiff(block);
      case 'collapsible':
        return this.renderCollapsible(block);
      case 'separator':
        return this.renderSeparator(block);
      case 'action':
        return this.renderAction(block);
      default:
        return '';
    }
  }

  private renderHeader(header: Output['header']): string {
    if (!header) return '';

    const box = this.box(
      `${header.icon || ''} ${header.title}`.trim(),
      header.subtitle
    );
    return box;
  }

  private renderText(block: Extract<ContentBlock, { type: 'text' }>): string {
    switch (block.style) {
      case 'heading':
        return chalk.bold.underline(block.text);
      case 'subheading':
        return chalk.bold(block.text);
      case 'emphasis':
        return chalk.italic(block.text);
      case 'code':
        return chalk.cyan(block.text);
      default:
        return block.text;
    }
  }

  private renderCode(block: Extract<ContentBlock, { type: 'code' }>): string {
    const lines: string[] = [];

    if (block.filename) {
      lines.push(chalk.dim(`// ${block.filename}`));
    }

    const codeLines = block.code.split('\n');
    const numbered = codeLines.map((line, i) => {
      const lineNum = chalk.dim(`${(i + 1).toString().padStart(3)} │ `);
      const highlight = block.highlightLines?.includes(i + 1)
        ? chalk.bgYellow.black
        : (s: string) => s;
      return lineNum + highlight(line);
    });

    lines.push(chalk.dim('┌' + '─'.repeat(this.width - 2) + '┐'));
    lines.push(...numbered.map(l => chalk.dim('│ ') + l));
    lines.push(chalk.dim('└' + '─'.repeat(this.width - 2) + '┘'));

    return lines.join('\n');
  }

  private renderList(block: Extract<ContentBlock, { type: 'list' }>): string {
    const renderItem = (item: typeof block.items[0], depth: number): string[] => {
      const indent = '  '.repeat(depth);
      const bullet = block.style === 'numbered'
        ? `${depth + 1}.`
        : block.style === 'checkbox'
        ? item.checked ? chalk.green('✓') : chalk.dim('○')
        : '•';

      const lines = [`${indent}${bullet} ${item.text}`];

      if (item.children) {
        for (const child of item.children as ContentBlock[]) {
          lines.push(this.renderBlock(child));
        }
      }

      return lines;
    };

    return block.items.flatMap(item => renderItem(item, 0)).join('\n');
  }

  private renderTable(block: Extract<ContentBlock, { type: 'table' }>): string {
    // Calculate column widths
    const colWidths = block.headers.map((h, i) => {
      const cellWidths = [h.length, ...block.rows.map(r => (r[i] || '').length)];
      return Math.max(...cellWidths);
    });

    // Render header
    const headerRow = block.headers
      .map((h, i) => h.padEnd(colWidths[i]))
      .join(' │ ');

    const separator = colWidths.map(w => '─'.repeat(w)).join('─┼─');

    // Render rows
    const dataRows = block.rows.map(row =>
      row.map((cell, i) => (cell || '').padEnd(colWidths[i])).join(' │ ')
    );

    return [
      chalk.bold(headerRow),
      chalk.dim(separator),
      ...dataRows,
    ].join('\n');
  }

  private renderTree(block: Extract<ContentBlock, { type: 'tree' }>): string {
    const renderNode = (node: TreeNode, prefix: string, isLast: boolean): string[] => {
      const connector = isLast ? '└── ' : '├── ';
      const lines = [prefix + connector + node.label];

      if (node.children) {
        const childPrefix = prefix + (isLast ? '    ' : '│   ');
        node.children.forEach((child, i) => {
          const childIsLast = i === node.children!.length - 1;
          lines.push(...renderNode(child, childPrefix, childIsLast));
        });
      }

      return lines;
    };

    const lines = [block.root];
    if (block.children) {
      block.children.forEach((child, i) => {
        const isLast = i === block.children.length - 1;
        lines.push(...renderNode(child, '', isLast));
      });
    }

    return lines.join('\n');
  }

  private renderProgress(block: Extract<ContentBlock, { type: 'progress' }>): string {
    const percent = Math.round((block.current / block.total) * 100);
    const barWidth = 30;
    const filled = Math.round((block.current / block.total) * barWidth);
    const empty = barWidth - filled;

    const statusColors: Record<string, typeof chalk> = {
      pending: chalk.dim,
      running: chalk.blue,
      success: chalk.green,
      error: chalk.red,
    };

    const color = statusColors[block.status || 'running'];
    const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));

    return `${block.label} [${bar}] ${percent}% (${block.current}/${block.total})`;
  }

  private renderStatus(block: Extract<ContentBlock, { type: 'status' }>): string {
    const icons: Record<string, string> = {
      success: chalk.green('✓'),
      warning: chalk.yellow('⚠'),
      error: chalk.red('✗'),
      info: chalk.blue('ℹ'),
      pending: chalk.dim('○'),
    };

    const colors: Record<string, typeof chalk> = {
      success: chalk.green,
      warning: chalk.yellow,
      error: chalk.red,
      info: chalk.blue,
      pending: chalk.dim,
    };

    const icon = icons[block.status];
    const color = colors[block.status];

    return `${icon} ${color(block.label)}${block.message ? `: ${block.message}` : ''}`;
  }

  private renderCallout(block: Extract<ContentBlock, { type: 'callout' }>): string {
    const styles: Record<string, { icon: string; color: typeof chalk }> = {
      info: { icon: 'ℹ', color: chalk.blue },
      warning: { icon: '⚠', color: chalk.yellow },
      error: { icon: '✗', color: chalk.red },
      success: { icon: '✓', color: chalk.green },
      tip: { icon: '💡', color: chalk.cyan },
    };

    const { icon, color } = styles[block.style];
    const title = block.title ? color.bold(` ${block.title}`) : '';

    const lines = [
      color(`${icon}${title}`),
      color(`│ ${block.content}`),
    ];

    return lines.join('\n');
  }

  private renderDiff(block: Extract<ContentBlock, { type: 'diff' }>): string {
    const lines: string[] = [chalk.bold(`diff --git ${block.filename}`)];

    for (const hunk of block.hunks) {
      lines.push(chalk.cyan(`@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`));

      for (const line of hunk.lines) {
        switch (line.type) {
          case 'add':
            lines.push(chalk.green(`+${line.content}`));
            break;
          case 'remove':
            lines.push(chalk.red(`-${line.content}`));
            break;
          default:
            lines.push(` ${line.content}`);
        }
      }
    }

    return lines.join('\n');
  }

  private renderCollapsible(block: Extract<ContentBlock, { type: 'collapsible' }>): string {
    const icon = block.expanded ? '▼' : '▶';
    const lines = [chalk.bold(`${icon} ${block.title}`)];

    if (block.expanded) {
      for (const child of block.content) {
        lines.push('  ' + this.renderBlock(child));
      }
    }

    return lines.join('\n');
  }

  private renderSeparator(block: Extract<ContentBlock, { type: 'separator' }>): string {
    switch (block.style) {
      case 'double':
        return chalk.dim('═'.repeat(this.width));
      case 'space':
        return '';
      default:
        return chalk.dim('─'.repeat(this.width));
    }
  }

  private renderAction(block: Extract<ContentBlock, { type: 'action' }>): string {
    const lines = [
      chalk.bold(block.label),
      block.description ? chalk.dim(block.description) : '',
      '',
      ...block.options.map(opt =>
        `  ${chalk.cyan(opt.key)}: ${opt.label}${opt.description ? chalk.dim(` - ${opt.description}`) : ''}`
      ),
    ];

    return lines.filter(Boolean).join('\n');
  }

  private renderFooter(footer: Output['footer']): string {
    if (!footer) return '';

    const parts: string[] = [];

    if (footer.duration !== undefined) {
      parts.push(`⏱ ${footer.duration}ms`);
    }

    if (footer.tokens !== undefined) {
      parts.push(`🎫 ${footer.tokens} tokens`);
    }

    let line = chalk.dim(parts.join(' │ '));

    if (footer.actions && footer.actions.length > 0) {
      const actionStr = footer.actions
        .map(a => chalk.cyan(a.command))
        .join('  ');
      line += '\n' + chalk.dim('Actions: ') + actionStr;
    }

    return line;
  }

  private box(title: string, subtitle?: string): string {
    const lines = [
      '┌' + '─'.repeat(this.width - 2) + '┐',
      '│ ' + chalk.bold(title.padEnd(this.width - 4)) + ' │',
    ];

    if (subtitle) {
      lines.push('│ ' + chalk.dim(subtitle.padEnd(this.width - 4)) + ' │');
    }

    lines.push('└' + '─'.repeat(this.width - 2) + '┘');

    return lines.join('\n');
  }
}
```

---

## 3. JSON Renderer

```typescript
/**
 * JSON Renderer
 *
 * Renders output as JSON for API responses.
 */

export class JSONRenderer extends OutputRenderer {
  render(output: Output): string {
    return JSON.stringify(output, null, 2);
  }

  renderBlock(block: ContentBlock): string {
    return JSON.stringify(block, null, 2);
  }
}
```

---

## 4. Output Builder

```typescript
/**
 * Output Builder
 *
 * Fluent API for building structured output.
 */

export class OutputBuilder {
  private output: Output;

  constructor(agent: string) {
    this.output = {
      version: '1.0',
      agent,
      timestamp: new Date().toISOString(),
      content: [],
    };
  }

  header(title: string, subtitle?: string, icon?: string): this {
    this.output.header = { title, subtitle, icon };
    return this;
  }

  text(text: string, style?: 'normal' | 'emphasis' | 'code' | 'heading' | 'subheading'): this {
    this.output.content.push({ type: 'text', text, style });
    return this;
  }

  code(code: string, language?: string, filename?: string): this {
    this.output.content.push({ type: 'code', code, language, filename });
    return this;
  }

  list(items: string[], style: 'bullet' | 'numbered' | 'checkbox' = 'bullet'): this {
    this.output.content.push({
      type: 'list',
      style,
      items: items.map(text => ({ text })),
    });
    return this;
  }

  table(headers: string[], rows: string[][]): this {
    this.output.content.push({ type: 'table', headers, rows });
    return this;
  }

  tree(root: string, children: TreeNode[]): this {
    this.output.content.push({ type: 'tree', root, children });
    return this;
  }

  progress(label: string, current: number, total: number, status?: 'pending' | 'running' | 'success' | 'error'): this {
    this.output.content.push({ type: 'progress', label, current, total, status });
    return this;
  }

  status(label: string, status: 'success' | 'warning' | 'error' | 'info' | 'pending', message?: string): this {
    this.output.content.push({ type: 'status', label, status, message });
    return this;
  }

  callout(style: 'info' | 'warning' | 'error' | 'success' | 'tip', content: string, title?: string): this {
    this.output.content.push({ type: 'callout', style, content, title });
    return this;
  }

  separator(style?: 'line' | 'space' | 'double'): this {
    this.output.content.push({ type: 'separator', style });
    return this;
  }

  footer(options: { duration?: number; tokens?: number; actions?: { label: string; command: string }[] }): this {
    this.output.footer = options;
    return this;
  }

  build(): Output {
    return this.output;
  }
}
```

---

## 5. Streaming Output

```typescript
/**
 * Streaming Output Renderer
 *
 * Handles progressive output for long-running operations.
 */

export class StreamingRenderer {
  private renderer: CLIRenderer;
  private currentLine = 0;

  constructor(renderer: CLIRenderer) {
    this.renderer = renderer;
  }

  /**
   * Start streaming output
   */
  start(header: Output['header']): void {
    if (header) {
      console.log(this.renderer['renderHeader'](header));
      console.log('');
    }
    this.currentLine = 0;
  }

  /**
   * Update progress
   */
  updateProgress(label: string, current: number, total: number, status?: string): void {
    const block: ContentBlock = {
      type: 'progress',
      label,
      current,
      total,
      status: status as any,
    };

    // Move cursor up and clear line
    if (this.currentLine > 0) {
      process.stdout.write(`\x1b[${this.currentLine}A\x1b[K`);
    }

    console.log(this.renderer.renderBlock(block));
    this.currentLine = 1;
  }

  /**
   * Append content block
   */
  append(block: ContentBlock): void {
    console.log(this.renderer.renderBlock(block));
    this.currentLine = 0; // Reset since we're adding new content
  }

  /**
   * Complete streaming
   */
  complete(footer?: Output['footer']): void {
    if (footer) {
      console.log('');
      console.log(this.renderer['renderFooter'](footer));
    }
  }
}
```

---

## 6. Example Usage

```typescript
// Example: Build phase output
const output = new OutputBuilder('frontend_developer')
  .header('Building Component', 'LoginForm.tsx', '🔨')
  .text('Creating login form component', 'heading')
  .status('TypeScript compilation', 'success')
  .status('Test execution', 'running')
  .progress('Tests', 15, 20, 'running')
  .separator()
  .code(`
export function LoginForm({ onSubmit }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}
  `.trim(), 'tsx', 'src/components/LoginForm.tsx')
  .callout('tip', 'Consider adding form validation with react-hook-form')
  .footer({
    duration: 1234,
    tokens: 567,
    actions: [
      { label: 'Run tests', command: 'npm test' },
      { label: 'View diff', command: 'git diff' },
    ],
  })
  .build();

const renderer = new CLIRenderer();
console.log(renderer.render(output));
```

---

## 7. Test Scenarios

```typescript
describe('GenUI Output', () => {
  describe('CLIRenderer', () => {
    it('should render header with box', () => {
      const output = new OutputBuilder('test')
        .header('Test Title', 'Subtitle')
        .build();

      const rendered = renderer.render(output);
      expect(rendered).toContain('Test Title');
      expect(rendered).toContain('┌');
    });

    it('should render code with line numbers', () => {
      const output = new OutputBuilder('test')
        .code('const x = 1;\nconst y = 2;', 'ts')
        .build();

      const rendered = renderer.render(output);
      expect(rendered).toContain('1 │');
      expect(rendered).toContain('2 │');
    });

    it('should render progress bar', () => {
      const output = new OutputBuilder('test')
        .progress('Loading', 50, 100)
        .build();

      const rendered = renderer.render(output);
      expect(rendered).toContain('50%');
    });

    it('should render tree structure', () => {
      const output = new OutputBuilder('test')
        .tree('src', [
          { label: 'components', children: [{ label: 'Button.tsx' }] },
          { label: 'utils' },
        ])
        .build();

      const rendered = renderer.render(output);
      expect(rendered).toContain('├──');
      expect(rendered).toContain('└──');
    });
  });

  describe('OutputBuilder', () => {
    it('should build valid output', () => {
      const output = new OutputBuilder('test-agent')
        .header('Test')
        .text('Hello')
        .build();

      expect(output.version).toBe('1.0');
      expect(output.agent).toBe('test-agent');
      expect(output.content.length).toBe(1);
    });
  });
});
```

---

## 8. Dependencies

- chalk (terminal colors)
- No external dependencies for core

---

## 9. Acceptance Criteria

- [ ] All content block types render correctly
- [ ] CLI output is properly formatted
- [ ] JSON output is valid and parseable
- [ ] Streaming output updates in place
- [ ] Progress bars show accurate percentage
- [ ] Trees render with correct connectors
- [ ] Tables align columns properly
- [ ] Diff view shows additions/removals
- [ ] All tests pass
