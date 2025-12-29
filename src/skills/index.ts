/**
 * Skills Framework
 *
 * Modular capability packs for agent prompts.
 */

// Types
export type {
  Skill,
  SkillPack,
  SkillCategory,
  SkillPriority,
  SkillCondition,
  ConditionOperator,
  SkillExample,
  SkillMatchContext,
  SkillSelectionResult,
  SkillInjectionOptions,
  SkillInjectionResult,
  SkillLoaderConfig,
  SkillValidationResult,
  SkillEvent,
  SkillEventType,
} from './types.js';

export {
  DEFAULT_INJECTION_OPTIONS,
  DEFAULT_LOADER_CONFIG,
  PRIORITY_WEIGHTS,
} from './types.js';

// Loader
export {
  SkillLoader,
  getSkillLoader,
  resetSkillLoader,
} from './skill-loader.js';

// Registry
export {
  SkillRegistry,
  getSkillRegistry,
  resetSkillRegistry,
} from './skill-registry.js';

// Injector
export {
  SkillInjector,
  getSkillInjector,
  resetSkillInjector,
  injectSkills,
} from './skill-injector.js';

// Built-in packs
export {
  builtInSkillPacks,
  codingSkillPack,
  testingSkillPack,
  securitySkillPack,
} from './built-in/index.js';

import { getSkillLoader } from './skill-loader.js';
import { builtInSkillPacks } from './built-in/index.js';
import { logger } from '../utils/logger.js';

const log = logger.child({ component: 'skills' });

/**
 * Initialize the skills framework with built-in packs
 */
export function initializeSkills(): void {
  const loader = getSkillLoader();

  // Load all built-in skill packs
  for (const pack of builtInSkillPacks) {
    const result = loader.loadPack(pack);
    if (!result.valid) {
      log.warn('Failed to load built-in pack', {
        packId: pack.id,
        errors: result.errors,
      });
    }
  }

  const stats = loader.getStats();
  log.info('Skills framework initialized', {
    packs: stats.packsLoaded,
    skills: stats.skillsLoaded,
  });
}

/**
 * Reset all skill singletons (for testing)
 */
export function resetSkills(): void {
  resetSkillLoader();
  resetSkillRegistry();
  resetSkillInjector();
}
