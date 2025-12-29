/**
 * Analyst Agent
 *
 * Researches best practices and produces analysis reports.
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  AnalysisOutput,
  ExecutionContext,
  AgentType,
} from './types.js';

/**
 * Analyst agent for research and analysis
 */
export class AnalystAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'analyst',
    name: 'Technical Analyst',
    description: 'Researches best practices and produces analysis reports',
    phase: 'mvp',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 5,
      timeout: 45000,
      retryCount: 2,
    },
    capabilities: [
      'research',
      'best-practice-analysis',
      'requirement-gathering',
      'pattern-identification',
      'recommendation-generation',
    ],
    validStates: ['ANALYZING', 'ORCHESTRATING'],
  };

  /**
   * Execute the analyst agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { prompt, context } = request;

    this.log.info('Analyst researching', {
      prompt: prompt.substring(0, 100),
    });

    // Perform analysis
    const analysis = this.performAnalysis(prompt, context);

    // Determine next agent
    const nextAgent = this.determineNextAgent(prompt, context);

    this.log.info('Analysis complete', {
      findingsCount: analysis.findings.length,
      recommendationsCount: analysis.recommendations.length,
      nextAgent,
    });

    return this.createSuccessResult(
      {
        analysis,
        routingHint: {
          nextAgent,
          reasoning: 'Research complete - proceeding with findings',
        },
      },
      startTime,
      600, // Estimated tokens
      0,
      {
        nextAgent,
        reasoning: 'Analysis complete, findings ready for next phase',
      }
    );
  }

  /**
   * Perform analysis of the request
   */
  private performAnalysis(prompt: string, context: ExecutionContext): AnalysisOutput {
    const findings = this.gatherFindings(prompt, context);
    const recommendations = this.generateRecommendations(findings, context);
    const summary = this.generateSummary(findings, recommendations);

    return {
      findings,
      summary,
      recommendations,
    };
  }

  /**
   * Gather findings from analysis
   */
  private gatherFindings(
    prompt: string,
    context: ExecutionContext
  ): AnalysisOutput['findings'] {
    const findings: AnalysisOutput['findings'] = [];
    const lowerPrompt = prompt.toLowerCase();

    // Security findings
    if (lowerPrompt.includes('auth') || lowerPrompt.includes('login') || lowerPrompt.includes('user')) {
      findings.push({
        category: 'security',
        finding: 'Authentication system required',
        severity: 'critical',
        recommendation: 'Implement secure authentication with proper password hashing',
      });
      findings.push({
        category: 'security',
        finding: 'Consider rate limiting for authentication endpoints',
        severity: 'warning',
        recommendation: 'Add rate limiting to prevent brute force attacks',
      });
    }

    // Performance findings
    if (lowerPrompt.includes('performance') || lowerPrompt.includes('fast') || lowerPrompt.includes('scale')) {
      findings.push({
        category: 'performance',
        finding: 'Performance optimization needed',
        severity: 'warning',
        recommendation: 'Implement caching strategy and database indexing',
      });
    }

    // Data management findings
    if (lowerPrompt.includes('data') || lowerPrompt.includes('database') || lowerPrompt.includes('storage')) {
      findings.push({
        category: 'data',
        finding: 'Data persistence requirements identified',
        severity: 'info',
        recommendation: 'Define data model and select appropriate database',
      });
      findings.push({
        category: 'data',
        finding: 'Consider data validation at input boundaries',
        severity: 'warning',
        recommendation: 'Implement schema validation for all data inputs',
      });
    }

    // UI/UX findings
    if (lowerPrompt.includes('ui') || lowerPrompt.includes('user interface') || lowerPrompt.includes('experience')) {
      findings.push({
        category: 'ux',
        finding: 'User experience considerations needed',
        severity: 'info',
        recommendation: 'Conduct user research and create user stories',
      });
      findings.push({
        category: 'accessibility',
        finding: 'Accessibility requirements should be addressed',
        severity: 'warning',
        recommendation: 'Follow WCAG 2.1 guidelines for accessibility',
      });
    }

    // API findings
    if (lowerPrompt.includes('api') || lowerPrompt.includes('endpoint') || lowerPrompt.includes('service')) {
      findings.push({
        category: 'architecture',
        finding: 'API design considerations needed',
        severity: 'info',
        recommendation: 'Follow RESTful or GraphQL best practices',
      });
      findings.push({
        category: 'documentation',
        finding: 'API documentation will be required',
        severity: 'info',
        recommendation: 'Use OpenAPI/Swagger for API documentation',
      });
    }

    // Testing findings
    if (lowerPrompt.includes('test') || lowerPrompt.includes('quality')) {
      findings.push({
        category: 'quality',
        finding: 'Testing strategy required',
        severity: 'warning',
        recommendation: 'Implement unit, integration, and e2e tests',
      });
    }

    // Compliance findings
    if (context.projectConfig.compliance.frameworks.length > 0) {
      for (const framework of context.projectConfig.compliance.frameworks) {
        findings.push({
          category: 'compliance',
          finding: `${framework} compliance requirements apply`,
          severity: 'critical',
          recommendation: `Ensure all implementations meet ${framework} standards`,
        });
      }
    }

    // Tech stack findings
    const techStack = context.projectConfig.techStack;
    if (techStack && Object.keys(techStack).length > 0) {
      findings.push({
        category: 'technology',
        finding: `Existing tech stack: ${JSON.stringify(techStack)}`,
        severity: 'info',
        recommendation: 'Align new implementations with existing technology choices',
      });
    }

    // If no specific findings, add general analysis
    if (findings.length === 0) {
      findings.push({
        category: 'general',
        finding: 'Task requires further specification',
        severity: 'info',
        recommendation: 'Gather more detailed requirements before proceeding',
      });
    }

    return findings;
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(
    findings: AnalysisOutput['findings'],
    context: ExecutionContext
  ): string[] {
    const recommendations: string[] = [];

    // Add recommendations from findings
    for (const finding of findings) {
      if (finding.recommendation && !recommendations.includes(finding.recommendation)) {
        recommendations.push(finding.recommendation);
      }
    }

    // Add general best practices
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const warningCount = findings.filter((f) => f.severity === 'warning').length;

    if (criticalCount > 0) {
      recommendations.push('Address critical findings before implementation');
    }

    if (warningCount > 2) {
      recommendations.push('Review warnings and create mitigation plan');
    }

    // Project-specific recommendations
    if (context.projectConfig.features.gitWorktrees) {
      recommendations.push('Use git worktrees for parallel development');
    }

    // Lessons learned recommendations
    if (context.lessonsLearned.length > 0) {
      recommendations.push('Review lessons learned for applicable insights');
    }

    return recommendations;
  }

  /**
   * Generate analysis summary
   */
  private generateSummary(
    findings: AnalysisOutput['findings'],
    recommendations: string[]
  ): string {
    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const warningCount = findings.filter((f) => f.severity === 'warning').length;
    const infoCount = findings.filter((f) => f.severity === 'info').length;

    const categories = [...new Set(findings.map((f) => f.category))];

    return (
      `Analysis complete with ${findings.length} findings ` +
      `(${criticalCount} critical, ${warningCount} warnings, ${infoCount} info). ` +
      `Categories analyzed: ${categories.join(', ')}. ` +
      `${recommendations.length} recommendations provided.`
    );
  }

  /**
   * Determine next agent
   */
  private determineNextAgent(
    prompt: string,
    context: ExecutionContext
  ): AgentType {
    const lowerPrompt = prompt.toLowerCase();

    // If this is a planning task, go to PM
    if (lowerPrompt.includes('plan') || lowerPrompt.includes('implement') || lowerPrompt.includes('build')) {
      if (!context.previousOutputs.has('project-manager')) {
        return 'project-manager';
      }
    }

    // If architecture needed, go to architect
    if (
      lowerPrompt.includes('architecture') ||
      lowerPrompt.includes('design') ||
      lowerPrompt.includes('structure')
    ) {
      return 'architect';
    }

    // If PM has already run, go to architect
    if (context.previousOutputs.has('project-manager')) {
      return 'architect';
    }

    // Default to PM for task breakdown
    return 'project-manager';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    // Analyst handles research and unknown tasks
    return ['research', 'unknown', 'refactor'].includes(taskType);
  }
}

/**
 * Factory function for analyst agent
 */
export function createAnalystAgent(): AnalystAgent {
  return new AnalystAgent();
}
