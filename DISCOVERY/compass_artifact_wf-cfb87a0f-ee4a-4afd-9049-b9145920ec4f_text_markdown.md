# Aigentflow: Multi-Agent Orchestrator Architecture Blueprint

The core architectural shift from V1 to V2 is transforming the orchestrator from a "task queue that dispatches" into a "coordinator that thinks." This blueprint addresses all 45 research questions with detailed schemas, implementation patterns, and enterprise-ready designs built for a £billion+ enterprise AI company.

## V1 Failure Prevention: The Foundation

V1's five critical failures drove every design decision in this blueprint. The orchestrator's **2000-character context truncation** is replaced with a tiered, per-agent context system supporting Claude's full 200K context window with smart summarization. **Freeform text outputs** become strict JSON schemas with Zod validation and Claude's structured output guarantees. **Stage-based routing** (`STAGE_AGENT_MAP.get(stage)`) transforms into a hybrid rule/AI decision engine where Claude reasons about complex routing decisions. **Missing feedback loops** are replaced with comprehensive BUILDER→TESTER→BUG_FIXER→TESTER cycles with max 3 retries and intelligent escalation. The **procedural orchestrator** becomes an AI agent with its own system prompt, synthesizing across agents and making strategic decisions.

## Intelligent Orchestrator Design

The orchestrator operates as a thinking coordinator using a hybrid architecture that balances speed with intelligence. Deterministic rules handle **85% of routing decisions** in under 5ms—when tests fail with `routing_hints.has_failures`, route to BUG_FIXER immediately. When `needs_user_approval` is true, pause and request input. Security concerns trigger SECURITY_AGENT with critical priority.

For ambiguous cases representing the remaining 15%, Claude provides reasoning through a tiered system: **Claude Haiku** handles simple disambiguation in 100-300ms, while **Claude Sonnet with extended thinking** manages complex multi-factor decisions, stage transitions, and synthesis across agent outputs in 300-1000ms.

```typescript
interface OrchestratorDecision {
  decision_type: 'route' | 'pause' | 'escalate' | 'synthesize';
  reasoning: string;  // Claude's step-by-step analysis
  routing?: {
    next_agents: AgentType[];
    parallel: boolean;
    tasks: AgentTask[];
  };
}
```

The orchestrator's system prompt establishes its identity as a coordinator, not a dispatcher. It maintains project state synthesis, evaluates agent output signals (`status`, `routing_hints`, `confidence`), and decides when to parallelize work versus serialize for dependencies.

## Structured Output System

Every agent returns validated JSON conforming to a common base schema with agent-specific extensions. The **base schema** includes `schema_version`, `agent_type`, `task_id`, `timestamp`, `status` (success/failed/blocked/needs_input), `confidence` score, `errors` array, `routing_hints`, and `tokens_used`. Agent-specific schemas extend this—the Project Manager returns epics with features and tasks, the Architect returns ADRs with tech stack decisions, the Tester returns structured test results with coverage metrics.

Validation uses **Zod** for TypeScript-first schema definition with `safeParse()` for non-throwing validation. Error recovery implements a multi-strategy pipeline: direct JSON parse → extract from markdown blocks → repair malformed JSON → extract partial key-value pairs. Schema evolution follows semantic versioning with backward-compatible changes only.

The `routing_hints` field enables intelligent orchestration:
```typescript
interface RoutingHints {
  next_agents: string[];          // Suggested next agents
  priority: 'critical' | 'high' | 'medium' | 'low';
  blocking: boolean;              // Does this block the pipeline?
  depends_on: string[];           // Task dependencies (DAG edges)
  needs_user_approval?: boolean;  // Pause for human input
  has_failures?: boolean;         // Trigger bug fixing
}
```

## Context Management System

The 2000-character truncation failure is replaced with a **four-tier context architecture**. **Tier 1 (Persistent Storage)** includes vector databases for semantic search, session databases for state and facts, and artifact repositories for code and specs. **Tier 2 (Shared Memory Blocks)** contains project state, agent status registry, decision logs, and dependency graphs. **Tier 3 (Agent-Specific Context)** provides curated context per agent type—Frontend developers get UI designs, component specs, and existing code; Backend developers get API specs, database schemas, and service contracts. **Tier 4 (Working Memory)** holds current task state, active tool results, and recent conversation turns.

