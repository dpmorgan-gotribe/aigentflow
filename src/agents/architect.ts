/**
 * Architect Agent
 *
 * Makes technology decisions and generates Architecture Decision Records (ADRs).
 */

import { BaseAgent } from './base-agent.js';
import type {
  AgentMetadata,
  AgentRequest,
  AgentResult,
  AgentExecutionOptions,
  ADROutput,
  ExecutionContext,
  AgentType,
} from './types.js';

/**
 * Architect agent for technical decisions
 */
export class ArchitectAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    type: 'architect',
    name: 'Software Architect',
    description: 'Makes technology decisions and creates ADRs',
    phase: 'mvp',
    defaultConfig: {
      enabled: true,
      maxConcurrent: 3,
      timeout: 60000,
      retryCount: 1,
    },
    capabilities: [
      'architecture-design',
      'technology-selection',
      'adr-generation',
      'pattern-recommendation',
      'risk-identification',
    ],
    validStates: ['DESIGNING', 'ORCHESTRATING'],
  };

  /**
   * Execute the architect agent
   */
  protected async executeCore(
    request: AgentRequest,
    _options: Required<AgentExecutionOptions>
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const { prompt, context } = request;

    this.log.info('Architect analyzing requirements', {
      prompt: prompt.substring(0, 100),
    });

    // Generate ADR based on the request
    const adr = this.generateADR(prompt, context);

    // Identify architecture recommendations
    const architecture = this.analyzeArchitecture(prompt, context);

    // Determine next agent
    const nextAgent = this.determineNextAgent(prompt, context);

    this.log.info('ADR generated', {
      title: adr.title,
      alternativesCount: adr.alternatives.length,
      nextAgent,
    });

    return this.createSuccessResult(
      {
        adr,
        architecture,
        routingHint: {
          nextAgent,
          reasoning: 'Architecture decisions made - proceeding to implementation',
        },
      },
      startTime,
      750, // Estimated tokens
      0,
      {
        nextAgent,
        reasoning: 'ADR created, ready for implementation',
      }
    );
  }

  /**
   * Generate an Architecture Decision Record
   */
  private generateADR(prompt: string, context: ExecutionContext): ADROutput {
    const lowerPrompt = prompt.toLowerCase();

    // Determine decision title
    const title = this.extractDecisionTitle(prompt);

    // Analyze context for the decision
    const decisionContext = this.analyzeContext(prompt, context);

    // Generate decision based on analysis
    const decision = this.makeDecision(prompt, context);

    // Generate alternatives
    const alternatives = this.generateAlternatives(prompt, context);

    // Identify consequences
    const consequences = this.identifyConsequences(decision, context);

    return {
      title,
      status: 'proposed',
      context: decisionContext,
      decision,
      consequences,
      alternatives,
    };
  }

  /**
   * Extract decision title from prompt
   */
  private extractDecisionTitle(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('database')) {
      return 'Database Technology Selection';
    }
    if (lowerPrompt.includes('api') || lowerPrompt.includes('rest') || lowerPrompt.includes('graphql')) {
      return 'API Architecture Decision';
    }
    if (lowerPrompt.includes('auth')) {
      return 'Authentication Strategy';
    }
    if (lowerPrompt.includes('frontend') || lowerPrompt.includes('ui')) {
      return 'Frontend Architecture Decision';
    }
    if (lowerPrompt.includes('microservice') || lowerPrompt.includes('monolith')) {
      return 'Service Architecture Decision';
    }
    if (lowerPrompt.includes('cache') || lowerPrompt.includes('performance')) {
      return 'Caching Strategy Decision';
    }
    if (lowerPrompt.includes('deploy') || lowerPrompt.includes('infrastructure')) {
      return 'Deployment Architecture Decision';
    }

    return `Architecture Decision: ${prompt.substring(0, 50)}`;
  }

  /**
   * Analyze context for decision
   */
  private analyzeContext(prompt: string, context: ExecutionContext): string {
    const factors: string[] = [];

    // Project context
    factors.push(`Project: ${context.projectConfig.name} v${context.projectConfig.version}`);

    // Tech stack context
    const techStack = context.projectConfig.techStack;
    if (techStack && Object.keys(techStack).length > 0) {
      factors.push(`Existing tech stack: ${JSON.stringify(techStack)}`);
    }

    // Compliance context
    if (context.projectConfig.compliance.frameworks.length > 0) {
      factors.push(
        `Compliance requirements: ${context.projectConfig.compliance.frameworks.join(', ')}`
      );
    }

    // Previous outputs context
    if (context.previousOutputs.has('analyst')) {
      factors.push('Analyst research available for reference');
    }
    if (context.previousOutputs.has('project-manager')) {
      factors.push('WBS available from project manager');
    }

    return `${factors.join('. ')}. Requirement: ${prompt.substring(0, 100)}`;
  }

  /**
   * Make architecture decision
   */
  private makeDecision(prompt: string, context: ExecutionContext): string {
    const lowerPrompt = prompt.toLowerCase();
    const techStack = context.projectConfig.techStack ?? {};

    // Database decision
    if (lowerPrompt.includes('database')) {
      if (lowerPrompt.includes('nosql') || lowerPrompt.includes('document')) {
        return 'Use MongoDB for document storage with flexible schema support';
      }
      if (lowerPrompt.includes('graph')) {
        return 'Use Neo4j for graph-based data relationships';
      }
      if (lowerPrompt.includes('time series')) {
        return 'Use InfluxDB for time-series data storage';
      }
      return 'Use PostgreSQL as the primary relational database with proper indexing';
    }

    // API decision
    if (lowerPrompt.includes('api')) {
      if (lowerPrompt.includes('graphql')) {
        return 'Implement GraphQL API using Apollo Server for flexible queries';
      }
      if (lowerPrompt.includes('real-time') || lowerPrompt.includes('websocket')) {
        return 'Implement WebSocket connections alongside REST API for real-time features';
      }
      return 'Implement RESTful API following OpenAPI specification standards';
    }

    // Auth decision
    if (lowerPrompt.includes('auth')) {
      if (lowerPrompt.includes('oauth') || lowerPrompt.includes('social')) {
        return 'Implement OAuth 2.0 with support for social identity providers';
      }
      return 'Implement JWT-based authentication with secure token handling';
    }

    // Frontend decision
    if (lowerPrompt.includes('frontend') || lowerPrompt.includes('ui')) {
      if (techStack.frontend?.includes('React')) {
        return 'Continue with React, add state management with Zustand or React Query';
      }
      return 'Use React with TypeScript for type-safe frontend development';
    }

    // Service architecture
    if (lowerPrompt.includes('microservice')) {
      return 'Adopt microservices architecture with API Gateway pattern';
    }
    if (lowerPrompt.includes('monolith')) {
      return 'Use modular monolith architecture for simpler deployment';
    }

    // Default decision
    return `Implement ${prompt.substring(0, 30)}... using established patterns and best practices`;
  }

  /**
   * Generate alternative options
   */
  private generateAlternatives(
    prompt: string,
    _context: ExecutionContext
  ): ADROutput['alternatives'] {
    const lowerPrompt = prompt.toLowerCase();
    const alternatives: ADROutput['alternatives'] = [];

    if (lowerPrompt.includes('database')) {
      alternatives.push({
        option: 'PostgreSQL',
        pros: ['ACID compliant', 'Rich querying', 'Mature ecosystem'],
        cons: ['Vertical scaling limitations', 'Complex sharding'],
      });
      alternatives.push({
        option: 'MongoDB',
        pros: ['Flexible schema', 'Horizontal scaling', 'Developer friendly'],
        cons: ['No ACID by default', 'Memory usage'],
      });
    } else if (lowerPrompt.includes('api')) {
      alternatives.push({
        option: 'REST API',
        pros: ['Simple', 'Well understood', 'Cacheable'],
        cons: ['Over-fetching', 'Multiple endpoints needed'],
      });
      alternatives.push({
        option: 'GraphQL',
        pros: ['Flexible queries', 'Single endpoint', 'Type system'],
        cons: ['Complexity', 'Caching challenges'],
      });
    } else if (lowerPrompt.includes('auth')) {
      alternatives.push({
        option: 'JWT',
        pros: ['Stateless', 'Scalable', 'Cross-domain'],
        cons: ['Token size', 'Cannot revoke easily'],
      });
      alternatives.push({
        option: 'Session-based',
        pros: ['Revocable', 'Server-controlled', 'Simpler'],
        cons: ['Server state', 'Scaling challenges'],
      });
    } else {
      // Generic alternatives
      alternatives.push({
        option: 'Build custom solution',
        pros: ['Tailored to needs', 'Full control'],
        cons: ['Development time', 'Maintenance burden'],
      });
      alternatives.push({
        option: 'Use existing library/framework',
        pros: ['Faster development', 'Community support'],
        cons: ['Less flexibility', 'Dependencies'],
      });
    }

    return alternatives;
  }

  /**
   * Identify consequences of the decision
   */
  private identifyConsequences(
    decision: string,
    context: ExecutionContext
  ): string[] {
    const consequences: string[] = [];

    // Positive consequences
    consequences.push('Establishes clear technical direction for the team');
    consequences.push('Reduces future decision-making overhead');

    // Technical consequences
    if (decision.includes('PostgreSQL') || decision.includes('database')) {
      consequences.push('Requires database migration scripts for schema changes');
      consequences.push('Team needs familiarity with SQL');
    }

    if (decision.includes('GraphQL')) {
      consequences.push('Requires schema definition and resolver implementation');
      consequences.push('Frontend gains query flexibility');
    }

    if (decision.includes('JWT')) {
      consequences.push('Need secure token storage on client');
      consequences.push('Implement token refresh mechanism');
    }

    if (decision.includes('microservices')) {
      consequences.push('Increased operational complexity');
      consequences.push('Need service discovery and orchestration');
    }

    // Compliance consequences
    if (context.projectConfig.compliance.strictMode) {
      consequences.push('Implementation must pass compliance audit');
    }

    return consequences;
  }

  /**
   * Analyze overall architecture
   */
  private analyzeArchitecture(
    prompt: string,
    context: ExecutionContext
  ): Record<string, unknown> {
    const techStack = context.projectConfig.techStack ?? {};

    return {
      components: this.identifyComponents(prompt),
      patterns: this.identifyPatterns(prompt),
      techStack: {
        frontend: techStack.frontend ?? ['React', 'TypeScript'],
        backend: techStack.backend ?? ['Node.js', 'Express'],
        infrastructure: techStack.infrastructure ?? ['Docker'],
      },
      recommendations: this.generateRecommendations(prompt, context),
    };
  }

  /**
   * Identify system components
   */
  private identifyComponents(prompt: string): string[] {
    const components: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('api') || lowerPrompt.includes('backend')) {
      components.push('API Layer');
    }
    if (lowerPrompt.includes('database') || lowerPrompt.includes('storage')) {
      components.push('Data Layer');
    }
    if (lowerPrompt.includes('ui') || lowerPrompt.includes('frontend')) {
      components.push('UI Layer');
    }
    if (lowerPrompt.includes('auth')) {
      components.push('Authentication Service');
    }
    if (lowerPrompt.includes('cache')) {
      components.push('Cache Layer');
    }

    if (components.length === 0) {
      components.push('Core Application Logic');
    }

    return components;
  }

  /**
   * Identify applicable patterns
   */
  private identifyPatterns(prompt: string): string[] {
    const patterns: string[] = [];
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('api')) {
      patterns.push('Repository Pattern');
      patterns.push('Controller Pattern');
    }
    if (lowerPrompt.includes('event') || lowerPrompt.includes('queue')) {
      patterns.push('Event-Driven Architecture');
    }
    if (lowerPrompt.includes('microservice')) {
      patterns.push('API Gateway Pattern');
      patterns.push('Circuit Breaker Pattern');
    }
    if (patterns.length === 0) {
      patterns.push('MVC Pattern');
    }

    return patterns;
  }

  /**
   * Generate architecture recommendations
   */
  private generateRecommendations(
    prompt: string,
    context: ExecutionContext
  ): string[] {
    const recommendations: string[] = [];

    // Security recommendations
    recommendations.push('Implement input validation at all entry points');
    recommendations.push('Use environment variables for sensitive configuration');

    // Scalability recommendations
    if (prompt.toLowerCase().includes('scale') || prompt.toLowerCase().includes('performance')) {
      recommendations.push('Design for horizontal scaling from the start');
      recommendations.push('Implement caching strategy for frequently accessed data');
    }

    // Testing recommendations
    recommendations.push('Create integration tests for API endpoints');

    return recommendations;
  }

  /**
   * Determine next agent
   */
  private determineNextAgent(
    prompt: string,
    context: ExecutionContext
  ): AgentType {
    const lowerPrompt = prompt.toLowerCase();

    // If UI-related, go to UI designer
    if (lowerPrompt.includes('ui') || lowerPrompt.includes('frontend')) {
      return 'ui-designer';
    }

    // If API/backend related, go to backend developer
    if (lowerPrompt.includes('api') || lowerPrompt.includes('backend')) {
      return 'backend-developer';
    }

    // Default to frontend if WBS indicates UI work
    if (context.previousOutputs.has('project-manager')) {
      const pmOutput = context.previousOutputs.get('project-manager');
      const wbs = (pmOutput?.output as Record<string, unknown>)?.wbs as { tasks?: Array<{ assignedAgent: string }> };
      if (wbs?.tasks?.some((t) => t.assignedAgent === 'ui-designer')) {
        return 'ui-designer';
      }
    }

    return 'backend-developer';
  }

  /**
   * Check if agent can handle task
   */
  canHandle(taskType: string, _context: ExecutionContext): boolean {
    return ['feature', 'refactor', 'api-only'].includes(taskType);
  }
}

/**
 * Factory function for architect agent
 */
export function createArchitectAgent(): ArchitectAgent {
  return new ArchitectAgent();
}
