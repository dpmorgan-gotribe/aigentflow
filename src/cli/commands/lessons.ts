/**
 * Lessons Command
 *
 * View and search learned lessons from code reviews.
 */

import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import type { AgentType } from '../../types.js';
import { initializeDatabase } from '../../persistence/database.js';
import { getLessonRepository } from '../../persistence/repositories/lesson-repository.js';
import { getAuditRepository } from '../../persistence/repositories/audit-repository.js';

interface LessonsOptions {
  search?: string;
  agent?: AgentType;
  category?: string;
  limit: string;
  add?: string;
}

export async function lessonsCommand(options: LessonsOptions): Promise<void> {
  const limit = parseInt(options.limit, 10) || 10;

  // Find project and initialize database
  const cwd = process.cwd();
  const aigentflowDir = path.join(cwd, '.aigentflow');

  if (!fs.existsSync(aigentflowDir)) {
    console.log(chalk.yellow('Not in an aigentflow project.'));
    console.log(chalk.gray('Run `aigentflow init <name>` to create a project.'));
    return;
  }

  const dbPath = path.join(aigentflowDir, 'aigentflow.db');
  initializeDatabase(dbPath);

  const lessonRepo = getLessonRepository();
  const auditRepo = getAuditRepository();

  // Handle adding a new lesson
  if (options.add) {
    console.log(chalk.gray('Adding new lesson...'));

    // Determine category from content
    const content = options.add.toLowerCase();
    let category = 'general';
    if (content.includes('security') || content.includes('vulnerab') || content.includes('xss') || content.includes('sql')) {
      category = 'security';
    } else if (content.includes('test') || content.includes('spec')) {
      category = 'testing';
    } else if (content.includes('perform') || content.includes('optim')) {
      category = 'performance';
    } else if (content.includes('accessib') || content.includes('a11y')) {
      category = 'accessibility';
    } else if (content.includes('architect') || content.includes('pattern') || content.includes('design')) {
      category = 'architecture';
    } else if (content.includes('style') || content.includes('css') || content.includes('ui')) {
      category = 'ui';
    }

    const lesson = lessonRepo.create(
      options.add,
      category,
      options.agent ?? 'analyst',
      'manual-entry',
      []
    );

    auditRepo.logUser('lesson_added', {
      lessonId: lesson.id,
      content: options.add,
      category,
    });

    console.log(chalk.green('Lesson added successfully.'));
    console.log('');
    console.log(`  ID: ${chalk.white(lesson.id)}`);
    console.log(`  Category: ${chalk.gray(category)}`);
    console.log(`  Content: ${chalk.white(options.add)}`);
    return;
  }

  // Search or list lessons
  const lessons = lessonRepo.search({
    query: options.search,
    category: options.category,
    agent: options.agent,
    limit,
  });

  console.log(chalk.cyan('Learned Lessons'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log('');

  if (lessons.length === 0) {
    console.log(chalk.gray('No lessons found matching filters.'));
    console.log('');
    console.log(chalk.gray('Lessons are automatically learned from:'));
    console.log(chalk.gray('  - Code reviews'));
    console.log(chalk.gray('  - Architecture decisions'));
    console.log(chalk.gray('  - Bug fixes'));
    console.log('');
    console.log(chalk.gray('Use `aigentflow lessons --add "lesson"` to add manually.'));
    return;
  }

  // Group by category for display
  const byCategory = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    if (!byCategory.has(lesson.category)) {
      byCategory.set(lesson.category, []);
    }
    byCategory.get(lesson.category)!.push(lesson);
  }

  for (const [category, categoryLessons] of byCategory) {
    const categoryColor = getCategoryColor(category);
    console.log(categoryColor(`[${category.toUpperCase()}]`));
    console.log('');

    for (const lesson of categoryLessons) {
      const usageColor = lesson.usage_count > 10
        ? chalk.green
        : lesson.usage_count > 5
          ? chalk.yellow
          : chalk.gray;

      console.log(`  ${chalk.white(lesson.id)}`);
      console.log(`    ${chalk.green(lesson.content)}`);
      console.log(
        `    Agent: ${chalk.gray(lesson.agent)} | ` +
        `Used: ${usageColor(String(lesson.usage_count))} times | ` +
        `Source: ${chalk.gray(lesson.source)}`
      );

      if (lesson.tags) {
        try {
          const tags = JSON.parse(lesson.tags) as string[];
          if (tags.length > 0) {
            console.log(`    Tags: ${chalk.cyan(tags.join(', '))}`);
          }
        } catch {
          // Ignore invalid tags
        }
      }

      console.log('');
    }
  }

  console.log(chalk.gray(`Showing ${lessons.length} lessons`));
  console.log('');

  // Show stats
  const stats = lessonRepo.getStats();
  console.log(chalk.gray(`Total lessons: ${stats.totalLessons}`));
  console.log('');

  // Show usage hints
  if (!options.search && !options.agent && !options.category) {
    console.log(chalk.gray('Search and filter options:'));
    console.log(chalk.gray('  --search <query>    Full-text search'));
    console.log(chalk.gray('  --agent <type>      Filter by agent'));
    console.log(chalk.gray('  --category <cat>    Filter by category'));
    console.log(chalk.gray('  --add <lesson>      Add new lesson'));
  }

  // Show available categories
  const categories = lessonRepo.getCategories();
  if (categories.length > 0 && !options.category) {
    console.log('');
    console.log(chalk.gray(`Available categories: ${categories.join(', ')}`));
  }
}

function getCategoryColor(category: string): chalk.Chalk {
  switch (category) {
    case 'security':
      return chalk.red;
    case 'performance':
      return chalk.yellow;
    case 'accessibility':
      return chalk.blue;
    case 'architecture':
      return chalk.magenta;
    case 'testing':
      return chalk.green;
    case 'ui':
      return chalk.cyan;
    default:
      return chalk.white;
  }
}