Per-agent context budgets allocate Claude's 200K context window: **15K for sacred context** (never truncate), **40K for high-priority context**, **25K for medium-priority**, **30K for working memory**, **25K for RAG retrieval**, and **40-65K reserved for response generation**. Summarization follows a hierarchy preferring raw data over compaction over lossy summarization. Smart truncation applies to old tool outputs and resolved errors while protecting current task specifications, active code files, error messages, and type definitions.

Context handoffs between agents use condensed **1000-2000 token summaries** with artifact references rather than full transcripts. The MemGPT-inspired memory block pattern enables agents to edit their own persistent memory within character limits, with automatic summarization when limits are approached.

## Feedback Loop Implementation

The build-test-fix cycle operates as a finite state machine with states including IDLE, BUILDING, TESTING, CLASSIFYING, BUG_FIXING, RETESTING, ESCALATING, and COMPLETE. Test failures trigger classification into categories: **SYNTAX_ERROR** (auto-fixable, immediate fix), **TYPE_ERROR** (auto-fixable, targeted fix), **FLAKY_TEST** (retry first, 2x), **LOGIC_ERROR** (requires design review, escalate).

The retry strategy implements exponential backoff with jitter: `min(maxDelay, initialDelay × 2^attempt) ± 30% jitter`. Starting at 1000ms, delays progress to approximately 700-1300ms, then 1400-2600ms, then 2800-5200ms before escalation. Maximum retries default to 3.

Escalation triggers include max retries exceeded, same error recurring after multiple fix attempts, security vulnerabilities detected, fundamental design issues identified, and fix attempts that introduced new failures. Escalation notifications include failed test details, attempt count, and action options (Fix Manually, Skip Tests, Create Issue).

Targeted test re-runs execute only failed tests: `jest --onlyFailures` for Jest, `pytest --lf` for pytest. The bug fixer receives rich context including the failed test code, affected source files parsed from stack traces, recent git changes, previous fix attempts (to avoid repeating failed patches), and error classification.

## Agent Definitions and MCP Architecture

The system comprises 13 specialized agents, each with defined capabilities, required context, output schemas, and security levels. The **Orchestrator** coordinates all agents using Claude for reasoning. The **Project Manager** breaks requirements into epics, features, and tasks with dependency graphs. The **Architect** creates ADRs using MADR 4.0 format, makes tech stack decisions, and defines security architecture. The **Analyst** researches best practices and analyzes requirements. The **UI Designer** creates design tokens, component specifications, and mockups with approval workflows. The **Git Agent** manages branches, commits, worktrees, and secret scanning. **Frontend** and **Backend Developers** implement features with structured output of files created, endpoints defined, and dependencies added. The **Tester** writes and executes tests with coverage tracking. The **Bug Fixer** analyzes failures and generates targeted patches. The **Merge Conflict Resolver** handles git conflicts. The **Reviewer** performs code review with security checklists and lesson extraction. The **Compliance Agent** monitors security, maintains audit logs, and verifies compliance requirements.

MCP (Model Context Protocol) integration provides standardized tool access. Required MCP servers include **filesystem** for file read/write, **git** for version control operations, **database** for query execution, **terminal** for command execution, and **web** for external API access. Each agent has restricted tool access based on security level (read-only, write, execute).

## Skills and Communication Architecture

Skills are modular capability packs encoding domain expertise, distinct from tools which execute actions. Skill categories include **Coding** (React, Vue, Python, TypeScript patterns), **Testing** (Jest, Pytest, Playwright frameworks), **Security** (secret scanning, SAST, dependency audit), and **Compliance** (SOC 2 checks, GDPR verification).

Each skill has versioned definitions:
```typescript
interface Skill {
  id: string;                     // "security.secrets.scanner"
  version: string;                // Semantic versioning
  category: 'coding' | 'testing' | 'security' | 'compliance';
  requiredTools: string[];
  execute: (context: SkillContext) => Promise<SkillResult>;
}
```

Agent communication uses a standardized message protocol with message types including `task.assign`, `task.complete`, `task.failed`, `handoff.request`, and `event.broadcast`. Messages include source/destination agent identifiers, correlation IDs for request tracking, priority levels, and TTL for timeout handling. The event bus supports pub/sub for broadcasts (file.changed, build.completed, security.vulnerability), enabling reactive agent coordination.

## State Management and Feature Flags

