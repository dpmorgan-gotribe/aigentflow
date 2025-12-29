/**
 * Analysis Module
 *
 * Code analysis and tech detection utilities.
 */

export {
  TechDetector,
  getTechDetector,
  resetTechDetector,
  BUILT_IN_RULES,
  type TechCategory,
  type ConfidenceLevel,
  type DetectedTech,
  type TechDetectionRule,
  type DetectionContext,
  type DetectionResult,
  type PackageJsonData,
  type TechStackResult,
  type TechStackSummary,
} from './tech-detector.js';

export {
  CodeAnalyzer,
  getCodeAnalyzer,
  resetCodeAnalyzer,
  type ArchitecturePattern,
  type DirectoryEntry,
  type DirectoryStructure,
  type CodeMetrics,
  type PatternDetection,
  type ProjectAnalysis,
  type ConventionAnalysis,
} from './code-analyzer.js';
