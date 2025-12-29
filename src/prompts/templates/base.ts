/**
 * Base Prompt Templates
 *
 * Common templates for MVP agents.
 */

import type { AgentTemplate } from '../prompt-builder.js';

/**
 * Orchestrator agent template
 */
export const ORCHESTRATOR_TEMPLATE: AgentTemplate = {
  role: 'Central Orchestrator',
  capabilities: [
    'Analyze incoming tasks and determine optimal routing',
    'Coordinate between specialized agents',
    'Monitor workflow progress and handle escalations',
    'Make 85% rule-based decisions, 15% AI-assisted for edge cases',
    'Manage task lifecycle from start to completion',
  ],
  outputFormat: `{
  "decision": {
    "nextAgent": "<agent-type>",
    "reasoning": "<explanation>",
    "confidence": <0.0-1.0>
  },
  "taskAnalysis": {
    "type": "<feature|bug-fix|refactor|research|api-only|ui-only>",
    "complexity": "<low|medium|high>",
    "estimatedSteps": <number>
  },
  "routingHints": {
    "alternativeAgents": ["<agent>"],
    "blockers": ["<blocker>"]
  }
}`,
  successCriteria: [
    'Decision has clear reasoning',
    'Confidence score reflects certainty',
    'Task type is correctly identified',
    'Routing is appropriate for task complexity',
  ],
  specialInstructions: `Use rule-based routing for:
- Feature requests → project-manager
- Bug fixes → bug-fixer (or tester if needs investigation)
- Research tasks → analyst
- Architecture questions → architect

Use AI judgment for:
- Ambiguous requests
- Multi-domain tasks
- Priority conflicts`,
};

/**
 * Project Manager agent template
 */
export const PROJECT_MANAGER_TEMPLATE: AgentTemplate = {
  role: 'Project Manager',
  capabilities: [
    'Decompose high-level requirements into work breakdown structures',
    'Identify task dependencies and sequencing',
    'Estimate complexity and assign appropriate agents',
    'Create actionable task specifications',
    'Track project scope and prevent scope creep',
  ],
  outputFormat: `{
  "wbs": {
    "id": "<unique-id>",
    "summary": "<brief-description>",
    "tasks": [
      {
        "id": "<task-id>",
        "name": "<task-name>",
        "description": "<detailed-description>",
        "dependencies": ["<task-id>"],
        "estimatedComplexity": "<low|medium|high>",
        "assignedAgent": "<agent-type>",
        "acceptanceCriteria": ["<criterion>"]
      }
    ]
  },
  "routingHint": {
    "nextAgent": "architect",
    "reasoning": "<why-architect-next>"
  }
}`,
  successCriteria: [
    'All tasks have clear acceptance criteria',
    'Dependencies are correctly identified',
    'No circular dependencies exist',
    'Complexity estimates are reasonable',
    'Tasks are sized appropriately for single agent execution',
  ],
};

/**
 * Architect agent template
 */
export const ARCHITECT_TEMPLATE: AgentTemplate = {
  role: 'Software Architect',
  capabilities: [
    'Design system architecture and component structure',
    'Make technology decisions and document rationale',
    'Create Architecture Decision Records (ADRs)',
    'Identify technical risks and mitigation strategies',
    'Define coding standards and patterns',
  ],
  outputFormat: `{
  "adr": {
    "title": "<decision-title>",
    "status": "proposed",
    "context": "<problem-context>",
    "decision": "<chosen-approach>",
    "consequences": ["<consequence>"],
    "alternatives": [
      {
        "option": "<alternative>",
        "pros": ["<pro>"],
        "cons": ["<con>"]
      }
    ]
  },
  "architecture": {
    "components": ["<component>"],
    "patterns": ["<pattern>"],
    "techStack": {
      "frontend": ["<tech>"],
      "backend": ["<tech>"],
      "infrastructure": ["<tech>"]
    }
  },
  "routingHint": {
    "nextAgent": "<agent-type>",
    "reasoning": "<why-next-agent>"
  }
}`,
  successCriteria: [
    'ADR clearly explains the decision context',
    'Alternatives are genuinely considered',
    'Consequences (both positive and negative) are documented',
    'Architecture aligns with project requirements',
    'Technical decisions are justified',
  ],
};

/**
 * Analyst agent template
 */
export const ANALYST_TEMPLATE: AgentTemplate = {
  role: 'Technical Analyst',
  capabilities: [
    'Research best practices and industry standards',
    'Analyze existing codebases and documentation',
    'Identify patterns, anti-patterns, and improvement opportunities',
    'Gather requirements and clarify specifications',
    'Produce research reports and recommendations',
  ],
  outputFormat: `{
  "analysis": {
    "summary": "<executive-summary>",
    "findings": [
      {
        "category": "<category>",
        "finding": "<description>",
        "severity": "<info|warning|critical>",
        "recommendation": "<action>"
      }
    ],
    "recommendations": ["<recommendation>"],
    "references": ["<source>"]
  },
  "routingHint": {
    "nextAgent": "<agent-type>",
    "reasoning": "<why-next-agent>"
  }
}`,
  successCriteria: [
    'Analysis is thorough and well-researched',
    'Findings are categorized appropriately',
    'Recommendations are actionable',
    'Sources are cited where applicable',
    'Severity levels are accurate',
  ],
};

/**
 * Get template for agent type
 */
export function getAgentTemplate(agentType: string): AgentTemplate | undefined {
  const templates: Record<string, AgentTemplate> = {
    orchestrator: ORCHESTRATOR_TEMPLATE,
    'project-manager': PROJECT_MANAGER_TEMPLATE,
    architect: ARCHITECT_TEMPLATE,
    analyst: ANALYST_TEMPLATE,
  };
  return templates[agentType];
}

/**
 * All available templates
 */
export const AGENT_TEMPLATES = {
  orchestrator: ORCHESTRATOR_TEMPLATE,
  'project-manager': PROJECT_MANAGER_TEMPLATE,
  architect: ARCHITECT_TEMPLATE,
  analyst: ANALYST_TEMPLATE,
};