State management implements event sourcing for complete audit trails with state recovery capability. Project state tracks epics, features, tasks, and their statuses. Agent execution state monitors current task, tool calls, messages, and token usage. Compliance state tracks check statuses, violations, and approvals.

The feature flag system supports multiple flag types: **boolean** (simple on/off), **percentage** (gradual rollout), **multivariate** (A/B testing), and **user-targeted** (specific segments). Environment-specific configurations override defaults, with compliance-gated features requiring approval and prerequisite checks. The evaluation engine checks flag prerequisites, evaluates targeting rules with conditions, and applies percentage rollouts using consistent hashing.

## Model Abstraction Layer

A unified provider interface supports multiple LLM providers:
```typescript
interface LLMProvider {
  chat(messages: Message[], options: ChatOptions): Promise<ChatResponse>;
  streamChat(messages: Message[], options: ChatOptions): AsyncIterable<ChatStreamChunk>;
  structured<T>(messages: Message[], schema: Schema<T>): Promise<T>;
  embed(input: string | string[]): Promise<number[][]>;
  capabilities: ProviderCapabilities;
}
```

Provider implementations exist for Claude (Anthropic), OpenAI, and local models (Ollama). The router implements fallback chains, automatic retry on transient errors, and cost tracking per request with project-level budget alerts.

## Prompt Architecture

A four-level prompt hierarchy structures all agent interactions. **Level 1 (System)** defines identity, global capabilities, and constraints. **Level 2 (Agent)** provides role-specific expertise, available tools, and behavior guidelines with few-shot examples. **Level 3 (Task)** contains the current objective, context, requirements, and acceptance criteria. **Level 4 (Compliance)** injects data classification, restrictions, required disclosures, and audit requirements.

Prompts are versioned with semantic versioning, stored in a registry, and promoted through labels (latest → staging → production). Template rendering validates required variables and substitutes values with optional defaults.

## Guardrails Framework

The guardrails system operates at four levels. **Input guardrails** prevent prompt injection attacks using pattern matching for dangerous phrases, typoglycemia defense for scrambled words, and encoding detection for Base64/Unicode obfuscation. **Output guardrails** detect system prompt leakage, hallucinations through grounding checks, toxicity, and PII for redaction. **Code guardrails** enforce security rules (SQL injection, XSS, secrets detection, command injection) and quality metrics (complexity, duplication, dead code). **Compliance guardrails** verify OWASP Top 10 requirements, data privacy rules, and regulatory requirements.

Quality gates enforce standards at each stage: **pre-code** gates require design document approval and threat modeling; **code** gates require zero critical issues, 80% line coverage, and passed security scans; **pre-merge** gates require 2 reviewer approvals and resolved conversations; **pre-deploy** gates require license compliance and complete audit trails.

## Review Architecture

Automated review rules check for security vulnerabilities, hardcoded secrets, XSS vulnerabilities, insecure dependencies, and missing auth checks. Human review triggers activate for security-sensitive files (auth, crypto), infrastructure changes (Terraform, Docker), API changes, and large PRs exceeding 500 lines.

The security review checklist follows OWASP guidelines covering input validation, authentication, authorization, data protection, and error handling. The approval workflow progresses through automated checks, peer review (2 approvals), security review for sensitive changes, and final approval.

Lesson extraction captures patterns from reviews—when suggestions are accepted, the system analyzes the before/after code, categorizes the lesson, and scores confidence. High-confidence lessons with sufficient votes can be promoted to automated rules.

## Documentation and Configuration

The **CLAUDE.md** template serves as the authoritative context file, containing project overview, tech stack, directory structure, coding standards, common commands, compliance context, agent-specific guidance, and recent changes. It uses `@` imports to reference detailed documentation without bloating the main file.

Configuration follows a **five-layer hierarchy**: system.config.yaml (platform defaults) → organization.config.yaml (org overrides) → project.config.yaml (project settings) → user.config.yaml (preferences) → .env.{environment} (runtime secrets). Higher layers override lower with deep merge semantics. All configs have JSON Schema validation.

The project structure includes `.aigentflow/` for orchestrator configuration (agents, compliance, lessons, hooks), `src/` for source code, `docs/` for architecture documentation and ADRs, and `tests/` for test suites including compliance tests.

## Learning and Self-Improvement

The learning system uses a hybrid storage approach: **vector database** for semantic similarity search, **relational database** for structured metadata and scoring, and optionally **graph database** for lesson relationships.

