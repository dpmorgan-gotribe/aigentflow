/**
 * Compliance Rules Index
 *
 * Export all compliance rule frameworks.
 */

export { platformFramework, platformRules } from './platform.js';
export { gdprFramework, gdprRules } from './gdpr.js';
export { soc2Framework, soc2Rules } from './soc2.js';

import { platformFramework } from './platform.js';
import { gdprFramework } from './gdpr.js';
import { soc2Framework } from './soc2.js';
import type { ComplianceFramework } from '../types.js';

/**
 * All built-in compliance frameworks
 */
export const builtInFrameworks: ComplianceFramework[] = [
  platformFramework,
  gdprFramework,
  soc2Framework,
];

/**
 * Get framework by ID
 */
export function getFrameworkById(id: string): ComplianceFramework | undefined {
  return builtInFrameworks.find((f) => f.id === id);
}

export default builtInFrameworks;
