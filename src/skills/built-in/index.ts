/**
 * Built-in Skill Packs
 *
 * Exports all built-in skill packs for the Skills Framework.
 */

export { codingSkillPack } from './coding.js';
export { testingSkillPack } from './testing.js';
export { securitySkillPack } from './security.js';

import { codingSkillPack } from './coding.js';
import { testingSkillPack } from './testing.js';
import { securitySkillPack } from './security.js';
import type { SkillPack } from '../types.js';

/**
 * All built-in skill packs
 */
export const builtInSkillPacks: SkillPack[] = [
  codingSkillPack,
  testingSkillPack,
  securitySkillPack,
];

export default builtInSkillPacks;