The lesson scoring algorithm computes: `Final Score = BaseScore × TypeMultiplier × RecencyFactor × UsageBoost × SuccessFactor × RelevanceScore × SeverityBoost`. **Compliance lessons receive 2x multiplier**. Recency uses exponential decay with 30-day half-life. Usage boost is logarithmic (capped at 2x). Relevance combines semantic similarity (60%) with contextual matching for language, framework, and project (40%).

User-created agents maintain isolated learning profiles with configurable sharing levels (none, project, organization, global). Cross-agent knowledge sharing requires minimum success rate, usage count, and optionally human approval. Project isolation prevents cross-contamination while always allowing global compliance lessons.

## Design System Integration

Design tokens follow the Style Dictionary format with a three-tier hierarchy: **primitive** (raw values like hex colors), **semantic** (contextual meanings like `primary`), and **component** (button.background, card.shadow). Component specifications define props, variants, states, accessibility requirements, and token references.

The **design-first workflow** requires every feature to start with UI Designer mockups. User approves designs before any code is written. Frontend builders reference approved designs. Visual verification compares implementation to mockups using tools like Applitools Eyes or Percy with configurable deviation thresholds (0.5% pixel deviation, 2px layout shift tolerance).

## Architect Agent Design

The Architect Agent creates ADRs when selecting major technologies, defining system boundaries, choosing data storage, designing authentication, or changing deployment architecture. The ADR template follows MADR 4.0 format with status, date, decision-makers, context, decision drivers, considered options, outcome, consequences, and required security considerations section.

The security architecture checklist covers identity and access (authentication, authorization, session management), data protection (encryption at rest/in transit, key management), network security (segmentation, firewall rules, API security), application security (input validation, output encoding, error handling), logging and monitoring (security events, log protection, alerting), and compliance controls (privacy, audit trails).

## Git and Secrets Architecture

Git worktrees enable parallel AI agent development with multiple working directories from a single repository. Branch naming follows `feature/agent-{id}-{task}` patterns. Branch protection requires signed commits, 2 reviews for main, and required status checks (secret-scan, tests, security-scan).

External project import follows a security-first pipeline: clone → secret scan (blocking) → dependency audit (blocking) → SAST scan → license check → compliance report → user approval → initialize Aigentflow config. Any detected secrets block import until remediated.

Secrets management integrates with HashiCorp Vault using environment-specific paths (development, staging, production) with different TTLs and rotation intervals. **Production uses dynamic secrets with 15-minute TTL and daily rotation**. Secret injection uses the Vault Agent sidecar pattern for production, environment files for development. Pre-commit secret scanning with TruffleHog and Gitleaks is **mandatory across ALL environments**.

## Environment-Aware Compliance

