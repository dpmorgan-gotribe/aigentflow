/**
 * Compliance Agent
 *
 * Evaluates code and configurations for compliance with security and regulatory standards.
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  ExecutionContext,
  AgentType,
} from './types.js';
import {
  getComplianceEngine,
  type ComplianceCheckResult,
  type ComplianceViolation,
  type ComplianceFrameworkId,
} from '../compliance/index.js';

/**
 * Compliance agent output
 */
export interface ComplianceAgentOutput {
  compliance: {
    passed: boolean;
    score: number;
    frameworks: string[];
    rulesChecked: number;
    rulesPassed: number;
  };
  violations: Array<{
    ruleId: string;
    framework: string;
    severity: string;
    message: string;
    file?: string;
    line?: number;
    remediation?: string;
  }>;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
    autoFixable: number;
  };
  recommendations: Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
  }>;
}

/**
 * Compliance Agent class
 */
export class ComplianceAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'compliance-agent',
    name: 'Compliance Agent',
    description: 'Evaluates code for security and regulatory compliance',
    phase: 'v1.0',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 2,
      timeout: 60000,
      retryCount: 2,
    },
    capabilities: [
      'security-compliance',
      'gdpr-compliance',
      'soc2-compliance',
      'violation-detection',
      'remediation-suggestions',
    ],
    validStates: ['ANALYZING', 'REVIEWING', 'ORCHESTRATING'],
  };

  private complianceEngine = getComplianceEngine();

  /**
   * Execute the compliance agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { context } = request;

    this.log.info('Running compliance check', {
      projectName: context.projectConfig.name,
      frameworks: context.projectConfig.compliance.frameworks,
    });

    try {
      // Enable configured frameworks
      this.configureFrameworks(context);

      // Run compliance checks
      const checkResults = await this.runChecks(context);

      // Build output
      const output = this.buildOutput(checkResults, context);

      // Determine next agent
      const nextAgent = this.determineNextAgent(output, context);

      this.log.info('Compliance check complete', {
        passed: output.compliance.passed,
        score: output.compliance.score,
        violationCount: output.violations.length,
        nextAgent,
      });

      return this.createSuccessResult(
        output,
        startTime,
        600, // Estimated tokens
        0,
        {
          nextAgent,
          reasoning: output.compliance.passed
            ? 'Compliance passed, proceeding with development'
            : 'Compliance issues found, review required',
        }
      );
    } catch (error) {
      this.log.error('Compliance check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Configure enabled frameworks based on project config
   */
  private configureFrameworks(context: ExecutionContext): void {
    const configuredFrameworks = context.projectConfig.compliance.frameworks;

    // Platform is always enabled
    this.complianceEngine.enableFramework('platform');

    // Enable project-configured frameworks
    for (const framework of configuredFrameworks) {
      const frameworkId = framework.toLowerCase() as ComplianceFrameworkId;
      if (frameworkId !== 'NONE') {
        this.complianceEngine.enableFramework(frameworkId);
      }
    }

    // Update strict mode
    this.complianceEngine.updateConfig({
      strictMode: context.projectConfig.compliance.strictMode,
    });
  }

  /**
   * Run compliance checks against project content
   */
  private async runChecks(context: ExecutionContext): Promise<ComplianceCheckResult[]> {
    const results: ComplianceCheckResult[] = [];

    // Check source code if available
    if (context.sourceCode && context.sourceCode.size > 0) {
      for (const [filePath, content] of context.sourceCode) {
        const result = this.complianceEngine.checkFile(filePath, content);
        if (result.violations.length > 0) {
          results.push(result);
        }
      }
    }

    // Check previous agent outputs (generated code)
    for (const [agentType, agentResult] of context.previousOutputs) {
      if (agentResult.success && agentResult.output) {
        const outputStr = typeof agentResult.output === 'string'
          ? agentResult.output
          : JSON.stringify(agentResult.output);

        const result = this.complianceEngine.checkGeneratedCode(outputStr, {
          metadata: { sourceAgent: agentType },
        });

        if (result.violations.length > 0) {
          results.push(result);
        }
      }
    }

    // If no content to check, run a basic check
    if (results.length === 0) {
      const basicResult = this.complianceEngine.check({
        projectConfig: {
          name: context.projectConfig.name,
          frameworks: context.projectConfig.compliance.frameworks as ComplianceFrameworkId[],
          strictMode: context.projectConfig.compliance.strictMode,
        },
      });
      results.push(basicResult);
    }

    return results;
  }

  /**
   * Build output from check results
   */
  private buildOutput(
    results: ComplianceCheckResult[],
    context: ExecutionContext
  ): ComplianceAgentOutput {
    // Aggregate results
    const allViolations: ComplianceViolation[] = [];
    let totalRulesChecked = 0;
    let totalRulesPassed = 0;
    let totalScore = 0;

    for (const result of results) {
      allViolations.push(...result.violations);
      totalRulesChecked += result.rulesChecked;
      totalRulesPassed += result.rulesPassed;
      totalScore += result.score;
    }

    const avgScore = results.length > 0 ? Math.round(totalScore / results.length) : 100;
    const passed = results.every((r) => r.passed);

    // Count by severity
    const summary = {
      critical: allViolations.filter((v) => v.severity === 'critical').length,
      high: allViolations.filter((v) => v.severity === 'high').length,
      medium: allViolations.filter((v) => v.severity === 'medium').length,
      low: allViolations.filter((v) => v.severity === 'low').length,
      info: allViolations.filter((v) => v.severity === 'info').length,
      autoFixable: allViolations.filter((v) => v.autoFixable).length,
    };

    // Format violations
    const violations = allViolations.map((v) => ({
      ruleId: v.ruleId,
      framework: v.framework,
      severity: v.severity,
      message: v.message,
      file: v.location?.file,
      line: v.location?.line,
      remediation: v.remediation,
    }));

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, allViolations, context);

    return {
      compliance: {
        passed,
        score: avgScore,
        frameworks: ['platform', ...context.projectConfig.compliance.frameworks],
        rulesChecked: totalRulesChecked,
        rulesPassed: totalRulesPassed,
      },
      violations,
      summary,
      recommendations,
    };
  }

  /**
   * Generate recommendations based on violations
   */
  private generateRecommendations(
    summary: ComplianceAgentOutput['summary'],
    violations: ComplianceViolation[],
    context: ExecutionContext
  ): ComplianceAgentOutput['recommendations'] {
    const recommendations: ComplianceAgentOutput['recommendations'] = [];

    // Critical violations require immediate attention
    if (summary.critical > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Address Critical Violations',
        description: `${summary.critical} critical violation(s) found. These must be fixed before proceeding.`,
      });
    }

    // High violations
    if (summary.high > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Fix High-Severity Issues',
        description: `${summary.high} high-severity issue(s) detected. Address these as soon as possible.`,
      });
    }

    // Auto-fixable violations
    if (summary.autoFixable > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Auto-Fix Available',
        description: `${summary.autoFixable} violation(s) can be automatically fixed. Consider running auto-fix.`,
      });
    }

    // GDPR-specific recommendations
    const gdprViolations = violations.filter((v) => v.framework === 'gdpr');
    if (gdprViolations.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'GDPR Compliance Review',
        description: `${gdprViolations.length} GDPR-related issue(s). Review data handling practices.`,
      });
    }

    // SOC 2-specific recommendations
    const soc2Violations = violations.filter((v) => v.framework === 'soc2');
    if (soc2Violations.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'SOC 2 Control Gaps',
        description: `${soc2Violations.length} SOC 2-related issue(s). Review security controls.`,
      });
    }

    // Secret detection
    const secretViolations = violations.filter((v) => v.ruleId.includes('secret'));
    if (secretViolations.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Secret Management Required',
        description: 'Hardcoded secrets detected. Use environment variables or a secrets manager.',
      });
    }

    // If no issues, provide positive feedback
    if (violations.length === 0) {
      recommendations.push({
        priority: 'low',
        title: 'Compliance Passed',
        description: 'No compliance issues detected. Continue with development.',
      });
    }

    return recommendations.slice(0, 5); // Limit to 5 recommendations
  }

  /**
   * Determine next agent based on compliance results
   */
  private determineNextAgent(output: ComplianceAgentOutput, context: ExecutionContext): AgentType {
    // If critical violations, may need to escalate or block
    if (output.summary.critical > 0 && context.projectConfig.compliance.strictMode) {
      return 'project-manager'; // PM decides how to proceed
    }

    // If compliance passed or only minor issues, continue with development
    if (output.compliance.passed) {
      // If coming from project-analyzer, go to architect
      if (context.previousOutputs.has('project-analyzer')) {
        return 'architect';
      }
      // If PM has run, go to architect
      if (context.previousOutputs.has('project-manager')) {
        return 'architect';
      }
    }

    // Default to architect for next steps
    return 'architect';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    return [
      'compliance-check',
      'security-review',
      'gdpr-audit',
      'soc2-audit',
    ].includes(taskType);
  }
}

/**
 * Factory function for compliance agent
 */
export function createComplianceAgent(): ComplianceAgent {
  return new ComplianceAgent();
}
