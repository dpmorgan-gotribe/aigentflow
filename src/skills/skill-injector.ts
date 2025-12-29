/**
 * Skill Injector
 *
 * Injects selected skills into agent prompts with proper formatting.
 */

import { logger } from '../utils/logger.js';
import { getSkillRegistry } from './skill-registry.js';
import type {
  Skill,
  SkillMatchContext,
  SkillInjectionOptions,
  SkillInjectionResult,
  SkillEvent,
} from './types.js';
import { DEFAULT_INJECTION_OPTIONS } from './types.js';

const log = logger.child({ component: 'skill-injector' });

/**
 * Skill injector for adding skills to prompts
 */
export class SkillInjector {
  private static instance: SkillInjector | null = null;
  private eventListeners: Array<(event: SkillEvent) => void> = [];

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): SkillInjector {
    if (!SkillInjector.instance) {
      SkillInjector.instance = new SkillInjector();
    }
    return SkillInjector.instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static reset(): void {
    SkillInjector.instance = null;
  }

  /**
   * Add event listener
   */
  on(listener: (event: SkillEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Emit skill event
   */
  private emit(event: Omit<SkillEvent, 'timestamp'>): void {
    const fullEvent: SkillEvent = { ...event, timestamp: new Date() };
    this.eventListeners.forEach((listener) => listener(fullEvent));
  }

  /**
   * Inject skills into a prompt based on context
   */
  inject(
    basePrompt: string,
    context: SkillMatchContext,
    options: Partial<SkillInjectionOptions> = {}
  ): SkillInjectionResult {
    const opts = { ...DEFAULT_INJECTION_OPTIONS, ...options };
    const registry = getSkillRegistry();

    // Select skills based on context and budget
    const selection = registry.selectSkills(context, opts.tokenBudget);

    if (selection.skills.length === 0) {
      return {
        content: basePrompt,
        injectedSkills: [],
        tokenCount: 0,
        budgetExceeded: false,
      };
    }

    // Format skills section
    const skillsContent = this.formatSkills(selection.skills, opts);

    // Combine with base prompt
    const content = this.combinePrompt(basePrompt, skillsContent, opts);

    // Emit injection event
    this.emit({
      type: 'skill:injected',
      message: `Injected ${selection.skills.length} skills`,
      data: {
        skills: selection.skills.map((s) => s.id),
        tokenCount: selection.totalTokens,
      },
    });

    log.debug('Injected skills into prompt', {
      skills: selection.skills.map((s) => s.id),
      tokens: selection.totalTokens,
    });

    return {
      content,
      injectedSkills: selection.skills.map((s) => s.id),
      tokenCount: selection.totalTokens,
      budgetExceeded: selection.excludedByBudget.length > 0,
    };
  }

  /**
   * Inject specific skills by ID
   */
  injectSkills(
    basePrompt: string,
    skills: Skill[],
    options: Partial<SkillInjectionOptions> = {}
  ): SkillInjectionResult {
    const opts = { ...DEFAULT_INJECTION_OPTIONS, ...options };

    // Apply budget
    let totalTokens = 0;
    const includedSkills: Skill[] = [];
    let budgetExceeded = false;

    for (const skill of skills) {
      if (totalTokens + skill.tokenEstimate <= opts.tokenBudget) {
        includedSkills.push(skill);
        totalTokens += skill.tokenEstimate;
      } else {
        budgetExceeded = true;
      }
    }

    if (includedSkills.length === 0) {
      return {
        content: basePrompt,
        injectedSkills: [],
        tokenCount: 0,
        budgetExceeded,
      };
    }

    // Format and combine
    const skillsContent = this.formatSkills(includedSkills, opts);
    const content = this.combinePrompt(basePrompt, skillsContent, opts);

    return {
      content,
      injectedSkills: includedSkills.map((s) => s.id),
      tokenCount: totalTokens,
      budgetExceeded,
    };
  }

  /**
   * Format skills into a single content block
   */
  formatSkills(skills: Skill[], options: SkillInjectionOptions): string {
    switch (options.format) {
      case 'markdown':
        return this.formatMarkdown(skills, options);
      case 'xml':
        return this.formatXml(skills, options);
      case 'plain':
        return this.formatPlain(skills, options);
      default:
        return this.formatMarkdown(skills, options);
    }
  }

  /**
   * Format skills as markdown
   */
  private formatMarkdown(skills: Skill[], options: SkillInjectionOptions): string {
    const lines: string[] = [];

    if (options.sectionHeader) {
      lines.push(`## ${options.sectionHeader}`);
      lines.push('');
    }

    for (const skill of skills) {
      lines.push(`### ${skill.name}`);

      if (options.includeMetadata) {
        lines.push(`*Category: ${skill.category} | Priority: ${skill.priority}*`);
      }

      lines.push('');
      lines.push(skill.content);

      if (options.includeExamples && skill.examples && skill.examples.length > 0) {
        lines.push('');
        lines.push('**Examples:**');
        for (const example of skill.examples) {
          lines.push(`- **${example.title}**`);
          lines.push(`  - Input: ${example.input}`);
          lines.push(`  - Output: ${example.output}`);
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format skills as XML
   */
  private formatXml(skills: Skill[], options: SkillInjectionOptions): string {
    const lines: string[] = [];

    const header = options.sectionHeader || 'skills';
    lines.push(`<${header}>`);

    for (const skill of skills) {
      lines.push(`  <skill id="${skill.id}" name="${skill.name}">`);

      if (options.includeMetadata) {
        lines.push(`    <metadata>`);
        lines.push(`      <category>${skill.category}</category>`);
        lines.push(`      <priority>${skill.priority}</priority>`);
        lines.push(`    </metadata>`);
      }

      lines.push(`    <content>`);
      lines.push(`      ${skill.content}`);
      lines.push(`    </content>`);

      if (options.includeExamples && skill.examples && skill.examples.length > 0) {
        lines.push(`    <examples>`);
        for (const example of skill.examples) {
          lines.push(`      <example title="${example.title}">`);
          lines.push(`        <input>${example.input}</input>`);
          lines.push(`        <output>${example.output}</output>`);
          lines.push(`      </example>`);
        }
        lines.push(`    </examples>`);
      }

      lines.push(`  </skill>`);
    }

    lines.push(`</${header}>`);

    return lines.join('\n');
  }

  /**
   * Format skills as plain text
   */
  private formatPlain(skills: Skill[], options: SkillInjectionOptions): string {
    const lines: string[] = [];

    if (options.sectionHeader) {
      lines.push(options.sectionHeader.toUpperCase());
      lines.push('='.repeat(options.sectionHeader.length));
      lines.push('');
    }

    for (const skill of skills) {
      lines.push(`[${skill.name}]`);

      if (options.includeMetadata) {
        lines.push(`Category: ${skill.category}, Priority: ${skill.priority}`);
      }

      lines.push('');
      lines.push(skill.content);

      if (options.includeExamples && skill.examples && skill.examples.length > 0) {
        lines.push('');
        lines.push('Examples:');
        for (const example of skill.examples) {
          lines.push(`* ${example.title}`);
          lines.push(`  Input: ${example.input}`);
          lines.push(`  Output: ${example.output}`);
        }
      }

      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Combine base prompt with skills content
   */
  private combinePrompt(
    basePrompt: string,
    skillsContent: string,
    options: SkillInjectionOptions
  ): string {
    // Check for injection point marker
    const marker = '{{SKILLS}}';
    if (basePrompt.includes(marker)) {
      return basePrompt.replace(marker, skillsContent);
    }

    // Default: append skills before the prompt
    return `${skillsContent}\n\n${basePrompt}`;
  }

  /**
   * Estimate token count for content
   * Simple estimation: ~4 chars per token on average
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / 4);
  }

  /**
   * Create a skill section for manual insertion
   */
  createSection(
    skills: Skill[],
    options: Partial<SkillInjectionOptions> = {}
  ): string {
    const opts = { ...DEFAULT_INJECTION_OPTIONS, ...options };
    return this.formatSkills(skills, opts);
  }
}

/**
 * Get skill injector singleton
 */
export function getSkillInjector(): SkillInjector {
  return SkillInjector.getInstance();
}

/**
 * Reset skill injector (for testing)
 */
export function resetSkillInjector(): void {
  SkillInjector.reset();
}

/**
 * Convenience function to inject skills into a prompt
 */
export function injectSkills(
  prompt: string,
  context: SkillMatchContext,
  options?: Partial<SkillInjectionOptions>
): SkillInjectionResult {
  return getSkillInjector().inject(prompt, context, options);
}