The two-tier compliance model distinguishes **Platform Compliance** (Aigentflow's own SOC 2, GDPR obligations) from **Project Compliance** (per-project requirements like HIPAA, PCI-DSS).

Controls scale by environment: **Local** has minimal controls (no MFA, console logging, .env files OK) but secret scanning is always on. **Development** adds structured logging and optional MFA. **Staging** enables full controls minus external audits. **Production** requires all controls including MFA, full external audit logging, real-time monitoring, and weekly access reviews.

SOC 2 compliance tracks Trust Services Criteria CC1-CC9 with automated evidence collection from cloud infrastructure, identity providers, code repositories, HR systems, and ticketing systems. Gap tracking treats compliance deficiencies like technical debt with severity, ownership, remediation plans, and audit impact flags.

Project compliance templates for HIPAA cover administrative, physical, and technical safeguards with PHI handling rules (AES-256 encryption, access logging, 6-year audit retention). PCI-DSS templates address all 12 requirements with card data isolation and scope reduction through tokenization. SOX templates cover Section 302/404 with IT general controls for access, change management, computer operations, and program development.

Launch blockers prevent deployment until critical compliance requirements are met: no exposed secrets, zero critical vulnerabilities, framework-specific requirements (PHI encryption for HIPAA, CDE isolation for PCI-DSS), and stakeholder approvals.

## Security Controls and Audit

Audit logging uses an **immutable hash chain** for tamper-evidence. Each log entry includes a SHA-256 hash of its contents and the previous entry's hash, forming a Merkle chain. Storage uses append-only PostgreSQL tables with triggers preventing UPDATE/DELETE, backed by S3 with Object Lock. Retention varies by classification: 7 years for security events, 3 years for user activity, 1 year for system events.

Authentication supports SAML, OIDC, and OAuth2 with MFA (TOTP, WebAuthn, SMS, email). API keys use bcrypt hashing with prefix identification, scopes, rate limits, and IP whitelisting. Sessions have configurable timeouts (absolute and idle) with rotation.

Authorization implements RBAC with built-in roles (owner, admin, developer, viewer, auditor) and custom role support. Each role defines permissions as resource-action pairs. The authorization service checks permissions with ABAC conditions and logs all decisions.

Multi-tenant security uses **row-level security (RLS)** in PostgreSQL with tenant context set at connection time. Storage isolation uses tenant-prefixed paths with per-tenant encryption keys. Compute isolation runs agents in containers with resource limits, network policies, and injected tenant context. Each tenant has its own **master encryption key** in KMS with derived data encryption keys for database, storage, and secrets.

Threat detection rules identify brute force attacks, suspicious execution patterns, cross-tenant access attempts, privilege escalation sequences, and data exfiltration. SIEM integration (Splunk, Datadog, Elastic, Sentinel) forwards events and receives alerts for correlation.

## Incident Response and GDPR

Incident severity levels range from SEV-1 (critical, 15-minute response, 4-hour resolution) to SEV-4 (low, 8-hour response, 72-hour resolution). Detection integrates APM alerts, log anomalies, resource thresholds, error rate spikes, and SIEM correlation.

Runbooks provide structured playbooks with automated diagnostics, remediation steps, escalation triggers, and rollback procedures. Post-incident reviews follow a blameless postmortem framework capturing timeline, root cause analysis (5 Whys), lessons learned, and tracked action items.

Tool integrations with PagerDuty and Opsgenie provide multi-channel notifications, escalation policies, on-call rotation, and Rundeck integration for runbook automation.

GDPR compliance includes comprehensive data inventory by category with legal basis mapping. DSAR (Data Subject Access Request) workflow handles all Article 15-21 request types with a 30-day SLA. The process flows from request intake → identity verification → data discovery → review and redaction → secure delivery. Consent management captures granular consent with proof, enforces consent checks before processing, and provides a preference center for withdrawal. Retention automation implements scheduled cleanup jobs executing policies by data category.

## Compliance Dashboards

The platform compliance dashboard displays overall compliance score, open DSARs (with deadline warnings), active incidents, days since last audit, compliance percentage by framework (GDPR, SOC 2, ISO 27001, EU AI Act), DSAR processing status, consent analytics, and critical gaps requiring action.

The project compliance dashboard shows data compliance percentage, agent compliance rates, security score, and AI risk level. Agent activity compliance tracks tasks, compliant percentage, flagged items, and blocked actions per agent. Data processing records document processing activities, legal basis coverage, and DPIAs completed.

Audit export formats include DSAR completion records, consent audit trails, processing activity records, security incident logs, and training completion certificates with date range selection and auditor-friendly formatting.

## Future Considerations

The **EU AI Act** timeline requires attention: February 2025 bans prohibited practices, August 2025 mandates GPAI transparency, August 2026 requires full high-risk AI compliance. Aigentflow likely classifies as high-risk or limited risk as a general-purpose AI system. Implementation requirements include risk management, data governance, technical documentation, transparency (user notification of AI interactions), human oversight for high-impact actions, accuracy testing, and comprehensive logging.

Emerging governance patterns include KPMG's Trusted AI Framework emphasizing reliability, fairness, accountability, transparency, security, and privacy. **Governance-as-a-Service (GaaS)** provides a modular, policy-driven enforcement layer for agent outputs with declarative policies, dynamic trust scores, and adaptive enforcement.

Multi-agent governance requires orchestrator-level controls (centralized policy, communication audit, task limits), agent-level controls (input validation, output filtering, scope restrictions), human oversight triggers for novel or high-impact scenarios, and incident response capabilities including agent isolation and emergency shutdown.

Interoperability standards to monitor include MCP (Model Context Protocol) for AI-tool interactions and A2A (Agent-to-Agent) for agent coordination.

---

This blueprint provides the architectural foundation for Aigentflow V2, addressing all critical V1 failures while building enterprise-grade compliance, security, and intelligence from day one. Implementation should prioritize the orchestrator intelligence layer, structured output system, and context management as the core enablers for all other components.