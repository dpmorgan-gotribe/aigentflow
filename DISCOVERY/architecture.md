# Aigentflow: Multi-Agent Orchestrator Architecture

> **Version:** 1.5.0
> **Target:** CLI-first multi-agent orchestrator (no UI)
> **Runtime:** Claude Code CLI integration
> **Ambition:** Enterprise-grade AI orchestration platform

---

## Table of Contents

**Core Architecture**
1. [Executive Summary](#1-executive-summary)
2. [Core Philosophy](#2-core-philosophy)
3. [System Architecture Overview](#3-system-architecture-overview)
4. [Agents](#4-agents)
5. [Skills](#5-skills)
6. [MCP Servers](#6-mcp-servers)

**Prompt & Context Engineering**
7. [Prompt Architecture](#7-prompt-architecture)
8. [Meta-Prompts](#8-meta-prompts)
9. [File Directory Structure](#9-file-directory-structure)

**Operations & CLI**
10. [CLI Interface Design](#10-cli-interface-design)
11. [Context Management](#11-context-management)
12. [Hooks & Guardrails](#12-hooks--guardrails)

**Security & Learning**
13. [Security & Compliance](#13-security--compliance)
14. [Learning System](#14-learning-system)
15. [Implementation Roadmap](#15-implementation-roadmap)

**Workflows & User Flows**
16. [Design-First Workflow](#16-design-first-workflow)
17. [User Flows](#17-user-flows)
18. [Project Initialization (Compliance-Aware)](#18-project-initialization-compliance-aware)
19. [Recovery & Checkpointing](#19-recovery--checkpointing)
20. [Claude Code Integration](#20-claude-code-integration)

**Self-Evolution (Post-MVP)**
21. [Self-Evolution Framework](#21-self-evolution-framework)

**System Configuration & Observability**
22. [CLAUDE.md Specification](#22-claudemd-specification)
23. [Real-Time Activity System](#23-real-time-activity-system)
24. [Configuration Hierarchy](#24-configuration-hierarchy)

**Enterprise Operations**
25. [Incident Response](#25-incident-response)
26. [GDPR Operations](#26-gdpr-operations)
27. [Compliance Dashboards](#27-compliance-dashboards)
28. [Vendor & Third-Party Security](#28-vendor--third-party-security)

**Platform Infrastructure**
29. [Model Abstraction Layer](#29-model-abstraction-layer)
30. [Multi-Tenant Security](#30-multi-tenant-security)
31. [Feature Flags](#31-feature-flags)

**Output & Rendering**
32. [GenUI Output Style](#32-genui-output-style)

**Appendices**
- [Appendix A: Universal Response Schema](#appendix-a-universal-response-schema)
- [Appendix B: Quick Reference](#appendix-b-quick-reference)
- [Appendix C: Self-Evolution Quick Reference](#appendix-c-self-evolution-quick-reference)
- [Appendix D: Tools per Agent](#appendix-d-tools-per-agent)
- [Appendix E: Complete Hooks Catalog](#appendix-e-complete-hooks-catalog)

---

## 1. Executive Summary

Aigentflow is a **CLI-first multi-agent orchestrator** that transforms Claude from a simple assistant into an intelligent coordinator managing specialized AI agents. The system addresses five critical failures from V1:

| V1 Failure | V2 Solution |
|------------|-------------|
| 2000-char context truncation | Per-agent context budgets up to 200K tokens |
| Freeform text outputs | Structured JSON schemas with validation |
| Stage-based routing lookup | Hybrid rule/AI intelligent routing |
| No feedback loops | BUILDER→TESTER→BUG_FIXER→TESTER cycles |
| Procedural orchestrator | AI agent that thinks and synthesizes |

**Key Insight:** The orchestrator is a **coordinator that thinks**, not a task queue that dispatches.

---

## 2. Core Philosophy

### 2.1 Design Principles

```yaml
principles:
  orchestrator_is_ai:
    description: "Orchestrator uses Claude for reasoning, not just dispatch"
    implication: "Can analyze, synthesize, and make judgment calls"

  structured_everything:
    description: "Every agent returns validated JSON, not freeform text"
    implication: "Orchestrator can parse and route intelligently"

  context_is_curated:
    description: "Agents receive tailored context, not everything"
    implication: "Prevents context exhaustion, improves focus"

  feedback_loops_automatic:
    description: "Failures trigger fix cycles without human intervention"
    implication: "Self-healing within retry limits"

  security_by_default:
    description: "Platform compliance baked in, project compliance optional"
    implication: "Enterprise-ready from day one"

  cli_first:
    description: "Full functionality without UI"
    implication: "Can run headless, integrate with Claude Code"
```

### 2.2 Architectural Shift

```
V1 (Failed):
  [DB Task Queue] → [Stage Lookup] → [Spawn Agent] → [Save Output] → Loop

V2 (Required):
  USER PROMPT
       │
       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │                    ORCHESTRATOR (AI Agent)                       │
  │  • Maintains full project context                                │
  │  • Synthesizes information between agents                        │
  │  • Makes intelligent routing decisions                           │
  │  • Parses structured agent outputs                               │
  │  • Implements feedback loops                                     │
  │  • Requests user input at checkpoints                            │
  └─────────────────────────────────────────────────────────────────┘
       │ Curated context          ▲ Structured JSON output
       ▼                          │
  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
  │ PLANNER │  │ BUILDER │  │ TESTER  │  │REVIEWER │
  └─────────┘  └─────────┘  └─────────┘  └─────────┘
```

---

## 3. System Architecture Overview

### 3.1 High-Level Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AIGENTFLOW SYSTEM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         CLI INTERFACE                                   │ │
│  │  aigentflow init | run | status | approve | abort | config              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                     ORCHESTRATOR CORE                                   │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │Decision      │  │State         │  │Context       │                  │ │
│  │  │Engine        │  │Machine       │  │Manager       │                  │ │
│  │  │(AI-powered)  │  │(Workflow)    │  │(Priming)     │                  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │   AGENTS    │           │   SKILLS    │           │MCP SERVERS  │       │
│  │  13+ types  │           │  4 categories│          │  5+ servers │       │
│  └─────────────┘           └─────────────┘           └─────────────┘       │
│         │                          │                          │             │
│         └──────────────────────────┼──────────────────────────┘             │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                      PERSISTENCE LAYER                                  │ │
│  │  State Store | Lesson DB | Audit Logs | Context Bundles | Secrets      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Runtime Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATION FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

USER PROMPT: "Build me a todo app with add, complete, and filter features"
         │
         ▼
┌─────────────────────┐
│ 1. PROMPT ANALYSIS  │ → Orchestrator AI analyzes intent, identifies epic
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 2. PLANNING         │ → Project Manager breaks into epics/features/tasks
└─────────────────────┘   with dependencies and compliance requirements
         │
         ▼
┌─────────────────────┐
│ 3. ARCHITECTURE     │ → Architect defines tech stack, structure, ADRs
└─────────────────────┘   (triggered for new projects/major features)
         │
         ▼
┌─────────────────────┐
│ 4. DESIGN           │ → UI Designer creates mockups
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ 5. APPROVAL GATE    │ → User approves designs before build
└─────────────────────┘
         │ ✅ Approved
         ▼
┌─────────────────────┐
│ 6. BUILD            │ → Frontend/Backend Developers implement
└─────────────────────┘   (parallel in separate worktrees)
         │
         ▼
┌─────────────────────┐
│ 7. TEST             │ → Tester runs suite, reports failures
└─────────────────────┘
         │
    ┌────┴────┐
    │ Failed? │────Yes────▶┌─────────────────────┐
    └────┬────┘            │ 8. BUG FIX LOOP     │
         │ No              │ BUG_FIXER → TESTER  │
         ▼                 │ (max 3 attempts)    │
┌─────────────────────┐    └─────────────────────┘
│ 9. REVIEW           │              │
└─────────────────────┘◀─────────────┘
         │
         ▼
┌─────────────────────┐
│ 10. COMPLETE        │ → Git commit, notify user
└─────────────────────┘
```

---

## 4. Agents

### 4.1 Agent Registry

| # | Agent | Role | Security Level | Key Outputs |
|---|-------|------|----------------|-------------|
| 1 | **Orchestrator** | Central coordinator, AI reasoning | System | Routing decisions, synthesis |
| 2 | **Project Manager** | Epic/feature/task breakdown | Internal | Plans, dependencies, estimates |
| 3 | **Architect** | Tech decisions, ADRs, structure | Internal | Architecture docs, ADRs |
| 4 | **Analyst** | Research, best practices | Internal | Research reports |
| 5 | **UI Designer** | Mockups, design tokens | Internal | HTML mockups, design specs |
| 6 | **Git Agent** | Branch/merge/worktree management | Internal | Git operations, conflict detection |
| 7 | **Frontend Developer** | UI implementation (TDD) | Internal | Components, tests |
| 8 | **Backend Developer** | API/service implementation (TDD) | Internal | Endpoints, tests |
| 9 | **Tester** | Test execution, coverage | Internal | Test reports, failures |
| 10 | **Bug Fixer** | Targeted bug fixes | Internal | Patches, fix verification |
| 11 | **Merge Conflict Resolver** | Conflict resolution | Internal | Resolved conflicts |
| 12 | **Reviewer** | Code review, lesson extraction | Internal | Review reports, lessons |
| 13 | **Project Analyzer** | Existing repo analysis | Internal | Tech stack, architecture map |
| 14 | **Compliance Agent** | Security/compliance monitoring | Restricted | Compliance reports, violations |

### 4.2 Agent Definition Schema

```yaml
# system/agents/_base_agent.yaml
_base_agent:
  schema_version: "1.0.0"

  identity:
    name: string
    description: string
    role: string
    goal: string
    backstory: string

  capabilities:
    tools_allowed: string[]
    skills_available: string[]
    max_context_tokens: number

  security:
    level: "system" | "restricted" | "internal" | "public"
    requirements: string[]

  output:
    schema: object          # JSON schema for structured output
    routing_hints: boolean  # Must include routing hints
    audit_fields: boolean   # Must include audit trail

  behavior:
    workflow: string[]      # Step-by-step workflow
    constraints: string[]   # What agent must NOT do
    escalation_triggers: string[]
```

### 4.3 Orchestrator Agent

```yaml
# system/agents/orchestrator.yaml
orchestrator:
  identity:
    name: "Orchestrator"
    role: "Central Coordinator"
    goal: "Coordinate agents to complete user requests efficiently and correctly"
    backstory: |
      You are the brain of the Aigentflow system. Unlike a simple task queue,
      you THINK about each situation, synthesize information across agents,
      and make intelligent routing decisions.

  decision_engine:
    routing_strategy: "hybrid"  # 85% deterministic rules, 15% AI reasoning

    deterministic_rules:
      - condition: "routing_hints.has_failures == true"
        action: "route_to_bug_fixer"
        priority: 1

      - condition: "routing_hints.needs_user_approval == true"
        action: "pause_and_request_approval"
        priority: 2

      - condition: "security_concern_detected"
        action: "route_to_compliance_agent"
        priority: 0  # Highest priority

    ai_reasoning_triggers:
      - "Ambiguous task requirements"
      - "Multiple valid routing options"
      - "Complex failure analysis"
      - "Stage transition decisions"
      - "Synthesis across multiple agent outputs"

  thinking_prompts:
    on_failure: |
      Tests failed with error: {error}
      Options: (a) create fix task, (b) spawn diagnostics, (c) escalate to user
      Analyze the error type and recommend the best action.

    on_ambiguity: |
      Task requirements are unclear: {task}
      Options: (a) request analyst research, (b) ask user, (c) make assumption
      Which approach minimizes risk and delay?

    on_completion: |
      All tasks complete. Verify:
      - Requirements fully met?
      - All tests passing?
      - Any concerns before notifying user?
```

### 4.4 Specialized Agent Examples

```yaml
# system/agents/project_manager.yaml
project_manager:
  identity:
    name: "Project Manager"
    role: "Work Breakdown Specialist"
    goal: "Break user requests into executable epics, features, and tasks"

  required_context:
    - user_requirements
    - architecture_summary
    - compliance_requirements
    - existing_epics

  output_schema:
    plan:
      epics:
        - id: string
          title: string
          features:
            - id: string
              title: string
              tasks:
                - id: string
                  title: string
                  type: "design" | "frontend" | "backend" | "testing" | "review"
                  dependencies: string[]
                  acceptance_criteria: string[]
                  compliance_relevant: boolean
                  estimated_complexity: "low" | "medium" | "high"

---
# system/agents/tester.yaml
tester:
  identity:
    name: "Tester"
    role: "Quality Assurance Specialist"
    goal: "Verify code correctness through comprehensive testing"

  output_schema:
    test_run:
      total_tests: number
      passed: number
      failed: number
      skipped: number
      coverage_percent: number
      failures:
        - test_name: string
          error_message: string
          source_file: string
          source_line: number
          suggested_fix: string
      security_tests:
        passed: boolean
        vulnerabilities: string[]

---
# system/agents/compliance_agent.yaml
compliance_agent:
  identity:
    name: "Compliance Agent"
    role: "Security and Compliance Guardian"
    goal: "Ensure platform and project compliance at all times"

  dual_responsibility:
    platform_compliance:
      always_active: true
      monitors:
        - "Audit log completeness"
        - "Encryption status"
        - "Access control enforcement"
        - "Secret exposure prevention"

    project_compliance:
      when_configured: true
      reads_from: "project.compliance_requirements"
      advises_agents: true
      reviews_code: true

---
# system/agents/analyst.yaml
analyst:
  identity:
    name: "Analyst"
    role: "Research and Best Practices Specialist"
    goal: "Provide researched recommendations and best practices"
    backstory: |
      You are the research arm of the team. When questions arise about
      best practices, library comparisons, or implementation approaches,
      you investigate thoroughly and provide well-reasoned recommendations.

  triggers:
    automatic:
      - "Architecture decisions needing research"
      - "Library/framework selection"
      - "Best practice verification"
      - "Performance optimization research"
    manual:
      - "Orchestrator requests research"
      - "User requests comparison/analysis"

  workflow:
    step_1: "Understand the research question"
    step_2: "Search documentation and best practices"
    step_3: "Analyze trade-offs and alternatives"
    step_4: "Provide structured recommendation"

  output_schema:
    research_report:
      question: string
      summary: string               # 2-3 sentence answer
      recommendation: string
      alternatives:
        - option: string
          pros: string[]
          cons: string[]
      sources: string[]
      confidence: number           # 0.0 - 1.0
      routing_hints:
        needs_user_decision: boolean
        suggested_option: string

  constraints:
    - "Cite sources for all claims"
    - "Present multiple options when applicable"
    - "Be explicit about confidence levels"
    - "Don't make implementation decisions - only recommend"

---
# system/agents/project_analyzer.yaml
project_analyzer:
  identity:
    name: "Project Analyzer"
    role: "Codebase Analysis Specialist"
    goal: "Understand existing codebases and generate comprehensive context"
    backstory: |
      You analyze existing repositories to understand their structure,
      patterns, tech stack, and architecture. Your analysis enables
      other agents to work effectively with unfamiliar codebases.

  triggers:
    - "Project import (aigentflow init --import)"
    - "First time working with a codebase"
    - "User requests codebase analysis"

  workflow:
    step_1_structure:
      action: "Analyze directory structure"
      outputs:
        - directory_tree
        - key_directories
        - entry_points

    step_2_tech_stack:
      action: "Detect technology stack"
      detects:
        - languages: ["Python", "TypeScript", "JavaScript", "Go", "Rust"]
        - frameworks: ["FastAPI", "Django", "Express", "React", "Vue", "Next.js"]
        - databases: ["PostgreSQL", "MySQL", "MongoDB", "SQLite", "Redis"]
        - testing: ["pytest", "Jest", "Playwright", "Cypress"]
        - build_tools: ["npm", "pip", "poetry", "cargo"]

    step_3_patterns:
      action: "Identify coding patterns"
      detects:
        - architecture: ["MVC", "Clean Architecture", "Hexagonal", "Microservices"]
        - api_style: ["REST", "GraphQL", "gRPC"]
        - state_management: ["Redux", "Zustand", "Vuex", "Context API"]
        - testing_patterns: ["Unit", "Integration", "E2E"]

    step_4_compliance:
      action: "Detect compliance indicators"
      checks:
        - "Personal data handling"
        - "Authentication implementation"
        - "Audit logging presence"
        - "Encryption usage"

    step_5_generate:
      action: "Generate context documentation"
      outputs:
        - claude.md             # Project context for Claude
        - architecture.yaml     # Structured architecture data
        - recommendations.md    # Improvement suggestions

  output_schema:
    analysis:
      project_name: string
      tech_stack:
        languages: string[]
        frontend: { framework: string, version: string }
        backend: { framework: string, version: string }
        database: { type: string, orm: string }
        testing: string[]
      architecture:
        pattern: string
        api_style: string
        key_directories: object
      code_quality:
        has_tests: boolean
        test_coverage_estimate: string
        has_linting: boolean
        has_type_checking: boolean
      compliance_indicators:
        handles_personal_data: boolean
        has_authentication: boolean
        has_audit_logging: boolean
        encryption_detected: boolean
      recommendations: string[]
      routing_hints:
        suggested_next: "architect" | "compliance_agent" | "none"
```

---

## 5. Skills

### 5.1 Skills Overview

Skills are **modular capability packs** encoding domain expertise. Unlike tools (which execute actions), skills provide knowledge and patterns.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            SKILLS ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   CODING    │  │   TESTING   │  │  SECURITY   │  │ COMPLIANCE  │        │
│  │   SKILLS    │  │   SKILLS    │  │   SKILLS    │  │   SKILLS    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│        │                │                │                │                 │
│  ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐    ┌─────┴─────┐         │
│  │ React     │    │ Jest      │    │ Secret    │    │ GDPR      │         │
│  │ Vue       │    │ Pytest    │    │ Scanning  │    │ SOC2      │         │
│  │ Python    │    │ Playwright│    │ SAST      │    │ HIPAA     │         │
│  │ TypeScript│    │ Cypress   │    │ Dep Audit │    │ PCI-DSS   │         │
│  │ Database  │    │           │    │ OWASP     │    │           │         │
│  └───────────┘    └───────────┘    └───────────┘    └───────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Skills Catalog

```yaml
skills_catalog:

  # ═══════════════════════════════════════════════════════════════════
  # CODING SKILLS
  # ═══════════════════════════════════════════════════════════════════
  coding:
    react:
      id: "coding.frontend.react"
      version: "18.x"
      provides:
        - "Component patterns (functional, hooks)"
        - "State management (useState, useReducer, Zustand)"
        - "Performance optimization (memo, useMemo, useCallback)"
        - "Testing patterns (React Testing Library)"
      required_by: ["frontend_developer"]

    vue:
      id: "coding.frontend.vue"
      version: "3.x"
      provides:
        - "Composition API patterns"
        - "Pinia state management"
        - "Vue Router integration"

    python:
      id: "coding.backend.python"
      version: "3.11+"
      provides:
        - "FastAPI endpoint patterns"
        - "Async/await best practices"
        - "Type hints and Pydantic"
        - "SQLAlchemy patterns"

    typescript:
      id: "coding.language.typescript"
      version: "5.x"
      provides:
        - "Type system patterns"
        - "Generic constraints"
        - "Utility types"

    database:
      id: "coding.database.general"
      provides:
        - "Schema design patterns"
        - "Query optimization"
        - "Migration patterns"
        - "Connection pooling"

  # ═══════════════════════════════════════════════════════════════════
  # TESTING SKILLS
  # ═══════════════════════════════════════════════════════════════════
  testing:
    jest:
      id: "testing.frontend.jest"
      provides:
        - "Unit test patterns"
        - "Mocking strategies"
        - "Snapshot testing"
        - "Coverage configuration"

    pytest:
      id: "testing.backend.pytest"
      provides:
        - "Fixture patterns"
        - "Parameterized tests"
        - "Async test patterns"
        - "Coverage with pytest-cov"

    playwright:
      id: "testing.e2e.playwright"
      provides:
        - "E2E test patterns"
        - "Page object model"
        - "Visual regression testing"
        - "Cross-browser testing"

  # ═══════════════════════════════════════════════════════════════════
  # SECURITY SKILLS
  # ═══════════════════════════════════════════════════════════════════
  security:
    secret_scanning:
      id: "security.secrets.scanner"
      provides:
        - "Pattern library for 50+ secret types"
        - "Pre-commit integration"
        - "CI/CD integration"
      patterns:
        - "AWS keys (AKIA...)"
        - "GitHub tokens (ghp_...)"
        - "Anthropic API keys (sk-ant-...)"
        - "Private keys (-----BEGIN...)"

    sast:
      id: "security.code.sast"
      provides:
        - "Static analysis rules"
        - "Vulnerability detection"
        - "Code quality metrics"

    dependency_audit:
      id: "security.deps.audit"
      provides:
        - "CVE database lookup"
        - "Snyk integration"
        - "License compliance"

    owasp_checks:
      id: "security.code.owasp"
      provides:
        - "SQL injection prevention"
        - "XSS prevention"
        - "CSRF protection"
        - "Authentication best practices"

  # ═══════════════════════════════════════════════════════════════════
  # COMPLIANCE SKILLS
  # ═══════════════════════════════════════════════════════════════════
  compliance:
    gdpr_checks:
      id: "compliance.privacy.gdpr"
      provides:
        - "Consent management patterns"
        - "Data export implementation"
        - "Right to deletion"
        - "Data minimization checks"

    soc2_checks:
      id: "compliance.security.soc2"
      provides:
        - "Access control verification"
        - "Audit logging requirements"
        - "Change management"
        - "Incident response"

    hipaa_checks:
      id: "compliance.healthcare.hipaa"
      provides:
        - "PHI handling rules"
        - "Encryption requirements"
        - "Audit trail requirements"
        - "Access logging"

    pci_checks:
      id: "compliance.payment.pci"
      provides:
        - "Card data isolation"
        - "Tokenization patterns"
        - "Secure transmission"
```

### 5.3 Skill Definition Schema

```yaml
# system/skills/coding/react.yaml
skill:
  _meta:
    id: "coding.frontend.react"
    version: "1.0.0"
    type: "skill"

  name: "React Development"
  description: "Expert patterns for React 18+ development"

  applicable_to:
    agents: ["frontend_developer"]
    file_patterns: ["*.tsx", "*.jsx"]

  patterns:
    functional_component: |
      ```tsx
      interface ${ComponentName}Props {
        // Props definition
      }

      export function ${ComponentName}({ ...props }: ${ComponentName}Props) {
        const [state, setState] = useState<StateType>(initialState);

        useEffect(() => {
          // Side effects
        }, [dependencies]);

        return (
          <div className="...">
            {/* Component content */}
          </div>
        );
      }
      ```

    zustand_store: |
      ```ts
      interface StoreState {
        items: Item[];
        setItems: (items: Item[]) => void;
        updateItemLocal: (id: string, updates: Partial<Item>) => void;
      }

      export const useStore = create<StoreState>((set, get) => ({
        items: [],
        setItems: (items) => set({ items }),
        updateItemLocal: (id, updates) => {
          set((state) => ({
            items: state.items.map((item) =>
              item.id === id ? { ...item, ...updates } : item
            ),
          }));
        },
      }));
      ```

  best_practices:
    - "Use functional components with hooks"
    - "Colocate state as close to usage as possible"
    - "Use Zustand for shared state, not prop drilling"
    - "Memoize expensive computations with useMemo"
    - "Use React.memo for components that render often with same props"

  anti_patterns:
    - "Don't use class components for new code"
    - "Don't store derived state"
    - "Don't mutate state directly"
    - "Avoid useEffect for data that should be derived"
```

---

## 6. MCP Servers

### 6.1 Required MCP Servers

```yaml
mcp_servers:

  # ═══════════════════════════════════════════════════════════════════
  # CORE SERVERS (Required)
  # ═══════════════════════════════════════════════════════════════════

  filesystem:
    priority: 1
    description: "File system operations"
    provides:
      - read_file
      - write_file
      - list_directory
      - search_files
      - delete_file
    security:
      sandboxed: true
      allowed_paths:
        - "projects/{project_id}/**"
        - "orchestrator-data/projects/{project_id}/**"
      denied_paths:
        - "**/.env"
        - "**/secrets/**"
      audit_log: true

  git:
    priority: 2
    description: "Git version control operations"
    provides:
      - git_status
      - git_commit
      - git_branch
      - git_merge
      - git_worktree
      - git_diff
    security:
      pre_commit_secret_scan: true
      block_force_push: true
      audit_log: true

  terminal:
    priority: 3
    description: "Command execution"
    provides:
      - execute_command
      - background_process
    security:
      sandboxed: true
      allowed_commands:
        - "npm"
        - "npx"
        - "pytest"
        - "python"
        - "node"
      blocked_commands:
        - "rm -rf"
        - "sudo"
        - "curl | sh"
      timeout_ms: 300000
      resource_limits:
        memory_mb: 2048
        cpu_percent: 80

  database:
    priority: 4
    description: "Database query execution"
    provides:
      - execute_query
      - schema_info
    security:
      parameterized_only: true
      readonly_default: true
      blocked_operations:
        - DROP
        - TRUNCATE
        - DELETE_WITHOUT_WHERE
      audit_log: true

  # ═══════════════════════════════════════════════════════════════════
  # INTEGRATION SERVERS (Optional)
  # ═══════════════════════════════════════════════════════════════════

  github:
    priority: 5
    description: "GitHub API integration"
    provides:
      - create_pr
      - list_issues
      - create_issue
      - get_pr_comments
    config:
      token_env: "GITHUB_TOKEN"

  web:
    priority: 6
    description: "Web research and API calls"
    provides:
      - web_search
      - fetch_url
    security:
      allowed_domains:
        - "*.anthropic.com"
        - "*.github.com"
        - "*.stackoverflow.com"
      rate_limit:
        requests_per_minute: 30

  memory:
    priority: 7
    description: "Persistent context storage"
    provides:
      - store_memory
      - retrieve_memory
      - search_memories
```

### 6.2 MCP Configuration

```json
// .mcp.json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "./projects", "./orchestrator-data"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"]
    },
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-sqlite", "--db-path", "./orchestrator-data/aigentflow.db"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

---

## 7. Prompt Architecture

### 7.1 18-Layer Prompt Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        18-LAYER PROMPT HIERARCHY                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  IDENTITY LAYER (Rarely changes)                                            │
│  ├── 1. System Purpose      "You are part of Aigentflow..."                │
│  ├── 2. Agent Goals         "Your goal is to..."                           │
│  └── 3. Role Specialization "You are a Backend Developer..."               │
│                                                                              │
│  OPERATIONAL LAYER (Changes by task type)                                   │
│  ├── 4. Workflow Instructions  "For API endpoints: 1. Read spec..."        │
│  ├── 5. Output Format          "Return JSON matching schema..."            │
│  └── 6. Behavioral Instructions "NEVER hardcode values..."                 │
│                                                                              │
│  CONTEXT LAYER (Changes frequently)                                         │
│  ├── 7. Project Metadata     { name, stack, compliance... }                │
│  ├── 8. Codebase Structure   { directories, patterns... }                  │
│  └── 9. Relevant Files       { file contents, dependencies... }            │
│                                                                              │
│  REASONING LAYER (Enables decisions)                                        │
│  ├── 10. Control Flow        "If ambiguous → request clarification"        │
│  ├── 11. Variables           { task_id, timestamp, user_id... }            │
│  ├── 12. Examples            Few-shot demonstrations                        │
│  └── 13. Delegation Prompt   "If you need X → request from Analyst"        │
│                                                                              │
│  META LAYER (Advanced behaviors)                                             │
│  ├── 14. Expertise Injection  Relevant lessons, best practices             │
│  ├── 15. Higher-Order         "Think step by step..."                      │
│  ├── 16. Template Usage       "Use templates in /templates/..."            │
│  ├── 17. Self-Improving       "Note patterns that worked well..."          │
│  └── 18. Template Structure   Actual output template                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Token Allocation

```yaml
token_allocation:
  total_budget: 100000  # 100K tokens per agent invocation

  allocation:
    system_prompt: 5000      # 5%  - Identity layers (1-3)
    tools: 10000             # 10% - Available MCP tools
    examples: 15000          # 15% - Few-shot demonstrations
    context: 50000           # 50% - Project context, files, specs
    message_history: 15000   # 15% - Conversation state
    buffer: 5000             # 5%  - Response generation space

  per_agent_budgets:
    orchestrator: 30000      # Needs broad context
    project_manager: 40000   # Large plans
    architect: 40000         # Architecture docs
    ui_designer: 35000       # Design specs
    frontend_developer: 50000 # Code context
    backend_developer: 50000  # Code context
    tester: 40000            # Test results
    bug_fixer: 45000         # Error context + code
    reviewer: 50000          # Full diff + standards
```

### 7.3 Prompt Composition Patterns

```yaml
prompt_composition:

  sequential:
    description: "Chain layers in order"
    pattern: "[System] → [Role] → [Workflow] → [Context] → [Examples] → [Task]"
    use_when: "Standard agent invocation"

  hierarchical:
    description: "Nest with increasing specificity"
    pattern: |
      System Identity
      └── Agent Role
          └── Task Type
              └── Specific Context
                  └── Current Task
    use_when: "Complex multi-step tasks"

  conditional:
    description: "Activate layers based on conditions"
    rules:
      - condition: "task.complexity == 'high'"
        activate: "[15. Higher-Order thinking]"

      - condition: "agent == 'bug_fixer'"
        activate: "[12. Bug fix examples]"

      - condition: "project.compliance.includes('GDPR')"
        activate: "[14. GDPR expertise injection]"
```

---

## 8. Meta-Prompts

### 8.1 Meta-Prompt Categories

Meta-prompts are **prompts about prompting** - they govern how agents construct and use prompts.

```yaml
meta_prompts:

  # ═══════════════════════════════════════════════════════════════════
  # SYSTEM IDENTITY META-PROMPT
  # ═══════════════════════════════════════════════════════════════════
  system_identity:
    purpose: "Establish core system identity"
    location: "system/prompts/meta/system_identity.yaml"
    content: |
      You are part of Aigentflow, an enterprise multi-agent orchestration system.

      CORE PRINCIPLES:
      1. You work collaboratively with specialized agents under orchestrator coordination
      2. You return structured JSON outputs that enable intelligent routing
      3. You operate within security and compliance constraints
      4. You learn from experience and apply lessons to future work
      5. You escalate when uncertain rather than guessing

      COLLABORATION:
      - The Orchestrator coordinates all agent activity
      - You may request information from other agents via routing_hints
      - You share context through structured handoffs, not raw dumps
      - You respect agent boundaries - don't do another agent's job

  # ═══════════════════════════════════════════════════════════════════
  # HIGHER-ORDER META-PROMPT
  # ═══════════════════════════════════════════════════════════════════
  higher_order:
    purpose: "Enable advanced reasoning and self-reflection"
    triggers:
      - "Complex architectural decisions"
      - "Ambiguous requirements"
      - "Multiple valid approaches"
    content: |
      APPROACH THIS TASK METHODICALLY:

      1. UNDERSTAND: Before acting, ensure you fully understand the scope
         - What is being asked?
         - What are the constraints?
         - What information is missing?

      2. PLAN: Think through your approach before implementing
         - What are the steps?
         - What could go wrong?
         - What are the dependencies?

      3. CONSIDER ALTERNATIVES: Are there other approaches?
         - What are the trade-offs?
         - Why choose this approach?

      4. VALIDATE: Before submitting, verify your output
         - Does it meet requirements?
         - Is it consistent with existing patterns?
         - Have you considered edge cases?

      5. DOCUMENT: Explain your decisions
         - Why this approach?
         - What assumptions did you make?

  # ═══════════════════════════════════════════════════════════════════
  # SELF-IMPROVING META-PROMPT
  # ═══════════════════════════════════════════════════════════════════
  self_improving:
    purpose: "Enable learning and lesson extraction"
    content: |
      AFTER COMPLETING THIS TASK, REFLECT:

      1. WHAT WORKED WELL?
         - Note patterns that were effective
         - Identify reusable approaches

      2. WHAT WAS CHALLENGING?
         - Document obstacles encountered
         - Note how they were resolved

      3. WHAT WOULD YOU DO DIFFERENTLY?
         - Identify improvements for next time
         - Note any assumptions that were wrong

      4. POTENTIAL LESSONS:
         - Extract generalizable insights
         - Score by impact and applicability

      Record your reflections in the 'observations' field of your output.
      High-value lessons will be reviewed and potentially added to the knowledge base.

  # ═══════════════════════════════════════════════════════════════════
  # ROUTING DECISION META-PROMPT
  # ═══════════════════════════════════════════════════════════════════
  routing_decision:
    purpose: "Guide orchestrator's routing decisions"
    used_by: "orchestrator"
    content: |
      ANALYZE THIS AGENT OUTPUT AND DECIDE NEXT ACTION:

      INPUT: {agent_response}

      DECISION FRAMEWORK:

      1. STATUS CHECK:
         - Is status success/failed/blocked/needs_approval?
         - If failed, what type of failure?

      2. ROUTING HINTS:
         - Does agent suggest next action?
         - Are there blocking dependencies?
         - Is user input required?

      3. FAILURE ANALYSIS (if applicable):
         - Is this a recoverable failure?
         - Should we retry, fix, or escalate?
         - Have we exceeded retry limits?

      4. SYNTHESIS:
         - Does this output affect other pending tasks?
         - Should we update the project plan?
         - Are there compliance implications?

      RESPOND WITH:
      {
        "decision": "route" | "pause" | "escalate" | "complete",
        "reasoning": "Step-by-step analysis",
        "next_action": {...}
      }
```

### 8.2 Agent-Specific Prompts

```yaml
# system/prompts/agents/backend_developer_prompt.yaml
backend_developer_prompt:
  layers:
    identity: |
      You are the Backend Developer agent in Aigentflow.
      You specialize in Python, FastAPI, SQLAlchemy, and API development.

    goal: |
      Your goal is to implement robust, secure, well-tested backend code
      that follows established patterns and meets acceptance criteria.

    workflow: |
      FOR EACH IMPLEMENTATION TASK:

      1. READ existing patterns in the codebase
         - Check similar endpoints for patterns
         - Review database models for conventions
         - Understand the API contract

      2. IMPLEMENT following TDD:
         - Write failing tests first
         - Implement minimal code to pass
         - Refactor while keeping tests green

      3. VERIFY:
         - All tests pass
         - No security vulnerabilities introduced
         - Code follows project patterns

      4. DOCUMENT:
         - Update API documentation
         - Add inline comments for complex logic

    constraints: |
      YOU MUST:
      - Use parameterized queries (no SQL injection)
      - Hash passwords with bcrypt/argon2
      - Validate ALL inputs server-side
      - Include error handling
      - Add audit logging for sensitive operations

      YOU MUST NOT:
      - Hardcode secrets or credentials
      - Return stack traces in error responses
      - Skip input validation
      - Implement frontend code

    output_format: |
      Return JSON matching this schema:
      {
        "status": "success" | "failed" | "blocked",
        "data": {
          "files_created": ["path/to/file.py"],
          "files_modified": ["path/to/existing.py"],
          "endpoints_created": ["/api/v1/resource"],
          "tests_created": ["test_resource.py"],
          "dependencies_added": []
        },
        "routing_hints": {
          "needs_user_approval": false,
          "has_failures": false,
          "suggested_next": "tester"
        },
        "audit": {
          "files_read": [],
          "files_modified": [],
          "duration_ms": 0,
          "tokens_used": 0
        }
      }
```

---

## 9. File Directory Structure

### 9.1 Complete Workspace Layout

```
workspace/
│
├── orchestrator-system/                    # PLATFORM CODE
│   ├── src/
│   │   ├── orchestrator/
│   │   │   ├── core/
│   │   │   │   ├── orchestrator.py         # Main orchestrator
│   │   │   │   ├── decision_engine.py      # AI routing decisions
│   │   │   │   ├── state_machine.py        # Workflow states
│   │   │   │   └── context_manager.py      # Context priming
│   │   │   │
│   │   │   ├── agents/
│   │   │   │   ├── base_agent.py
│   │   │   │   ├── project_manager.py
│   │   │   │   ├── architect.py
│   │   │   │   ├── ui_designer.py
│   │   │   │   ├── frontend_developer.py
│   │   │   │   ├── backend_developer.py
│   │   │   │   ├── tester.py
│   │   │   │   ├── bug_fixer.py
│   │   │   │   ├── reviewer.py
│   │   │   │   ├── git_agent.py
│   │   │   │   ├── compliance_agent.py
│   │   │   │   ├── project_analyzer.py
│   │   │   │   └── merge_conflict_resolver.py
│   │   │   │
│   │   │   ├── tools/
│   │   │   │   ├── filesystem.py
│   │   │   │   ├── git.py
│   │   │   │   ├── code_execute.py
│   │   │   │   └── security_scan.py
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── hook_engine.py
│   │   │   │   └── builtin_hooks.py
│   │   │   │
│   │   │   ├── compliance/
│   │   │   │   ├── audit_logger.py
│   │   │   │   ├── secret_scanner.py
│   │   │   │   └── compliance_checker.py
│   │   │   │
│   │   │   └── cli/
│   │   │       ├── main.py                  # CLI entry point
│   │   │       ├── commands/
│   │   │       │   ├── init.py
│   │   │       │   ├── run.py
│   │   │       │   ├── status.py
│   │   │       │   ├── approve.py
│   │   │       │   └── config.py
│   │   │       └── formatters/
│   │   │           ├── table.py
│   │   │           └── json.py
│   │   │
│   │   └── utils/
│   │
│   ├── tests/
│   └── pyproject.toml
│
├── orchestrator-data/                       # ALL ORCHESTRATOR STATE
│   │
│   ├── system/                              # Platform-wide configs
│   │   │
│   │   ├── agents/                          # Agent definitions
│   │   │   ├── _base_agent.yaml
│   │   │   ├── orchestrator.yaml
│   │   │   ├── project_manager.yaml
│   │   │   ├── architect.yaml
│   │   │   ├── ui_designer.yaml
│   │   │   ├── frontend_developer.yaml
│   │   │   ├── backend_developer.yaml
│   │   │   ├── tester.yaml
│   │   │   ├── bug_fixer.yaml
│   │   │   ├── reviewer.yaml
│   │   │   ├── git_agent.yaml
│   │   │   ├── compliance_agent.yaml
│   │   │   ├── project_analyzer.yaml
│   │   │   └── merge_conflict_resolver.yaml
│   │   │
│   │   ├── skills/                          # Skill definitions
│   │   │   ├── coding/
│   │   │   │   ├── react.yaml
│   │   │   │   ├── vue.yaml
│   │   │   │   ├── python.yaml
│   │   │   │   ├── typescript.yaml
│   │   │   │   └── database.yaml
│   │   │   ├── testing/
│   │   │   │   ├── jest.yaml
│   │   │   │   ├── pytest.yaml
│   │   │   │   └── playwright.yaml
│   │   │   ├── security/
│   │   │   │   ├── secret_scanning.yaml
│   │   │   │   ├── sast.yaml
│   │   │   │   └── owasp_checks.yaml
│   │   │   └── compliance/
│   │   │       ├── gdpr_checks.yaml
│   │   │       ├── soc2_checks.yaml
│   │   │       └── hipaa_checks.yaml
│   │   │
│   │   ├── prompts/                         # Prompt templates
│   │   │   ├── meta/
│   │   │   │   ├── system_identity.yaml
│   │   │   │   ├── higher_order.yaml
│   │   │   │   ├── self_improving.yaml
│   │   │   │   └── routing_decision.yaml
│   │   │   ├── agents/
│   │   │   │   └── {agent_name}_prompt.yaml
│   │   │   └── templates/
│   │   │       ├── task_assignment.yaml
│   │   │       ├── handoff.yaml
│   │   │       └── escalation.yaml
│   │   │
│   │   ├── guardrails/                      # Safety guardrails
│   │   │   ├── input/
│   │   │   │   ├── prompt_injection.yaml
│   │   │   │   └── pii_detection.yaml
│   │   │   ├── output/
│   │   │   │   ├── secret_leakage.yaml
│   │   │   │   └── format_validation.yaml
│   │   │   └── code/
│   │   │       ├── sql_injection.yaml
│   │   │       ├── xss_prevention.yaml
│   │   │       └── hardcoded_secrets.yaml
│   │   │
│   │   ├── hooks/                           # Hook definitions
│   │   │   ├── lifecycle/
│   │   │   │   ├── agent_spawn.yaml
│   │   │   │   └── agent_complete.yaml
│   │   │   ├── security/
│   │   │   │   └── secret_detected.yaml
│   │   │   └── workflow/
│   │   │       └── design_approved.yaml
│   │   │
│   │   ├── mcps/                            # MCP server configs
│   │   │   ├── filesystem.yaml
│   │   │   ├── git.yaml
│   │   │   └── database.yaml
│   │   │
│   │   └── compliance/                      # Platform compliance
│   │       ├── environment_compliance.yaml
│   │       ├── compliance_debt.yaml
│   │       └── controls/
│   │           ├── soc2_controls.yaml
│   │           └── gdpr_controls.yaml
│   │
│   ├── user/{user_id}/                      # Per-user data
│   │   ├── preferences.yaml
│   │   ├── learnings/
│   │   │   └── lessons.db                   # SQLite with embeddings
│   │   └── secrets/
│   │       └── vault.encrypted
│   │
│   └── projects/{project_id}/               # Per-project data
│       ├── project.yaml                     # Project configuration
│       │
│       ├── .orchestrator/                   # Orchestrator state
│       │   ├── state.json                   # Current state
│       │   ├── history.json                 # State history
│       │   ├── activity.log                 # Activity stream
│       │   └── task_queue.json              # Pending tasks
│       │
│       ├── .agents/                         # Agent overrides
│       ├── .skills/                         # Skill overrides
│       ├── .hooks/                          # Project hooks
│       ├── .lessons/                        # Project learnings
│       │
│       ├── architecture/                    # Architecture docs
│       │   ├── architecture.yaml
│       │   ├── security_architecture.yaml
│       │   ├── diagrams/
│       │   └── adrs/
│       │
│       ├── compliance/                      # Project compliance
│       │   ├── project_compliance.yaml
│       │   ├── control_status.yaml
│       │   └── audit_log/
│       │
│       ├── designs/                         # Design mockups
│       │   ├── approved/
│       │   ├── pending/
│       │   └── styleguide/
│       │
│       ├── context_bundles/                 # Context snapshots
│       │
│       └── claude.md                        # Project context file
│
├── projects/                                # USER SOURCE CODE
│   └── {project_id}/
│       ├── .git/                            # User's git repo
│       ├── src/
│       ├── tests/
│       └── ...
│
└── worktrees/                               # GIT WORKTREES
    └── {project_id}/
        ├── feature-auth-system/
        ├── feature-dashboard/
        └── bugfix-login-error/
```

### 9.2 Overlay Pattern

The orchestrator maintains a **parallel overlay** that never modifies user source repos directly:

```yaml
overlay_pattern:
  principle: "Orchestrator data lives OUTSIDE project repos"

  user_source_files:
    location: "projects/{project_id}/**"
    orchestrator_access: "read + write via git workflow"

  orchestrator_state:
    location: "orchestrator-data/projects/{project_id}/**"
    orchestrator_access: "direct read/write"

  benefits:
    - "Clean separation of concerns"
    - "Easy to remove orchestrator without affecting source"
    - "No merge conflicts with orchestrator files"
    - "Project repo stays clean for external developers"
```

---

## 10. CLI Interface Design

### 10.1 Command Overview

```bash
aigentflow - Multi-Agent Orchestrator CLI

COMMANDS:
  init        Initialize a new project or import existing repo
  run         Execute a prompt through the orchestrator
  status      Show current orchestration status
  approve     Approve pending designs/changes
  reject      Reject pending designs/changes with feedback
  abort       Stop current orchestration
  resume      Resume paused orchestration
  config      View/edit configuration
  agents      List and manage agents
  lessons     View and manage learned lessons
  logs        View activity logs
  export      Export project data

USAGE:
  aigentflow init [--import <repo-url>]
  aigentflow run "<prompt>"
  aigentflow status [--json] [--watch]
  aigentflow approve <item-id>
  aigentflow reject <item-id> --feedback "<feedback>"
  aigentflow abort [--force]
  aigentflow resume
  aigentflow config [set|get|list] [key] [value]
  aigentflow agents [list|show|enable|disable] [agent-name]
  aigentflow lessons [list|search|export] [query]
  aigentflow logs [--tail] [--filter <agent>]
```

### 10.2 Command Details

```yaml
cli_commands:

  init:
    description: "Initialize new or import existing project"
    flags:
      --import: "URL of existing repo to import"
      --compliance: "Compliance frameworks (comma-separated)"
      --stack: "Tech stack preset (react-fastapi, vue-django, etc.)"
    workflow:
      new_project:
        - "Create project directory"
        - "Initialize git repository"
        - "Create orchestrator overlay structure"
        - "Gather compliance requirements"
        - "Spawn Architect for initial setup"
      import_project:
        - "Clone repository"
        - "Run security scan (blocking)"
        - "Spawn Project Analyzer"
        - "Detect compliance indicators"
        - "Create overlay structure"
        - "Generate claude.md"

  run:
    description: "Execute prompt through orchestrator"
    args:
      prompt: "Natural language request"
    flags:
      --agent: "Route directly to specific agent"
      --async: "Return immediately, check status later"
      --dry-run: "Show plan without executing"
    output:
      streaming: true
      format: "Colored terminal output with spinners"

  status:
    description: "Show orchestration status"
    flags:
      --json: "Output as JSON"
      --watch: "Auto-refresh every 2 seconds"
    displays:
      - "Current phase (planning/building/testing/etc.)"
      - "Active agents and their tasks"
      - "Pending approvals"
      - "Recent activity"
      - "Error count"

  approve:
    description: "Approve pending design or change"
    args:
      item_id: "ID of item to approve"
    workflow:
      - "Mark item as approved"
      - "Unblock dependent tasks"
      - "Resume orchestration"

  logs:
    description: "View activity logs"
    flags:
      --tail: "Follow log output"
      --filter: "Filter by agent name"
      --level: "Filter by level (info/warn/error)"
      --since: "Show logs since timestamp"
```

### 10.3 CLI Output Formatting

```
$ aigentflow run "Build a todo app with add, complete, and filter"

┌─────────────────────────────────────────────────────────────────────────────┐
│  AIGENTFLOW                                                    v1.0.0       │
└─────────────────────────────────────────────────────────────────────────────┘

[10:42:15] ORCHESTRATOR → Analyzing request...

[10:42:17] ORCHESTRATOR → Detected: Todo App feature
           • Add new todo
           • Mark todo complete
           • Filter todos

[10:42:18] ORCHESTRATOR → Spawning PROJECT_MANAGER...

[10:42:25] PROJECT_MANAGER → Created plan:

           EPIC: Todo App
           ├── Feature: Add Todo
           │   ├── Task: Design add todo UI          [design]
           │   ├── Task: Create Todo API endpoint    [backend]
           │   └── Task: Build AddTodo component     [frontend]
           ├── Feature: Complete Todo
           │   └── ...
           └── Feature: Filter Todos
               └── ...

           Total: 9 tasks, 3 parallel tracks

[10:42:26] ORCHESTRATOR → Spawning UI_DESIGNER for design tasks...

[10:42:45] UI_DESIGNER → Mockup created: designs/pending/todo-app-v1.html

┌─────────────────────────────────────────────────────────────────────────────┐
│  ⏸️  APPROVAL REQUIRED                                                       │
│                                                                              │
│  Design mockup ready for review                                              │
│  Preview: file://./designs/pending/todo-app-v1.html                          │
│                                                                              │
│  Commands:                                                                   │
│    aigentflow approve design-001                                             │
│    aigentflow reject design-001 --feedback "..."                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Waiting for approval... (Ctrl+C to background)
```

---

## 11. Context Management

### 11.1 Context Bundle Schema

```yaml
context_bundle:
  description: "Complete state package for agent invocation"

  schema:
    bundle_id: string
    version: "1.0.0"
    created_at: timestamp
    agent_type: string
    task_id: string

    sections:
      - name: string
        type: "required" | "optional"
        content: string
        token_count: number
        source: string
        freshness: timestamp

    checkpoint:
      state_hash: string
      can_resume_from: boolean

    audit:
      context_sources: string[]
      sensitive_data_present: boolean
      pii_redacted: boolean
```

### 11.2 Per-Agent Context Profiles

```yaml
context_profiles:

  orchestrator:
    required:
      - project_state           # Current workflow state
      - active_tasks            # All in-progress tasks
      - agent_statuses          # What each agent is doing
      - recent_decisions        # Last 5 routing decisions
      - pending_approvals       # Items awaiting user input
    optional:
      - error_history           # Recent errors
      - performance_metrics     # Token usage, costs
    max_tokens: 30000

  project_manager:
    required:
      - project_requirements    # User's original request
      - architecture_summary    # High-level architecture
      - existing_epics          # Current plan structure
      - completed_tasks         # What's been done
    optional:
      - user_preferences        # Communication style
      - compliance_requirements
    max_tokens: 40000

  frontend_developer:
    required:
      - approved_design         # Mockup to implement
      - api_specification       # Available endpoints
      - component_library       # Existing components
      - coding_standards        # Style guide
    optional:
      - test_patterns
      - performance_requirements
    max_tokens: 50000

  bug_fixer:
    required:
      - failure_details         # Exact error, stack trace
      - failed_test_code        # The failing test
      - source_file_content     # The buggy code
      - recent_changes          # Git diff
      - previous_fix_attempts   # What didn't work
    max_tokens: 45000
```

### 11.3 Context Retrieval Strategy

```yaml
context_retrieval:

  hybrid_approach:
    description: "Pre-load essential (20%), JIT for rest"
    recommended: true

    pre_load:
      - "Task specification"
      - "Acceptance criteria"
      - "Architecture constraints"
      - "Recent relevant lessons"

    just_in_time:
      - "File contents (on demand)"
      - "Test results (when testing)"
      - "Error details (when fixing)"

  relevance_scoring:
    formula: |
      relevance = (
        semantic_similarity * 0.40 +
        lexical_match * 0.25 +
        recency_score * 0.15 +
        metadata_match * 0.20
      )
    thresholds:
      high_precision: 0.85
      balanced: 0.70
      high_recall: 0.55
```

---

## 12. Hooks & Guardrails

### 12.1 Hook Categories

```yaml
hooks:

  # ═══════════════════════════════════════════════════════════════════
  # AGENT LIFECYCLE HOOKS
  # ═══════════════════════════════════════════════════════════════════
  agent_lifecycle:
    AGENT_SPAWN_BEFORE:
      description: "Before agent is spawned"
      can_cancel: true
      payload: { agent_type, task_id, context_size }

    AGENT_SPAWN_AFTER:
      description: "After agent is spawned"
      payload: { agent_id, agent_type, spawn_timestamp }

    AGENT_RESPONSE_COMPLETE:
      description: "When agent completes response"
      payload: { agent_id, response, duration_ms, tokens_used }

    AGENT_ERROR:
      description: "When agent encounters error"
      payload: { agent_id, error, recoverable }

  # ═══════════════════════════════════════════════════════════════════
  # SECURITY HOOKS
  # ═══════════════════════════════════════════════════════════════════
  security:
    SECRET_DETECTED:
      description: "When secret is detected in content"
      action: "BLOCK"
      compliance_critical: true
      payload: { content_type, secret_type, location }

    FILE_WRITE_BEFORE:
      description: "Before any file write"
      can_cancel: true
      can_modify_content: true
      payload: { path, content, agent_id }

    GIT_COMMIT_BEFORE:
      description: "Before git commit"
      can_cancel: true
      payload: { files, message, branch }

  # ═══════════════════════════════════════════════════════════════════
  # WORKFLOW HOOKS
  # ═══════════════════════════════════════════════════════════════════
  workflow:
    DESIGN_SUBMITTED:
      description: "Designer submits mockup"
      payload: { design_id, mockup_path }

    DESIGN_APPROVED:
      description: "User approves design"
      action: "Unblock dependent build tasks"
      payload: { design_id, approved_by }

    TEST_RUN_COMPLETE:
      description: "Test suite completes"
      payload: { passed, failed, failures }

  # ═══════════════════════════════════════════════════════════════════
  # LEARNING HOOKS
  # ═══════════════════════════════════════════════════════════════════
  learning:
    LESSON_CANDIDATE_IDENTIFIED:
      description: "Potential lesson identified"
      payload: { lesson, source_agent, context }

    LESSON_COMMITTED:
      description: "Lesson added to knowledge base"
      payload: { lesson_id, category }
```

### 12.2 Guardrails Framework

```yaml
guardrails:

  input_guardrails:
    prompt_injection:
      patterns:
        - "ignore previous instructions"
        - "you are now"
        - "disregard your"
      action: "BLOCK"

    pii_detection:
      patterns:
        - "SSN: \\d{3}-\\d{2}-\\d{4}"
        - "Credit Card: \\d{4}[- ]?\\d{4}"
      action: "REDACT"

  output_guardrails:
    secret_leakage:
      patterns:
        - "AKIA[0-9A-Z]{16}"           # AWS Access Key
        - "sk-ant-[a-zA-Z0-9-]{40,}"   # Anthropic Key
        - "ghp_[0-9a-zA-Z]{36}"        # GitHub Token
      action: "BLOCK"

  code_guardrails:
    sql_injection:
      check: "parameterized_queries_only"
      action: "BLOCK"

    xss_prevention:
      check: "output_encoding"
      action: "WARN"

    hardcoded_secrets:
      patterns:
        - "password\\s*=\\s*['\"][^'\"]+['\"]"
        - "api_key\\s*=\\s*['\"][^'\"]+['\"]"
      action: "BLOCK"
```

---

## 13. Security & Compliance

### 13.1 Two-Tier Compliance Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     TWO-TIER COMPLIANCE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TIER 1: PLATFORM COMPLIANCE (Mandatory)                                    │
│  ════════════════════════════════════════                                   │
│  Our obligations as a SaaS platform                                         │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    GDPR     │  │   SOC 2     │  │  Security   │  │   Audit     │        │
│  │  Platform   │  │  Type I/II  │  │  Controls   │  │  Logging    │        │
│  │  User Data  │  │             │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  Enforced by: Platform code (not configurable)                              │
│  Applies to: ALL projects regardless of user settings                       │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TIER 2: PROJECT COMPLIANCE (User-Defined)                                  │
│  ════════════════════════════════════════                                   │
│  Per-project requirements chosen by user                                    │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    GDPR     │  │   HIPAA     │  │  PCI-DSS    │  │   Custom    │        │
│  │  (Project)  │  │ Healthcare  │  │  Payments   │  │   Rules     │        │
│  │             │  │             │  │             │  │             │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
│                                                                              │
│  Optional: Hobby projects can have NONE                                     │
│  Applies to: Generated code for user's project                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.2 Environment-Aware Compliance

```yaml
environment_compliance:

  local:
    description: "Developer's local machine"
    compliance_level: "minimal"
    enabled:
      - "Basic auth"
      - "Console logging"
      - "Secret scanning on commit"  # ALWAYS
    disabled:
      - "MFA enforcement"
      - "Audit log integrity"
      - "Encryption at rest"

  development:
    description: "Shared dev server / CI"
    compliance_level: "basic"
    enabled:
      - "Structured logging"
      - "Basic RBAC"
      - "Dependency scanning"

  staging:
    description: "Pre-production"
    compliance_level: "full_minus_external"
    enabled:
      - "MFA required"
      - "Full RBAC"
      - "Encryption at rest/transit"
      - "SAST scanning"

  production:
    description: "Live system"
    compliance_level: "full"
    mandatory:
      - "MFA for all users"
      - "Tamper-proof audit logging"
      - "Encryption (AES-256)"
      - "Secret scanning (blocks deploy)"
      - "SOC 2 evidence collection"
      - "Quarterly access reviews"
```

### 13.3 Secret Detection Patterns

```yaml
secret_patterns:

  cloud_providers:
    - name: "AWS Access Key ID"
      pattern: "AKIA[0-9A-Z]{16}"
      severity: "critical"

    - name: "AWS Secret Access Key"
      pattern: "[0-9a-zA-Z/+]{40}"
      context: "aws_secret|secret_access_key"
      severity: "critical"

    - name: "Google Cloud API Key"
      pattern: "AIza[0-9A-Za-z-_]{35}"
      severity: "critical"

  api_keys:
    - name: "Anthropic API Key"
      pattern: "sk-ant-[a-zA-Z0-9-]{40,}"
      severity: "critical"

    - name: "OpenAI API Key"
      pattern: "sk-[a-zA-Z0-9]{48}"
      severity: "critical"

    - name: "GitHub Token"
      pattern: "ghp_[0-9a-zA-Z]{36}"
      severity: "critical"

  private_keys:
    - name: "RSA Private Key"
      pattern: "-----BEGIN RSA PRIVATE KEY-----"
      severity: "critical"

    - name: "OpenSSH Private Key"
      pattern: "-----BEGIN OPENSSH PRIVATE KEY-----"
      severity: "critical"
```

---

## 14. Learning System

### 14.1 Lesson Scoring Algorithm

```yaml
lesson_scoring:

  dimensions:
    impact:
      weight: 0.30
      scale:
        5: "Critical - prevents major failures"
        4: "High - prevents significant bugs"
        3: "Medium - improves quality meaningfully"
        2: "Low - minor improvement"
        1: "Minimal - barely noticeable"

    generalizability:
      weight: 0.25
      scale:
        5: "Universal - applies to all projects"
        4: "Broad - applies to most projects"
        3: "Moderate - applies to similar features"
        2: "Narrow - specific technology"
        1: "Specific - only this situation"

    actionability:
      weight: 0.20
      scale:
        5: "Crystal clear - immediately applicable"
        4: "Clear - straightforward to implement"
        3: "Moderate - requires interpretation"
        2: "Vague - guidance but not specific"
        1: "Abstract - hard to apply"

    novelty:
      weight: 0.15
      scale:
        5: "Completely new insight"
        4: "New angle on existing knowledge"
        3: "Reinforces with new context"
        2: "Mostly duplicates existing"
        1: "Exact duplicate"

    recurrence_potential:
      weight: 0.10
      scale:
        5: "Very common - frequent occurrence"
        4: "Common - regular occurrence"
        3: "Occasional - happens sometimes"
        2: "Rare - unusual circumstance"
        1: "One-off - unique situation"

  thresholds:
    commit: 3.5          # Score >= 3.5: auto-commit
    review: 2.5          # Score 2.5-3.5: human review
    discard: 2.5         # Score < 2.5: discard

  category_multipliers:
    security: 2.0
    compliance: 2.0
    secrets_exposure: 2.5
    vulnerability: 2.0
    performance: 1.2
    code_quality: 1.0
```

### 14.2 Lesson Storage

```yaml
lesson_storage:

  schema:
    id: string
    created_at: timestamp
    source_agent: string
    source_task: string
    category: string
    subcategory: string
    title: string
    description: string
    code_example:
      before: string
      after: string
    context: object
    score: number
    score_breakdown: object
    usage_count: number
    last_used: timestamp
    embedding: vector

  retrieval:
    method: "hybrid_search"
    components:
      bm25_weight: 0.4
      embedding_weight: 0.6
    reranking: "cross_encoder"
```

---

## 15. Implementation Roadmap

### 15.1 Phase 1: Core Foundation (Weeks 1-4)

```yaml
phase_1:
  name: "Core Foundation"
  duration: "4 weeks"

  deliverables:
    - "CLI skeleton with basic commands"
    - "Orchestrator core (state machine, decision engine)"
    - "Agent base class and 3 core agents (Orchestrator, PM, Architect)"
    - "MCP server integration (filesystem, git)"
    - "Basic prompt hierarchy (layers 1-6)"
    - "JSON schema validation for outputs"
    - "SQLite state persistence"

  success_criteria:
    - "Can initialize a project"
    - "Can run simple prompt through orchestrator"
    - "Structured JSON outputs from agents"
    - "State persists between sessions"
```

### 15.2 Phase 2: Agent Ecosystem (Weeks 5-8)

```yaml
phase_2:
  name: "Agent Ecosystem"
  duration: "4 weeks"

  deliverables:
    - "All 14 agents implemented"
    - "Feedback loop (BUILDER → TESTER → BUG_FIXER)"
    - "Design approval workflow"
    - "Git worktree support"
    - "Context bundling and handoffs"
    - "Skills framework (coding, testing)"

  success_criteria:
    - "Full orchestration flow works"
    - "Bug fix loop operates correctly"
    - "Parallel agent execution in worktrees"
```

### 15.3 Phase 3: Security & Compliance (Weeks 9-12)

```yaml
phase_3:
  name: "Security & Compliance"
  duration: "4 weeks"

  deliverables:
    - "Secret scanning with 50+ patterns"
    - "Input/output guardrails"
    - "Audit logging system"
    - "Two-tier compliance framework"
    - "Environment-aware compliance"
    - "Security skills (OWASP, SAST)"

  success_criteria:
    - "Secrets blocked before commit"
    - "Audit trail for all agent actions"
    - "Compliance checks pass for production"
```

### 15.4 Phase 4: Learning & Polish (Weeks 13-16)

```yaml
phase_4:
  name: "Learning & Polish"
  duration: "4 weeks"

  deliverables:
    - "Lesson extraction and scoring"
    - "Knowledge base with vector search"
    - "Meta-prompts for self-improvement"
    - "Project analyzer for imports"
    - "CLI polish and documentation"
    - "Performance optimization"

  success_criteria:
    - "Lessons extracted and applied"
    - "Existing repos can be imported"
    - "CLI is intuitive and well-documented"
```

---

## Appendix A: Universal Response Schema

```typescript
interface AgentResponse<T> {
  // Metadata
  schema_version: string;       // "1.0.0"
  agent_type: string;           // "backend_developer"
  task_id: string;              // "TASK-001"
  timestamp: string;            // ISO 8601

  // Status
  status: "success" | "completed" | "completed_with_issues" |
          "failed" | "blocked" | "needs_approval" | "needs_info";
  confidence: number;           // 0.0 - 1.0

  // Agent-specific payload
  data: T;

  // Routing hints for orchestrator
  routing_hints: {
    needs_user_approval: boolean;
    needs_user_input: boolean;
    has_failures: boolean;
    has_warnings: boolean;
    blocked_by?: string[];
    suggested_next?: string;
    retry_recommended?: boolean;
    escalate_to_user?: boolean;
  };

  // Audit trail
  audit: {
    files_read: string[];
    files_created: string[];
    files_modified: string[];
    files_deleted: string[];
    external_calls: string[];
    secrets_accessed: string[];
    duration_ms: number;
    tokens_used: number;
  };

  // Learning system
  observations?: {
    potential_lessons: string[];
    issues_encountered: string[];
    suggestions: string[];
  };

  // Errors
  errors?: {
    code: string;
    message: string;
    recoverable: boolean;
  }[];
}
```

---

## Appendix B: Quick Reference

### CLI Commands

```bash
# Project Management
aigentflow init                      # Initialize new project
aigentflow init --import <url>       # Import existing repo

# Orchestration
aigentflow run "<prompt>"            # Execute prompt
aigentflow status                    # Show status
aigentflow status --watch            # Live status

# Approvals
aigentflow approve <id>              # Approve design/change
aigentflow reject <id> --feedback "" # Reject with feedback

# Control
aigentflow abort                     # Stop orchestration
aigentflow resume                    # Resume paused work

# Configuration
aigentflow config list               # List all config
aigentflow agents list               # List agents
aigentflow lessons search "<query>"  # Search lessons
```

### Key File Locations

| Purpose | Location |
|---------|----------|
| Agent definitions | `orchestrator-data/system/agents/*.yaml` |
| Skills | `orchestrator-data/system/skills/**/*.yaml` |
| Prompts | `orchestrator-data/system/prompts/**/*.yaml` |
| Guardrails | `orchestrator-data/system/guardrails/**/*.yaml` |
| Project state | `orchestrator-data/projects/{id}/.orchestrator/` |
| User source code | `projects/{project_id}/` |
| Git worktrees | `worktrees/{project_id}/{branch}/` |

---

## 16. Design-First Workflow

### 16.1 Design-First Principle

**Every user-facing feature MUST start with UI Designer creating mockups before any code is written.** This is a mandatory workflow, not optional.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DESIGN-FIRST WORKFLOW (MANDATORY)                      │
└─────────────────────────────────────────────────────────────────────────────┘

USER REQUEST: "Add user authentication"
       │
       ▼
┌──────────────────┐
│ PROJECT MANAGER  │ → Identifies: "This feature needs UI flows"
└────────┬─────────┘   Sets: design_required = true
         │
         ▼ (DESIGN REQUIRED FLAG)
┌──────────────────┐
│   UI DESIGNER    │ → Creates mockups for:
└────────┬─────────┘   - Login page
         │              - Registration page
         │              - Password reset flow
         │              - Error states
         │              - Loading states
         ▼
┌──────────────────┐
│ APPROVAL GATE    │ → USER MUST APPROVE DESIGNS
└────────┬─────────┘   ❌ Rejected → Back to Designer with feedback
         │              ✅ Approved → Continue to build
         ▼
┌──────────────────┐
│    BUILDERS      │ → Frontend & Backend reference approved designs
└────────┬─────────┘   - Component names match mockup labels
         │              - All states implemented per mockup
         │              - Visual verification against mockups
         ▼
┌──────────────────┐
│ VISUAL VERIFY    │ → Compare implementation to mockups
└──────────────────┘   - Screenshot comparison
                       - Layout verification
                       - Responsive breakpoints checked
```

### 16.2 Design Approval States

```yaml
design_approval_workflow:
  states:
    draft:
      description: "Designer working on mockup"
      allowed_transitions: ["pending_review"]

    pending_review:
      description: "Awaiting user review"
      allowed_transitions: ["approved", "changes_requested"]
      blocks: ["build_tasks"]  # All build tasks blocked

    changes_requested:
      description: "User requested changes"
      allowed_transitions: ["pending_review"]
      includes: "user_feedback"

    approved:
      description: "Can proceed to build"
      allowed_transitions: ["superseded"]
      unblocks: ["build_tasks"]

    superseded:
      description: "Replaced by newer version"
      terminal: true

  transitions:
    draft_to_pending_review:
      trigger: "designer_submits"
      action: "notify_user"
      hook: "DESIGN_SUBMITTED"

    pending_review_to_approved:
      trigger: "user_approves"
      action: "unblock_build_tasks"
      hook: "DESIGN_APPROVED"

    pending_review_to_changes_requested:
      trigger: "user_requests_changes"
      action: "return_to_designer"
      data: "user_feedback"
      hook: "DESIGN_CHANGES_REQUESTED"

    changes_requested_to_pending_review:
      trigger: "designer_resubmits"
      action: "notify_user"
      hook: "DESIGN_RESUBMITTED"

  rules:
    - "NO build tasks can start until design is 'approved'"
    - "Build tasks MUST reference approved design version"
    - "Design changes after approval require re-approval"
    - "Superseded designs are archived, not deleted"
```

### 16.3 Design Reference in Build Tasks

```typescript
interface BuildTask {
  task_id: string;
  type: "frontend" | "backend";

  // MANDATORY for frontend tasks
  design_reference: {
    mockup_id: string;
    mockup_version: string;        // e.g., "v3"
    mockup_path: string;           // "designs/approved/auth/login-v3.html"
    approval_timestamp: string;
    approved_by: string;

    // Specific elements this task implements
    implements: string[];          // ["login-form", "error-states", "loading"]
  };

  // Visual verification config
  visual_verification: {
    enabled: boolean;
    comparison_threshold: number;  // 0.5% pixel deviation allowed
    breakpoints: string[];         // ["mobile", "tablet", "desktop"]
    states_to_verify: string[];    // ["default", "loading", "error", "success"]
  };
}
```

### 16.4 Feature Detection: Does This Need Design?

```yaml
design_required_detection:
  # Project Manager uses these rules to determine if design is needed

  always_requires_design:
    - "New page or screen"
    - "New user-facing component"
    - "Changes to existing UI layout"
    - "New user flow or wizard"
    - "Error or empty states"
    - "Forms with validation"
    - "Navigation changes"
    - "Modal or dialog boxes"
    - "Dashboard or data visualization"

  never_requires_design:
    - "API-only changes"
    - "Database schema changes"
    - "Backend service logic"
    - "Performance optimization"
    - "Bug fixes (unless UI affected)"
    - "Refactoring (unless UI affected)"
    - "Documentation"
    - "Test additions"
    - "Configuration changes"

  requires_review:
    # These might need design - PM should check with user
    - "Text/copy changes"
    - "Icon/image updates"
    - "Color/styling changes"
    - "Responsive adjustments"
    - "Accessibility improvements"

  detection_prompt: |
    Analyze this feature request and determine if UI design is needed.

    Feature: {feature_description}

    Consider:
    1. Does this add or modify user-visible elements?
    2. Does this change how users interact with the system?
    3. Are there new screens, forms, or flows?

    Respond with:
    - design_required: true/false
    - reason: explanation
    - design_scope: list of mockups needed (if required)
```

### 16.5 Visual Verification System

```yaml
visual_verification:
  description: |
    After frontend implementation, automatically compare
    rendered output against approved mockups.

  process:
    step_1_capture:
      action: "Screenshot implementation"
      tool: "Playwright/Puppeteer"
      captures:
        - each_breakpoint: ["375px", "768px", "1280px"]
        - each_state: ["default", "loading", "error", "success", "empty"]

    step_2_compare:
      action: "Compare against mockup"
      method: "Pixel diff with tolerance"
      threshold: 0.5  # 0.5% deviation allowed
      ignore_regions:
        - "Dynamic content (timestamps, user data)"
        - "Animations mid-frame"

    step_3_report:
      action: "Generate verification report"
      includes:
        - comparison_images
        - deviation_percentage
        - highlighted_differences
        - pass_fail_status

  failure_handling:
    threshold_exceeded:
      action: "Flag for review"
      blocks: "task_completion"
      options:
        - "Update implementation to match mockup"
        - "Update mockup to match implementation (requires re-approval)"
        - "Accept deviation with justification"
```

---

## 17. User Flows

### 17.1 New Project Creation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NEW PROJECT CREATION FLOW                            │
└─────────────────────────────────────────────────────────────────────────────┘

USER: aigentflow init

=== STEP 1: Project Basics ===
┌─────────────────────────────────────────────────────────────────────────────┐
│ Project name: my-todo-app                                                    │
│ Description: A todo application with categories and priorities              │
│ Primary platform: Web                                                        │
│ Additional platforms: [ ] Mobile  [ ] Desktop  [ ] API-only                 │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
=== STEP 2: Tech Stack Selection ===

ORCHESTRATOR → ARCHITECT: "Recommend tech stack for web todo app"

ARCHITECT analyzes requirements and suggests:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Recommended Stack:                                                           │
│ • Frontend: React 18 + TypeScript + Zustand + Tailwind                      │
│ • Backend: FastAPI + SQLAlchemy + SQLite                                    │
│ • Testing: Jest + Pytest + Playwright                                       │
│                                                                              │
│ [Accept] [Modify] [Choose Different]                                        │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
=== STEP 3: Compliance Requirements ===

ORCHESTRATOR → COMPLIANCE AGENT: "Assess compliance needs"

┌─────────────────────────────────────────────────────────────────────────────┐
│ Does your project handle any of the following?                               │
│                                                                              │
│ DATA PROCESSING                                                              │
│ ☐ Personal data (names, emails, addresses) → GDPR                           │
│ ☐ EU resident data → GDPR                                                   │
│ ☐ Health data → HIPAA                                                       │
│ ☐ Payment/financial data → PCI-DSS                                          │
│ ☐ Children's data → COPPA                                                   │
│                                                                              │
│ SECURITY REQUIREMENTS                                                        │
│ ☐ Enterprise customers → SOC 2                                              │
│ ☐ Government customers → FedRAMP                                            │
│                                                                              │
│ For a simple todo app: [Skip - No compliance needed]                        │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
=== STEP 4: Project Structure Generation ===

ARCHITECT generates:
  • Directory structure
  • Initial configuration files
  • Architecture documentation
  • ADR templates
         │
         ▼
=== STEP 5: Orchestrator Overlay Setup ===

System creates:
  orchestrator-data/projects/{project_id}/
  ├── project.yaml
  ├── .orchestrator/state.json
  ├── architecture/
  ├── designs/
  └── claude.md
         │
         ▼
=== STEP 6: Git Initialization ===

GIT AGENT:
  • Initializes repository
  • Creates .gitignore
  • Sets up pre-commit hooks (secret scanning)
  • Makes initial commit
         │
         ▼
=== STEP 7: Ready ===

┌─────────────────────────────────────────────────────────────────────────────┐
│ ✅ Project 'my-todo-app' created successfully!                               │
│                                                                              │
│ Next steps:                                                                  │
│   aigentflow run "Build the initial todo app with add and list features"   │
│                                                                              │
│ Project location: ./projects/my-todo-app                                    │
│ State location: ./orchestrator-data/projects/my-todo-app                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 17.2 Import Existing Project Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       IMPORT EXISTING PROJECT FLOW                           │
└─────────────────────────────────────────────────────────────────────────────┘

USER: aigentflow init --import https://github.com/user/existing-app

=== STEP 1: Clone Repository ===

GIT AGENT:
  • Clones repository to projects/{project_id}/
  • Detects branch structure
  • Identifies main/default branch
         │
         ▼
=== STEP 2: Security Scan (BLOCKING) ===

COMPLIANCE AGENT runs security audit:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Security Scan Results                                                     │
│                                                                              │
│ Secret Detection:        ✅ No secrets found                                │
│ Dependency Vulnerabilities:                                                  │
│   • lodash@4.17.15 - HIGH - Prototype pollution (CVE-2021-23337)           │
│   • axios@0.21.0 - MEDIUM - SSRF vulnerability                              │
│ License Compliance:      ✅ All licenses compatible                         │
│                                                                              │
│ ⚠️  2 vulnerabilities found. Update recommended before proceeding.          │
│                                                                              │
│ [Continue Anyway] [Fix First] [Abort]                                       │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
=== STEP 3: Project Analysis ===

ORCHESTRATOR → PROJECT ANALYZER: "Analyze codebase"

PROJECT ANALYZER detects:
┌─────────────────────────────────────────────────────────────────────────────┐
│ 📊 Project Analysis                                                          │
│                                                                              │
│ Tech Stack Detected:                                                         │
│   Frontend: React 17, Redux, Material-UI                                    │
│   Backend: Express.js, MongoDB, Mongoose                                    │
│   Testing: Jest (limited coverage ~35%)                                     │
│                                                                              │
│ Architecture:                                                                │
│   Pattern: MVC-ish with service layer                                       │
│   API Style: REST (inconsistent naming)                                     │
│   State Management: Redux with sagas                                        │
│                                                                              │
│ Code Quality:                                                                │
│   TypeScript: Partial (60% coverage)                                        │
│   Linting: ESLint configured                                                │
│   Tests: Unit only, no E2E                                                  │
│                                                                              │
│ Potential Compliance Indicators:                                             │
│   • User model has email/password → Personal data                           │
│   • No audit logging detected                                               │
│   • Session management via cookies                                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
=== STEP 4: Generate Context File ===

PROJECT ANALYZER generates claude.md:
  • Project overview
  • Directory structure map
  • Key patterns identified
  • Areas needing attention
  • Coding conventions detected
         │
         ▼
=== STEP 5: Overlay Setup ===

Same as new project - creates orchestrator-data structure
         │
         ▼
=== STEP 6: Compliance Assessment (if applicable) ===

If personal data detected:
  COMPLIANCE AGENT asks about GDPR requirements
  Generates compliance checklist
         │
         ▼
=== STEP 7: Ready ===

┌─────────────────────────────────────────────────────────────────────────────┐
│ ✅ Project 'existing-app' imported successfully!                             │
│                                                                              │
│ Analysis summary:                                                            │
│   • Tech stack: React + Express + MongoDB                                   │
│   • 2 security vulnerabilities to address                                   │
│   • Test coverage: 35% (recommend improving)                                │
│   • Compliance: GDPR considerations identified                              │
│                                                                              │
│ Generated files:                                                             │
│   • orchestrator-data/projects/existing-app/claude.md                       │
│   • orchestrator-data/projects/existing-app/architecture/analysis.yaml     │
│                                                                              │
│ Recommended first task:                                                      │
│   aigentflow run "Fix the 2 security vulnerabilities identified"           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 17.3 Feature Development Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FEATURE DEVELOPMENT FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

USER: aigentflow run "Add user authentication with login, register, and password reset"

=== PHASE 1: ANALYSIS ===

ORCHESTRATOR analyzes request:
  • Identifies as new feature (not bug fix)
  • Detects UI requirement → design_required = true
  • Estimates scope: Medium (3-5 tasks per feature)
         │
         ▼
=== PHASE 2: PLANNING ===

ORCHESTRATOR → PROJECT MANAGER

PROJECT MANAGER creates plan:
┌─────────────────────────────────────────────────────────────────────────────┐
│ EPIC: User Authentication                                                    │
│                                                                              │
│ ├── Feature: User Registration                                              │
│ │   ├── Task: Design registration flow        [design] [blocking]           │
│ │   ├── Task: Create User model               [backend]                     │
│ │   ├── Task: Create registration API         [backend]                     │
│ │   ├── Task: Build registration form         [frontend] [needs: design]    │
│ │   └── Task: Write registration tests        [testing]                     │
│ │                                                                            │
│ ├── Feature: User Login                                                      │
│ │   ├── Task: Design login flow               [design] [blocking]           │
│ │   ├── Task: Create auth service             [backend]                     │
│ │   ├── Task: Create login API                [backend]                     │
│ │   ├── Task: Build login form                [frontend] [needs: design]    │
│ │   └── Task: Write login tests               [testing]                     │
│ │                                                                            │
│ └── Feature: Password Reset                                                  │
│     ├── Task: Design reset flow               [design] [blocking]           │
│     ├── Task: Create reset token system       [backend]                     │
│     ├── Task: Create reset API                [backend]                     │
│     ├── Task: Build reset forms               [frontend] [needs: design]    │
│     └── Task: Write reset tests               [testing]                     │
│                                                                              │
│ Dependencies: Backend tasks can start. Frontend blocked on design.          │
│ Parallel tracks: 2 (backend + design, then frontend)                        │
│ Estimated tasks: 15                                                          │
│                                                                              │
│ [Approve Plan] [Modify] [Cancel]                                            │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼ User approves

=== PHASE 3: ARCHITECTURE (if needed) ===

For significant features, ARCHITECT reviews:
  • Security architecture for auth
  • Session/token strategy
  • Creates ADR if new patterns introduced
         │
         ▼
=== PHASE 4: DESIGN ===

UI DESIGNER creates mockups for all UI tasks:
  • Registration page (all states)
  • Login page (all states)
  • Password reset flow (3 screens)
  • Email templates

[Design submitted → User reviews → Approved/Changes requested]
         │
         ▼ Designs approved

=== PHASE 5: BUILD (Parallel Execution) ===

GIT AGENT creates worktrees:
  • worktrees/project/feature-auth-backend
  • worktrees/project/feature-auth-frontend

BACKEND DEVELOPER (in backend worktree):
  • Creates User model with tests
  • Creates auth service with tests
  • Creates API endpoints with tests

FRONTEND DEVELOPER (in frontend worktree, after design approved):
  • Builds registration form matching mockup
  • Builds login form matching mockup
  • Builds reset forms matching mockups
         │
         ▼
=== PHASE 6: TEST ===

TESTER executes:
  • Unit tests (backend + frontend)
  • Integration tests (API)
  • E2E tests (full flows)
  • Visual regression tests

If failures → BUG FIX LOOP (max 3 attempts)
         │
         ▼
=== PHASE 7: REVIEW ===

REVIEWER checks:
  • Code quality
  • Security (auth-specific checks)
  • Test coverage
  • Pattern consistency
  • Extracts lessons learned
         │
         ▼
=== PHASE 8: MERGE & COMPLETE ===

GIT AGENT:
  • Merges worktrees to main
  • Resolves any conflicts
  • Creates summary commit

ORCHESTRATOR:
  • Updates project state
  • Notifies user of completion
  • Presents summary

┌─────────────────────────────────────────────────────────────────────────────┐
│ ✅ Feature Complete: User Authentication                                     │
│                                                                              │
│ Implemented:                                                                 │
│   • User registration with email verification                               │
│   • Login with JWT tokens                                                   │
│   • Password reset via email                                                │
│                                                                              │
│ Files created: 12                                                            │
│ Tests added: 34 (100% pass rate)                                            │
│ Coverage: 92%                                                                │
│                                                                              │
│ Commits:                                                                     │
│   abc1234 feat(auth): add user registration                                 │
│   def5678 feat(auth): add login flow                                        │
│   ghi9012 feat(auth): add password reset                                    │
│                                                                              │
│ Lessons learned: 2 (added to knowledge base)                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 17.4 Design Approval Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DESIGN APPROVAL FLOW                                │
└─────────────────────────────────────────────────────────────────────────────┘

UI DESIGNER completes mockup
         │
         ▼
=== SUBMISSION ===

Designer submits:
  • HTML mockup file(s)
  • Design tokens (colors, spacing, typography)
  • Interaction notes
  • Responsive breakpoints
  • State variations

File saved to: orchestrator-data/projects/{id}/designs/pending/
         │
         ▼
=== NOTIFICATION ===

┌─────────────────────────────────────────────────────────────────────────────┐
│ ⏸️  DESIGN REVIEW REQUIRED                                                   │
│                                                                              │
│ Feature: User Registration                                                   │
│ Designer: UI Designer Agent                                                  │
│ Mockups: 4 screens                                                           │
│                                                                              │
│ Preview:                                                                     │
│   file://./orchestrator-data/projects/myapp/designs/pending/registration/   │
│                                                                              │
│ Screens:                                                                     │
│   1. registration-form.html      - Main registration form                   │
│   2. registration-loading.html   - Loading state                            │
│   3. registration-error.html     - Error state                              │
│   4. registration-success.html   - Success confirmation                     │
│                                                                              │
│ Commands:                                                                    │
│   aigentflow approve design-001                                              │
│   aigentflow reject design-001 --feedback "Need larger buttons"             │
│   aigentflow preview design-001  (opens in browser)                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

Orchestration PAUSED - waiting for user input
         │
         ├──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
    USER APPROVES                            USER REJECTS
         │                                          │
         ▼                                          ▼
┌──────────────────┐                    ┌──────────────────┐
│ Design moves to  │                    │ Feedback sent to │
│ designs/approved/│                    │ UI Designer      │
│                  │                    │                  │
│ Build tasks      │                    │ Designer revises │
│ UNBLOCKED        │                    │ and resubmits    │
└──────────────────┘                    └──────────────────┘
         │                                          │
         ▼                                          ▼
  Continue to BUILD                          Back to DESIGN
```

### 17.5 Bug Fix Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             BUG FIX FLOW                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Test failure detected OR User reports bug
         │
         ▼
=== TRIAGE ===

ORCHESTRATOR analyzes failure:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Failure Analysis                                                             │
│                                                                              │
│ Test: test_user_registration_validates_email                                │
│ Error: AssertionError: Expected validation error for invalid email          │
│ File: tests/test_auth.py:45                                                 │
│ Source: app/services/auth_service.py:123                                    │
│                                                                              │
│ Classification: Logic error (not syntax, not infra)                         │
│ Suggested fix: Add email validation in validate_registration()              │
│ Confidence: 0.85                                                             │
│                                                                              │
│ Routing: BUG_FIXER                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
=== FIX ATTEMPT 1 ===

BUG FIXER receives:
  • Error details
  • Source file content (targeted lines)
  • Test file content
  • Recent changes (git diff)

BUG FIXER:
  • Analyzes root cause
  • Implements fix
  • Runs targeted test
         │
         ├──────────────────────────────────────────┐
         │                                          │
         ▼                                          ▼
    TEST PASSES                              TEST FAILS
         │                                          │
         ▼                                          ▼
  Return to normal flow                   Attempt 2 (max 3)
         │                                          │
         │                              ┌───────────┴───────────┐
         │                              │                       │
         │                              ▼                       ▼
         │                        Still fails            Attempt 3
         │                        after attempt 3              │
         │                              │                       │
         │                              ▼                       │
         │                    ┌──────────────────┐              │
         │                    │ ESCALATE TO USER │              │
         │                    │                  │              │
         │                    │ "Unable to fix   │              │
         │                    │  automatically.  │              │
         │                    │  Human review    │              │
         │                    │  required."      │              │
         │                    └──────────────────┘              │
         │                                                      │
         ▼                                                      ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Bug Fix Summary                                                           │
│                                                                           │
│ Issue: Email validation missing in registration                          │
│ Fix: Added email regex validation in validate_registration()             │
│ Attempts: 1                                                               │
│ Tests: All passing                                                        │
│                                                                           │
│ Files modified:                                                           │
│   app/services/auth_service.py (+5 lines)                                │
│                                                                           │
│ Lesson extracted: "Always validate email format server-side"             │
└──────────────────────────────────────────────────────────────────────────┘
```

### 17.6 Orchestration State Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ORCHESTRATION STATE MACHINE                            │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────┐
                              │   IDLE   │
                              └────┬─────┘
                                   │ User request
                                   ▼
                              ┌──────────┐
                              │ ANALYZING│
                              └────┬─────┘
                                   │
                                   ▼
                              ┌──────────┐
                              │ PLANNING │
                              └────┬─────┘
                                   │
                         ┌─────────┼─────────┐
                         │         │         │
                         ▼         ▼         ▼
                    ┌────────┐ ┌────────┐ ┌────────┐
                    │ARCHITEC│ │DESIGNING│ │BUILDING│
                    │  TING  │ │        │ │        │
                    └───┬────┘ └───┬────┘ └───┬────┘
                        │         │          │
                        │         ▼          │
                        │   ┌──────────┐     │
                        │   │ AWAITING │     │
                        │   │ APPROVAL │     │
                        │   └────┬─────┘     │
                        │        │           │
                        └────────┼───────────┘
                                 │
                                 ▼
                            ┌──────────┐
                            │ TESTING  │
                            └────┬─────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ FIXING   │ │ REVIEWING│ │ COMPLETE │
              │ (loop)   │ │          │ │          │
              └────┬─────┘ └────┬─────┘ └──────────┘
                   │            │
                   └────────────┘

Special states:
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │  PAUSED  │     │  ERROR   │     │ ABORTED  │
  │(user req)│     │(unrecov) │     │(user req)│
  └──────────┘     └──────────┘     └──────────┘
```

---

## 18. Project Initialization (Compliance-Aware)

### 18.1 Full Initialization Flow

```yaml
project_initialization:

  phase_1_basics:
    name: "Project Basics"
    collects:
      - project_name: string
      - description: string
      - primary_platform: "web" | "mobile" | "desktop" | "api"
      - additional_platforms: string[]

  phase_2_tech_stack:
    name: "Tech Stack Selection"
    agent: "architect"
    process:
      - Analyze project requirements
      - Recommend appropriate stack
      - Present options to user
      - User confirms or modifies
    outputs:
      - tech_stack.yaml
      - architecture_decisions.md

  phase_3_compliance:
    name: "Compliance Assessment"
    agent: "compliance_agent"
    questionnaire:
      data_processing:
        - question: "Will you process personal data (names, emails, etc.)?"
          yes_implies: ["GDPR"]
        - question: "Will you process EU resident data?"
          yes_implies: ["GDPR"]
        - question: "Will you process health/medical data?"
          yes_implies: ["HIPAA"]
        - question: "Will you process payment card data?"
          yes_implies: ["PCI-DSS"]
        - question: "Will you process children's data (under 13)?"
          yes_implies: ["COPPA"]

      data_storage:
        - question: "Is EU data residency required?"
          yes_implies: ["GDPR_strict"]
        - question: "Any specific country requirements?"
          free_form: true

      security_requirements:
        - question: "Do you need SOC 2 compliance?"
          yes_implies: ["SOC2"]
        - question: "Is ISO 27001 required?"
          yes_implies: ["ISO27001"]

    outputs:
      - project_compliance.yaml
      - data_processing_register.yaml
      - control_checklist.yaml

  phase_4_architecture:
    name: "Architecture Generation"
    agent: "architect"
    when: "always for new projects"
    generates:
      - directory_structure/
      - architecture.yaml
      - security_architecture.yaml (if compliance enabled)
      - diagrams/ (C4, data flow)
      - adrs/ (initial decisions)

  phase_5_security_setup:
    name: "Security Configuration"
    agent: "orchestrator"
    always:
      - .gitignore (with sensitive file patterns)
      - pre-commit hooks (secret scanning)
      - audit logging configuration
    if_compliance:
      - encryption configuration
      - access control setup
      - compliance monitoring hooks

  phase_6_git_setup:
    name: "Version Control"
    agent: "git_agent"
    actions:
      - Initialize repository
      - Create branch protection rules
      - Set up commit signing (optional)
      - Make initial commit

  phase_7_ready:
    name: "Project Ready"
    outputs:
      - Summary of project setup
      - Next steps recommendations
      - Links to generated documentation
```

### 18.2 Compliance Documentation Generated

```yaml
compliance_documentation:

  project_compliance_yaml:
    description: "Main compliance configuration"
    contains:
      enabled_frameworks: ["GDPR", "SOC2"]
      data_classification: "confidential"
      data_residency: "EU"
      retention_policy: "2 years"
      encryption_required: true
      audit_logging: true

  data_processing_register:
    description: "GDPR Article 30 register"
    contains:
      processing_activities:
        - name: "User registration"
          data_types: ["email", "password_hash", "name"]
          purpose: "Account creation"
          lawful_basis: "contract"
          retention: "Account lifetime + 30 days"

  control_checklist:
    description: "Controls to implement"
    contains:
      immediate:
        - "Implement password hashing (bcrypt/argon2)"
        - "Add input validation"
        - "Enable HTTPS"
      before_launch:
        - "Add consent management"
        - "Implement data export"
        - "Add deletion capability"
      ongoing:
        - "Quarterly access reviews"
        - "Annual penetration testing"
```

---

## 19. Recovery & Checkpointing

### 19.1 Checkpoint System

```yaml
checkpoint_system:

  description: |
    The orchestrator creates checkpoints at key points, enabling
    recovery from failures and replay for debugging.

  checkpoint_triggers:
    automatic:
      - "Before each agent spawn"
      - "After each agent completion"
      - "Before user approval gates"
      - "After state transitions"

    manual:
      - "User requests checkpoint"
      - "Before risky operations"

  checkpoint_contents:
    metadata:
      checkpoint_id: "cp-20251229-001"
      created_at: "2025-12-29T10:00:00Z"
      trigger: "agent_complete"
      parent_checkpoint: "cp-20251229-000"

    orchestrator_state:
      current_phase: "building"
      active_tasks: ["task-001", "task-002"]
      completed_tasks: ["task-000"]
      pending_approvals: []

    agent_states:
      - agent_id: "agent-001"
        type: "backend_developer"
        status: "completed"
        last_output_hash: "abc123"

    context_snapshot:
      project_state_hash: "def456"
      relevant_files_hash: "ghi789"

    git_state:
      head_commit: "abc1234"
      branch: "feature/auth"
      uncommitted_changes: false
```

### 19.2 Recovery Procedures

```yaml
recovery_procedures:

  # ═══════════════════════════════════════════════════════════════════
  # AGENT CRASH RECOVERY
  # ═══════════════════════════════════════════════════════════════════
  agent_crash:
    detection: "Agent process exits unexpectedly or times out"
    procedure:
      step_1: "Log crash details"
      step_2: "Load last checkpoint before agent spawn"
      step_3: "Assess if recoverable"
      step_4_if_recoverable:
        - "Restart agent with same context"
        - "Resume from checkpoint"
        - "Max 3 restart attempts"
      step_4_if_not_recoverable:
        - "Escalate to user"
        - "Preserve crash context for debugging"

  # ═══════════════════════════════════════════════════════════════════
  # ORCHESTRATOR CRASH RECOVERY
  # ═══════════════════════════════════════════════════════════════════
  orchestrator_crash:
    detection: "Orchestrator process exits or system restart"
    procedure:
      step_1: "On restart, scan for incomplete sessions"
      step_2: "Load last checkpoint"
      step_3: "Assess state consistency"
      step_4: "Prompt user: Resume or Abort?"
      step_5_if_resume:
        - "Restore orchestrator state"
        - "Re-spawn any interrupted agents"
        - "Continue from checkpoint"

  # ═══════════════════════════════════════════════════════════════════
  # USER-INITIATED RECOVERY
  # ═══════════════════════════════════════════════════════════════════
  user_rewind:
    trigger: "aigentflow rewind [checkpoint-id]"
    procedure:
      step_1: "Validate checkpoint exists and is valid"
      step_2: "Show what will be undone"
      step_3: "Confirm with user"
      step_4: "Restore state to checkpoint"
      step_5: "Reset git to checkpoint commit (optional)"
      step_6: "Resume orchestration"

  # ═══════════════════════════════════════════════════════════════════
  # GIT STATE RECOVERY
  # ═══════════════════════════════════════════════════════════════════
  git_recovery:
    uncommitted_changes_lost:
      - "Check git reflog for recoverable commits"
      - "Check stash for saved work"
      - "Notify user of potential data loss"

    merge_conflict_during_recovery:
      - "Spawn merge conflict resolver"
      - "If unresolvable, escalate to user"
```

### 19.3 Replay System

```yaml
replay_system:

  description: |
    Replay allows re-execution of agent interactions for debugging
    and analysis. Critical distinction: steps BEFORE the replay point
    are REPLAYED (cached results), steps AFTER are EXECUTED FRESH.

  replay_modes:
    full_replay:
      description: "Re-execute entire session from start"
      use_case: "Debugging, understanding how result was reached"
      behavior: "All agent calls re-executed (may produce different results)"

    checkpoint_replay:
      description: "Resume from specific checkpoint"
      use_case: "Recovery, testing alternative paths"
      behavior: "Restore state, execute remaining steps fresh"

    cached_replay:
      description: "Replay with cached agent responses"
      use_case: "Fast debugging, deterministic replay"
      behavior: "Use stored responses, no new API calls"

  implementation:
    storage:
      hot_tier: "Redis - last 24-72 hours"
      warm_tier: "SQLite - last 30-90 days"
      cold_tier: "Compressed files - compliance retention"

    idempotency:
      method: "Request ID tracking"
      behavior: "Duplicate requests return cached response"
```

---

## 20. Claude Code Integration

### 20.1 Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CLAUDE CODE INTEGRATION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Aigentflow runs as a SKILL within Claude Code CLI:

  ┌──────────────────────────────────────────────────────────────────────────┐
  │                         CLAUDE CODE CLI                                   │
  │                                                                           │
  │  ┌────────────────┐   ┌────────────────┐   ┌────────────────┐           │
  │  │  Built-in      │   │  MCP Servers   │   │   Skills       │           │
  │  │  Tools         │   │                │   │                │           │
  │  │  (Read, Edit,  │   │  (filesystem,  │   │  ┌──────────┐  │           │
  │  │   Bash, etc.)  │   │   git, etc.)   │   │  │AIGENTFLOW│  │           │
  │  │                │   │                │   │  │  SKILL   │  │           │
  │  └────────────────┘   └────────────────┘   │  └──────────┘  │           │
  │                                             │       │        │           │
  └─────────────────────────────────────────────│───────│────────│───────────┘
                                                │       │        │
                                                │       ▼        │
                                          ┌─────────────────────────┐
                                          │  AIGENTFLOW ORCHESTRATOR │
                                          │                          │
                                          │  Spawns specialized      │
                                          │  agents via Claude Code  │
                                          │  subagent system         │
                                          └─────────────────────────┘
```

### 20.2 Skill Configuration

```yaml
# .claude/skills/aigentflow/SKILL.md
---
name: aigentflow-orchestrator
description: |
  Multi-agent orchestrator for complex software development.
  Use when building features, analyzing codebases, or managing
  multi-step development workflows.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

# Aigentflow Orchestrator

You are the Aigentflow orchestrator, coordinating specialized AI agents
to complete software development tasks.

## When to Use
- Building new features (spawns PM, Designer, Developers, Tester)
- Analyzing existing codebases (spawns Project Analyzer)
- Complex multi-file changes (coordinates parallel work)
- Tasks requiring design approval (spawns Designer, manages approvals)

## Core Behavior
1. Analyze incoming request
2. Create execution plan (spawn Project Manager)
3. Coordinate agents based on plan
4. Manage approval gates
5. Handle failures with retry loops
6. Synthesize results and report to user

## Agent Spawning
Use the Task tool to spawn specialized agents:
- subagent_type: "backend-developer" for API work
- subagent_type: "frontend-developer" for UI work
- subagent_type: "tester" for test execution
```

### 20.3 Subagent Definitions

```yaml
# .claude/agents/backend-developer.md
---
name: backend-developer
description: Expert in Python, FastAPI, SQLAlchemy. Use for API development.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

You are the Backend Developer agent in Aigentflow.

## Expertise
- Python 3.11+
- FastAPI with async patterns
- SQLAlchemy with Alembic migrations
- Pydantic v2 for validation
- pytest for testing

## Rules
- NEVER write frontend code
- ALWAYS write tests for new code
- ALWAYS use parameterized queries
- Follow existing patterns in the codebase

## Output Format
Return structured JSON with:
- status: "success" | "failed" | "blocked"
- files_created: string[]
- files_modified: string[]
- tests_added: string[]
- routing_hints: { needs_user_approval: boolean, suggested_next: string }

---

# .claude/agents/frontend-developer.md
---
name: frontend-developer
description: Expert in React, TypeScript, Zustand. Use for UI development.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---

You are the Frontend Developer agent in Aigentflow.

## Expertise
- React 18 with hooks
- TypeScript
- Zustand for state management
- Tailwind CSS
- Jest + React Testing Library

## Rules
- NEVER write backend code
- ALWAYS reference approved designs
- ALWAYS write component tests
- Follow existing patterns in the codebase

## Design Reference
Every UI task includes a design_reference with:
- mockup_path: Path to approved HTML mockup
- implements: List of elements to implement
- states: List of states to implement

Match the mockup EXACTLY.
```

### 20.4 Custom Commands

```yaml
# .claude/commands/orchestrate.md
---
description: Run a task through the Aigentflow orchestrator
---

Invoke the Aigentflow orchestrator skill to handle: $ARGUMENTS

The orchestrator will:
1. Analyze the request
2. Create an execution plan
3. Spawn appropriate agents
4. Coordinate the work
5. Report results

---

# .claude/commands/design-review.md
---
description: Review pending designs
---

Check for pending design approvals:

1. List all pending designs in orchestrator-data/projects/*/designs/pending/
2. For each pending design, show:
   - Feature name
   - Mockup preview link
   - Submission timestamp
3. Prompt for approval action

---

# .claude/commands/project-status.md
---
description: Show current orchestration status
---

Display the current Aigentflow project status:

1. Read .orchestrator/state.json
2. Show current phase
3. List active tasks and their status
4. Show any pending approvals
5. Show recent activity (last 5 events)
```

### 20.5 Session Management

```yaml
session_management:

  session_continuity:
    resume_command: "claude --resume"
    continue_command: "claude --continue"

    state_persistence:
      location: "orchestrator-data/projects/{id}/.orchestrator/"
      files:
        - state.json     # Current orchestration state
        - history.json   # State history for replay
        - activity.log   # Activity stream

  session_handoff:
    between_sessions:
      - "Orchestrator saves state to disk"
      - "Next session loads state"
      - "Orchestration resumes where it left off"

    session_notes:
      location: ".claude/session-notes/"
      purpose: "Context for multi-day features"
      format: |
        # Session: {date}
        ## Accomplished
        - ...
        ## In Progress
        - ...
        ## Next Steps
        - ...
        ## Blockers
        - ...

  catchup_command:
    description: "Quick context restoration"
    script: |
      Review current state:
      1. git status
      2. git log --oneline -5
      3. Read .orchestrator/state.json
      4. Read .claude/session-notes/ (if exists)
      5. Summarize current development state
```

### 20.6 Token Optimization

```yaml
token_optimization:

  large_file_handling:
    rules:
      - "NEVER read entire files > 50KB"
      - "Use Grep to find target location first"
      - "Read only relevant line ranges (max 500 lines)"
      - "Use line numbers for all edits"

    patterns:
      search_first: |
        # BAD: Read entire large file
        Read orchestrator.py

        # GOOD: Search first, then targeted read
        Grep for "class TaskQueue" in orchestrator.py
        Read orchestrator.py lines 450-550

  context_compaction:
    trigger: "70% context capacity"
    strategy:
      - "Summarize completed work"
      - "Archive verbose outputs"
      - "Keep only essential context"

  mcp_server_management:
    rule: "Disable unused MCP servers"
    check_command: "/context"
    disable_unused: true
```

---

## 21. Self-Evolution Framework

> **Note:** This section describes capabilities to be implemented once the core orchestrator is operational end-to-end. Self-evolution requires a stable baseline to evolve from.

### 21.1 Evolution Philosophy

The core insight: **treat configurations as competing hypotheses** and let empirical performance drive improvement. Rather than manually tuning agent prompts and orchestration logic, configurations compete on real projects with winning strategies propagating through the system.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SELF-EVOLUTION ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    PRODUCTION TRACK (Stable)                             ││
│  │                                                                          ││
│  │   Current champion configuration serving all live requests              ││
│  │   Only promoted after rigorous validation                               ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    ▲                                         │
│                                    │ Promotion (after validation)           │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    EVOLUTION TRACK (Experimental)                        ││
│  │                                                                          ││
│  │   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐        ││
│  │   │ Config A  │   │ Config B  │   │ Config C  │   │ Config D  │        ││
│  │   │ μ=26.1    │   │ μ=27.3    │   │ μ=24.8    │   │ μ=28.5    │        ││
│  │   │ σ=3.2     │   │ σ=2.8     │   │ σ=4.1     │   │ σ=2.1     │  ←WIN  ││
│  │   └───────────┘   └───────────┘   └───────────┘   └───────────┘        ││
│  │         │               │               │               │               ││
│  │         └───────────────┼───────────────┼───────────────┘               ││
│  │                         ▼               ▼                                ││
│  │                   Tournament / Best-of-N Evaluation                      ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                    ▲                                         │
│                                    │ Generation                              │
│                                    │                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │                    EVOLUTION ENGINE                                       ││
│  │                                                                          ││
│  │   DSPy/MIPROv2  │  EvoPrompt  │  PromptBreeder  │  Random Mutation      ││
│  │                                                                          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 21.2 Evolvable Units

Not everything should evolve. Define explicit **evolution boundaries**:

```yaml
evolvable_units:

  # ═══════════════════════════════════════════════════════════════════
  # AGENT PROMPTS (Primary evolution target)
  # ═══════════════════════════════════════════════════════════════════
  agent_prompts:
    evolvable: true
    layers:
      identity: false          # Core identity is fixed
      workflow_instructions: true
      output_format: false     # Schema must be stable
      behavioral_constraints: true
      examples: true           # Few-shot examples evolve
      meta_instructions: true

  # ═══════════════════════════════════════════════════════════════════
  # ORCHESTRATOR DECISIONS
  # ═══════════════════════════════════════════════════════════════════
  orchestrator:
    evolvable: true
    components:
      routing_thresholds: true      # When to route to which agent
      failure_classification: true   # How to categorize failures
      retry_limits: true             # Max attempts before escalate
      parallelization_strategy: true # When to parallelize
      context_selection: true        # What context to include

  # ═══════════════════════════════════════════════════════════════════
  # SKILLS
  # ═══════════════════════════════════════════════════════════════════
  skills:
    evolvable: true
    components:
      code_patterns: true       # Best practice patterns
      anti_patterns: true       # What to avoid
      examples: true            # Demonstration code

  # ═══════════════════════════════════════════════════════════════════
  # NON-EVOLVABLE (Safety boundaries)
  # ═══════════════════════════════════════════════════════════════════
  fixed_boundaries:
    - "Security guardrails"
    - "Compliance requirements"
    - "Output JSON schemas"
    - "Audit logging requirements"
    - "Secret detection patterns"
    - "Agent identity cores"
```

### 21.3 Configuration Genome

Every configuration is represented as a **genome** that can be versioned, compared, mutated, and crossed:

```yaml
configuration_genome:
  id: "genome-20251229-001"
  parent_ids: ["genome-20251228-003", "genome-20251228-007"]  # Two parents if crossed
  generation: 42
  created_at: "2025-12-29T10:00:00Z"
  created_by: "evolution_engine"

  # The actual evolvable parameters
  genes:
    # Agent prompt genes
    backend_developer:
      workflow_instructions: "prompt-bd-v3.7"
      behavioral_constraints: "constraints-bd-v2.1"
      examples: ["ex-bd-001", "ex-bd-002", "ex-bd-005"]

    tester:
      workflow_instructions: "prompt-test-v4.2"
      failure_classification: "class-test-v1.8"

    # Orchestrator genes
    orchestrator:
      routing_model: "hybrid-v2.3"
      parallelization_threshold: 0.7
      retry_base_delay_ms: 1000
      max_fix_attempts: 3
      context_relevance_threshold: 0.72

    # Skill genes
    skills:
      react_patterns: "patterns-react-v5.1"
      fastapi_patterns: "patterns-fastapi-v3.4"

  # Performance tracking
  fitness:
    trueskill_mu: 28.3
    trueskill_sigma: 2.1
    conservative_estimate: 22.0  # μ - 3σ
    matches_played: 47
    win_rate: 0.68

  metrics:
    avg_test_pass_rate: 0.94
    avg_security_score: 0.98
    avg_code_quality: 0.87
    avg_task_completion_time_ms: 45000
    avg_token_usage: 32000

  lineage:
    mutations_applied:
      - gene: "orchestrator.parallelization_threshold"
        change: "0.65 → 0.70"
        reason: "Random mutation"
      - gene: "backend_developer.examples"
        change: "Added ex-bd-005"
        reason: "MIPROv2 optimization"
```

### 21.4 Evaluation Architecture

Three-layer evaluation combining objective metrics with LLM-as-judge:

```yaml
evaluation_architecture:

  # ═══════════════════════════════════════════════════════════════════
  # LAYER 1: OBJECTIVE METRICS (60% weight)
  # ═══════════════════════════════════════════════════════════════════
  objective_metrics:
    test_pass_rate:
      weight: 0.25
      measurement: "Automated test execution"
      threshold: ">= 0.95 for promotion"

    code_coverage:
      weight: 0.10
      measurement: "Coverage tools (pytest-cov, c8)"
      threshold: ">= 0.80"

    security_score:
      weight: 0.15
      measurement: "SAST + secret scanning + dependency audit"
      threshold: "Zero critical, zero high"

    complexity_score:
      weight: 0.10
      measurement: "Cyclomatic complexity, maintainability index"
      threshold: "< 15 avg cyclomatic"

  # ═══════════════════════════════════════════════════════════════════
  # LAYER 2: LLM-AS-JUDGE (40% weight)
  # ═══════════════════════════════════════════════════════════════════
  llm_judge:
    panel_of_llms:
      - model: "claude-3-5-haiku"
        weight: 0.33
      - model: "gpt-4o-mini"
        weight: 0.33
      - model: "command-r"
        weight: 0.34
    aggregation: "majority_vote_with_confidence"

    dimensions:
      functional_correctness:
        weight: 0.15
        scale: "1-4"
        prompt: "Does the code correctly implement the requirements?"

      readability:
        weight: 0.10
        scale: "1-4"
        prompt: "Is the code easy to read and understand?"

      maintainability:
        weight: 0.10
        scale: "1-4"
        prompt: "Will this code be easy to modify and extend?"

      architectural_soundness:
        weight: 0.05
        scale: "1-4"
        prompt: "Does this follow good architectural practices?"

    bias_mitigation:
      position_swap: true          # Run comparisons both ways
      anti_verbosity: true         # Penalize unnecessarily long code
      different_judge_than_generator: true

  # ═══════════════════════════════════════════════════════════════════
  # LAYER 3: AGGREGATION
  # ═══════════════════════════════════════════════════════════════════
  aggregation:
    method: "weighted_sum"
    confidence_intervals: "bootstrap_1000"
    comparison_method: "pairwise_tournament"  # Better than absolute scoring
```

### 21.5 Tournament System

TrueSkill-based rating system for configuration comparison:

```yaml
tournament_system:

  rating_algorithm: "TrueSkill"
  initial_rating:
    mu: 25.0
    sigma: 8.33  # 25/3

  # ═══════════════════════════════════════════════════════════════════
  # TOURNAMENT TYPES
  # ═══════════════════════════════════════════════════════════════════
  tournament_types:
    round_robin:
      description: "Every config plays every other config"
      use_when: "Small number of configs (< 10)"
      matches_per_pair: 5

    swiss:
      description: "Configs play similar-rated opponents"
      use_when: "Medium number of configs (10-50)"
      rounds: 7

    knockout:
      description: "Single elimination after seeding"
      use_when: "Large number of configs (> 50)"

  # ═══════════════════════════════════════════════════════════════════
  # BENCHMARK SUITE
  # ═══════════════════════════════════════════════════════════════════
  benchmark_projects:
    description: "Reference projects for consistent evaluation"
    projects:
      - id: "bench-todo-app"
        complexity: "simple"
        features: ["CRUD", "filtering", "basic UI"]
        expected_duration: "< 30 min"

      - id: "bench-auth-system"
        complexity: "medium"
        features: ["JWT auth", "RBAC", "password reset"]
        expected_duration: "< 2 hours"

      - id: "bench-realtime-chat"
        complexity: "complex"
        features: ["WebSocket", "rooms", "presence", "history"]
        expected_duration: "< 4 hours"

      - id: "bench-ecommerce"
        complexity: "enterprise"
        features: ["Products", "cart", "checkout", "inventory"]
        expected_duration: "< 8 hours"

  # ═══════════════════════════════════════════════════════════════════
  # PROMOTION CRITERIA
  # ═══════════════════════════════════════════════════════════════════
  promotion:
    requirements:
      min_matches: 12
      min_conservative_estimate: 26.0  # μ - 3σ
      confidence_interval_no_overlap: true
      regression_tests_pass: true
      security_audit_pass: true
      human_approval: true  # For production promotion

    gates:
      - name: "Shadow validation"
        duration: "48 hours"
        traffic: "100% shadow"

      - name: "Canary rollout"
        stages: [0.01, 0.05, 0.20, 0.50, 1.0]
        duration_per_stage: "24 hours"
        rollback_triggers:
          - "error_rate > baseline + 0.5%"
          - "latency_p99 > baseline + 20%"
          - "quality_score < baseline - 5%"
```

### 21.6 Evolution Engines

Multiple optimization strategies working in parallel:

```yaml
evolution_engines:

  # ═══════════════════════════════════════════════════════════════════
  # DSPy MIPROv2 (Bayesian Optimization)
  # ═══════════════════════════════════════════════════════════════════
  miprov2:
    description: "Systematic prompt optimization via Bayesian search"
    targets:
      - "Agent workflow instructions"
      - "Few-shot example selection"
    config:
      auto_level: "medium"
      train_validation_split: "20/80"  # DSPy recommendation
      max_bootstrapped_demos: 4
      max_labeled_demos: 16

    implementation: |
      ```python
      from dspy.teleprompt import MIPROv2

      optimizer = MIPROv2(
          metric=composite_quality_metric,
          auto="medium",
          num_threads=4
      )
      optimized_agent = optimizer.compile(
          agent_module,
          trainset=benchmark_examples[:20],
          valset=benchmark_examples[20:]
      )
      ```

  # ═══════════════════════════════════════════════════════════════════
  # EvoPrompt (Genetic Algorithm)
  # ═══════════════════════════════════════════════════════════════════
  evoprompt:
    description: "Genetic algorithms for exploring novel prompts"
    targets:
      - "System prompts"
      - "Behavioral constraints"
    config:
      population_size: 10
      generations: 10
      mutation_rate: 0.3
      crossover_rate: 0.5
      selection: "tournament_size_3"

    operators:
      mutation: |
        Given this prompt: {current_prompt}
        Suggest a variation that might improve {target_metric}.
        Keep the core intent but explore alternative phrasings.

      crossover: |
        Given two prompts:
        Prompt A: {prompt_a}
        Prompt B: {prompt_b}
        Create a child prompt that combines the best aspects of both.

  # ═══════════════════════════════════════════════════════════════════
  # PromptBreeder (Self-Referential Evolution)
  # ═══════════════════════════════════════════════════════════════════
  promptbreeder:
    description: "Evolves both task prompts AND mutation prompts"
    targets:
      - "Meta-prompts"
      - "Reasoning instructions"
    config:
      population_size: 20
      mutation_prompts_population: 10
      hyper_mutation_rate: 0.1  # Mutate the mutation prompts

  # ═══════════════════════════════════════════════════════════════════
  # Random Exploration
  # ═══════════════════════════════════════════════════════════════════
  random:
    description: "Random parameter variations for exploration"
    targets:
      - "Numerical thresholds"
      - "Temperature settings"
    config:
      exploration_rate: 0.1  # 10% of new configs are random
```

### 21.7 Constitutional AI Integration

Self-improvement bounded by inviolable principles:

```yaml
constitutional_ai:

  # ═══════════════════════════════════════════════════════════════════
  # CONSTITUTION (Inviolable Principles)
  # ═══════════════════════════════════════════════════════════════════
  constitution:
    security_principles:
      - id: "SEC-001"
        principle: "Never expose secrets, API keys, or credentials"
        enforcement: "Hard block"

      - id: "SEC-002"
        principle: "Validate and sanitize all inputs"
        enforcement: "Hard block"

      - id: "SEC-003"
        principle: "Use parameterized queries exclusively"
        enforcement: "Hard block"

    quality_principles:
      - id: "QUA-001"
        principle: "Prefer tested code over untested code"
        enforcement: "Soft penalty in scoring"

      - id: "QUA-002"
        principle: "Follow existing patterns in the codebase"
        enforcement: "Soft penalty in scoring"

      - id: "QUA-003"
        principle: "Minimize complexity while meeting requirements"
        enforcement: "Soft penalty in scoring"

    efficiency_principles:
      - id: "EFF-001"
        principle: "Minimize token usage without sacrificing quality"
        enforcement: "Cost tracking"

      - id: "EFF-002"
        principle: "Avoid redundant API calls"
        enforcement: "Call tracking"

    compliance_principles:
      - id: "COM-001"
        principle: "Respect data protection requirements"
        enforcement: "Hard block"

      - id: "COM-002"
        principle: "Maintain audit trails for all actions"
        enforcement: "Hard block"

  # ═══════════════════════════════════════════════════════════════════
  # SELF-CRITIQUE WORKFLOW
  # ═══════════════════════════════════════════════════════════════════
  self_critique:
    enabled: true
    workflow:
      - step: "Generate initial output"
      - step: "Critique against constitution"
        prompt: |
          Review this output against our principles:
          {output}

          Principles:
          {constitution}

          Identify any violations or areas for improvement.
      - step: "Revise based on critique"
      - step: "Final validation"
```

### 21.8 Process Reward Models

Step-level evaluation for better credit assignment:

```yaml
process_reward_models:

  description: |
    Rather than scoring only final outputs, evaluate each reasoning step.
    This enables more precise credit assignment and better learning signals.

  evaluation_points:
    planning:
      - "Was the problem decomposition appropriate?"
      - "Were dependencies correctly identified?"
      - "Was complexity estimated accurately?"

    design:
      - "Does the design meet requirements?"
      - "Is the design implementable?"
      - "Were accessibility concerns addressed?"

    implementation:
      - "Was the algorithm selection appropriate?"
      - "Was the code structure sensible?"
      - "Were edge cases considered?"

    testing:
      - "Do tests cover critical paths?"
      - "Are tests independent and repeatable?"
      - "Is coverage adequate?"

  credit_assignment:
    method: "step_weighted"
    weights:
      planning: 0.15
      design: 0.20
      implementation: 0.40
      testing: 0.25
```

### 21.9 Online Configuration Selection

Thompson Sampling for optimal explore/exploit during live operation:

```yaml
online_selection:

  algorithm: "thompson_sampling"

  description: |
    During live operation, intelligently select which configuration to use
    for each request. Balances exploration (trying uncertain configs) with
    exploitation (using known winners).

  implementation:
    model: "Beta distribution per configuration"
    initial_params:
      alpha: 1  # Prior successes
      beta: 1   # Prior failures

    selection_process:
      - "Sample success probability from each config's Beta distribution"
      - "Select config with highest sampled probability"
      - "Execute request with selected config"
      - "Update config's Beta params based on outcome"

  benefits:
    - "Self-corrects when good configs are underestimated"
    - "Naturally reduces exploration as uncertainty decreases"
    - "Optimal regret bounds (theoretical guarantee)"

  guardrails:
    min_production_confidence: 0.8  # Don't use configs with low confidence
    max_exploration_rate: 0.10      # Cap exploration in production
```

### 21.10 Safety Infrastructure

Comprehensive safety for self-modifying systems:

```yaml
safety_infrastructure:

  # ═══════════════════════════════════════════════════════════════════
  # SHADOW DEPLOYMENT
  # ═══════════════════════════════════════════════════════════════════
  shadow_deployment:
    description: "Run evolved configs in shadow, discard outputs"
    traffic_percentage: 100  # All traffic duplicated
    output_handling: "discard"
    comparison: "Automated evaluation vs production"
    duration: "48 hours minimum"

  # ═══════════════════════════════════════════════════════════════════
  # CANARY ROLLOUT
  # ═══════════════════════════════════════════════════════════════════
  canary_rollout:
    stages:
      - percentage: 1
        duration: "24 hours"
        gates: ["error_rate", "latency", "quality_score"]

      - percentage: 5
        duration: "24 hours"
        gates: ["error_rate", "latency", "quality_score"]

      - percentage: 20
        duration: "24 hours"
        gates: ["error_rate", "latency", "quality_score", "user_satisfaction"]

      - percentage: 50
        duration: "48 hours"
        gates: ["all_metrics"]

      - percentage: 100
        gates: ["final_validation"]

  # ═══════════════════════════════════════════════════════════════════
  # AUTOMATED ROLLBACK
  # ═══════════════════════════════════════════════════════════════════
  automated_rollback:
    triggers:
      - metric: "error_rate"
        condition: "> baseline + 0.5%"
        window: "5 minutes"

      - metric: "latency_p99"
        condition: "> baseline + 20%"
        window: "5 minutes"

      - metric: "quality_score"
        condition: "< baseline - 5%"
        window: "15 minutes"

      - metric: "security_violation"
        condition: "any"
        window: "immediate"

    rollback_procedure:
      - "Immediately route 100% traffic to previous stable"
      - "Disable evolved config"
      - "Alert on-call team"
      - "Generate incident report"
      - "Add to regression test suite"

  # ═══════════════════════════════════════════════════════════════════
  # CATASTROPHIC FORGETTING PREVENTION
  # ═══════════════════════════════════════════════════════════════════
  forgetting_prevention:
    strategies:
      - name: "Self-Synthesized Rehearsal"
        description: "Use LLM to generate examples of previous capabilities"
        frequency: "Every 10 evolution cycles"

      - name: "Regression Test Suite"
        description: "Maintain golden test cases that must always pass"
        enforcement: "Hard gate for promotion"

      - name: "Capability Checkpoints"
        description: "Periodic full evaluation on all benchmark tasks"
        frequency: "Weekly"
```

### 21.11 Cost Management

Evolution is expensive. Manage costs aggressively:

```yaml
cost_management:

  # ═══════════════════════════════════════════════════════════════════
  # MODEL ROUTING
  # ═══════════════════════════════════════════════════════════════════
  intelligent_routing:
    description: "Route simple tasks to cheaper models"
    tiers:
      simple:
        models: ["claude-3-5-haiku", "gpt-4o-mini"]
        criteria:
          - "Simple code fixes"
          - "Straightforward CRUD"
          - "Well-defined tasks"

      standard:
        models: ["claude-3-5-sonnet", "gpt-4o"]
        criteria:
          - "Feature implementation"
          - "Moderate complexity"

      complex:
        models: ["claude-3-opus", "o1"]
        criteria:
          - "Architectural decisions"
          - "Complex algorithms"
          - "Ambiguous requirements"

  # ═══════════════════════════════════════════════════════════════════
  # EARLY STOPPING
  # ═══════════════════════════════════════════════════════════════════
  early_stopping:
    evaluation_checkpoints:
      - at_percentage: 30
        action: "Stop if significantly behind"
        threshold: "< 50% of leader score"

      - at_percentage: 60
        action: "Stop if no improvement trend"
        threshold: "Score decreasing for 3 checkpoints"

  # ═══════════════════════════════════════════════════════════════════
  # PROMPT COMPRESSION
  # ═══════════════════════════════════════════════════════════════════
  prompt_compression:
    technique: "LLMLingua"
    compression_ratio: "2-5x"
    application: "Non-critical context sections"

  # ═══════════════════════════════════════════════════════════════════
  # BUDGET TRACKING
  # ═══════════════════════════════════════════════════════════════════
  evolution_budget:
    daily_limit_usd: 100
    per_experiment_limit_usd: 20
    alerts:
      - at_percentage: 50
        action: "notify"
      - at_percentage: 80
        action: "warn"
      - at_percentage: 100
        action: "pause_evolution"
```

### 21.12 Experiment Tracking & Reproducibility

Full audit trail for compliance and debugging:

```yaml
experiment_tracking:

  platform: "MLflow + Weights & Biases"

  tracked_artifacts:
    configuration:
      - "Full genome specification"
      - "Parent lineage"
      - "Mutation/crossover operations applied"

    execution:
      - "Benchmark tasks executed"
      - "Model calls made"
      - "Token counts"
      - "Latencies"

    results:
      - "Objective metric scores"
      - "LLM judge evaluations"
      - "TrueSkill rating updates"
      - "Comparison outcomes"

    artifacts:
      - "Generated code snapshots"
      - "Test results"
      - "Security scan outputs"

  reproducibility:
    seed_tracking: true
    model_fingerprint_logging: true
    environment_versioning: true
    git_commit_linking: true

  compliance:
    audit_trail: "Immutable, append-only"
    retention: "7 years"
    change_approval_workflow: true
    sox_compatible: true
```

### 21.13 Evolution Roadmap Integration

How self-evolution phases map to the main implementation roadmap:

```yaml
evolution_phases:

  # Only begin after Phase 4 of main roadmap is complete
  prerequisite: "Core orchestrator operational end-to-end"

  phase_e1:
    name: "Evaluation Foundation"
    duration: "2 weeks"
    deliverables:
      - "Benchmark project suite (4 projects)"
      - "Objective metrics collection"
      - "Basic LLM-as-judge with 3-model panel"
      - "Experiment tracking with MLflow"
    success_criteria:
      - "Can evaluate any configuration reproducibly"
      - "Metrics are stable and meaningful"

  phase_e2:
    name: "Tournament Infrastructure"
    duration: "2 weeks"
    deliverables:
      - "TrueSkill rating implementation"
      - "Round-robin tournament scheduler"
      - "Configuration versioning and lineage"
      - "Shadow deployment infrastructure"
    success_criteria:
      - "Configs compete and ratings converge"
      - "Can shadow-run any config safely"

  phase_e3:
    name: "Evolution Engines"
    duration: "3 weeks"
    deliverables:
      - "DSPy/MIPROv2 integration"
      - "EvoPrompt genetic algorithm"
      - "Random exploration baseline"
      - "Constitutional AI layer"
    success_criteria:
      - "Can generate novel configurations"
      - "Constitutional principles enforced"

  phase_e4:
    name: "Production Evolution"
    duration: "3 weeks"
    deliverables:
      - "Thompson Sampling for online selection"
      - "Canary rollout pipeline"
      - "Automated rollback triggers"
      - "Full safety infrastructure"
    success_criteria:
      - "Evolved configs safely reach production"
      - "Zero regressions in 30-day period"

  phase_e5:
    name: "Continuous Optimization"
    duration: "Ongoing"
    deliverables:
      - "Automated evolution scheduling"
      - "Cost optimization (routing, compression)"
      - "Process reward models"
      - "PromptBreeder for meta-evolution"
    success_criteria:
      - "System measurably improves over time"
      - "Cost per improvement decreases"
```

---

## Appendix C: Self-Evolution Quick Reference

### Evolution Commands (Future CLI)

```bash
# Evolution management
aigentflow evolve status                    # Show evolution status
aigentflow evolve start                     # Start evolution cycle
aigentflow evolve stop                      # Stop evolution
aigentflow evolve configs list              # List all configurations
aigentflow evolve configs compare A B       # Compare two configs

# Tournament
aigentflow tournament status                # Show tournament status
aigentflow tournament run                   # Run tournament round
aigentflow tournament ratings               # Show TrueSkill ratings

# Deployment
aigentflow evolve promote <config-id>       # Promote to production
aigentflow evolve rollback                  # Rollback to previous
aigentflow evolve shadow <config-id>        # Start shadow deployment
```

### Key Evolution Metrics

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| TrueSkill μ | > 28 | < 22 triggers review |
| Win rate | > 0.60 | < 0.40 triggers removal |
| Test pass rate | > 0.95 | < 0.90 blocks promotion |
| Security score | 1.0 | Any vulnerability blocks |
| Cost per task | Decreasing | > 150% baseline alerts |

---

## Appendix D: Tools per Agent

### Tool Assignments and Security Constraints

```yaml
tools_per_agent:

  # ═══════════════════════════════════════════════════════════════════
  # ORCHESTRATOR
  # ═══════════════════════════════════════════════════════════════════
  orchestrator:
    tools:
      - task_spawn          # Spawn other agents
      - state_read          # Read orchestrator state
      - state_write         # Write orchestrator state
      - context_bundle      # Create/read context bundles
      - approval_request    # Request user approval
    security_level: "system"
    notes: "Has access to spawn any agent and manage system state"

  # ═══════════════════════════════════════════════════════════════════
  # PROJECT MANAGER
  # ═══════════════════════════════════════════════════════════════════
  project_manager:
    tools:
      - filesystem_read     # Read project files
      - filesystem_list     # List directories
      - task_create         # Create tasks in plan
      - task_update         # Update task status
    security_level: "internal"
    notes: "Read-only filesystem access, can create tasks"

  # ═══════════════════════════════════════════════════════════════════
  # ARCHITECT
  # ═══════════════════════════════════════════════════════════════════
  architect:
    tools:
      - filesystem_read     # Read all project files
      - filesystem_write    # Write architecture docs only
      - web_search          # Research best practices
      - diagram_generate    # Generate architecture diagrams
    security_level: "internal"
    constraints:
      filesystem_write:
        allowed_paths:
          - "architecture/**"
          - "docs/**"
          - "adrs/**"
        denied_paths:
          - "src/**"
          - "*.py"
          - "*.ts"

  # ═══════════════════════════════════════════════════════════════════
  # UI DESIGNER
  # ═══════════════════════════════════════════════════════════════════
  ui_designer:
    tools:
      - filesystem_read     # Read existing styles/components
      - filesystem_write    # Write mockups and designs
      - image_generate      # Generate placeholder images (optional)
    security_level: "internal"
    constraints:
      filesystem_write:
        allowed_paths:
          - "designs/**"
          - "mockups/**"
          - "styleguide/**"
        denied_paths:
          - "src/**"
          - "*.py"
          - "*.ts"

  # ═══════════════════════════════════════════════════════════════════
  # FRONTEND DEVELOPER
  # ═══════════════════════════════════════════════════════════════════
  frontend_developer:
    tools:
      - filesystem_read     # Read any project file
      - filesystem_write    # Write frontend code
      - code_execute        # Run npm commands
      - git_status          # Check git status
    security_level: "internal"
    constraints:
      filesystem_write:
        allowed_paths:
          - "frontend/**"
          - "src/components/**"
          - "src/hooks/**"
          - "src/stores/**"
          - "*.tsx"
          - "*.ts"
          - "*.css"
        denied_paths:
          - "backend/**"
          - "*.py"
          - ".env*"
      code_execute:
        allowed_commands:
          - "npm test"
          - "npm run lint"
          - "npm run build"
          - "npx prettier"
        blocked_commands:
          - "npm publish"
          - "rm -rf"

  # ═══════════════════════════════════════════════════════════════════
  # BACKEND DEVELOPER
  # ═══════════════════════════════════════════════════════════════════
  backend_developer:
    tools:
      - filesystem_read     # Read any project file
      - filesystem_write    # Write backend code
      - code_execute        # Run python commands
      - db_query            # Query database (read-only default)
      - git_status          # Check git status
    security_level: "internal"
    constraints:
      filesystem_write:
        allowed_paths:
          - "backend/**"
          - "app/**"
          - "tests/**"
          - "*.py"
        denied_paths:
          - "frontend/**"
          - "*.tsx"
          - ".env*"
      code_execute:
        allowed_commands:
          - "pytest"
          - "python -m pytest"
          - "ruff check"
          - "ruff format"
          - "alembic"
        blocked_commands:
          - "pip install"  # Requires approval
          - "rm -rf"
      db_query:
        mode: "readonly"
        parameterized_only: true
        blocked_operations:
          - "DROP"
          - "DELETE"
          - "TRUNCATE"

  # ═══════════════════════════════════════════════════════════════════
  # TESTER
  # ═══════════════════════════════════════════════════════════════════
  tester:
    tools:
      - filesystem_read     # Read all code and tests
      - code_execute        # Run test commands
      - screenshot_capture  # For visual testing
    security_level: "internal"
    constraints:
      code_execute:
        allowed_commands:
          - "pytest"
          - "npm test"
          - "npx playwright"
          - "npx cypress"

  # ═══════════════════════════════════════════════════════════════════
  # BUG FIXER
  # ═══════════════════════════════════════════════════════════════════
  bug_fixer:
    tools:
      - filesystem_read     # Read error context
      - filesystem_write    # Write fixes
      - code_execute        # Run tests to verify
      - git_diff            # See recent changes
    security_level: "internal"
    constraints:
      filesystem_write:
        max_files_per_fix: 3  # Limit scope of fixes
        requires_test_pass: true

  # ═══════════════════════════════════════════════════════════════════
  # GIT AGENT
  # ═══════════════════════════════════════════════════════════════════
  git_agent:
    tools:
      - git_status
      - git_commit
      - git_branch
      - git_merge
      - git_worktree
      - git_diff
      - git_log
    security_level: "internal"
    constraints:
      blocked_operations:
        - "git push --force"
        - "git reset --hard"
      pre_commit:
        - "secret_scan"     # Always scan before commit

  # ═══════════════════════════════════════════════════════════════════
  # COMPLIANCE AGENT
  # ═══════════════════════════════════════════════════════════════════
  compliance_agent:
    tools:
      - filesystem_read     # Read all files for scanning
      - audit_log_read      # Read audit logs
      - secret_scan         # Scan for secrets
      - vulnerability_scan  # Check dependencies
      - compliance_report   # Generate reports
    security_level: "restricted"
    notes: "Read-only access, but can block operations via hooks"

  # ═══════════════════════════════════════════════════════════════════
  # PROJECT ANALYZER
  # ═══════════════════════════════════════════════════════════════════
  project_analyzer:
    tools:
      - filesystem_read     # Read entire codebase
      - filesystem_list     # List all directories
      - filesystem_write    # Write analysis results
      - code_execute        # Run analysis tools
    security_level: "internal"
    constraints:
      filesystem_write:
        allowed_paths:
          - "orchestrator-data/**/analysis/**"
          - "**/claude.md"
      code_execute:
        allowed_commands:
          - "cloc"          # Count lines of code
          - "tree"          # Directory structure

  # ═══════════════════════════════════════════════════════════════════
  # REVIEWER
  # ═══════════════════════════════════════════════════════════════════
  reviewer:
    tools:
      - filesystem_read     # Read code to review
      - git_diff            # See changes
      - lesson_write        # Record lessons learned
    security_level: "internal"
    notes: "Read-only code access, can write to lessons DB"

  # ═══════════════════════════════════════════════════════════════════
  # ANALYST
  # ═══════════════════════════════════════════════════════════════════
  analyst:
    tools:
      - filesystem_read     # Read project context
      - web_search          # Research online
      - web_fetch           # Fetch documentation
    security_level: "internal"
    notes: "Research-only, no write access"
```

### Tool Security Levels

| Level | Description | Example Agents |
|-------|-------------|----------------|
| **system** | Full access, can spawn agents | Orchestrator |
| **restricted** | Audit access, can block but not modify | Compliance Agent |
| **internal** | Standard development access | Developers, Tester |
| **public** | Read-only, external-facing | Documentation agents |

---

## Appendix E: Complete Hooks Catalog

### Hook Categories and Events

```yaml
hooks_catalog:

  # ═══════════════════════════════════════════════════════════════════
  # AGENT LIFECYCLE HOOKS
  # ═══════════════════════════════════════════════════════════════════
  agent_lifecycle:
    AGENT_SPAWN_BEFORE:
      description: "Before agent is spawned"
      payload: { agent_type, task_id, context_size }
      can_block: true
      use_cases:
        - "Validate agent type is allowed"
        - "Check resource limits"
        - "Inject additional context"

    AGENT_SPAWN_AFTER:
      description: "After agent is spawned"
      payload: { agent_id, agent_type, spawn_timestamp }
      can_block: false
      use_cases:
        - "Log agent creation"
        - "Start monitoring"

    AGENT_THINKING_START:
      description: "Agent begins reasoning"
      payload: { agent_id, task_id }
      can_block: false
      use_cases:
        - "Start thinking timer"
        - "Update UI status"

    AGENT_THINKING_CHUNK:
      description: "Streaming thinking output"
      payload: { agent_id, chunk }
      can_block: false
      use_cases:
        - "Display thinking to user"
        - "Monitor reasoning quality"

    AGENT_RESPONSE_START:
      description: "Agent begins response"
      payload: { agent_id, response_type }
      can_block: false
      use_cases:
        - "Update UI to show response"

    AGENT_RESPONSE_CHUNK:
      description: "Streaming response output"
      payload: { agent_id, chunk }
      can_block: false
      use_cases:
        - "Display response progressively"

    AGENT_RESPONSE_COMPLETE:
      description: "Agent finished response"
      payload: { agent_id, response, duration_ms, tokens_used }
      can_block: false
      use_cases:
        - "Log completion"
        - "Trigger routing decision"
        - "Update metrics"

    AGENT_ERROR:
      description: "Agent encountered error"
      payload: { agent_id, error, recoverable, stack_trace }
      can_block: false
      use_cases:
        - "Log error"
        - "Trigger recovery"
        - "Alert on-call"

  # ═══════════════════════════════════════════════════════════════════
  # TOOL USAGE HOOKS
  # ═══════════════════════════════════════════════════════════════════
  tool_usage:
    TOOL_CALL_BEFORE:
      description: "Before any tool is called"
      payload: { agent_id, tool_name, tool_input }
      can_block: true
      use_cases:
        - "Validate tool permissions"
        - "Rate limiting"
        - "Input sanitization"

    TOOL_CALL_AFTER:
      description: "After tool completes"
      payload: { agent_id, tool_name, tool_output, duration_ms }
      can_block: false
      use_cases:
        - "Log tool usage"
        - "Update metrics"

    TOOL_ERROR:
      description: "Tool returned error"
      payload: { agent_id, tool_name, error }
      can_block: false
      use_cases:
        - "Log error"
        - "Retry logic"

    FILE_READ_BEFORE:
      description: "Before file is read"
      payload: { agent_id, file_path, purpose }
      can_block: true
      use_cases:
        - "Block sensitive files"
        - "Audit file access"

    FILE_WRITE_BEFORE:
      description: "Before file is written"
      payload: { agent_id, file_path, content }
      can_block: true
      can_modify: true  # Can modify content
      use_cases:
        - "Block sensitive files"
        - "Add headers/comments"
        - "Format code"

    FILE_WRITE_AFTER:
      description: "After file is written"
      payload: { agent_id, file_path }
      can_block: false
      use_cases:
        - "Run linter"
        - "Update index"

    DATABASE_QUERY_BEFORE:
      description: "Before database query"
      payload: { agent_id, query, params }
      can_block: true
      use_cases:
        - "Validate query safety"
        - "Block dangerous operations"
        - "Audit data access"

    EXTERNAL_API_CALL:
      description: "Before external API call"
      payload: { agent_id, url, method, headers }
      can_block: true
      use_cases:
        - "Validate allowed domains"
        - "Rate limiting"
        - "Add auth headers"

  # ═══════════════════════════════════════════════════════════════════
  # SECURITY HOOKS
  # ═══════════════════════════════════════════════════════════════════
  security:
    SECRET_DETECTED:
      description: "Secret found in content"
      payload: { content_type, secret_type, location, masked_value }
      action: "BLOCK"  # Always blocks
      use_cases:
        - "Prevent secret commit"
        - "Alert security team"
        - "Quarantine content"

    SENSITIVE_DATA_DETECTED:
      description: "PII or sensitive data found"
      payload: { data_type, location, redacted_sample }
      can_block: true
      use_cases:
        - "GDPR compliance"
        - "Data classification"

    COMPLIANCE_VIOLATION:
      description: "Code violates compliance rule"
      payload: { rule_id, rule_description, file_path, line_number }
      can_block: true
      use_cases:
        - "Block non-compliant code"
        - "Generate compliance report"

    ACCESS_DENIED:
      description: "Agent tried unauthorized action"
      payload: { agent_id, action, resource, reason }
      can_block: false  # Already blocked
      use_cases:
        - "Security audit"
        - "Detect malicious patterns"

    AUTHENTICATION_EVENT:
      description: "Auth-related event occurred"
      payload: { event_type, user_id, success, method }
      can_block: false
      use_cases:
        - "Audit logging"
        - "Anomaly detection"

    ENCRYPTION_REQUIRED:
      description: "Data requires encryption"
      payload: { data_type, destination }
      can_block: true
      use_cases:
        - "Enforce encryption policy"

  # ═══════════════════════════════════════════════════════════════════
  # WORKFLOW HOOKS
  # ═══════════════════════════════════════════════════════════════════
  workflow:
    TASK_CREATED:
      description: "New task created"
      payload: { task_id, task_type, parent_id, created_by }
      can_block: false
      use_cases:
        - "Update task board"
        - "Notify watchers"

    TASK_STARTED:
      description: "Task execution began"
      payload: { task_id, agent_id }
      can_block: false
      use_cases:
        - "Update status"
        - "Start timer"

    TASK_COMPLETED:
      description: "Task finished successfully"
      payload: { task_id, result, duration_ms }
      can_block: false
      use_cases:
        - "Update dependencies"
        - "Trigger next task"

    TASK_FAILED:
      description: "Task execution failed"
      payload: { task_id, error, retry_count }
      can_block: false
      use_cases:
        - "Trigger bug fix"
        - "Alert user"

    DESIGN_SUBMITTED:
      description: "Designer submitted mockup"
      payload: { design_id, mockup_path, feature_id }
      can_block: false
      use_cases:
        - "Notify user for review"
        - "Block build tasks"

    DESIGN_APPROVED:
      description: "User approved design"
      payload: { design_id, approved_by, timestamp }
      can_block: false
      use_cases:
        - "Unblock build tasks"
        - "Archive approved version"

    DESIGN_CHANGES_REQUESTED:
      description: "User requested design changes"
      payload: { design_id, feedback, requested_by }
      can_block: false
      use_cases:
        - "Notify designer"
        - "Log feedback"

    BUILD_STARTED:
      description: "Build phase began"
      payload: { epic_id, tasks_count }
      can_block: false
      use_cases:
        - "Update project status"

    BUILD_COMPLETE:
      description: "All build tasks finished"
      payload: { epic_id, files_created, files_modified }
      can_block: false
      use_cases:
        - "Trigger testing"
        - "Notify user"

    TEST_RUN_STARTED:
      description: "Test suite execution began"
      payload: { test_suite, triggered_by }
      can_block: false
      use_cases:
        - "Update status"

    TEST_RUN_COMPLETE:
      description: "Test suite finished"
      payload: { passed, failed, coverage, duration_ms }
      can_block: false
      use_cases:
        - "Trigger bug fix if failures"
        - "Update quality metrics"

    REVIEW_REQUESTED:
      description: "Code review requested"
      payload: { pr_id, files_changed, reviewer }
      can_block: false
      use_cases:
        - "Spawn reviewer agent"

    REVIEW_COMPLETE:
      description: "Code review finished"
      payload: { pr_id, approved, comments_count, lessons }
      can_block: false
      use_cases:
        - "Merge if approved"
        - "Request fixes if not"

  # ═══════════════════════════════════════════════════════════════════
  # GIT HOOKS
  # ═══════════════════════════════════════════════════════════════════
  git:
    GIT_COMMIT_BEFORE:
      description: "Before git commit"
      payload: { files, message, branch, author }
      can_block: true
      use_cases:
        - "Run secret scan"
        - "Validate commit message"
        - "Check branch policy"

    GIT_COMMIT_AFTER:
      description: "After git commit"
      payload: { commit_hash, branch }
      can_block: false
      use_cases:
        - "Trigger CI"
        - "Update changelog"

    GIT_PUSH_BEFORE:
      description: "Before git push"
      payload: { branch, commits_count, remote }
      can_block: true
      use_cases:
        - "Block force push to main"
        - "Require review"

    GIT_MERGE_BEFORE:
      description: "Before git merge"
      payload: { source_branch, target_branch, conflicts }
      can_block: true
      use_cases:
        - "Detect conflicts"
        - "Validate target branch"

    GIT_MERGE_CONFLICT:
      description: "Merge conflict detected"
      payload: { files, source_branch, target_branch }
      can_block: false
      use_cases:
        - "Spawn conflict resolver"

  # ═══════════════════════════════════════════════════════════════════
  # LEARNING HOOKS
  # ═══════════════════════════════════════════════════════════════════
  learning:
    LESSON_CANDIDATE_IDENTIFIED:
      description: "Potential lesson found"
      payload: { lesson, source_agent, context, initial_score }
      can_block: false
      use_cases:
        - "Queue for scoring"
        - "Deduplicate"

    LESSON_SCORED:
      description: "Lesson scoring complete"
      payload: { lesson_id, score, score_breakdown }
      can_block: false
      use_cases:
        - "Auto-commit if high score"
        - "Flag for review if medium"

    LESSON_COMMITTED:
      description: "Lesson added to knowledge base"
      payload: { lesson_id, category, embedding_id }
      can_block: false
      use_cases:
        - "Update search index"
        - "Notify relevant agents"

    LESSON_APPLIED:
      description: "Lesson used by agent"
      payload: { lesson_id, agent_id, task_id }
      can_block: false
      use_cases:
        - "Track lesson effectiveness"
        - "Update usage count"

  # ═══════════════════════════════════════════════════════════════════
  # NOTIFICATION HOOKS
  # ═══════════════════════════════════════════════════════════════════
  notification:
    USER_INPUT_REQUIRED:
      description: "Orchestrator needs user input"
      payload: { prompt, options, context }
      can_block: false
      use_cases:
        - "Show notification"
        - "Send email/Slack"

    ORCHESTRATION_COMPLETE:
      description: "Task/epic completed"
      payload: { epic_id, summary, duration, lessons_learned }
      can_block: false
      use_cases:
        - "Desktop notification"
        - "Email summary"

    ERROR_ESCALATED:
      description: "Error escalated to user"
      payload: { error, context, attempted_fixes }
      can_block: false
      use_cases:
        - "Alert user"
        - "Create issue"
```

### Hook Configuration Example

```json
// settings.json hooks configuration
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 scripts/check_file_permissions.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit:*.py|Write:*.py",
        "hooks": [
          {
            "type": "command",
            "command": "ruff format $FILE && ruff check --fix $FILE"
          }
        ]
      },
      {
        "matcher": "Edit:*.tsx|Edit:*.ts",
        "hooks": [
          {
            "type": "command",
            "command": "npx prettier --write $FILE && npx eslint --fix $FILE"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Aigentflow' 'User input required'"
          }
        ]
      }
    ]
  }
}
```

### Hook Exit Codes

| Code | Meaning | Effect |
|------|---------|--------|
| 0 | Success | Continue execution |
| 1 | Error (non-blocking) | Log warning, continue |
| 2 | Block | Stop execution, report to user |
| 3 | Modify | Use modified content from stdout |

---

## 22. CLAUDE.md Specification

The CLAUDE.md file is the primary mechanism for providing persistent context to Claude Code. Aigentflow uses a hierarchical CLAUDE.md system with both system-level and project-level files.

### 22.1 System-Level CLAUDE.md

The system-level CLAUDE.md lives in the orchestrator-system directory and provides context for developing Aigentflow itself.

**Location:** `orchestrator-system/CLAUDE.md`

```markdown
# Aigentflow Development Context

## Project Overview
Aigentflow is a CLI-first multi-agent orchestrator for Claude Code. It coordinates
specialized AI agents to complete software development tasks through structured
workflows, persistent memory, and self-evolving capabilities.

## Architecture Summary

### Core Components
- **Orchestrator**: Main coordination layer using StateGraph pattern
- **Agent Pool**: 14 specialized agents (see Section 4)
- **Context Manager**: Handles context loading, summarization, and token budgets
- **MCP Servers**: filesystem, git, terminal, database, github, web, memory
- **Skills Engine**: Atomic capabilities invoked by agents

### Key Patterns
- **Event Sourcing**: All state changes are immutable events
- **Context Bundles**: Checkpoint + context + agent state for recovery
- **Design-First**: UI mockups required before frontend development
- **Two-Tier Compliance**: Platform (mandatory) + Project (optional)

## File Structure

```
orchestrator-system/
├── src/
│   ├── core/                # Core orchestration logic
│   │   ├── orchestrator.py  # Main StateGraph implementation
│   │   ├── context_manager.py
│   │   ├── state_manager.py
│   │   └── router.py        # Agent routing logic
│   ├── agents/              # Agent implementations
│   │   ├── base_agent.py    # Abstract base class
│   │   ├── orchestrator_agent.py
│   │   ├── project_manager.py
│   │   └── ...
│   ├── skills/              # Skill implementations
│   ├── mcp/                 # MCP server integrations
│   ├── memory/              # Memory hierarchy (core, working, archival)
│   └── cli/                 # CLI entry points
├── orchestrator-data/       # Runtime data (separate from code)
├── tests/
└── CLAUDE.md               # This file
```

## Coding Standards

### Python Style
- Python 3.11+ with full type hints
- Use Pydantic for all data models
- Async/await for I/O operations
- Structured logging with structlog

### Agent Development
- Agents inherit from BaseAgent
- All agent outputs use AgentResponse[T] schema
- Agents declare required tools and context in their definition
- Max context budget: 50K tokens per agent

### Testing Requirements
- pytest for all tests
- Minimum 80% coverage for core modules
- Integration tests for agent workflows
- Mock external APIs (Anthropic, GitHub)

## Guardrails (MUST FOLLOW)

### Protected Operations
- Database migrations → Require explicit approval
- Agent definition changes → Run full test suite
- MCP server configuration → Security review required
- Production deployments → Require compliance check

### Forbidden Operations
- NEVER hardcode API keys or secrets
- NEVER bypass the design approval workflow
- NEVER commit without running tests
- NEVER modify event history (append-only)

### Required Checks
- After agent changes: `pytest tests/agents/`
- After skill changes: `pytest tests/skills/`
- Before commits: `ruff check && ruff format --check`
- CI must pass: All tests + type checking + linting

## Common Development Tasks

| Task | Command/Approach |
|------|------------------|
| Add new agent | Read base_agent.py, create in agents/, register in agent_pool.yaml |
| Add new skill | Create in skills/{category}/, add to skill_catalog.yaml |
| Modify context flow | Update context_manager.py, test with integration tests |
| Add MCP server | Create adapter in mcp/, register in mcp_config.yaml |
| Debug agent routing | Check router.py routing_hints, enable verbose logging |

## Key Files Reference

| Purpose | File | Notes |
|---------|------|-------|
| Main orchestrator | src/core/orchestrator.py | StateGraph implementation |
| Agent routing | src/core/router.py | Decides next agent |
| Context management | src/core/context_manager.py | Token budgets, summarization |
| Base agent class | src/agents/base_agent.py | All agents inherit this |
| Response schemas | src/schemas/responses.py | AgentResponse[T] definitions |
| Hook definitions | orchestrator-data/system/hooks/ | Lifecycle hooks |
| Agent configs | orchestrator-data/system/agents/ | Agent YAML definitions |
```

### 22.2 Project-Level claude.md

Every project managed by Aigentflow gets a `claude.md` file generated by the Project Analyzer agent during project initialization.

**Location:** `orchestrator-data/projects/{project_id}/claude.md`

```markdown
# {Project Name} - Claude Context

## Project Overview
{Generated description of the project purpose and scope}

## Tech Stack
- **Frontend**: {framework, version}
- **Backend**: {language, framework, version}
- **Database**: {type, version}
- **Infrastructure**: {hosting, CI/CD}

## Architecture Summary

### Directory Structure
```
{Auto-generated from analysis}
```

### Key Components
{Identified components with brief descriptions}

### Data Flow
{How data moves through the system}

## Coding Standards

### Style Guidelines
{Detected from existing code or configured by user}

### Naming Conventions
{File naming, variable naming, etc.}

### Import Patterns
{How imports are organized in this project}

## Common Patterns

### Database Access
{Pattern used for database queries}

### API Endpoints
{Pattern for adding new endpoints}

### Component Creation
{Pattern for new UI components}

## Key Files Reference

| Purpose | File | Notes |
|---------|------|-------|
| Entry point | {path} | {description} |
| Config | {path} | {description} |
| Routes | {path} | {description} |

## Guardrails

### Protected Files
{Files that should not be modified without approval}

### Forbidden Operations
{Project-specific restrictions}

### Required Checks
{Commands to run before commits}

## Known Issues & Debt
{Technical debt items identified during analysis}

---
*Generated by Aigentflow Project Analyzer*
*Last updated: {timestamp}*
*Analysis version: {version}*
```

### 22.3 Modular Rules with .claude/rules/

For complex projects, context can be split into modular rule files that are loaded based on the current file or task context.

**Directory Structure:**
```
.claude/
├── rules/
│   ├── 01-project-overview.md      # Always loaded first
│   ├── 02-architecture.md          # Core architecture rules
│   ├── frontend-*.md               # Loaded for frontend files
│   ├── backend-*.md                # Loaded for backend files
│   ├── testing-*.md                # Loaded for test files
│   └── security-*.md               # Loaded for security-sensitive files
└── settings.json                   # Claude Code settings
```

**Rule File Pattern Matching:**

```yaml
rule_loading:
  patterns:
    # Always load these
    always:
      - "01-*.md"
      - "02-*.md"

    # Load based on file extension
    by_extension:
      ".tsx|.jsx|.ts|.js":
        - "frontend-*.md"
      ".py":
        - "backend-*.md"
      "_test.py|.test.ts|.spec.ts":
        - "testing-*.md"

    # Load based on file path
    by_path:
      "src/api/":
        - "api-*.md"
      "src/components/":
        - "components-*.md"
      "infrastructure/":
        - "infra-*.md"

    # Load based on task type
    by_task:
      "security_audit":
        - "security-*.md"
      "performance_optimization":
        - "performance-*.md"
```

### 22.4 CLAUDE.md Generation Pipeline

The Project Analyzer agent generates claude.md through a structured analysis pipeline:

```yaml
claude_md_generation:
  steps:
    1_discovery:
      actions:
        - "Scan directory structure"
        - "Identify project type (npm, pip, cargo, etc.)"
        - "Find entry points"
        - "Detect frameworks"
      outputs:
        - project_type
        - tech_stack
        - entry_points

    2_code_analysis:
      actions:
        - "Parse key files"
        - "Extract patterns"
        - "Identify conventions"
        - "Map dependencies"
      outputs:
        - coding_patterns
        - naming_conventions
        - import_patterns

    3_architecture_extraction:
      actions:
        - "Build component graph"
        - "Trace data flow"
        - "Identify layers"
        - "Map API surface"
      outputs:
        - architecture_summary
        - component_map
        - api_surface

    4_context_synthesis:
      actions:
        - "Generate project overview"
        - "Create key files table"
        - "Derive guardrails"
        - "Identify common tasks"
      outputs:
        - claude_md_content

    5_validation:
      actions:
        - "Verify file references exist"
        - "Check command validity"
        - "Test import examples"
      outputs:
        - validated_claude_md
```

### 22.5 claude.md Update Triggers

The claude.md file is regenerated or updated when:

```yaml
update_triggers:
  full_regeneration:
    - "Project initialization"
    - "Major version upgrade detected"
    - "User requests 'refresh project context'"
    - "More than 30% of files changed since last generation"

  incremental_update:
    - "New major file added (routes, models, components)"
    - "Tech stack change detected (new framework)"
    - "Package.json/requirements.txt significant changes"
    - "After learning a new project-specific lesson"

  section_update:
    - "Key files table: When files are renamed/moved"
    - "Guardrails: When hooks configuration changes"
    - "Patterns: When new pattern detected in codebase"
```

---

## 23. Real-Time Activity System

The activity system provides real-time visibility into orchestrator operations through WebSocket streaming and persistent activity logs.

### 23.1 WebSocket Event Types

```typescript
// Core event type definitions
interface ActivityEvent {
  event_id: string;           // UUID
  timestamp: string;          // ISO 8601
  session_id: string;         // Orchestration session
  project_id: string;
  event_type: ActivityEventType;
  payload: EventPayload;
  metadata: {
    sequence: number;         // For ordering
    parent_event_id?: string; // For event chains
    correlation_id: string;   // Links related events
  };
}

type ActivityEventType =
  // Agent lifecycle events
  | "agent.spawned"
  | "agent.thinking"
  | "agent.tool_call"
  | "agent.tool_result"
  | "agent.response"
  | "agent.completed"
  | "agent.failed"
  | "agent.blocked"

  // Task events
  | "task.created"
  | "task.started"
  | "task.progress"
  | "task.completed"
  | "task.failed"

  // Workflow events
  | "workflow.started"
  | "workflow.checkpoint"
  | "workflow.paused"
  | "workflow.resumed"
  | "workflow.completed"

  // Approval events
  | "approval.requested"
  | "approval.granted"
  | "approval.denied"
  | "approval.timeout"

  // File events
  | "file.read"
  | "file.write"
  | "file.delete"

  // Git events
  | "git.commit"
  | "git.branch"
  | "git.push"
  | "git.conflict"

  // System events
  | "system.error"
  | "system.warning"
  | "system.checkpoint"
  | "system.recovery";
```

### 23.2 Event Payload Schemas

```typescript
// Agent thinking event
interface AgentThinkingPayload {
  agent_id: string;
  agent_type: AgentType;
  thinking_content: string;   // Streaming text
  tokens_used: number;
  is_final: boolean;
}

// Tool call event
interface ToolCallPayload {
  agent_id: string;
  tool_name: string;
  tool_input: Record<string, any>;
  is_streaming: boolean;
}

// Task progress event
interface TaskProgressPayload {
  task_id: string;
  task_type: string;
  progress: number;           // 0-100
  status_message: string;
  substeps?: {
    total: number;
    completed: number;
    current: string;
  };
}

// Approval request event
interface ApprovalRequestPayload {
  approval_id: string;
  approval_type: "design" | "code" | "deploy" | "security";
  title: string;
  description: string;
  artifacts: {
    type: string;
    path: string;
    preview_url?: string;
  }[];
  timeout_seconds: number;
  default_action: "approve" | "deny" | "timeout";
}
```

### 23.3 Subscription Model

```yaml
websocket_subscriptions:
  channels:
    # Project-level channels
    project/{project_id}/activity:
      description: "All activity for a project"
      events: ["*"]

    project/{project_id}/agents:
      description: "Agent-specific events"
      events: ["agent.*"]

    project/{project_id}/tasks:
      description: "Task progress events"
      events: ["task.*"]

    project/{project_id}/approvals:
      description: "Approval requests"
      events: ["approval.*"]

    # User-level channels
    user/{user_id}/notifications:
      description: "User notifications"
      events: ["approval.requested", "system.error", "workflow.completed"]

  filters:
    # Clients can filter within a channel
    agent_type: ["BACKEND_DEVELOPER", "TESTER"]
    task_id: "specific-task-id"
    severity: ["error", "warning"]

  connection:
    protocol: "wss"
    heartbeat_interval: 30s
    reconnect_strategy: "exponential_backoff"
    max_reconnect_attempts: 10
```

### 23.4 CLI Activity Display

```yaml
cli_activity_display:
  modes:
    compact:
      description: "Single-line status updates"
      format: "[{timestamp}] {agent_type}: {status_message}"
      example: "[14:32:05] BACKEND_DEVELOPER: Implementing user authentication endpoint"

    verbose:
      description: "Detailed activity with tool calls"
      shows:
        - "Agent thinking (summarized)"
        - "Tool calls with inputs"
        - "File modifications"
        - "Progress percentages"

    stream:
      description: "Full streaming output"
      shows:
        - "Complete agent thinking"
        - "Tool call results"
        - "All file diffs"

  visual_indicators:
    agent_icons:
      ORCHESTRATOR: "🎭"
      PROJECT_MANAGER: "📋"
      ARCHITECT: "🏗️"
      UI_DESIGNER: "🎨"
      FRONTEND_DEVELOPER: "⚛️"
      BACKEND_DEVELOPER: "⚙️"
      TESTER: "🧪"
      BUG_FIXER: "🔧"
      REVIEWER: "👁️"
      GIT_AGENT: "📦"

    status_colors:
      thinking: "blue"
      working: "yellow"
      success: "green"
      error: "red"
      blocked: "magenta"
      waiting: "cyan"
```

### 23.5 Activity Persistence Tiers

```yaml
persistence_tiers:
  hot_storage:
    backend: "Redis"
    retention: "24-72 hours"
    purpose: "Real-time streaming, active sessions"
    structure:
      streams:
        pattern: "activity:{project_id}:{session_id}"
        max_length: 10000
      pubsub:
        pattern: "live:{project_id}"

  warm_storage:
    backend: "PostgreSQL"
    retention: "30-90 days"
    purpose: "Query, search, audit"
    structure:
      table: "activity_events"
      indexes:
        - "project_id, timestamp"
        - "session_id"
        - "event_type"
        - "correlation_id"
      partitioning: "monthly by timestamp"

  cold_storage:
    backend: "S3 / Object Storage"
    retention: "7+ years"
    purpose: "Compliance, long-term audit"
    structure:
      path: "s3://aigentflow-archive/{year}/{month}/{project_id}/"
      format: "JSONL, gzip compressed"
      metadata: "Stored in DynamoDB/Glacier catalog"
```

### 23.6 Activity Search & Query

```yaml
activity_query_api:
  endpoints:
    search:
      path: "/api/v1/activity/search"
      method: "POST"
      body:
        project_id: "required"
        filters:
          time_range: { start: "ISO8601", end: "ISO8601" }
          event_types: ["agent.*", "task.*"]
          agent_types: ["BACKEND_DEVELOPER"]
          status: ["completed", "failed"]
          text_search: "authentication"
        pagination:
          cursor: "optional"
          limit: 100

    replay:
      path: "/api/v1/activity/replay"
      method: "POST"
      body:
        session_id: "required"
        from_event_id: "optional"
        speed: 1.0  # 1.0 = real-time, 2.0 = 2x speed
      response: "WebSocket URL for replay stream"

    export:
      path: "/api/v1/activity/export"
      method: "POST"
      body:
        project_id: "required"
        time_range: { start: "ISO8601", end: "ISO8601" }
        format: "json" | "csv" | "jsonl"
      response: "Download URL (async generation)"
```

---

## 24. Configuration Hierarchy

Aigentflow uses a 5-layer configuration hierarchy where each layer can override values from the layer above.

### 24.1 Configuration Layers

```yaml
configuration_layers:
  1_system:
    description: "Platform defaults, shipped with Aigentflow"
    location: "orchestrator-system/config/defaults/"
    managed_by: "Aigentflow maintainers"
    mutable: false
    examples:
      - "Default agent definitions"
      - "Base guardrails"
      - "Default token budgets"
      - "Standard skill definitions"

  2_organization:
    description: "Organization-wide overrides"
    location: "orchestrator-data/org/{org_id}/config/"
    managed_by: "Organization admins"
    mutable: true
    examples:
      - "Company coding standards"
      - "Approved tech stacks"
      - "Compliance requirements"
      - "Custom agent configurations"

  3_project:
    description: "Project-specific configuration"
    location: "orchestrator-data/projects/{project_id}/config/"
    managed_by: "Project leads"
    mutable: true
    examples:
      - "Project tech stack"
      - "Custom skills"
      - "Project guardrails"
      - "Agent overrides"

  4_user:
    description: "Individual user preferences"
    location: "orchestrator-data/user/{user_id}/config/"
    managed_by: "Individual users"
    mutable: true
    examples:
      - "Editor preferences"
      - "Notification settings"
      - "Favorite skills"
      - "Personal hooks"

  5_environment:
    description: "Runtime environment overrides"
    location: "Environment variables"
    managed_by: "Deployment"
    mutable: true
    examples:
      - "API endpoints"
      - "Feature flags"
      - "Debug settings"
      - "Resource limits"
```

### 24.2 Override Semantics

```yaml
override_semantics:
  merge_strategies:
    replace:
      description: "Lower layer completely replaces higher layer"
      applies_to:
        - "Scalar values (strings, numbers, booleans)"
        - "Explicit 'replace' markers"
      example:
        system: { max_retries: 3 }
        project: { max_retries: 5 }
        result: { max_retries: 5 }

    deep_merge:
      description: "Objects are recursively merged"
      applies_to:
        - "Object/dictionary values"
      example:
        system: { agent: { timeout: 60, retries: 3 } }
        project: { agent: { timeout: 120 } }
        result: { agent: { timeout: 120, retries: 3 } }

    append:
      description: "Arrays are concatenated"
      applies_to:
        - "Array values with '+' prefix"
      example:
        system: { skills: ["code", "test"] }
        project: { "+skills": ["security_scan"] }
        result: { skills: ["code", "test", "security_scan"] }

    prepend:
      description: "Array values added to beginning"
      applies_to:
        - "Array values with '++' prefix"
      example:
        system: { guardrails: ["no_secrets"] }
        project: { "++guardrails": ["project_specific"] }
        result: { guardrails: ["project_specific", "no_secrets"] }

    remove:
      description: "Remove items from parent array"
      applies_to:
        - "Array values with '-' prefix"
      example:
        system: { skills: ["code", "test", "deploy"] }
        project: { "-skills": ["deploy"] }
        result: { skills: ["code", "test"] }
```

### 24.3 Configuration Schema

```yaml
# Master configuration schema (JSON Schema draft-07)
configuration_schema:
  $schema: "http://json-schema.org/draft-07/schema#"
  type: object

  properties:
    version:
      type: string
      pattern: "^[0-9]+\\.[0-9]+\\.[0-9]+$"

    agents:
      type: object
      description: "Agent configuration overrides"
      additionalProperties:
        $ref: "#/$defs/agent_config"

    skills:
      type: object
      description: "Skill availability and configuration"
      additionalProperties:
        $ref: "#/$defs/skill_config"

    guardrails:
      type: object
      properties:
        input:
          type: array
          items: { $ref: "#/$defs/guardrail" }
        output:
          type: array
          items: { $ref: "#/$defs/guardrail" }
        code:
          type: array
          items: { $ref: "#/$defs/guardrail" }

    context:
      type: object
      properties:
        max_tokens:
          type: integer
          minimum: 1000
          maximum: 200000
        summarization_threshold:
          type: number
          minimum: 0.5
          maximum: 1.0
        retrieval:
          type: object
          properties:
            hybrid_weight:
              type: number
              minimum: 0
              maximum: 1
            rerank_enabled:
              type: boolean

    hooks:
      type: object
      additionalProperties:
        type: array
        items: { $ref: "#/$defs/hook_config" }

    compliance:
      type: object
      properties:
        enabled:
          type: boolean
        frameworks:
          type: array
          items:
            enum: ["soc2", "gdpr", "hipaa", "pci_dss", "iso27001"]
        auto_scan:
          type: boolean

    notifications:
      type: object
      properties:
        channels:
          type: array
          items:
            enum: ["cli", "email", "slack", "webhook"]
        events:
          type: object
          additionalProperties:
            type: array
            items: { type: string }

  $defs:
    agent_config:
      type: object
      properties:
        enabled: { type: boolean }
        max_context_tokens: { type: integer }
        tools_allowed: { type: array, items: { type: string } }
        skills_available: { type: array, items: { type: string } }
        model_override: { type: string }

    skill_config:
      type: object
      properties:
        enabled: { type: boolean }
        timeout_ms: { type: integer }
        max_retries: { type: integer }

    guardrail:
      type: object
      properties:
        name: { type: string }
        enabled: { type: boolean }
        severity: { enum: ["error", "warning", "info"] }
        action: { enum: ["block", "warn", "log", "redact", "fix"] }

    hook_config:
      type: object
      properties:
        type: { enum: ["command", "script", "http"] }
        matcher: { type: string }
        command: { type: string }
        timeout_ms: { type: integer }
```

### 24.4 Configuration Loading

```python
# Configuration loading pseudocode
def load_configuration(
    project_id: str,
    user_id: str,
    org_id: str | None = None
) -> Configuration:
    """
    Load configuration with full hierarchy resolution.
    """

    # Layer 1: System defaults (always present)
    config = load_yaml("orchestrator-system/config/defaults/config.yaml")

    # Layer 2: Organization (if applicable)
    if org_id:
        org_config = load_yaml(f"orchestrator-data/org/{org_id}/config/config.yaml")
        config = deep_merge(config, org_config)

    # Layer 3: Project
    project_config = load_yaml(f"orchestrator-data/projects/{project_id}/config/config.yaml")
    config = deep_merge(config, project_config)

    # Layer 4: User preferences
    user_config = load_yaml(f"orchestrator-data/user/{user_id}/config/config.yaml")
    config = deep_merge(config, user_config)

    # Layer 5: Environment variables
    env_config = load_from_env(prefix="AIGENTFLOW_")
    config = deep_merge(config, env_config)

    # Validate against schema
    validate_config(config, load_schema("configuration_schema"))

    return Configuration(**config)


def deep_merge(base: dict, override: dict) -> dict:
    """
    Recursively merge override into base with semantic handling.
    """
    result = base.copy()

    for key, value in override.items():
        # Handle special prefixes
        if key.startswith("+"):
            # Append to array
            actual_key = key[1:]
            if actual_key in result and isinstance(result[actual_key], list):
                result[actual_key] = result[actual_key] + value
            else:
                result[actual_key] = value

        elif key.startswith("++"):
            # Prepend to array
            actual_key = key[2:]
            if actual_key in result and isinstance(result[actual_key], list):
                result[actual_key] = value + result[actual_key]
            else:
                result[actual_key] = value

        elif key.startswith("-"):
            # Remove from array
            actual_key = key[1:]
            if actual_key in result and isinstance(result[actual_key], list):
                result[actual_key] = [
                    item for item in result[actual_key]
                    if item not in value
                ]

        elif isinstance(value, dict) and key in result and isinstance(result[key], dict):
            # Deep merge objects
            result[key] = deep_merge(result[key], value)

        else:
            # Replace value
            result[key] = value

    return result
```

### 24.5 Configuration CLI Commands

```bash
# View effective configuration
aigentflow config show
aigentflow config show --layer project
aigentflow config show --key agents.backend_developer

# Set configuration values
aigentflow config set agents.backend_developer.max_context_tokens 60000 --layer project
aigentflow config set guardrails.input.+[] "custom_guardrail" --layer project

# Validate configuration
aigentflow config validate
aigentflow config validate --strict

# Show configuration diff between layers
aigentflow config diff --from system --to project

# Reset to defaults
aigentflow config reset --layer project
aigentflow config reset --layer project --key agents

# Export/import configuration
aigentflow config export --output config-backup.yaml
aigentflow config import --input config-backup.yaml --layer project
```

---

## 25. Incident Response

The incident response system provides structured procedures for detecting, containing, and resolving security and operational incidents.

### 25.1 Severity Classification

```yaml
severity_levels:
  SEV-1:
    name: "Critical"
    description: "Complete service outage, data breach, or security compromise"
    examples:
      - "Production database compromised"
      - "Customer data exposed"
      - "Complete platform unavailable"
      - "Active exploitation detected"
    response_time: "15 minutes"
    resolution_target: "4 hours"
    notification:
      - "On-call engineer (immediate)"
      - "Engineering lead (immediate)"
      - "CEO/CTO (within 30 min)"
      - "Legal (if data breach)"
    bridge: "War room activated"

  SEV-2:
    name: "High"
    description: "Major feature unavailable, significant performance degradation"
    examples:
      - "Agent execution failing for all users"
      - "Authentication system down"
      - "Data corruption detected (limited scope)"
      - "Critical vulnerability discovered"
    response_time: "30 minutes"
    resolution_target: "8 hours"
    notification:
      - "On-call engineer (immediate)"
      - "Engineering lead (within 1 hour)"
    bridge: "Optional, based on complexity"

  SEV-3:
    name: "Medium"
    description: "Feature degraded, workaround available"
    examples:
      - "Single agent type failing"
      - "Slow response times (2-5x normal)"
      - "Non-critical integration down"
      - "Minor security issue"
    response_time: "2 hours"
    resolution_target: "24 hours"
    notification:
      - "On-call engineer (via ticket)"
      - "Team channel notification"
    bridge: "Not required"

  SEV-4:
    name: "Low"
    description: "Minor issue, cosmetic, or improvement needed"
    examples:
      - "UI rendering issue"
      - "Documentation error"
      - "Non-blocking bug"
    response_time: "8 hours"
    resolution_target: "72 hours"
    notification:
      - "Ticket created"
    bridge: "Not required"
```

### 25.2 Detection Sources

```yaml
detection_sources:
  automated:
    apm_alerts:
      provider: "Datadog / New Relic"
      triggers:
        - "Error rate > 1%"
        - "P99 latency > 5s"
        - "Apdex score < 0.8"

    log_anomalies:
      provider: "Elasticsearch / CloudWatch"
      triggers:
        - "Error log spike (3x baseline)"
        - "Authentication failures > 10/min"
        - "Unusual access patterns"

    resource_thresholds:
      triggers:
        - "CPU > 85% for 5 min"
        - "Memory > 90%"
        - "Disk > 80%"
        - "Database connections > 80%"

    security_monitoring:
      provider: "SIEM (Splunk / Sentinel)"
      triggers:
        - "Failed login attempts > 5 from same IP"
        - "Privilege escalation detected"
        - "Unusual data access patterns"
        - "Known attack signatures"

  manual:
    - "Customer support tickets"
    - "Internal team reports"
    - "Security researcher disclosure"
    - "Third-party vulnerability alerts"
```

### 25.3 Incident Response Workflow

```yaml
incident_workflow:
  1_detect:
    actions:
      - "Alert triggers from monitoring"
      - "Ticket created automatically"
      - "On-call paged based on severity"
    outputs:
      - incident_id
      - initial_severity
      - detection_source

  2_triage:
    actions:
      - "Verify alert is legitimate (not false positive)"
      - "Assess actual severity"
      - "Identify affected systems and users"
      - "Escalate if needed"
    outputs:
      - confirmed_severity
      - scope_assessment
      - escalation_decision

  3_contain:
    actions:
      - "Isolate affected systems if needed"
      - "Revoke compromised credentials"
      - "Enable additional logging"
      - "Preserve evidence (snapshots, logs)"
    outputs:
      - containment_actions_taken
      - evidence_preserved

  4_investigate:
    actions:
      - "Determine root cause"
      - "Assess full impact"
      - "Identify timeline of events"
      - "Document findings"
    outputs:
      - root_cause_analysis
      - impact_assessment
      - event_timeline

  5_remediate:
    actions:
      - "Fix vulnerability or issue"
      - "Restore affected services"
      - "Verify fix effectiveness"
      - "Monitor for recurrence"
    outputs:
      - remediation_actions
      - service_restoration_time
      - verification_results

  6_notify:
    if_data_breach:
      - "ICO notification within 72 hours (GDPR)"
      - "Affected customers notified 'without undue delay'"
      - "Document all communications"
    all_incidents:
      - "Internal stakeholders updated"
      - "Status page updated if public-facing"

  7_review:
    actions:
      - "Schedule post-incident review (within 5 days)"
      - "Write incident report"
      - "Identify action items"
      - "Update runbooks if needed"
    outputs:
      - incident_report
      - action_items
      - lessons_learned
```

### 25.4 Runbook Structure

```yaml
runbook_template:
  metadata:
    id: "RB-001"
    title: "Database Connection Pool Exhaustion"
    severity: "SEV-2"
    last_updated: "2024-12-01"
    owner: "Backend Team"

  symptoms:
    - "API requests timing out"
    - "Error logs show 'connection pool exhausted'"
    - "Database metrics show max connections reached"

  automated_diagnostics:
    commands:
      - name: "Check connection count"
        command: "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

      - name: "Find long-running queries"
        command: "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"

      - name: "Check application connection pools"
        command: "curl -s http://localhost:8080/health/db | jq '.connection_pool'"

  remediation_steps:
    immediate:
      - step: "Kill long-running queries"
        command: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE duration > interval '5 minutes' AND state = 'active';"
        requires_approval: false

      - step: "Restart application pods (rolling)"
        command: "kubectl rollout restart deployment/aigentflow-api"
        requires_approval: true

    if_persists:
      - step: "Increase connection pool size"
        command: "kubectl set env deployment/aigentflow-api DB_POOL_SIZE=50"
        requires_approval: true

      - step: "Scale database read replicas"
        command: "terraform apply -target=module.rds_read_replica"
        requires_approval: true

  escalation_triggers:
    - "Issue not resolved within 30 minutes"
    - "Multiple systems affected"
    - "Data integrity concerns"

  rollback_procedure:
    - "Revert connection pool size"
    - "Rollback application deployment"
    - "Restore database from snapshot if needed"
```

### 25.5 Post-Incident Review Template

```yaml
post_incident_review:
  metadata:
    incident_id: "INC-2024-0042"
    severity: "SEV-2"
    date: "2024-12-15"
    duration: "2 hours 15 minutes"
    facilitator: "Jane Smith"
    participants: ["Backend Team", "Platform Team", "Security"]

  executive_summary: |
    Brief 2-3 sentence description of what happened and impact.

  timeline:
    - time: "14:32 UTC"
      event: "First alert triggered"
    - time: "14:35 UTC"
      event: "On-call acknowledged"
    - time: "14:42 UTC"
      event: "Root cause identified"
    - time: "15:15 UTC"
      event: "Fix deployed"
    - time: "16:47 UTC"
      event: "Incident resolved"

  impact:
    users_affected: 1250
    requests_failed: 3420
    revenue_impact: "£0 (no transactions affected)"
    data_impact: "None"

  root_cause_analysis:
    technique: "5 Whys"
    analysis:
      - why: "Why did the service fail?"
        answer: "Database connections exhausted"
      - why: "Why were connections exhausted?"
        answer: "Connection leak in new feature"
      - why: "Why wasn't the leak caught?"
        answer: "Load testing didn't simulate long sessions"
      - why: "Why doesn't load testing cover this?"
        answer: "Test scenarios not updated for new feature"
      - why: "Why weren't test scenarios updated?"
        answer: "No checklist for test scenario updates"
    root_cause: "Missing process for updating load test scenarios when adding features"

  what_went_well:
    - "Alert triggered within 3 minutes"
    - "On-call responded quickly"
    - "Runbook was accurate and helpful"
    - "Communication was clear"

  what_could_improve:
    - "Detection could have been faster with connection pool monitoring"
    - "Runbook didn't cover this specific scenario"
    - "Rollback took longer than expected"

  action_items:
    - id: "AI-001"
      action: "Add connection pool exhaustion alert"
      owner: "Platform Team"
      due_date: "2024-12-22"
      priority: "High"

    - id: "AI-002"
      action: "Update load test scenarios checklist"
      owner: "QA Team"
      due_date: "2024-12-29"
      priority: "Medium"

    - id: "AI-003"
      action: "Add runbook for connection pool issues"
      owner: "Backend Team"
      due_date: "2024-12-22"
      priority: "High"

  blameless_culture_note: |
    This review focuses on systems and processes, not individuals.
    The goal is to improve our systems to prevent recurrence.
```

### 25.6 Tool Integrations

```yaml
incident_tool_integrations:
  pagerduty:
    purpose: "On-call alerting and escalation"
    integration:
      - "Datadog → PagerDuty (automated alerts)"
      - "Manual escalation via PagerDuty"
    features:
      - "Multi-channel notifications (SMS, call, push, email)"
      - "Escalation policies by severity"
      - "On-call rotation management"
      - "Incident timeline"

  opsgenie:
    purpose: "Alternative to PagerDuty"
    integration:
      - "Similar to PagerDuty"
    features:
      - "Alert deduplication"
      - "Heartbeat monitoring"
      - "Stakeholder notifications"

  slack:
    purpose: "Team communication during incidents"
    integration:
      - "Incident channel auto-created"
      - "Status updates posted automatically"
    channels:
      - "#incidents - All incidents"
      - "#incidents-sev1 - Critical only"
      - "#on-call - On-call coordination"

  statuspage:
    purpose: "External communication"
    integration:
      - "Auto-update from incident status"
    components:
      - "API"
      - "Web Application"
      - "Agent Execution"
      - "Integrations"

  rundeck:
    purpose: "Runbook automation"
    integration:
      - "Execute runbook steps automatically"
      - "Approval gates for destructive actions"
    features:
      - "Audit trail of all actions"
      - "Role-based access control"
      - "Job scheduling"
```

---

## 26. GDPR Operations

GDPR compliance requires operational capabilities for handling data subject requests, consent management, and data retention.

### 26.1 Data Inventory

```yaml
data_inventory:
  user_account_data:
    category: "Identity"
    data_elements:
      - "Email address"
      - "Name"
      - "Profile picture"
      - "Organization affiliation"
    legal_basis: "Contract performance"
    retention: "Account lifetime + 30 days"
    location: "PostgreSQL (EU)"

  authentication_data:
    category: "Security"
    data_elements:
      - "Password hash"
      - "MFA secrets"
      - "Session tokens"
      - "Login history"
    legal_basis: "Legitimate interest (security)"
    retention: "Account lifetime"
    location: "PostgreSQL (EU), Redis (EU)"

  project_data:
    category: "User Content"
    data_elements:
      - "Project configurations"
      - "Generated code"
      - "Design mockups"
      - "Agent conversations"
    legal_basis: "Contract performance"
    retention: "Project lifetime + 90 days"
    location: "PostgreSQL (EU), S3 (EU)"

  usage_analytics:
    category: "Analytics"
    data_elements:
      - "Feature usage"
      - "Performance metrics"
      - "Error logs"
    legal_basis: "Legitimate interest (service improvement)"
    retention: "13 months (anonymized after)"
    location: "Elasticsearch (EU)"

  billing_data:
    category: "Financial"
    data_elements:
      - "Billing address"
      - "Payment method (tokenized)"
      - "Invoice history"
    legal_basis: "Legal obligation + Contract"
    retention: "7 years (tax requirements)"
    location: "Stripe (processor)"

  audit_logs:
    category: "Compliance"
    data_elements:
      - "User actions"
      - "System events"
      - "Security events"
    legal_basis: "Legal obligation + Legitimate interest"
    retention: "7 years"
    location: "S3 (EU, immutable)"
```

### 26.2 DSAR Workflow (Data Subject Access Requests)

```yaml
dsar_workflow:
  request_types:
    access:
      article: "GDPR Article 15"
      description: "Right to obtain copy of personal data"
      sla: "30 days"

    rectification:
      article: "GDPR Article 16"
      description: "Right to correct inaccurate data"
      sla: "30 days"

    erasure:
      article: "GDPR Article 17"
      description: "Right to be forgotten"
      sla: "30 days"
      exceptions:
        - "Legal obligation to retain"
        - "Public interest"
        - "Legal claims"

    portability:
      article: "GDPR Article 20"
      description: "Right to receive data in machine-readable format"
      sla: "30 days"
      format: "JSON or CSV"

    restriction:
      article: "GDPR Article 18"
      description: "Right to limit processing"
      sla: "30 days"

    objection:
      article: "GDPR Article 21"
      description: "Right to object to processing"
      sla: "30 days"

  workflow_stages:
    1_intake:
      actions:
        - "Receive request via privacy@aigentflow.com or in-app"
        - "Log request in DSAR tracking system"
        - "Generate reference number"
        - "Send acknowledgment within 3 days"
      outputs:
        - dsar_id
        - acknowledgment_sent

    2_verification:
      actions:
        - "Verify identity of requester"
        - "Confirm data subject relationship"
        - "Check for duplicate requests"
      verification_methods:
        - "Email verification to registered address"
        - "Security questions"
        - "ID verification (for high-risk requests)"
      outputs:
        - identity_verified
        - verification_method

    3_scoping:
      actions:
        - "Determine applicable data categories"
        - "Identify all data storage locations"
        - "Check for third-party processors"
        - "Estimate effort and timeline"
      outputs:
        - data_scope
        - effort_estimate

    4_discovery:
      actions:
        - "Query all identified data sources"
        - "Collect data from third parties if needed"
        - "Compile complete data package"
      automated_queries:
        - source: "PostgreSQL"
          query: "SELECT * FROM users WHERE email = ?"
        - source: "Elasticsearch"
          query: "user_id:?"
        - source: "S3"
          pattern: "projects/{user_id}/*"
      outputs:
        - raw_data_collected

    5_review:
      actions:
        - "Review data for third-party information"
        - "Redact other users' data"
        - "Apply legal exceptions if applicable"
        - "Prepare response package"
      redaction_rules:
        - "Other users' emails/names"
        - "Internal system identifiers"
        - "Security-sensitive data"
      outputs:
        - reviewed_data_package

    6_delivery:
      actions:
        - "Generate data export in requested format"
        - "Encrypt package with user-provided key or secure link"
        - "Send via secure channel"
        - "Log delivery confirmation"
      delivery_methods:
        - "Secure download link (expires in 7 days)"
        - "Encrypted email attachment"
        - "In-app data export"
      outputs:
        - delivery_confirmation
        - completion_date

    7_closure:
      actions:
        - "Mark request as complete"
        - "Update DSAR log"
        - "Generate compliance report"
        - "Archive request documentation"
      retention: "3 years for DSAR documentation"
```

### 26.3 Consent Management

```yaml
consent_management:
  consent_types:
    essential:
      description: "Required for service operation"
      legal_basis: "Contract performance"
      examples:
        - "Account creation"
        - "Service delivery"
        - "Security measures"
      user_control: "Cannot withdraw (must delete account)"

    analytics:
      description: "Product usage analytics"
      legal_basis: "Consent"
      default: false
      examples:
        - "Feature usage tracking"
        - "Performance metrics"
        - "Error reporting"
      user_control: "Can withdraw anytime"

    marketing:
      description: "Marketing communications"
      legal_basis: "Consent"
      default: false
      examples:
        - "Product updates"
        - "Newsletter"
        - "Promotional offers"
      user_control: "Can withdraw anytime"

    third_party:
      description: "Data sharing with partners"
      legal_basis: "Consent"
      default: false
      examples:
        - "Integration partners"
        - "Analytics providers"
      user_control: "Can withdraw anytime"

  consent_capture:
    requirements:
      - "Clear, plain language"
      - "Specific purpose stated"
      - "Separate consent for each purpose"
      - "No pre-ticked boxes"
      - "Easy to withdraw as to give"

    proof_of_consent:
      stored_fields:
        - consent_type
        - version
        - timestamp
        - ip_address
        - user_agent
        - consent_text_shown
        - user_id

    database_schema:
      table: "user_consents"
      columns:
        - { name: "id", type: "UUID", primary: true }
        - { name: "user_id", type: "UUID", foreign_key: "users.id" }
        - { name: "consent_type", type: "VARCHAR(50)" }
        - { name: "granted", type: "BOOLEAN" }
        - { name: "version", type: "VARCHAR(20)" }
        - { name: "granted_at", type: "TIMESTAMP" }
        - { name: "withdrawn_at", type: "TIMESTAMP", nullable: true }
        - { name: "ip_address", type: "INET" }
        - { name: "user_agent", type: "TEXT" }

  preference_center:
    features:
      - "View all active consents"
      - "Granular control per consent type"
      - "One-click withdraw all optional"
      - "History of consent changes"
      - "Download consent proof"

    api_endpoints:
      - "GET /api/v1/privacy/consents - List user consents"
      - "PUT /api/v1/privacy/consents/{type} - Update consent"
      - "DELETE /api/v1/privacy/consents/{type} - Withdraw consent"
      - "GET /api/v1/privacy/consents/export - Export consent history"
```

### 26.4 Retention Automation

```yaml
retention_automation:
  policies:
    deleted_accounts:
      trigger: "Account deletion requested"
      grace_period: "30 days (recovery window)"
      actions:
        - "Anonymize user record"
        - "Delete personal data"
        - "Retain anonymized analytics"
        - "Keep audit logs (legal requirement)"

    inactive_accounts:
      trigger: "No login for 24 months"
      actions:
        - "Send reactivation reminder (30 days before)"
        - "Send final warning (7 days before)"
        - "Mark account for deletion"
        - "Apply deleted_accounts policy"

    project_data:
      trigger: "Project deleted"
      grace_period: "90 days (recovery window)"
      actions:
        - "Soft delete immediately"
        - "Hard delete after grace period"
        - "Remove from backups after 1 year"

    session_data:
      trigger: "Session age > 30 days"
      actions:
        - "Delete session records"
        - "Clear Redis cache"

    logs:
      analytics_logs:
        retention: "13 months"
        action: "Anonymize, then aggregate"
      security_logs:
        retention: "7 years"
        action: "Archive to cold storage"
      audit_logs:
        retention: "7 years"
        action: "Immutable archive"

  automation_jobs:
    daily:
      - name: "Session cleanup"
        schedule: "0 2 * * *"
        query: "DELETE FROM sessions WHERE last_active < NOW() - INTERVAL '30 days'"

      - name: "Soft-deleted project cleanup"
        schedule: "0 3 * * *"
        query: "DELETE FROM projects WHERE deleted_at < NOW() - INTERVAL '90 days'"

    weekly:
      - name: "Inactive account check"
        schedule: "0 4 * * 0"
        action: "Send reminders for accounts inactive > 22 months"

    monthly:
      - name: "Log rotation"
        schedule: "0 5 1 * *"
        action: "Move logs > 13 months to archive, anonymize"

    quarterly:
      - name: "Retention audit"
        schedule: "0 6 1 1,4,7,10 *"
        action: "Generate retention compliance report"
```

---

## 27. Compliance Dashboards

Dashboards provide visibility into compliance status for both platform and project levels.

### 27.1 Platform Compliance Dashboard

```yaml
platform_dashboard:
  header_metrics:
    overall_compliance_score:
      calculation: "Weighted average of framework scores"
      target: ">= 95%"
      display: "Percentage with trend arrow"

    open_dsars:
      calculation: "Count of DSARs not yet completed"
      warning_threshold: "> 5"
      display: "Count with SLA status (on-track/at-risk/overdue)"

    active_incidents:
      calculation: "Count of open SEV-1 and SEV-2 incidents"
      critical_threshold: "> 0 SEV-1"
      display: "Count by severity"

    days_since_last_audit:
      calculation: "Days since last external audit"
      warning_threshold: "> 300 days"
      display: "Days with next audit date"

  framework_compliance:
    gdpr:
      score: "Percentage of controls compliant"
      components:
        - { name: "Data inventory", weight: 15 }
        - { name: "Consent management", weight: 20 }
        - { name: "DSAR process", weight: 20 }
        - { name: "Retention automation", weight: 15 }
        - { name: "Breach notification", weight: 15 }
        - { name: "DPIAs completed", weight: 15 }

    soc2:
      score: "Percentage of controls compliant"
      trust_services:
        - { name: "Security (CC1-CC9)", weight: 40 }
        - { name: "Availability", weight: 20 }
        - { name: "Confidentiality", weight: 20 }
        - { name: "Processing Integrity", weight: 10 }
        - { name: "Privacy", weight: 10 }

    iso27001:
      score: "Percentage of controls implemented"
      domains:
        - "A.5 Information security policies"
        - "A.6 Organization of information security"
        - "A.7 Human resource security"
        - "A.8 Asset management"
        - "A.9 Access control"
        - "A.10 Cryptography"
        - "A.11 Physical security"
        - "A.12 Operations security"
        - "A.13 Communications security"
        - "A.14 System acquisition"
        - "A.15 Supplier relationships"
        - "A.16 Incident management"
        - "A.17 Business continuity"
        - "A.18 Compliance"

  dsar_metrics:
    total_received: "Count this month"
    by_type: "Breakdown (access, erasure, etc.)"
    average_resolution_time: "Days"
    sla_compliance: "% completed within 30 days"
    overdue_count: "Requiring immediate attention"

  consent_analytics:
    opt_in_rates:
      - { type: "Analytics", rate: "45%" }
      - { type: "Marketing", rate: "22%" }
      - { type: "Third-party", rate: "12%" }
    withdrawal_rate: "Monthly trend"
    version_distribution: "Users by consent version"

  critical_gaps:
    display: "Table of non-compliant items"
    columns:
      - "Gap ID"
      - "Framework"
      - "Control"
      - "Severity"
      - "Owner"
      - "Due Date"
      - "Status"
```

### 27.2 Project Compliance Dashboard

```yaml
project_dashboard:
  header_metrics:
    data_compliance_score:
      calculation: "Based on project's enabled frameworks"
      display: "Percentage"

    agent_compliance_rate:
      calculation: "Tasks without compliance violations / Total tasks"
      display: "Percentage"

    security_score:
      calculation: "Based on security scans and vulnerabilities"
      components:
        - "SAST findings"
        - "Dependency vulnerabilities"
        - "Secret detection"
        - "Security review completion"

    ai_risk_level:
      calculation: "Based on AI usage patterns"
      levels: ["Low", "Medium", "High"]
      factors:
        - "Sensitive data processed by AI"
        - "Automated decision-making"
        - "User-facing AI outputs"

  agent_activity_compliance:
    columns:
      - agent_type
      - total_tasks
      - compliant_percentage
      - flagged_items
      - blocked_actions
    example_rows:
      - { agent: "Backend Developer", tasks: 45, compliant: "98%", flagged: 1, blocked: 0 }
      - { agent: "Frontend Developer", tasks: 32, compliant: "100%", flagged: 0, blocked: 0 }
      - { agent: "Reviewer", tasks: 28, compliant: "100%", flagged: 2, blocked: 0 }

  data_processing_records:
    processing_activities:
      columns:
        - "Activity"
        - "Data categories"
        - "Legal basis"
        - "Recipients"
        - "Retention"
      example_rows:
        - { activity: "User registration", data: "Identity", basis: "Contract", recipients: "None", retention: "Account lifetime" }

    legal_basis_coverage:
      display: "Pie chart of processing by legal basis"
      categories:
        - "Contract: 45%"
        - "Consent: 25%"
        - "Legitimate interest: 20%"
        - "Legal obligation: 10%"

    dpias_completed:
      display: "Count and list of completed DPIAs"
      required_for:
        - "New processing involving sensitive data"
        - "Large-scale profiling"
        - "Systematic monitoring"

  framework_specific:
    if_gdpr:
      - "Consent collection points"
      - "Data export functionality"
      - "Deletion cascade verification"
      - "Cross-border transfer documentation"

    if_hipaa:
      - "PHI handling controls"
      - "Encryption status"
      - "Access logging coverage"
      - "BAA status with processors"

    if_pci_dss:
      - "Cardholder data environment scope"
      - "Tokenization status"
      - "Network segmentation"
      - "Vulnerability scan results"
```

### 27.3 Audit Export Formats

```yaml
audit_exports:
  dsar_completion_report:
    format: "PDF, CSV"
    contents:
      - "DSAR ID and reference"
      - "Request type"
      - "Date received"
      - "Date completed"
      - "Days to complete"
      - "Identity verification method"
      - "Data categories provided"
      - "Redactions applied"
      - "Delivery method"
    purpose: "Demonstrate DSAR compliance to auditors"

  consent_audit_trail:
    format: "CSV, JSON"
    contents:
      - "User ID (pseudonymized)"
      - "Consent type"
      - "Version"
      - "Granted/Withdrawn"
      - "Timestamp"
      - "IP address"
      - "Proof hash"
    purpose: "Evidence of valid consent"

  processing_activity_records:
    format: "PDF (GDPR Article 30 format)"
    contents:
      - "Controller details"
      - "Processing purposes"
      - "Data subject categories"
      - "Data categories"
      - "Recipients"
      - "Third country transfers"
      - "Retention periods"
      - "Security measures"
    purpose: "Required GDPR documentation"

  security_incident_logs:
    format: "CSV, SIEM-compatible"
    contents:
      - "Incident ID"
      - "Severity"
      - "Detection time"
      - "Resolution time"
      - "Root cause"
      - "Data impact"
      - "Notification status"
    purpose: "Security audit evidence"

  access_review_evidence:
    format: "PDF, CSV"
    contents:
      - "Review date"
      - "Reviewer"
      - "Users reviewed"
      - "Access changes made"
      - "Exceptions documented"
    purpose: "SOC 2 access control evidence"

  training_completion:
    format: "PDF"
    contents:
      - "Employee ID"
      - "Training module"
      - "Completion date"
      - "Assessment score"
      - "Certificate"
    purpose: "Security awareness compliance"
```

---

## 28. Vendor & Third-Party Security

Managing security risks from sub-processors and third-party integrations.

### 28.1 Sub-Processor Registry

```yaml
sub_processor_registry:
  anthropic:
    service: "AI model provider (Claude API)"
    data_processed:
      - "User prompts"
      - "Project code (sent for analysis)"
      - "Agent conversations"
    data_location: "US (with EU SCCs)"
    compliance:
      - "SOC 2 Type II"
      - "GDPR DPA available"
    dpa_signed: true
    last_review: "2024-12-01"
    risk_level: "High"
    controls:
      - "API data not used for training (per Anthropic policy)"
      - "No data retention beyond request"
      - "Encryption in transit (TLS 1.3)"

  hetzner:
    service: "Cloud infrastructure (servers, storage)"
    data_processed:
      - "All platform data"
      - "Database storage"
      - "File storage"
    data_location: "EU (Germany)"
    compliance:
      - "ISO 27001"
      - "GDPR compliant"
    dpa_signed: true
    last_review: "2024-11-15"
    risk_level: "High"
    controls:
      - "Data encrypted at rest"
      - "Private network isolation"
      - "Regular security updates"

  stripe:
    service: "Payment processing"
    data_processed:
      - "Billing information"
      - "Payment card tokens"
    data_location: "US (with EU SCCs)"
    compliance:
      - "PCI DSS Level 1"
      - "SOC 2 Type II"
      - "GDPR DPA available"
    dpa_signed: true
    last_review: "2024-10-01"
    risk_level: "Medium"
    controls:
      - "Card data never touches our systems"
      - "Tokenization for recurring billing"

  github:
    service: "OAuth provider, code hosting integration"
    data_processed:
      - "OAuth tokens"
      - "Repository metadata"
    data_location: "US"
    compliance:
      - "SOC 2 Type II"
      - "GDPR DPA available"
    dpa_signed: true
    last_review: "2024-09-01"
    risk_level: "Medium"
    controls:
      - "Minimal scope OAuth permissions"
      - "Token encryption at rest"

  cloudflare:
    service: "CDN, DDoS protection, DNS"
    data_processed:
      - "Request metadata"
      - "IP addresses"
    data_location: "Global (EU data centers prioritized)"
    compliance:
      - "SOC 2 Type II"
      - "ISO 27001"
      - "GDPR compliant"
    dpa_signed: true
    last_review: "2024-11-01"
    risk_level: "Low"
    controls:
      - "No caching of sensitive data"
      - "EU-only processing option"
```

### 28.2 Vendor Assessment Process

```yaml
vendor_assessment:
  new_vendor_process:
    1_initial_screening:
      questions:
        - "What data will they process?"
        - "Is this a critical service?"
        - "What is their compliance status?"
      documentation_required:
        - "Service description"
        - "Data flow diagram"
        - "Business justification"

    2_security_questionnaire:
      areas:
        - "Organization security"
        - "Access control"
        - "Data protection"
        - "Incident response"
        - "Business continuity"
        - "Compliance certifications"
      questionnaire_options:
        - "SIG Lite (standard)"
        - "CAIQ (cloud-specific)"
        - "Custom based on risk"

    3_documentation_review:
      required_documents:
        - "SOC 2 Type II report (or equivalent)"
        - "Penetration test results (within 12 months)"
        - "Insurance certificates"
        - "DPA / SCCs if EU data"
      nice_to_have:
        - "ISO 27001 certificate"
        - "Privacy policy"
        - "Security whitepaper"

    4_risk_assessment:
      risk_factors:
        - data_sensitivity: { weight: 30, levels: ["Public", "Internal", "Confidential", "Restricted"] }
        - data_volume: { weight: 15, levels: ["Low", "Medium", "High"] }
        - integration_depth: { weight: 20, levels: ["API", "SDK", "Deep integration"] }
        - replaceability: { weight: 15, levels: ["Easy", "Moderate", "Difficult"] }
        - vendor_size: { weight: 10, levels: ["Startup", "SMB", "Enterprise"] }
        - compliance_status: { weight: 10, levels: ["None", "Partial", "Full"] }

      risk_levels:
        low: "Score < 40"
        medium: "Score 40-70"
        high: "Score > 70"
        critical: "Score > 85 or Restricted data"

    5_approval:
      low_risk: "Security team approval"
      medium_risk: "Security team + Engineering lead"
      high_risk: "Security team + CTO"
      critical_risk: "Security team + CTO + Legal"

    6_contract_requirements:
      all_vendors:
        - "Data processing agreement"
        - "Confidentiality clauses"
        - "Right to audit"
        - "Breach notification (24-48 hours)"
        - "Termination and data return"
      high_risk_vendors:
        - "Security SLAs"
        - "Regular security reporting"
        - "Incident response SLAs"
        - "Insurance minimums"

  ongoing_monitoring:
    annual_review:
      - "Re-assess risk level"
      - "Review updated SOC 2 reports"
      - "Check for security incidents"
      - "Verify DPA still valid"

    continuous_monitoring:
      - "Security rating services (BitSight, SecurityScorecard)"
      - "Breach notification alerts"
      - "Compliance status changes"

    review_triggers:
      - "Security incident at vendor"
      - "Major service changes"
      - "M&A activity"
      - "Compliance certification expiry"
```

### 28.3 DPA Requirements

```yaml
dpa_requirements:
  minimum_clauses:
    processing_details:
      - "Subject matter and duration"
      - "Nature and purpose of processing"
      - "Type of personal data"
      - "Categories of data subjects"

    processor_obligations:
      - "Process only on documented instructions"
      - "Ensure personnel confidentiality"
      - "Implement appropriate security measures"
      - "Assist with DSAR requests"
      - "Delete or return data on termination"
      - "Allow and contribute to audits"
      - "Notify of breaches without undue delay"

    sub_processor_clauses:
      - "Require written authorization for sub-processors"
      - "List of current sub-processors"
      - "Notification of sub-processor changes"
      - "Flow-down of data protection obligations"

    international_transfers:
      - "Standard Contractual Clauses (SCCs) if applicable"
      - "Transfer impact assessment"
      - "Supplementary measures if needed"

  template_versions:
    controller_to_processor:
      use_case: "Most vendor relationships"
      template: "EU Standard Contractual Clauses (Module 2)"

    controller_to_controller:
      use_case: "Partners, joint processing"
      template: "EU Standard Contractual Clauses (Module 1)"

    processor_to_processor:
      use_case: "Sub-processor chains"
      template: "EU Standard Contractual Clauses (Module 3)"

  dpa_tracking:
    database_fields:
      - vendor_name
      - dpa_version
      - signed_date
      - expiry_date
      - scc_modules_used
      - sub_processors_listed
      - last_reviewed
      - next_review_due
```

---

## 29. Model Abstraction Layer

A unified interface for interacting with multiple LLM providers with fallback, cost tracking, and capability management.

### 29.1 Provider Interface

```typescript
// Core provider interface
interface LLMProvider {
  // Standard chat completion
  chat(
    messages: Message[],
    options: ChatOptions
  ): Promise<ChatResponse>;

  // Streaming chat completion
  streamChat(
    messages: Message[],
    options: ChatOptions
  ): AsyncIterable<ChatStreamChunk>;

  // Structured output (JSON mode)
  structured<T>(
    messages: Message[],
    schema: JSONSchema,
    options: ChatOptions
  ): Promise<T>;

  // Embeddings
  embed(
    input: string | string[]
  ): Promise<number[][]>;

  // Provider capabilities
  capabilities: ProviderCapabilities;

  // Health check
  healthCheck(): Promise<HealthStatus>;
}

interface ChatOptions {
  model: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  topP?: number;
  topK?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'none' | 'required' | { name: string };
}

interface ProviderCapabilities {
  maxContextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsStructuredOutput: boolean;
  supportsVision: boolean;
  supportsToolUse: boolean;
  supportsExtendedThinking: boolean;
  embeddingDimensions?: number;
}

interface ChatResponse {
  content: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  toolCalls?: ToolCall[];
}
```

### 29.2 Provider Implementations

```yaml
provider_implementations:
  anthropic:
    models:
      claude-opus-4:
        context_window: 200000
        max_output: 32000
        cost_per_1k_input: 0.015
        cost_per_1k_output: 0.075
        capabilities:
          - "streaming"
          - "structured_output"
          - "vision"
          - "tool_use"
          - "extended_thinking"
        use_cases:
          - "Complex reasoning"
          - "Architecture decisions"
          - "Code review"

      claude-sonnet-4:
        context_window: 200000
        max_output: 16000
        cost_per_1k_input: 0.003
        cost_per_1k_output: 0.015
        capabilities:
          - "streaming"
          - "structured_output"
          - "vision"
          - "tool_use"
          - "extended_thinking"
        use_cases:
          - "Code generation"
          - "Analysis"
          - "Most agent tasks"

      claude-haiku-3.5:
        context_window: 200000
        max_output: 8000
        cost_per_1k_input: 0.0008
        cost_per_1k_output: 0.004
        capabilities:
          - "streaming"
          - "structured_output"
          - "tool_use"
        use_cases:
          - "Quick tasks"
          - "Simple routing"
          - "Summarization"

  openai:
    models:
      gpt-4-turbo:
        context_window: 128000
        max_output: 4096
        cost_per_1k_input: 0.01
        cost_per_1k_output: 0.03
        capabilities:
          - "streaming"
          - "structured_output"
          - "vision"
          - "tool_use"

      gpt-4o:
        context_window: 128000
        max_output: 16384
        cost_per_1k_input: 0.005
        cost_per_1k_output: 0.015
        capabilities:
          - "streaming"
          - "structured_output"
          - "vision"
          - "tool_use"

  local:
    ollama:
      models:
        - "llama3:70b"
        - "codellama:34b"
        - "mixtral:8x7b"
      cost: 0  # Self-hosted
      use_cases:
        - "Offline development"
        - "Sensitive data (never leaves network)"
        - "Cost optimization for simple tasks"
```

### 29.3 Fallback and Routing

```yaml
fallback_configuration:
  default_chain:
    - provider: "anthropic"
      model: "claude-sonnet-4"
      timeout: 30000

    - provider: "openai"
      model: "gpt-4o"
      timeout: 30000
      condition: "anthropic_unavailable OR timeout"

    - provider: "anthropic"
      model: "claude-haiku-3.5"
      condition: "all_failed AND retry_count < 3"

  routing_rules:
    by_task_complexity:
      simple:
        description: "Summarization, formatting, simple queries"
        default_model: "claude-haiku-3.5"
        max_cost: 0.01

      standard:
        description: "Code generation, analysis, most tasks"
        default_model: "claude-sonnet-4"
        max_cost: 0.50

      complex:
        description: "Architecture, complex reasoning, reviews"
        default_model: "claude-opus-4"
        max_cost: 2.00

    by_sensitivity:
      public:
        allowed_providers: ["anthropic", "openai", "local"]

      internal:
        allowed_providers: ["anthropic", "local"]
        prefer: "local"

      confidential:
        allowed_providers: ["local"]
        require_local: true

  retry_strategy:
    max_retries: 3
    backoff:
      initial_delay: 1000
      max_delay: 10000
      multiplier: 2
      jitter: 0.3
    retryable_errors:
      - "RATE_LIMITED"
      - "TIMEOUT"
      - "SERVICE_UNAVAILABLE"
      - "INTERNAL_ERROR"
    non_retryable_errors:
      - "INVALID_REQUEST"
      - "AUTHENTICATION_ERROR"
      - "QUOTA_EXCEEDED"
```

### 29.4 Cost Tracking

```yaml
cost_tracking:
  per_request_tracking:
    fields:
      - request_id
      - timestamp
      - provider
      - model
      - input_tokens
      - output_tokens
      - cost_usd
      - project_id
      - agent_type
      - task_id

  aggregation_levels:
    per_project:
      metrics:
        - "Total cost"
        - "Cost by model"
        - "Cost by agent"
        - "Token usage"
      alerts:
        daily_threshold: 50.00
        monthly_threshold: 500.00

    per_organization:
      metrics:
        - "Total cost across projects"
        - "Cost trend"
        - "Cost by project"
      alerts:
        monthly_threshold: 5000.00

    platform:
      metrics:
        - "Total platform cost"
        - "Cost per customer"
        - "Margin analysis"

  budget_controls:
    project_level:
      - "Daily spending limit"
      - "Monthly budget cap"
      - "Alert at 80% threshold"
      - "Hard stop at 100%"

    actions_on_limit:
      warning: "Notify project owner"
      soft_limit: "Downgrade to cheaper model"
      hard_limit: "Pause agent execution"

  cost_optimization:
    strategies:
      - "Route simple tasks to Haiku"
      - "Cache repeated queries"
      - "Compress context where possible"
      - "Use embeddings for similarity vs full LLM"

    reporting:
      daily_digest: "Cost summary email to project owners"
      weekly_report: "Optimization recommendations"
      monthly_invoice: "Detailed breakdown by project"
```

---

## 30. Multi-Tenant Security

Security controls ensuring complete isolation between tenants in a shared infrastructure environment.

### 30.1 Data Isolation

```yaml
data_isolation:
  database_isolation:
    strategy: "Row-Level Security (RLS)"
    implementation:
      postgresql:
        setup: |
          -- Enable RLS on all tenant tables
          ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
          ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
          ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

          -- Create RLS policies
          CREATE POLICY tenant_isolation ON projects
            USING (tenant_id = current_setting('app.tenant_id')::uuid);

          CREATE POLICY tenant_isolation ON tasks
            USING (project_id IN (
              SELECT id FROM projects
              WHERE tenant_id = current_setting('app.tenant_id')::uuid
            ));

        connection_setup: |
          -- Set tenant context at connection time
          SET app.tenant_id = '{tenant_uuid}';

    additional_controls:
      - "All queries automatically filtered by tenant"
      - "Cross-tenant queries impossible at DB level"
      - "Audit logging of all data access"
      - "Regular testing of isolation"

  storage_isolation:
    strategy: "Tenant-prefixed paths with separate encryption"
    implementation:
      s3_structure:
        pattern: "s3://aigentflow-data/{tenant_id}/{project_id}/{file_path}"
        bucket_policy: |
          Deny access to paths not matching authenticated tenant_id

      encryption:
        - "Per-tenant master key in KMS"
        - "Derived data encryption keys per project"
        - "Keys never shared between tenants"

    access_control:
      - "IAM policies enforce tenant boundaries"
      - "Presigned URLs include tenant validation"
      - "No cross-tenant URL access possible"

  cache_isolation:
    redis:
      key_pattern: "tenant:{tenant_id}:*"
      implementation:
        - "All cache keys prefixed with tenant_id"
        - "Separate Redis databases per security tier (optional)"
        - "TTL on all keys to prevent stale cross-tenant data"

  backup_isolation:
    - "Tenant-specific backup encryption keys"
    - "Backups stored in tenant-prefixed paths"
    - "Restore only possible to same tenant"
```

### 30.2 Compute Isolation

```yaml
compute_isolation:
  container_isolation:
    runtime: "Kubernetes with gVisor/Kata Containers for high-security"
    configuration:
      resource_limits:
        cpu: "2 cores max per agent"
        memory: "4Gi max per agent"
        ephemeral_storage: "10Gi"

      network_policies: |
        apiVersion: networking.k8s.io/v1
        kind: NetworkPolicy
        metadata:
          name: tenant-isolation
        spec:
          podSelector:
            matchLabels:
              tenant: "{tenant_id}"
          policyTypes:
          - Ingress
          - Egress
          ingress:
          - from:
            - podSelector:
                matchLabels:
                  tenant: "{tenant_id}"
          egress:
          - to:
            - podSelector:
                matchLabels:
                  tenant: "{tenant_id}"
            - namespaceSelector:
                matchLabels:
                  name: "shared-services"

      security_context:
        run_as_non_root: true
        read_only_root_filesystem: true
        allow_privilege_escalation: false
        capabilities:
          drop: ["ALL"]

  agent_execution_isolation:
    sandboxing:
      - "Each agent runs in isolated container"
      - "No shared filesystem between agents"
      - "Network access controlled by policy"
      - "Secrets injected, not stored in container"

    tenant_context_injection:
      environment_variables:
        - "TENANT_ID"
        - "PROJECT_ID"
        - "SECURITY_LEVEL"
      verification:
        - "All API calls include tenant context"
        - "Middleware validates tenant ownership"
        - "Audit log includes tenant context"

  resource_quotas:
    per_tenant:
      max_concurrent_agents: 10
      max_cpu_cores: 20
      max_memory_gb: 40
      max_storage_gb: 100
      max_api_requests_per_minute: 1000

    enforcement:
      - "Kubernetes ResourceQuota per namespace"
      - "Rate limiting at API gateway"
      - "Graceful degradation on limit"
```

### 30.3 Encryption Architecture

```yaml
encryption_architecture:
  key_hierarchy:
    platform_master_key:
      location: "AWS KMS / HashiCorp Vault"
      purpose: "Encrypt tenant master keys"
      rotation: "Annual"
      access: "Platform administrators only"

    tenant_master_key:
      location: "AWS KMS / HashiCorp Vault"
      purpose: "Encrypt tenant data encryption keys"
      rotation: "Annual"
      access: "Tenant-specific IAM role"

    data_encryption_keys:
      types:
        database_dek:
          purpose: "Encrypt database columns"
          rotation: "Monthly"

        storage_dek:
          purpose: "Encrypt file storage"
          rotation: "Monthly"

        secrets_dek:
          purpose: "Encrypt tenant secrets"
          rotation: "Weekly"

  encryption_at_rest:
    database:
      method: "AES-256-GCM column encryption"
      encrypted_columns:
        - "users.email"
        - "users.name"
        - "projects.credentials"
        - "agents.api_keys"

    storage:
      method: "Server-side encryption with customer keys (SSE-C)"
      implementation: "S3 with per-tenant keys"

    backups:
      method: "AES-256-GCM"
      key: "Tenant-specific backup key"

  encryption_in_transit:
    external:
      - "TLS 1.3 for all external connections"
      - "HSTS enabled"
      - "Certificate pinning for mobile apps"

    internal:
      - "mTLS between services"
      - "Encrypted service mesh (Istio)"

  key_management:
    vault_integration:
      transit_engine: "Encrypt/decrypt without exposing keys"
      dynamic_secrets: "Short-lived credentials for services"
      audit_logging: "All key operations logged"

    key_rotation_process:
      1: "Generate new key version"
      2: "Re-encrypt active data with new key"
      3: "Mark old key for deletion"
      4: "Delete old key after retention period"
```

### 30.4 Tenant Provisioning

```yaml
tenant_provisioning:
  onboarding_workflow:
    1_account_creation:
      - "Create tenant record"
      - "Generate tenant UUID"
      - "Create admin user"

    2_infrastructure_setup:
      - "Create Kubernetes namespace"
      - "Apply network policies"
      - "Set resource quotas"

    3_security_setup:
      - "Generate tenant master key"
      - "Generate data encryption keys"
      - "Configure secrets path"

    4_database_setup:
      - "Create tenant schema (if schema-per-tenant)"
      - "Apply RLS policies"
      - "Seed initial data"

    5_storage_setup:
      - "Create S3 prefix structure"
      - "Configure bucket policies"
      - "Set up backup schedule"

  offboarding_workflow:
    grace_period: "30 days"
    steps:
      1_disable: "Disable tenant access"
      2_export: "Generate data export for customer"
      3_backup: "Create final backup (retained 90 days)"
      4_delete_data:
        - "Delete database records"
        - "Delete storage files"
        - "Delete cached data"
      5_delete_keys: "Destroy encryption keys (after retention)"
      6_cleanup:
        - "Remove Kubernetes namespace"
        - "Archive audit logs"
```

---

## 31. Feature Flags

A comprehensive feature flag system for controlled rollouts, A/B testing, and compliance-gated features.

### 31.1 Flag Types

```yaml
flag_types:
  boolean:
    description: "Simple on/off toggle"
    schema:
      name: string
      type: "boolean"
      default_value: boolean
      description: string
    example:
      name: "new_dashboard_enabled"
      type: "boolean"
      default_value: false
      description: "Enable the redesigned dashboard"

  percentage:
    description: "Gradual rollout by percentage"
    schema:
      name: string
      type: "percentage"
      percentage: number  # 0-100
      sticky: boolean     # Same user always gets same value
      salt: string        # For consistent hashing
    example:
      name: "new_editor_rollout"
      type: "percentage"
      percentage: 25
      sticky: true
      salt: "editor-v2-2024"

  multivariate:
    description: "A/B/n testing with variants"
    schema:
      name: string
      type: "multivariate"
      variants:
        - { name: string, weight: number, value: any }
      default_variant: string
    example:
      name: "checkout_flow_experiment"
      type: "multivariate"
      variants:
        - { name: "control", weight: 50, value: { steps: 3 } }
        - { name: "simplified", weight: 25, value: { steps: 2 } }
        - { name: "express", weight: 25, value: { steps: 1 } }
      default_variant: "control"

  user_targeted:
    description: "Target specific users or segments"
    schema:
      name: string
      type: "targeted"
      rules:
        - { attribute: string, operator: string, value: any, result: any }
      default_value: any
    example:
      name: "beta_features"
      type: "targeted"
      rules:
        - { attribute: "user.email", operator: "ends_with", value: "@aigentflow.com", result: true }
        - { attribute: "user.plan", operator: "equals", value: "enterprise", result: true }
        - { attribute: "user.id", operator: "in", value: ["uuid1", "uuid2"], result: true }
      default_value: false

  compliance_gated:
    description: "Features requiring compliance approval"
    schema:
      name: string
      type: "compliance_gated"
      compliance_requirements:
        - framework: string
          controls: string[]
      approval_required: boolean
      approved_by: string[]
    example:
      name: "ai_code_execution"
      type: "compliance_gated"
      compliance_requirements:
        - { framework: "soc2", controls: ["CC6.1", "CC6.7"] }
        - { framework: "iso27001", controls: ["A.12.5"] }
      approval_required: true
      approved_by: ["security-team", "compliance-officer"]
```

### 31.2 Flag Configuration

```yaml
flag_configuration:
  storage:
    primary: "PostgreSQL"
    cache: "Redis (5 minute TTL)"
    local_cache: "In-memory (1 minute TTL)"

  hierarchy:
    levels:
      - "system"       # Platform-wide defaults
      - "organization" # Organization overrides
      - "project"      # Project-specific
      - "user"         # User-specific (for testing)

    override_rules:
      - "Lower level overrides higher"
      - "Compliance flags cannot be overridden to less restrictive"
      - "System kill-switches override everything"

  environments:
    development:
      all_flags_default: true  # Enable everything for dev
      except:
        - "production_only_*"
        - "compliance_*"

    staging:
      inherit_from: "production"
      overrides:
        new_feature_rollout: 100  # Full rollout in staging

    production:
      inherit_from: "system_defaults"
      requires_approval_for_changes: true

  change_management:
    audit_logging: true
    approval_required:
      production_changes: true
      compliance_flags: true
      percentage_increase_over_25: true

    rollback:
      automatic: "On error rate spike > 5%"
      manual: "Immediate via dashboard or CLI"
```

### 31.3 Evaluation Engine

```typescript
// Flag evaluation logic
interface FlagEvaluator {
  evaluate<T>(
    flagName: string,
    context: EvaluationContext
  ): FlagResult<T>;
}

interface EvaluationContext {
  userId?: string;
  userEmail?: string;
  userPlan?: string;
  organizationId?: string;
  projectId?: string;
  environment: string;
  customAttributes?: Record<string, any>;
}

interface FlagResult<T> {
  value: T;
  variant?: string;
  reason: EvaluationReason;
  flagKey: string;
  evaluatedAt: Date;
}

type EvaluationReason =
  | 'DEFAULT'
  | 'TARGETING_MATCH'
  | 'PERCENTAGE_ROLLOUT'
  | 'ENVIRONMENT_OVERRIDE'
  | 'USER_OVERRIDE'
  | 'COMPLIANCE_BLOCKED'
  | 'KILL_SWITCH'
  | 'ERROR_FALLBACK';
```

```yaml
evaluation_algorithm:
  steps:
    1_check_kill_switch:
      if: "Flag has kill_switch = true"
      return: "default_value, reason: KILL_SWITCH"

    2_check_compliance:
      if: "Flag is compliance_gated"
      actions:
        - "Verify all required frameworks met"
        - "Verify approval if required"
      if_blocked: "return false, reason: COMPLIANCE_BLOCKED"

    3_check_user_override:
      if: "User has explicit override"
      return: "override_value, reason: USER_OVERRIDE"

    4_check_environment:
      if: "Environment has override"
      return: "environment_value, reason: ENVIRONMENT_OVERRIDE"

    5_check_targeting:
      if: "Flag has targeting rules"
      for_each_rule:
        - "Evaluate rule condition against context"
        - "If match, return rule.result"
      return: "matched_value, reason: TARGETING_MATCH"

    6_check_percentage:
      if: "Flag is percentage type"
      actions:
        - "Hash userId + flagName + salt"
        - "Map hash to 0-100"
        - "Compare to percentage threshold"
      return: "enabled/disabled, reason: PERCENTAGE_ROLLOUT"

    7_return_default:
      return: "default_value, reason: DEFAULT"
```

### 31.4 Flag Management CLI

```bash
# List all flags
aigentflow flags list
aigentflow flags list --environment production

# Get flag details
aigentflow flags get new_editor_rollout

# Create flag
aigentflow flags create \
  --name "new_feature" \
  --type boolean \
  --default false \
  --description "Enable new feature"

# Update flag
aigentflow flags update new_editor_rollout \
  --percentage 50

# Enable for specific users
aigentflow flags target new_feature \
  --add-user user@example.com

# Rollout progression
aigentflow flags rollout new_feature \
  --to 25 \
  --over "7 days" \
  --monitor-error-rate

# Emergency kill switch
aigentflow flags kill dangerous_feature --reason "Security issue"

# View flag history
aigentflow flags history new_feature

# Evaluate flag for testing
aigentflow flags evaluate new_feature \
  --user-id "test-user" \
  --environment staging
```

### 31.5 Integration with Agents

```yaml
agent_flag_integration:
  agent_feature_flags:
    examples:
      - name: "agent.parallel_execution"
        description: "Allow agents to run in parallel"
        default: true

      - name: "agent.extended_thinking"
        description: "Enable extended thinking for complex tasks"
        default: true
        model_requirement: "claude-sonnet-4 or better"

      - name: "agent.auto_fix_loop"
        description: "Automatically attempt to fix test failures"
        default: true
        max_retries: 3

      - name: "agent.code_execution"
        description: "Allow agents to execute generated code"
        type: "compliance_gated"
        compliance_requirements:
          - { framework: "security", controls: ["sandboxing", "audit_logging"] }

  flag_evaluation_in_agents:
    timing: "At agent spawn time"
    caching: "Flags cached for agent session"
    refresh: "On explicit request or session restart"

  flag_based_behavior:
    example: |
      if feature_flags.is_enabled("agent.extended_thinking", context):
          response = await claude.think_extended(prompt)
      else:
          response = await claude.chat(prompt)

  experimentation:
    agent_ab_testing:
      - "Test different system prompts"
      - "Compare model performance"
      - "Evaluate tool configurations"

    metrics_collection:
      - "Success rate by variant"
      - "Token usage by variant"
      - "Latency by variant"
      - "User satisfaction by variant"
```

---

## 32. GenUI Output Style

Generative UI (GenUI) enables agents to output structured UI specifications that can be dynamically rendered across different platforms (CLI, web, mobile). This section defines the output schemas, component library, and rendering patterns.

### 32.1 GenUI Philosophy

```yaml
genui_principles:
  platform_agnostic:
    description: "Output format renders on any platform"
    approach: "Abstract components, not HTML/CSS"

  progressive_disclosure:
    description: "Show essential info first, details on demand"
    approach: "Collapsible sections, expandable details"

  actionable_outputs:
    description: "Every output enables next action"
    approach: "Embedded actions, quick commands"

  accessibility_first:
    description: "Accessible by default"
    approach: "Semantic structure, ARIA-compatible"

  streaming_compatible:
    description: "Works with streaming responses"
    approach: "Incremental rendering, chunk-aware"
```

### 32.2 Core Component Schema

```typescript
// Base component interface
interface GenUIComponent {
  type: ComponentType;
  id?: string;
  key?: string;
  props: ComponentProps;
  children?: GenUIComponent[];
  actions?: ComponentAction[];
  metadata?: ComponentMetadata;
}

type ComponentType =
  // Layout
  | 'container' | 'stack' | 'grid' | 'columns' | 'card' | 'section'
  // Content
  | 'text' | 'heading' | 'code' | 'markdown' | 'image' | 'icon'
  // Data Display
  | 'table' | 'list' | 'tree' | 'timeline' | 'progress' | 'stat'
  // Interactive
  | 'button' | 'link' | 'input' | 'select' | 'checkbox' | 'toggle'
  // Feedback
  | 'alert' | 'badge' | 'tooltip' | 'loading' | 'empty'
  // Agent-specific
  | 'agent-status' | 'task-card' | 'file-diff' | 'approval-request'
  | 'code-block' | 'terminal-output' | 'design-preview';

interface ComponentAction {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger' | 'ghost';
  command?: string;           // CLI command to execute
  confirm?: ConfirmDialog;    // Confirmation before action
  keyboard_shortcut?: string; // e.g., "cmd+enter"
}

interface ComponentMetadata {
  streaming?: boolean;        // Component updates incrementally
  collapsible?: boolean;      // Can be collapsed
  copyable?: boolean;         // Content can be copied
  priority?: 'high' | 'medium' | 'low';
}
```

### 32.3 Layout Components

```yaml
layout_components:
  container:
    description: "Root wrapper with optional padding/borders"
    props:
      padding: "none | sm | md | lg"
      border: boolean
      background: "default | muted | accent"
    example:
      type: "container"
      props: { padding: "md", border: true }
      children: [...]

  stack:
    description: "Vertical or horizontal flex container"
    props:
      direction: "vertical | horizontal"
      gap: "none | xs | sm | md | lg | xl"
      align: "start | center | end | stretch"
      justify: "start | center | end | between | around"
    example:
      type: "stack"
      props: { direction: "vertical", gap: "md" }
      children: [...]

  grid:
    description: "CSS Grid-style layout"
    props:
      columns: number | "auto"
      gap: "sm | md | lg"
      min_width: string  # e.g., "200px"
    example:
      type: "grid"
      props: { columns: 3, gap: "md" }
      children: [...]

  columns:
    description: "Multi-column layout with ratios"
    props:
      ratios: number[]  # e.g., [1, 2, 1] for 25%/50%/25%
      gap: "sm | md | lg"
    example:
      type: "columns"
      props: { ratios: [1, 3] }
      children: [
        { type: "sidebar", ... },
        { type: "main-content", ... }
      ]

  card:
    description: "Elevated container with header/body/footer"
    props:
      title: string
      subtitle?: string
      icon?: string
      collapsible: boolean
      default_collapsed: boolean
    example:
      type: "card"
      props: { title: "Agent Output", icon: "robot", collapsible: true }
      children: [...]

  section:
    description: "Semantic section with heading"
    props:
      title: string
      level: 1 | 2 | 3 | 4
      anchor?: string  # For linking
    example:
      type: "section"
      props: { title: "Test Results", level: 2, anchor: "tests" }
      children: [...]
```

### 32.4 Content Components

```yaml
content_components:
  text:
    description: "Text content with optional formatting"
    props:
      content: string
      variant: "body | caption | label | mono"
      color: "default | muted | success | warning | error | info"
      weight: "normal | medium | bold"
    example:
      type: "text"
      props: { content: "Task completed successfully", color: "success" }

  heading:
    description: "Section headings"
    props:
      content: string
      level: 1 | 2 | 3 | 4 | 5 | 6
      icon?: string
    example:
      type: "heading"
      props: { content: "Architecture Overview", level: 2, icon: "layers" }

  code:
    description: "Inline code snippet"
    props:
      content: string
      language?: string
    example:
      type: "code"
      props: { content: "npm install", language: "bash" }

  code_block:
    description: "Multi-line code with syntax highlighting"
    props:
      content: string
      language: string
      filename?: string
      line_numbers: boolean
      highlight_lines?: number[]
      diff?: boolean  # Show as diff with +/- highlighting
      max_height?: string
    actions:
      - { id: "copy", label: "Copy", type: "ghost" }
      - { id: "apply", label: "Apply", type: "primary", command: "..." }
    example:
      type: "code_block"
      props:
        content: "function hello() {\n  return 'world';\n}"
        language: "typescript"
        filename: "src/utils.ts"
        line_numbers: true
        highlight_lines: [2]

  markdown:
    description: "Rendered markdown content"
    props:
      content: string
      sanitize: boolean
    example:
      type: "markdown"
      props: { content: "## Summary\n\nThis is **bold** text." }

  image:
    description: "Image with optional caption"
    props:
      src: string
      alt: string
      caption?: string
      width?: string
      height?: string
    example:
      type: "image"
      props: { src: "mockup.png", alt: "UI Mockup", caption: "Dashboard design" }
```

### 32.5 Data Display Components

```yaml
data_display_components:
  table:
    description: "Data table with optional sorting/filtering"
    props:
      columns:
        - { key: string, label: string, width?: string, align?: "left|center|right" }
      rows: object[]
      sortable: boolean
      filterable: boolean
      selectable: boolean
      striped: boolean
      compact: boolean
      max_rows?: number  # Show "and X more" after
    example:
      type: "table"
      props:
        columns:
          - { key: "file", label: "File", width: "50%" }
          - { key: "status", label: "Status", width: "25%" }
          - { key: "lines", label: "Lines", align: "right" }
        rows:
          - { file: "src/app.ts", status: "modified", lines: 42 }
          - { file: "src/utils.ts", status: "added", lines: 18 }
        sortable: true
        striped: true

  list:
    description: "Ordered or unordered list"
    props:
      items: (string | ListItem)[]
      ordered: boolean
      icon?: string  # Icon for all items
    example:
      type: "list"
      props:
        items:
          - { content: "Install dependencies", icon: "check", color: "success" }
          - { content: "Run tests", icon: "spinner", color: "info" }
          - { content: "Deploy", icon: "circle", color: "muted" }
        ordered: true

  tree:
    description: "Hierarchical tree structure"
    props:
      nodes: TreeNode[]
      expandable: boolean
      default_expanded: boolean | number  # true, false, or depth
      show_lines: boolean
    example:
      type: "tree"
      props:
        nodes:
          - label: "src"
            icon: "folder"
            children:
              - { label: "components", icon: "folder", children: [...] }
              - { label: "app.tsx", icon: "file-code" }
        expandable: true
        default_expanded: 2

  timeline:
    description: "Chronological event timeline"
    props:
      events:
        - timestamp: string
          title: string
          description?: string
          status: "completed | current | pending | error"
          icon?: string
    example:
      type: "timeline"
      props:
        events:
          - { timestamp: "14:32", title: "Task started", status: "completed" }
          - { timestamp: "14:33", title: "Running tests", status: "current", icon: "spinner" }
          - { timestamp: "-", title: "Deploy", status: "pending" }

  progress:
    description: "Progress indicator"
    props:
      value: number  # 0-100
      label?: string
      variant: "bar | circle | steps"
      size: "sm | md | lg"
      color: "default | success | warning | error"
      show_value: boolean
    example:
      type: "progress"
      props: { value: 75, label: "Tests passing", variant: "bar", show_value: true }

  stat:
    description: "Key metric display"
    props:
      label: string
      value: string | number
      change?: { value: number, direction: "up" | "down" }
      icon?: string
      color?: string
    example:
      type: "stat"
      props:
        label: "Coverage"
        value: "87%"
        change: { value: 5, direction: "up" }
        icon: "chart"
        color: "success"
```

### 32.6 Interactive Components

```yaml
interactive_components:
  button:
    description: "Clickable button with action"
    props:
      label: string
      variant: "primary | secondary | danger | ghost | link"
      size: "sm | md | lg"
      icon?: string
      icon_position: "left | right"
      loading: boolean
      disabled: boolean
      full_width: boolean
    action:
      command: string
      confirm?: { title: string, message: string }
    example:
      type: "button"
      props: { label: "Approve", variant: "primary", icon: "check" }
      actions: [{ id: "approve", command: "aigentflow approve --task-id xyz" }]

  button_group:
    description: "Group of related buttons"
    props:
      buttons: Button[]
      attached: boolean  # Visually connected
    example:
      type: "button_group"
      props:
        attached: true
        buttons:
          - { label: "Approve", variant: "primary" }
          - { label: "Reject", variant: "danger" }
          - { label: "Skip", variant: "ghost" }

  input:
    description: "Text input field"
    props:
      placeholder: string
      label?: string
      type: "text | password | number | email | search"
      default_value?: string
      required: boolean
      validation?: { pattern: string, message: string }
    example:
      type: "input"
      props: { placeholder: "Enter commit message...", label: "Message" }

  select:
    description: "Dropdown selection"
    props:
      options: { value: string, label: string, icon?: string }[]
      placeholder: string
      default_value?: string
      multiple: boolean
      searchable: boolean
    example:
      type: "select"
      props:
        placeholder: "Select agent..."
        options:
          - { value: "backend", label: "Backend Developer", icon: "server" }
          - { value: "frontend", label: "Frontend Developer", icon: "layout" }

  checkbox:
    description: "Boolean toggle with label"
    props:
      label: string
      checked: boolean
      indeterminate: boolean
    example:
      type: "checkbox"
      props: { label: "Run tests after build", checked: true }

  toggle:
    description: "On/off switch"
    props:
      label: string
      enabled: boolean
      disabled: boolean
    example:
      type: "toggle"
      props: { label: "Auto-approve minor changes", enabled: false }
```

### 32.7 Feedback Components

```yaml
feedback_components:
  alert:
    description: "Contextual message banner"
    props:
      variant: "info | success | warning | error"
      title?: string
      message: string
      icon?: string
      dismissible: boolean
    actions:
      - { label: string, command: string }
    example:
      type: "alert"
      props:
        variant: "warning"
        title: "Approval Required"
        message: "This change modifies protected files"
        dismissible: false
      actions:
        - { id: "view", label: "View Changes", command: "git diff" }

  badge:
    description: "Status indicator label"
    props:
      label: string
      variant: "default | success | warning | error | info"
      size: "sm | md"
      dot: boolean  # Show as dot only
    example:
      type: "badge"
      props: { label: "In Progress", variant: "info" }

  tooltip:
    description: "Hover information"
    props:
      content: string | GenUIComponent
      position: "top | bottom | left | right"
      trigger: "hover | click"
    # Applied as wrapper to child component

  loading:
    description: "Loading state indicator"
    props:
      variant: "spinner | dots | bar | skeleton"
      size: "sm | md | lg"
      label?: string
    example:
      type: "loading"
      props: { variant: "spinner", label: "Generating code..." }

  empty:
    description: "Empty state placeholder"
    props:
      icon: string
      title: string
      description?: string
    actions:
      - { label: string, command: string }
    example:
      type: "empty"
      props:
        icon: "inbox"
        title: "No tasks yet"
        description: "Start by describing what you want to build"
      actions:
        - { id: "new", label: "New Project", command: "aigentflow init" }
```

### 32.8 Agent-Specific Components

```yaml
agent_components:
  agent_status:
    description: "Agent execution status card"
    props:
      agent_type: string
      agent_icon: string
      status: "idle | thinking | working | waiting | completed | failed"
      task_summary?: string
      progress?: number
      tokens_used?: number
      duration_ms?: number
    example:
      type: "agent_status"
      props:
        agent_type: "Backend Developer"
        agent_icon: "server"
        status: "working"
        task_summary: "Implementing user authentication endpoint"
        progress: 45
        tokens_used: 12500

  task_card:
    description: "Task summary with status and actions"
    props:
      task_id: string
      title: string
      description?: string
      status: "pending | in_progress | review | completed | failed | blocked"
      assignee?: string
      priority: "low | medium | high | critical"
      tags: string[]
      created_at: string
      updated_at: string
    actions:
      - { label: "View", command: "aigentflow task view {task_id}" }
      - { label: "Retry", command: "aigentflow task retry {task_id}" }
    example:
      type: "task_card"
      props:
        task_id: "task-123"
        title: "Add user authentication"
        status: "in_progress"
        assignee: "Backend Developer"
        priority: "high"
        tags: ["api", "security"]

  file_diff:
    description: "File change visualization"
    props:
      filename: string
      language: string
      change_type: "added | modified | deleted | renamed"
      hunks:
        - start_line: number
          changes:
            - type: "add | remove | context"
              content: string
              line_number: number
      stats: { additions: number, deletions: number }
    actions:
      - { label: "Apply", command: "aigentflow apply {filename}" }
      - { label: "Reject", command: "aigentflow reject {filename}" }
    example:
      type: "file_diff"
      props:
        filename: "src/auth/login.ts"
        language: "typescript"
        change_type: "modified"
        hunks:
          - start_line: 10
            changes:
              - { type: "context", content: "function login()", line_number: 10 }
              - { type: "remove", content: "  return null;", line_number: 11 }
              - { type: "add", content: "  return authenticate(user);", line_number: 11 }
        stats: { additions: 5, deletions: 2 }

  approval_request:
    description: "User approval prompt"
    props:
      request_id: string
      type: "design | code | deploy | security"
      title: string
      description: string
      artifacts:
        - { type: string, label: string, preview?: GenUIComponent }
      timeout_seconds?: number
      default_action: "approve | deny"
    actions:
      - { id: "approve", label: "Approve", variant: "primary" }
      - { id: "deny", label: "Deny", variant: "danger" }
      - { id: "modify", label: "Request Changes", variant: "secondary" }
    example:
      type: "approval_request"
      props:
        request_id: "apr-456"
        type: "design"
        title: "Dashboard Layout Approval"
        description: "Please review the proposed dashboard design"
        artifacts:
          - { type: "image", label: "Mockup", preview: { type: "image", props: {...} } }
        timeout_seconds: 3600

  terminal_output:
    description: "Command execution output"
    props:
      command: string
      output: string
      exit_code: number
      duration_ms: number
      streaming: boolean
    metadata:
      copyable: true
      collapsible: true
    example:
      type: "terminal_output"
      props:
        command: "npm test"
        output: "PASS src/auth.test.ts\n  ✓ should authenticate user (45ms)\n\nTests: 1 passed"
        exit_code: 0
        duration_ms: 1250

  design_preview:
    description: "UI design mockup preview"
    props:
      design_id: string
      title: string
      image_url: string
      thumbnail_url?: string
      status: "draft | pending_approval | approved | rejected"
      version: number
      components: string[]  # List of components in design
    actions:
      - { label: "View Full", command: "aigentflow design view {design_id}" }
      - { label: "Approve", command: "aigentflow design approve {design_id}" }
    example:
      type: "design_preview"
      props:
        design_id: "dsg-789"
        title: "Login Page"
        image_url: "/designs/login-v2.png"
        status: "pending_approval"
        version: 2
        components: ["LoginForm", "SocialAuth", "ForgotPassword"]
```

### 32.9 Composite Patterns

```yaml
composite_patterns:
  agent_output:
    description: "Standard agent response layout"
    structure:
      type: "container"
      children:
        - type: "agent_status"      # Header with agent info
        - type: "section"            # Main output content
          children:
            - type: "markdown"       # Summary
            - type: "code_block"     # Generated code
            - type: "file_diff"      # Changes made
        - type: "section"            # Artifacts
          children:
            - type: "list"           # Files created/modified
        - type: "alert"              # Warnings/notes
        - type: "button_group"       # Actions

  task_summary:
    description: "Task completion summary"
    structure:
      type: "card"
      props: { title: "Task Complete", icon: "check-circle" }
      children:
        - type: "stats_row"          # Key metrics
          children:
            - type: "stat"           # Files changed
            - type: "stat"           # Lines added
            - type: "stat"           # Tests passed
        - type: "timeline"           # Execution steps
        - type: "table"              # File changes
        - type: "button_group"       # Next actions

  approval_flow:
    description: "Multi-step approval process"
    structure:
      type: "container"
      children:
        - type: "progress"           # Step indicator
          props: { variant: "steps" }
        - type: "approval_request"   # Current approval
        - type: "stack"              # Previous approvals (collapsed)
          children:
            - type: "card"           # Each previous approval
              props: { collapsible: true, default_collapsed: true }

  error_report:
    description: "Error with context and recovery"
    structure:
      type: "container"
      children:
        - type: "alert"
          props: { variant: "error" }
        - type: "card"
          props: { title: "Error Details", collapsible: true }
          children:
            - type: "code_block"     # Stack trace
            - type: "table"          # Context variables
        - type: "card"
          props: { title: "Suggested Fixes" }
          children:
            - type: "list"           # Fix options with actions
```

### 32.10 CLI Rendering Rules

```yaml
cli_rendering:
  width_handling:
    max_width: 120          # Characters
    responsive_breakpoints:
      narrow: 60            # Single column, abbreviated
      medium: 80            # Standard terminal
      wide: 120             # Full layout

  color_mapping:
    semantic_colors:
      success: "green"
      warning: "yellow"
      error: "red"
      info: "blue"
      muted: "gray"
      accent: "cyan"

    component_colors:
      heading: "bold white"
      code: "cyan"
      link: "underline blue"
      badge_success: "bg:green black"
      badge_error: "bg:red white"

  unicode_symbols:
    icons:
      check: "✓"
      cross: "✗"
      arrow_right: "→"
      bullet: "•"
      spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
      folder: "📁"
      file: "📄"
      warning: "⚠"
      info: "ℹ"

    box_drawing:
      horizontal: "─"
      vertical: "│"
      top_left: "┌"
      top_right: "┐"
      bottom_left: "└"
      bottom_right: "┘"
      t_down: "┬"
      t_up: "┴"
      t_right: "├"
      t_left: "┤"
      cross: "┼"

  component_rendering:
    table:
      border_style: "rounded"  # ascii | rounded | heavy | double | none
      header_style: "bold"
      truncate_cell: 40        # Max cell width before "..."
      max_rows_before_scroll: 20

    code_block:
      line_number_style: "dim"
      highlight_style: "bg:yellow"
      diff_add_style: "green"
      diff_remove_style: "red"

    progress:
      bar_char_filled: "█"
      bar_char_empty: "░"
      bar_width: 30

    tree:
      indent: 2
      branch_style: "├── "
      last_branch_style: "└── "
      vertical_style: "│   "
```

### 32.11 Streaming Output Protocol

```yaml
streaming_protocol:
  chunk_types:
    start:
      description: "Begin new component"
      format: { type: "start", component_type: string, id: string }

    update:
      description: "Update existing component content"
      format: { type: "update", id: string, content: string, append: boolean }

    replace:
      description: "Replace component entirely"
      format: { type: "replace", id: string, component: GenUIComponent }

    complete:
      description: "Mark component as finished"
      format: { type: "complete", id: string }

    action:
      description: "Enable/disable actions"
      format: { type: "action", id: string, action_id: string, enabled: boolean }

  streaming_components:
    text:
      strategy: "append"
      buffer_until: "sentence"  # word | sentence | paragraph | complete

    code_block:
      strategy: "append"
      buffer_until: "line"
      highlight_on_complete: true

    table:
      strategy: "row_append"
      show_placeholder_rows: 3

    progress:
      strategy: "replace"
      update_frequency_ms: 100

    agent_status:
      strategy: "replace"
      fields_that_stream: ["task_summary", "progress"]

  example_stream:
    - { type: "start", component_type: "agent_status", id: "agent-1" }
    - { type: "update", id: "agent-1", path: "props.status", value: "thinking" }
    - { type: "start", component_type: "code_block", id: "code-1" }
    - { type: "update", id: "code-1", content: "function ", append: true }
    - { type: "update", id: "code-1", content: "hello() {\n", append: true }
    - { type: "update", id: "code-1", content: "  return 'world';\n}", append: true }
    - { type: "complete", id: "code-1" }
    - { type: "action", id: "code-1", action_id: "apply", enabled: true }
```

### 32.12 Accessibility Requirements

```yaml
accessibility:
  semantic_structure:
    - "All content uses semantic components (heading levels, lists, tables)"
    - "Reading order matches visual order"
    - "Interactive elements are keyboard accessible"
    - "Focus indicators are visible"

  aria_mapping:
    alert: { role: "alert", "aria-live": "polite" }
    progress: { role: "progressbar", "aria-valuenow": "{value}" }
    button: { role: "button", "aria-pressed": "{pressed}" }
    checkbox: { role: "checkbox", "aria-checked": "{checked}" }
    tree: { role: "tree" }
    tree_item: { role: "treeitem", "aria-expanded": "{expanded}" }
    tab_list: { role: "tablist" }
    tab: { role: "tab", "aria-selected": "{selected}" }

  color_contrast:
    minimum_ratio: 4.5       # WCAG AA
    large_text_ratio: 3.0    # For 18pt+ or 14pt bold

  keyboard_navigation:
    tab: "Move between interactive elements"
    enter: "Activate button/link"
    space: "Toggle checkbox/expand"
    arrow_keys: "Navigate within component (tree, select)"
    escape: "Close modal/dismiss"

  screen_reader:
    - "All images have alt text"
    - "Icons have aria-label or are decorative (aria-hidden)"
    - "Loading states announced"
    - "Dynamic updates use aria-live regions"
```

### 32.13 Agent Output Examples

```yaml
# Example: Backend Developer completing a task
backend_developer_output:
  type: "container"
  props: { padding: "md" }
  children:
    - type: "agent_status"
      props:
        agent_type: "Backend Developer"
        agent_icon: "server"
        status: "completed"
        task_summary: "Implemented user authentication endpoint"
        tokens_used: 15420
        duration_ms: 45000

    - type: "section"
      props: { title: "Changes Made", level: 2 }
      children:
        - type: "file_diff"
          props:
            filename: "src/routes/auth.py"
            language: "python"
            change_type: "added"
            stats: { additions: 45, deletions: 0 }

        - type: "file_diff"
          props:
            filename: "src/models/user.py"
            language: "python"
            change_type: "modified"
            stats: { additions: 12, deletions: 3 }

    - type: "section"
      props: { title: "New Endpoints", level: 2 }
      children:
        - type: "table"
          props:
            columns:
              - { key: "method", label: "Method", width: "15%" }
              - { key: "path", label: "Path", width: "40%" }
              - { key: "description", label: "Description" }
            rows:
              - { method: "POST", path: "/api/v1/auth/login", description: "Authenticate user" }
              - { method: "POST", path: "/api/v1/auth/logout", description: "End session" }
              - { method: "POST", path: "/api/v1/auth/refresh", description: "Refresh token" }

    - type: "alert"
      props:
        variant: "info"
        title: "Next Steps"
        message: "Tests should be written for these endpoints"

    - type: "button_group"
      props:
        buttons:
          - { label: "Run Tests", variant: "primary", icon: "play" }
          - { label: "View Full Diff", variant: "secondary", icon: "eye" }
          - { label: "Request Review", variant: "secondary", icon: "users" }
      actions:
        - { id: "test", command: "pytest tests/auth/" }
        - { id: "diff", command: "git diff HEAD~1" }
        - { id: "review", command: "aigentflow review request" }
```

```yaml
# Example: Approval Request for Design
design_approval_output:
  type: "container"
  children:
    - type: "approval_request"
      props:
        request_id: "apr-design-001"
        type: "design"
        title: "Dashboard Layout - v2"
        description: "Updated dashboard with new sidebar navigation and widget layout"
        timeout_seconds: 86400
        artifacts:
          - type: "mockup"
            label: "Desktop View"
          - type: "mockup"
            label: "Mobile View"

    - type: "section"
      props: { title: "Design Preview", level: 2 }
      children:
        - type: "design_preview"
          props:
            design_id: "dsg-dashboard-v2"
            title: "Dashboard Layout"
            image_url: "/mockups/dashboard-v2.png"
            status: "pending_approval"
            version: 2
            components:
              - "Sidebar"
              - "MetricsWidget"
              - "ActivityFeed"
              - "QuickActions"

    - type: "section"
      props: { title: "Changes from v1", level: 2 }
      children:
        - type: "list"
          props:
            items:
              - { content: "Collapsible sidebar navigation", icon: "check" }
              - { content: "Drag-and-drop widget arrangement", icon: "check" }
              - { content: "Dark mode support", icon: "check" }
              - { content: "Responsive mobile layout", icon: "check" }

    - type: "button_group"
      props:
        buttons:
          - { label: "Approve Design", variant: "primary", icon: "check" }
          - { label: "Request Changes", variant: "secondary", icon: "edit" }
          - { label: "Reject", variant: "danger", icon: "x" }
```

---

*Document Version: 1.5.0*
*Generated: December 2024*
*Target: CLI-first multi-agent orchestrator for Claude Code integration*
