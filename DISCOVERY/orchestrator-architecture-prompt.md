# Multi-Agent Orchestrator System: Comprehensive Architecture Prompt

I want you to conduct deep research into the Anthropic Claude documentation and related resources to help me architect a cutting-edge multi-agent orchestrator system. This will eventually power a UI for building full-stack mobile, desktop, and web applications — but first, we're building the headless backend system to ensure everything works before adding any interface.

**Critical Context:** This system is being built with the ambition of becoming a £billion+ valuation enterprise AI company. Therefore, security, compliance, and enterprise-readiness must be baked in from day one — not bolted on later. Every architectural decision must consider compliance implications.

## Research Phase

Start by thoroughly reviewing:
- https://platform.claude.com/docs/en/home (entire documentation)
- Best practices for multi-agent AI systems
- MCP (Model Context Protocol) servers and implementations
- Agentic coding patterns and orchestration frameworks
- Prompt engineering best practices for multi-agent systems
- Feature flag architectures for AI systems
- Event-driven and state machine architectures for AI orchestration
- Design system architectures (styleguides, component libraries, design tokens)
- Multi-tenant SaaS architectures with customization layers
- Version control patterns for configuration and prompts
- Continuous learning systems for AI agents
- Software architecture patterns and decision records (ADRs)
- Real-time event streaming architectures (WebSockets, SSE, pub/sub)
- Hook/plugin systems in software architectures
- Knowledge management and lesson learned systems
- Architecture visualization approaches (C4 model, arc42, UML, etc.)
- Interactive architecture diagrams and tools
- Graph-based and spatial representations of software systems
- Git workflows for multi-repo systems
- Secrets management best practices (Vault, dotenv, git-secrets)
- Overlay/sidecar patterns for non-invasive tooling integration
- **SOC 2 Type I and Type II compliance requirements**
- **GDPR and UK data protection regulations**
- **Enterprise security best practices (OWASP, NIST)**
- **Multi-tenant security isolation patterns**
- **Audit logging and compliance reporting systems**
- **AI-specific security concerns (prompt injection, data leakage)**

Search the web for current state-of-the-art approaches to multi-agent development systems, agentic workflows, and any open-source implementations we could learn from.

---

## System Vision

### Critical Lessons from V1 (Anti-Patterns to Avoid)

**We built a previous version of this system that failed.** Analysis revealed fundamental architectural flaws that we MUST NOT repeat. The core problem was: **"The orchestrator was a task queue, not a coordinator."**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     V1 FAILURE ANALYSIS: WHAT WENT WRONG                    │
└─────────────────────────────────────────────────────────────────────────────┘

ISSUE 1: CONTEXT PASSING WAS TOO THIN
──────────────────────────────────────
❌ V1 MISTAKE:
   previous_context truncated to 2000 chars!
   
   if len(context_str) > 2000:
       context_str = context_str[:1900] + "... [truncated]"
   
   Agents lost critical context from previous stages.

✅ V2 REQUIREMENT:
   - Rich, structured context passing
   - Context tailored per agent type (designer needs different context than backend dev)
   - Smart summarization, not dumb truncation
   - Include: design decisions, API specs, file changes, test results, architecture context


ISSUE 2: NO STRUCTURED OUTPUT FORMAT
────────────────────────────────────
❌ V1 MISTAKE:
   Agents saved freeform output[:8000] to database
   Orchestrator couldn't parse agent output for routing decisions
   
   No automatic bug-fix loop because orchestrator couldn't tell if tests failed.

✅ V2 REQUIREMENT:
   - Every agent returns structured JSON with defined schema
   - PLANNER returns: { tasks: [...], dependencies: [...] }
   - BUILDER returns: { files_created: [...], files_modified: [...], status: "success" }
   - TESTER returns: { passed: 7, failed: 1, failures: [{test, error, file, line}] }
   - REVIEWER returns: { approved: true, issues: [...], lessons: [...] }
   - Orchestrator parses output and routes based on structured data


ISSUE 3: STAGE-BASED VS TASK-BASED ROUTING
─────────────────────────────────────────
❌ V1 MISTAKE:
   Pure stage-based lookup with no intelligence:
   
   return STAGE_AGENT_MAP.get(stage)  # That's it
   
   Task in "building" → spawn fullstack_dev (always, regardless of context)
   Orchestrator was a dumb task queue.

✅ V2 REQUIREMENT:
   - Orchestrator makes intelligent routing decisions
   - Consider: task type, dependencies, previous results, failures, context
   - "TESTER found bug" → route to BUG_FIXER with failure context
   - "Design needs approval" → pause and request user input
   - "Architecture question" → route to ARCHITECT, not BUILDER


ISSUE 4: NO FEEDBACK LOOP FOR FAILURES
─────────────────────────────────────
❌ V1 MISTAKE:
   Agent completes → task.stage transitions → next agent spawns
   No parsing of result to check for failures
   No automatic retry/fix loop
   
   diagnosing/bugfix stages only triggered by agent failure, not test failure

✅ V2 REQUIREMENT:
   - Automatic feedback loops:
     BUILDER → TESTER → [if failed] → BUG_FIXER (with failure context) → TESTER
   - Parse test results to detect failures
   - Create fix tasks automatically
   - Re-run only failed tests after fix
   - Maximum retry count to prevent infinite loops


ISSUE 5: ORCHESTRATOR DOESN'T "THINK"
────────────────────────────────────
❌ V1 MISTAKE:
   Pure procedural loop:
   
   while running:
       slots = get_available_slots()
       tasks = get_executable_tasks()
       for task in tasks[:slots]:
           spawn_agent(task.stage → agent_type)
   
   process_user_prompt() used Claude but only for direct user prompts,
   not for automated decision-making.

✅ V2 REQUIREMENT:
   - Orchestrator IS an AI agent that thinks
   - Uses Claude to analyze: "Given this test failure, should I retry, 
     create a fix task, or ask the user?"
   - Makes judgment calls on routing
   - Can recognize when it's stuck and escalate to user
   - Synthesizes information across agents to make informed decisions


SUMMARY: THE CORE ARCHITECTURAL SHIFT
─────────────────────────────────────
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  V1 ARCHITECTURE (Failed):                                                  │
│                                                                             │
│    [DB Task Queue] → [Stage Lookup] → [Spawn Agent] → [Save Output] → Loop │
│                                                                             │
│    Orchestrator = Dumb dispatcher                                           │
│    Agents = Independent workers with minimal context                        │
│    Output = Freeform text dumped to DB                                      │
│    Routing = Stage-based lookup table                                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  V2 ARCHITECTURE (Required):                                                │
│                                                                             │
│    USER PROMPT                                                              │
│         │                                                                   │
│         ▼                                                                   │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                    ORCHESTRATOR (AI Agent)                       │     │
│    │                                                                  │     │
│    │  • Maintains full project context                                │     │
│    │  • Synthesizes information between agents                        │     │
│    │  • Makes intelligent routing decisions                           │     │
│    │  • Parses structured agent outputs                               │     │
│    │  • Implements feedback loops                                     │     │
│    │  • Requests user input at checkpoints                            │     │
│    │  • Handles failures intelligently                                │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│         │                   ▲                                               │
│         │ Curated context   │ Structured JSON output                       │
│         ▼                   │                                               │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│    │ PLANNER │  │DESIGNER │  │ BUILDER │  │ TESTER  │  │REVIEWER │       │
│    └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                                             │
│    Orchestrator = Intelligent coordinator with AI reasoning                 │
│    Agents = Specialists receiving curated, structured context               │
│    Output = Structured JSON with defined schemas                            │
│    Routing = AI-driven decisions based on context and results               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Ideal Orchestration Flow Example

This is what we're building — study this flow carefully:

```
================================================================================
ORCHESTRATOR RECEIVES USER PROMPT
================================================================================
USER → ORCHESTRATOR:
"Build me a todo app that I can add new todos, mark them as done, and filter them"

--------------------------------------------------------------------------------
ORCHESTRATOR THINKING (AI Reasoning):
--------------------------------------------------------------------------------
> Parsing request...
> Epic detected: "Todo App"
> Features identified:
>   1. Add new todo
>   2. Mark todo as done  
>   3. Filter todos
>
> Workflow: PLANNER → DESIGNER → BUILDER → TESTER → REVIEWER
> Starting with PLANNER...

================================================================================
PHASE 1: PLANNING
================================================================================

ORCHESTRATOR → PLANNER:
┌─────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM: You are a software planner. Break down requirements into tasks.    │
│                                                                             │
│ CONTEXT:                                                                    │
│ - Project: Todo App                                                         │
│ - Stack: React frontend, FastAPI backend, SQLite database                   │
│                                                                             │
│ USER REQUEST:                                                               │
│ "Build me a todo app that I can add new todos, mark them as done,          │
│  and filter them"                                                           │
│                                                                             │
│ OUTPUT FORMAT:                                                              │
│ Return a JSON object with tasks array. Each task needs:                     │
│ { id, title, description, type, dependencies, acceptance_criteria }         │
└─────────────────────────────────────────────────────────────────────────────┘

PLANNER → ORCHESTRATOR (Structured JSON):
{
  "status": "success",
  "tasks": [
    {
      "id": "TASK-001",
      "title": "Design UI mockup for Todo App",
      "type": "design",
      "dependencies": [],
      "acceptance_criteria": ["Shows add form", "Shows todo list",
                              "Shows filter controls", "Shows checkboxes"]
    },
    {
      "id": "TASK-002",
      "title": "Create Todo database schema",
      "type": "backend",
      "dependencies": [],
      "acceptance_criteria": ["todos table with id, text, done, created"]
    },
    ... more tasks
  ]
}

--------------------------------------------------------------------------------
ORCHESTRATOR THINKING:
--------------------------------------------------------------------------------
> Received 5 tasks from PLANNER
> ✓ Output is valid JSON with expected schema
> Building dependency graph...
> Parallel execution possible: TASK-001, TASK-002 (no dependencies)
> Next: Execute TASK-001 (design) with DESIGNER

================================================================================
PHASE 2: DESIGN
================================================================================

ORCHESTRATOR → DESIGNER:
┌─────────────────────────────────────────────────────────────────────────────┐
│ SYSTEM: You are a UI designer. Create mockups.                             │
│                                                                             │
│ TASK: TASK-001 - Design UI mockup for Todo App                              │
│                                                                             │
│ ACCEPTANCE CRITERIA:                                                        │
│ - Shows add form                                                            │
│ - Shows todo list                                                           │
│ - Shows filter controls                                                     │
│ - Shows checkboxes                                                          │
│                                                                             │
│ OUTPUT FORMAT: JSON with files_created, design_decisions, needs_approval    │
└─────────────────────────────────────────────────────────────────────────────┘

DESIGNER → ORCHESTRATOR (Structured JSON):
{
  "status": "completed",
  "files_created": ["mockups/todo-app-v1.html"],
  "design_decisions": [
    "Centered card layout for focus",
    "Input at top with Add button",
    "Checkbox + text + delete for each item"
  ],
  "needs_approval": true
}

--------------------------------------------------------------------------------
ORCHESTRATOR THINKING:
--------------------------------------------------------------------------------
> DESIGNER completed TASK-001
> ✓ Output parsed successfully
> needs_approval: true → Pause workflow, request human approval

ORCHESTRATOR → USER:
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⏸️  APPROVAL REQUIRED                                                       │
│                                                                             │
│ Task: TASK-001 - Design UI mockup                                           │
│ Preview: mockups/todo-app-v1.html                                           │
│                                                                             │
│ [APPROVE]  [REQUEST CHANGES]  [REJECT]                                      │
└─────────────────────────────────────────────────────────────────────────────┘

USER: "APPROVE"

... [Build phases continue with structured I/O] ...

================================================================================
PHASE 5: TESTING (Demonstrating Feedback Loop)
================================================================================

TESTER → ORCHESTRATOR (Structured JSON):
{
  "status": "completed_with_failures",
  "results": {
    "passed": 7,
    "failed": 1,
    "failures": [
      {
        "test": "test_filter_completed_todos",
        "error": "AssertionError: Expected 1 todo, got 3",
        "file": "routes/todos.py",
        "line": 24,
        "suggestion": "Filter query not applying done=True condition"
      }
    ]
  }
}

--------------------------------------------------------------------------------
ORCHESTRATOR THINKING:
--------------------------------------------------------------------------------
> TESTER found 1 failure
> ✓ Parsed failure details from structured output
> Decision: Create fix task and route to BUG_FIXER
> Context to include: exact error, file, line, suggestion

ORCHESTRATOR → BUG_FIXER:
┌─────────────────────────────────────────────────────────────────────────────┐
│ TASK: FIX-001 - Fix filter query in todos API                               │
│                                                                             │
│ BUG REPORT (from TESTER):                                                   │
│ - Test: test_filter_completed_todos                                         │
│ - Error: Expected 1 todo, got 3                                             │
│ - File: routes/todos.py, line 24                                            │
│ - Suggestion: Filter query not applying done=True condition                 │
│                                                                             │
│ OUTPUT FORMAT: JSON with status, files_modified, fix_description            │
└─────────────────────────────────────────────────────────────────────────────┘

BUG_FIXER → ORCHESTRATOR:
{
  "status": "fixed",
  "files_modified": ["routes/todos.py"],
  "fix_description": "Added .filter(Todo.done == True) for completed filter"
}

--------------------------------------------------------------------------------
ORCHESTRATOR THINKING:
--------------------------------------------------------------------------------
> Bug fixed by BUG_FIXER
> Decision: Re-run ONLY the failed test (not full suite)
> Route back to TESTER with scoped context

ORCHESTRATOR → TESTER:
┌─────────────────────────────────────────────────────────────────────────────┐
│ RUN SPECIFIC TEST: test_filter_completed_todos                               │
│ FILE: tests/test_todos_api.py                                               │
│                                                                             │
│ REASON: Verifying fix for FIX-001                                           │
└─────────────────────────────────────────────────────────────────────────────┘

TESTER → ORCHESTRATOR:
{
  "status": "passed",
  "results": { "passed": 8, "failed": 0 }
}

--------------------------------------------------------------------------------
ORCHESTRATOR THINKING:
--------------------------------------------------------------------------------
> All tests passing ✓
> Feedback loop complete
> Decision: Proceed to REVIEWER
```

### Key Orchestration Patterns (MUST IMPLEMENT)

```yaml
orchestration_patterns:
  
  1_structured_context_passing:
    description: "Each agent receives curated, structured context"
    implementation:
      - Agent receives only what they need (not entire project history)
      - Context tailored to agent type
      - Previous agent outputs summarized relevantly
      - Architecture context included
      - Acceptance criteria clearly stated
    example:
      frontend_developer_context:
        task: "Build TodoForm component"
        design_reference: "mockups/todo-app-v1.html"
        api_spec: { endpoints: ["POST /api/todos"] }
        architecture: { component_dir: "src/components/", state: "Zustand" }
        acceptance_criteria: ["Input field", "Add button", "Clears on submit"]
        
  2_structured_output_format:
    description: "Every agent returns parseable JSON"
    implementation:
      - Define schema per agent type
      - Orchestrator validates output against schema
      - Parse output to make routing decisions
      - Store structured data for downstream agents
    schemas:
      planner: { tasks: [], dependencies: {} }
      builder: { status, files_created, files_modified }
      tester: { passed: int, failed: int, failures: [] }
      reviewer: { approved: bool, issues: [], lessons: [] }
      
  3_intelligent_routing:
    description: "Orchestrator uses AI to decide next action"
    implementation:
      - Parse agent output
      - Evaluate: success/failure/needs_approval/needs_info
      - Route based on result, not just stage
      - Consider context and history
    decision_tree:
      tester_result:
        if_all_pass: "route to reviewer"
        if_failures: "create fix task, route to bug_fixer"
        if_needs_info: "route to analyst or ask user"
      reviewer_result:
        if_approved: "complete task"
        if_issues: "route back to relevant builder"
        if_architectural: "escalate to architect"
        
  4_feedback_loops:
    description: "Automatic retry/fix cycles"
    implementation:
      - BUILDER → TESTER → [fail] → BUG_FIXER → TESTER (retry)
      - Maximum retry count (e.g., 3) to prevent infinite loops
      - Escalate to user if max retries exceeded
      - Re-run only failed tests, not full suite
    config:
      max_fix_attempts: 3
      retest_scope: "failed_only"  # not "full_suite"
      escalate_after: 3
      
  5_orchestrator_thinking:
    description: "Orchestrator is an AI agent that reasons"
    implementation:
      - Use Claude for routing decisions
      - Analyze: "Given X result, what should I do?"
      - Synthesize information across agents
      - Recognize when stuck and escalate
    thinking_prompts:
      on_failure: "Tests failed with {error}. Options: (a) fix attempt, 
                   (b) spawn diagnostics, (c) ask user. Recommend?"
      on_ambiguity: "Task requirements unclear. Options: (a) spawn analyst 
                     for research, (b) ask user, (c) make assumption?"
      on_completion: "All tasks done. Verify: requirements met? Tests pass?
                      Any concerns before notifying user?"
```

### Core Agent Architecture

**Orchestrator Agent** — The central coordinator that spawns, monitors, and manages all sub-agents. Maintains system state, handles escalations, and ensures work flows correctly through the pipeline. **All orchestrator actions are audit-logged for compliance.**

**Sub-Agents:**

1. **Project Manager** — Breaks work into epics → features → tasks. Determines which agents are needed for each task, identifies user flows requiring designs, sequences work appropriately. Creates a detailed plan of work required to complete each task. If the Project Manager lacks sufficient information to create a comprehensive plan, it must request analysis from the Orchestrator — the Orchestrator gets analysis from the Analyst agent and then passes back to Project Manager. The plan should include dependencies, estimated complexity, required agents, and acceptance criteria. The Project Manager works within the constraints defined by the Architect. **Must flag tasks with compliance implications.**

2. **Architect** — Owns all technical architecture decisions. Defines tech stack, system structure, patterns, integrations, and technical constraints. Produces and maintains architecture.md and Architecture Decision Records (ADRs). May request analysis from Orchestrator when evaluating options. **Must consider security architecture, data flow compliance, and privacy-by-design principles.** Is consulted whenever:
   - A new project is initialized (defines foundational architecture)
   - New features require architectural decisions
   - Scaling, performance, or security concerns arise
   - Integration with external systems is needed
   - Technical debt or refactoring is considered
   - Compliance requirements have technical implications
   - **Data flows that may affect GDPR/privacy compliance**

3. **Analyst** — Searches the web for best practices, technical approaches, competitive analysis, and informs decisions with research. Can be called by Orchestrator when any agent (Project Manager, Architect, etc.) needs more information.

4. **UI Designer** — Creates mockup designs for approval. Once approved, generates all user flow designs (mobile/desktop/webapp or combinations). Designs feed into task specifications for builders. **Must consider accessibility compliance (WCAG) and privacy UX patterns (cookie consent, data collection disclosure).**

5. **Git Agent** — Manages git workflow: creates integration branches from main, spins up feature branches for worktrees, handles merges, detects and reports conflicts. **Also manages the separation between project repos and orchestrator overlay, ensures secrets are never committed. All git operations are audit-logged.**

6. **Frontend Developer** — Builds UI components using TDD, follows strict engineering standards, clean code principles, no hardcoding, single source of truth for constants. Works within architectural constraints. **Must implement security headers, XSS prevention, CSRF protection, and proper input validation.**

7. **Backend Developer** — Builds APIs, services, database layers using TDD, same engineering standards as frontend. Works within architectural constraints. **Must implement authentication, authorization, encryption, parameterized queries, rate limiting, and audit logging.**

8. **Tester** — Runs test suites, reports failures to orchestrator, builds E2E tests once features complete without bugs. **Must include security tests (OWASP Top 10), penetration testing scenarios, and compliance validation tests.**

9. **Bug Fixer** — Spawned by orchestrator when bugs are identified, focuses on targeted fixes. **Security vulnerabilities are prioritized as critical.**

10. **Merge Conflict Resolver** — Spawned when git agent reports conflicts, plans and executes resolution.

11. **Reviewer Agent** — Assesses every agent's work against architecture, compliance, and standards. Identifies potential lessons learned from each review. Scores lessons for importance before committing to the knowledge base — only high-value lessons that will meaningfully improve future agent performance are stored. This prevents lesson bloat and keeps the self-improvement system high-signal. **Also checks for accidental secret exposure in code, security vulnerabilities, and compliance violations.**

12. **Project Analyzer** — Spawned when importing existing repositories. Analyzes codebase structure, identifies tech stack, maps architecture, detects patterns, and generates initial orchestrator configuration without modifying the source repo. **Performs security audit of imported code, identifies potential vulnerabilities and compliance gaps.**

13. **Compliance Agent** — **Dedicated agent for security and compliance at BOTH platform and project levels.** 
    
    **Platform Compliance (Always Active):**
    - Monitors orchestrator system for SOC 2/GDPR compliance
    - Ensures audit logs are complete
    - Validates platform encryption and access controls
    - Tracks platform compliance status for audits
    - Generates platform compliance reports
    
    **Project Compliance (When Configured):**
    - Reads project's compliance requirements from config
    - Advises other agents on project-specific compliance needs
    - Reviews generated code against project compliance frameworks
    - Generates project compliance reports
    - Detects compliance gaps in imported projects

---

## Agent Output Schemas (Critical for V2)

**V1 Failure:** Agents returned freeform text, orchestrator couldn't parse for routing decisions.

**V2 Requirement:** Every agent MUST return structured JSON matching these schemas. The orchestrator parses output to make intelligent routing decisions.

### Universal Response Wrapper

```typescript
// Every agent response wrapped in this structure
interface AgentResponse<T> {
  status: "success" | "completed" | "completed_with_issues" | "failed" | "blocked" | "needs_approval" | "needs_info";
  agent_type: string;
  task_id: string;
  timestamp: string;
  
  // Agent-specific payload
  data: T;
  
  // For orchestrator routing decisions
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
  
  // For audit and compliance
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
  
  // For learning system
  observations?: {
    potential_lessons: string[];
    issues_encountered: string[];
    suggestions: string[];
  };
}
```

### Agent-Specific Schemas

```yaml
agent_output_schemas:

  project_manager:
    data_schema:
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

  architect:
    data_schema:
      architecture:
        tech_stack: object
        structure: object
        security_architecture: object
      adrs_created: string[]
      constraints: string[]

  tester:
    data_schema:
      test_run:
        total_tests: number
        passed: number
        failed: number
        failures:
          - test_name: string
            error_message: string
            source_file: string
            source_line: number
            suggested_fix?: string

  reviewer:
    data_schema:
      review:
        approved: boolean
        blocking_issues: array
        suggestions: array
        compliance_check: { passed: boolean, violations: string[] }
        security_check: { passed: boolean, vulnerabilities: string[] }
        lessons_learned: array
```

### Orchestrator Routing Logic

```python
def process_agent_response(response: AgentResponse) -> RoutingDecision:
    """
    V2: Parse structured output and decide intelligently.
    V1 just advanced to next stage regardless of output.
    """
    
    # Check routing hints first
    if response.routing_hints.needs_user_approval:
        return RoutingDecision(action="request_approval", block=True)
    
    if response.routing_hints.has_failures:
        return handle_failures(response)
    
    # Agent-specific routing
    if response.agent_type == "tester" and response.data.test_run.failed > 0:
        return RoutingDecision(
            action="fix_loop",
            fix_tasks=create_fix_tasks(response.data.test_run.failures),
            max_attempts=3
        )
    
    return RoutingDecision(action="continue")
```

---

### Engineering Standards to Enforce

**Platform-Level Standards (Our System):**
- Test-Driven Development throughout
- High-level architecture awareness in all agents
- No hardcoded values — single source of truth for constants
- Clean code principles
- Consistent patterns across all builders
- All development follows Architect's decisions and ADRs
- **NEVER commit secrets, API keys, or credentials to git**
- **Keep orchestrator files separate from project source code when integrating existing repos**
- **All platform data access must be audit-logged**
- **Platform encryption at rest and in transit is mandatory**

**Project-Level Standards (User Projects):**
- Projects have their OWN compliance requirements (gathered during initialization)
- Project compliance is OPTIONAL and user-defined
- Agents apply project-specific compliance only when configured
- A hobby project needs no compliance; an enterprise healthcare app needs HIPAA

---

## Two-Tier Compliance Architecture

**Critical Distinction:** There are TWO separate compliance contexts in this system:

### Tier 1: Platform Compliance (Mandatory)

This is OUR compliance as a SaaS platform. We MUST be compliant regardless of what projects users create.

```yaml
platform_compliance:
  description: "AgentFlow platform's own compliance obligations"
  applies_to: "The orchestrator system itself"
  mandatory: true
  
  requirements:
    gdpr:
      - "User data protection"
      - "Right to deletion"
      - "Data portability"
      - "DPA with sub-processors (Anthropic, hosting)"
      - "72-hour breach notification"
      
    soc2:
      - "Access control (MFA, RBAC)"
      - "Audit logging of all platform actions"
      - "Encryption at rest and in transit"
      - "Incident response procedures"
      - "Change management"
      
    security:
      - "Multi-tenant isolation"
      - "Secret management"
      - "Vulnerability scanning"
      - "Penetration testing"
      
  enforced_by:
    - "Platform code (hardcoded, not configurable)"
    - "Compliance Agent monitoring platform health"
    - "Automated compliance checks"
    - "Audit logging hooks"
    
  examples:
    - "Every agent spawn is audit-logged (platform requirement)"
    - "User data encrypted at rest (platform requirement)"
    - "Secrets never in logs (platform requirement)"
    - "MFA for platform access (platform requirement)"
```

### Tier 2: Project Compliance (User-Defined)

Each PROJECT created within the platform has its OWN compliance requirements. These are gathered during project initialization or analysis.

```yaml
project_compliance:
  description: "Compliance requirements for individual user projects"
  applies_to: "Code and systems generated for user projects"
  mandatory: false
  user_defined: true
  
  gathered_during:
    - "Project initialization wizard"
    - "Project analysis (for imported repos)"
    - "User can update anytime"
    
  possible_frameworks:
    - "None (hobby project, prototype)"
    - "GDPR (EU user data)"
    - "HIPAA (US healthcare)"
    - "PCI-DSS (payment processing)"
    - "SOC 2 (enterprise SaaS)"
    - "CCPA (California privacy)"
    - "COPPA (children's data)"
    - "Custom (user-defined rules)"
    
  how_it_works:
    - "User selects applicable frameworks during init"
    - "Compliance requirements stored in project config"
    - "Agents receive project compliance context"
    - "Generated code includes appropriate controls"
    - "Reviewer checks against project requirements"
    
  examples:
    hobby_project:
      frameworks: []
      result: "No compliance overhead, fast development"
      
    startup_saas:
      frameworks: ["GDPR"]
      result: "Agents add consent management, data export, deletion"
      
    healthcare_app:
      frameworks: ["HIPAA", "GDPR"]
      result: "Agents add audit logging, encryption, access controls, BAA considerations"
      
    fintech_app:
      frameworks: ["PCI-DSS", "SOC2", "GDPR"]
      result: "Strict data handling, card data isolation, comprehensive audit trail"
```

### How Agents Handle Two-Tier Compliance

```yaml
agent_compliance_behavior:
  
  platform_compliance:
    # ALWAYS enforced, agents cannot disable
    always_do:
      - "Audit log all file operations"
      - "Never log secrets"
      - "Respect tenant isolation"
      - "Use platform secrets management"
    enforced_by: "Platform guardrails (not agent prompts)"
    
  project_compliance:
    # Only enforced when project has requirements
    conditionally_do:
      - "Add GDPR consent flows (if GDPR enabled)"
      - "Add HIPAA audit logging (if HIPAA enabled)"
      - "Add PCI card data handling (if PCI-DSS enabled)"
    source: "project.compliance_requirements"
    
  agent_context_injection:
    # Agents receive project compliance in their context
    example:
      system_prompt_addition: |
        PROJECT COMPLIANCE REQUIREMENTS:
        - GDPR: Yes
          - Must implement: consent management, data export, deletion
          - User data must be encryptable
          - Audit trail for data access
        - HIPAA: No
        - PCI-DSS: No
        
        Apply these requirements to all code you generate for this project.
```

### Project Compliance Configuration

```yaml
# projects/{id}/compliance/project_compliance.yaml

project_compliance:
  # Gathered during initialization or updated by user
  frameworks:
    gdpr:
      enabled: true
      requirements:
        - consent_management
        - data_export
        - data_deletion
        - breach_notification
      data_residency: "EU"
      
    hipaa:
      enabled: false
      
    pci_dss:
      enabled: false
      
    soc2:
      enabled: false
      
    custom:
      enabled: true
      rules:
        - "All API endpoints must have rate limiting"
        - "User passwords must be Argon2id hashed"
        
  # Compliance checks for this project
  automated_checks:
    - check: "gdpr_consent_present"
      on: "user_data_collection"
    - check: "encryption_at_rest"
      on: "database_schema"
      
  # What Reviewer checks for this project
  review_requirements:
    - "GDPR consent flows implemented"
    - "Data export endpoint exists"
    - "User deletion cascade works"
```

### Project Initialization: Compliance Gathering

```
=== PROJECT INITIALIZATION: COMPLIANCE STEP ===

ORCHESTRATOR → USER:
┌─────────────────────────────────────────────────────────────────────────────┐
│ COMPLIANCE REQUIREMENTS                                                      │
│                                                                              │
│ What compliance frameworks apply to your project?                            │
│ (Select all that apply, or none for hobby/prototype projects)               │
│                                                                              │
│ DATA PRIVACY                                                                 │
│ ☐ GDPR (EU General Data Protection Regulation)                              │
│   → Required if: Processing EU resident personal data                        │
│                                                                              │
│ ☐ CCPA (California Consumer Privacy Act)                                    │
│   → Required if: California users, >$25M revenue or >50K users              │
│                                                                              │
│ ☐ COPPA (Children's Online Privacy Protection)                              │
│   → Required if: Collecting data from children under 13                      │
│                                                                              │
│ INDUSTRY-SPECIFIC                                                            │
│ ☐ HIPAA (Health Insurance Portability and Accountability)                   │
│   → Required if: US healthcare data                                          │
│                                                                              │
│ ☐ PCI-DSS (Payment Card Industry Data Security Standard)                    │
│   → Required if: Processing credit card payments                             │
│                                                                              │
│ ENTERPRISE                                                                   │
│ ☐ SOC 2 (for your project, not the platform)                                │
│   → Required if: Enterprise customers will require it                        │
│                                                                              │
│ ☐ None - This is a hobby project / prototype                                │
│                                                                              │
│ ☐ Custom requirements (specify below)                                        │
│   [________________________________________________]                        │
│                                                                              │
│                                                    [Back] [Continue]         │
└─────────────────────────────────────────────────────────────────────────────┘

USER: Selects "GDPR" only

ORCHESTRATOR stores in project config:
{
  "compliance": {
    "frameworks": ["GDPR"],
    "gathered_at": "2025-01-15T10:00:00Z",
    "gathered_method": "initialization_wizard"
  }
}

→ All agents for this project now receive GDPR requirements in context
→ Generated code includes GDPR controls
→ Reviewer checks for GDPR compliance
```

### Project Analysis: Compliance Detection

When importing an existing repo, analyze for compliance indicators:

```
=== PROJECT IMPORT: COMPLIANCE ANALYSIS ===

PROJECT ANALYZER examines:
  - Existing privacy policy
  - Cookie consent implementations
  - Data handling patterns
  - Industry indicators (healthcare terms, payment processing)
  - Existing compliance documentation

PROJECT ANALYZER → ORCHESTRATOR:
{
  "compliance_indicators": {
    "detected_frameworks": ["GDPR"],
    "evidence": [
      "Cookie consent banner in index.html",
      "GDPR-style privacy policy at /privacy",
      "Data export endpoint at /api/user/export"
    ],
    "missing_for_gdpr": [
      "No data deletion endpoint found",
      "No consent tracking in database schema"
    ],
    "recommendations": [
      "Confirm GDPR compliance is required",
      "Add data deletion functionality",
      "Implement consent tracking"
    ]
  }
}

ORCHESTRATOR → USER:
"I detected GDPR compliance patterns in your codebase. Should I:
 1. Enable GDPR compliance requirements (recommended)
 2. Skip compliance (this is a prototype)
 3. Configure different compliance requirements"
```

---

## Security & Compliance Framework

**Critical Context:** This section describes TWO separate compliance contexts:

1. **Platform Compliance** — OUR compliance as a SaaS product (SOC 2, GDPR). This is MANDATORY and applies to the orchestrator system itself. We must be compliant regardless of what projects users create.

2. **Project Compliance** — Compliance for USER PROJECTS. This is OPTIONAL and user-defined. A hobby project needs nothing; an enterprise healthcare app needs HIPAA. This is covered in the "Two-Tier Compliance Architecture" section above.

The compliance maturity model and controls below apply to **PLATFORM COMPLIANCE ONLY**.

### Environment-Aware Compliance

**Problem:** Full compliance enforcement during development is painful and unnecessary. We don't need MFA, audit log integrity verification, and penetration testing while building locally.

**Solution:** Compliance requirements vary by environment. Track "compliance debt" so nothing is forgotten before launch.

```yaml
# system/compliance/environment_compliance.yaml

environments:
  local:
    description: "Developer's local machine"
    detection:
      - "NODE_ENV=development"
      - "AGENTFLOW_ENV=local"
      - "No PRODUCTION_SECRET present"
      - "Database is SQLite or local Postgres"
    compliance_level: "minimal"
    
  development:
    description: "Shared dev server / CI"
    detection:
      - "AGENTFLOW_ENV=development"
      - "Running in CI pipeline"
      - "Non-production domain"
    compliance_level: "basic"
    
  staging:
    description: "Pre-production testing"
    detection:
      - "AGENTFLOW_ENV=staging"
      - "Staging domain pattern"
    compliance_level: "full_minus_external"
    
  production:
    description: "Live system with real users"
    detection:
      - "AGENTFLOW_ENV=production"
      - "Production domain"
      - "PRODUCTION_SECRET present"
    compliance_level: "full"


compliance_by_environment:
  
  # ═══════════════════════════════════════════════════════════════════
  # LOCAL DEVELOPMENT - Minimal friction, maximum speed
  # ═══════════════════════════════════════════════════════════════════
  local:
    enabled:
      - "Basic auth (username/password, no MFA required)"
      - "Console logging (no structured audit logs)"
      - "Local secrets in .env file (gitignored)"
      - "HTTP allowed (no HTTPS required)"
      - "No rate limiting"
      - "Basic input validation (prevent crashes)"
      - "Secret scanning on git commit (ALWAYS - prevents accidents)"
    
    disabled:
      - "MFA enforcement"
      - "Audit log integrity verification"
      - "Encryption at rest (local DB)"
      - "HTTPS enforcement"
      - "Rate limiting"
      - "Session timeout"
      - "IP allowlisting"
      - "Penetration testing"
      - "SOC 2 evidence collection"
      - "Compliance reporting"
    
    warnings_only:
      # These show warnings but don't block
      - "Missing security headers → Warning in console"
      - "Unencrypted data → Warning in console"
      - "Missing audit log → Warning in console"
    
  # ═══════════════════════════════════════════════════════════════════
  # DEVELOPMENT (Shared/CI) - Some controls, still flexible
  # ═══════════════════════════════════════════════════════════════════
  development:
    enabled:
      - "Basic auth with MFA optional"
      - "Structured logging (but not tamper-proof)"
      - "Secrets from environment variables"
      - "HTTPS (self-signed OK)"
      - "Basic rate limiting"
      - "Input validation"
      - "Secret scanning (blocks commits)"
      - "Dependency vulnerability scanning"
      - "Basic RBAC"
    
    disabled:
      - "MFA enforcement"
      - "Audit log integrity (append-only, signed)"
      - "Production secrets management"
      - "Penetration testing"
      - "SOC 2 evidence collection"
      - "Incident response automation"
    
    warnings_only:
      - "Missing encryption at rest → Warning"
      - "Session management gaps → Warning"
      
  # ═══════════════════════════════════════════════════════════════════
  # STAGING - Production-like, but no external audits
  # ═══════════════════════════════════════════════════════════════════
  staging:
    enabled:
      - "MFA required"
      - "Full RBAC"
      - "Structured audit logging"
      - "Encryption at rest and transit"
      - "Secrets management (HashiCorp Vault or similar)"
      - "Full rate limiting"
      - "Security headers"
      - "Session management"
      - "Input validation (strict)"
      - "Secret scanning"
      - "Dependency scanning"
      - "SAST (Static Application Security Testing)"
    
    disabled:
      - "Audit log integrity verification (expensive)"
      - "SOC 2 evidence collection"
      - "External penetration testing"
      - "Breach notification workflows"
      - "Third-party security assessments"
    
    test_mode:
      # Run these in test mode (no real notifications)
      - "Incident response (test notifications)"
      - "Breach detection (logged, not alerted)"
      
  # ═══════════════════════════════════════════════════════════════════
  # PRODUCTION - Full compliance, no exceptions
  # ═══════════════════════════════════════════════════════════════════
  production:
    enabled: "ALL CONTROLS"
    
    mandatory:
      - "MFA for all users"
      - "RBAC strictly enforced"
      - "Tamper-proof audit logging"
      - "Encryption at rest (AES-256)"
      - "Encryption in transit (TLS 1.2+)"
      - "Secrets in vault (no env vars)"
      - "Rate limiting on all endpoints"
      - "Security headers (CSP, HSTS, etc.)"
      - "Session timeout (30 min inactive)"
      - "Secret scanning (blocks deployment)"
      - "Dependency scanning (blocks on critical)"
      - "Incident response automation"
      - "Breach notification workflows"
      - "SOC 2 evidence collection"
      - "Compliance reporting"
      - "Access reviews (quarterly)"
      - "Penetration testing (annual)"
```

### Compliance Debt Tracking

Track what's not yet implemented so nothing is forgotten before launch:

```yaml
# system/compliance/compliance_debt.yaml

compliance_debt:
  description: "Controls not yet implemented - MUST be done before production"
  
  tracked_items:
    - id: "DEBT-001"
      control: "Tamper-proof audit logging"
      required_for: "production"
      current_state: "Basic logging only"
      effort_estimate: "2 weeks"
      blocking_launch: true
      
    - id: "DEBT-002"
      control: "MFA enforcement"
      required_for: "production"
      current_state: "Optional MFA"
      effort_estimate: "1 week"
      blocking_launch: true
      
    - id: "DEBT-003"
      control: "SOC 2 evidence collection"
      required_for: "production"
      current_state: "Not started"
      effort_estimate: "4 weeks"
      blocking_launch: true
      
    - id: "DEBT-004"
      control: "Penetration testing"
      required_for: "production"
      current_state: "Not scheduled"
      effort_estimate: "External vendor, 2-4 weeks"
      blocking_launch: true
      
    - id: "DEBT-005"
      control: "DPA with Anthropic"
      required_for: "production"
      current_state: "Need to request"
      effort_estimate: "Legal review, 2-4 weeks"
      blocking_launch: true
      
  summary:
    total_items: 5
    blocking_launch: 5
    estimated_total_effort: "11-13 weeks"
    
  # Auto-generated checklist for launch
  pre_launch_checklist:
    - "☐ DEBT-001: Implement tamper-proof audit logging"
    - "☐ DEBT-002: Enforce MFA for all accounts"
    - "☐ DEBT-003: Set up SOC 2 evidence collection"
    - "☐ DEBT-004: Complete penetration test"
    - "☐ DEBT-005: Execute DPA with Anthropic"
```

### Environment Detection Implementation

```python
# How the system detects current environment

class ComplianceEnvironment:
    """Detect environment and return appropriate compliance level."""
    
    @staticmethod
    def detect() -> str:
        """
        Detection priority:
        1. Explicit AGENTFLOW_ENV variable (most reliable)
        2. PRODUCTION_SECRET presence (production indicator)
        3. Domain patterns
        4. Default to 'local' (safest for development)
        """
        
        # Explicit environment variable
        env = os.getenv('AGENTFLOW_ENV')
        if env in ['local', 'development', 'staging', 'production']:
            return env
        
        # Production indicators
        if os.getenv('PRODUCTION_SECRET'):
            return 'production'
        
        # Domain-based detection
        domain = os.getenv('DOMAIN', '')
        if 'staging.' in domain:
            return 'staging'
        if domain and not any(x in domain for x in ['localhost', '.local', '.dev']):
            return 'production'  # Assume production for unknown domains
        
        # CI detection
        if os.getenv('CI') or os.getenv('GITHUB_ACTIONS'):
            return 'development'
        
        # Default to local (safest)
        return 'local'
    
    @staticmethod
    def get_compliance_config(environment: str) -> ComplianceConfig:
        """Load compliance requirements for environment."""
        return load_yaml(f'system/compliance/environment_compliance.yaml')[environment]
    
    @staticmethod
    def is_control_enabled(control: str, environment: str = None) -> bool:
        """Check if a specific control is enabled in current environment."""
        env = environment or ComplianceEnvironment.detect()
        config = ComplianceEnvironment.get_compliance_config(env)
        return control in config.get('enabled', [])
    
    @staticmethod
    def check_compliance_debt() -> list:
        """Return list of compliance items blocking production launch."""
        debt = load_yaml('system/compliance/compliance_debt.yaml')
        return [item for item in debt['tracked_items'] if item['blocking_launch']]


# Usage in code
class AuditLogger:
    def log(self, event: dict):
        env = ComplianceEnvironment.detect()
        
        if env == 'local':
            # Just print to console
            print(f"[AUDIT] {event}")
        elif env == 'development':
            # Structured log, no integrity
            self.structured_log(event)
        elif env in ['staging', 'production']:
            # Full audit with integrity
            self.tamper_proof_log(event)
            
        # In local/dev, warn about missing production controls
        if env in ['local', 'development']:
            if not self.has_integrity_verification():
                logger.warning("COMPLIANCE: Audit log integrity not enabled (OK for dev)")
```

### Compliance Gates by Environment

```yaml
# When compliance checks block vs warn vs skip

compliance_gates:

  secret_detected:
    local: "BLOCK"        # Always block - prevents accidents
    development: "BLOCK"  # Always block
    staging: "BLOCK"      # Always block
    production: "BLOCK"   # Always block
    # Secret scanning is ALWAYS enforced - no exceptions
    
  missing_audit_log:
    local: "SKIP"         # Don't even check
    development: "WARN"   # Warning in logs
    staging: "WARN"       # Warning, flag for review
    production: "BLOCK"   # Cannot deploy
    
  missing_mfa:
    local: "SKIP"
    development: "SKIP"
    staging: "WARN"
    production: "BLOCK"
    
  unencrypted_pii:
    local: "WARN"         # Remind developer
    development: "WARN"
    staging: "BLOCK"
    production: "BLOCK"
    
  missing_rate_limit:
    local: "SKIP"
    development: "WARN"
    staging: "WARN"
    production: "BLOCK"
    
  dependency_vulnerability:
    critical:
      local: "WARN"
      development: "WARN"
      staging: "BLOCK"
      production: "BLOCK"
    high:
      local: "SKIP"
      development: "WARN"
      staging: "WARN"
      production: "BLOCK"
    medium:
      local: "SKIP"
      development: "SKIP"
      staging: "WARN"
      production: "WARN"
      
  failed_security_test:
    local: "WARN"
    development: "WARN"
    staging: "BLOCK"
    production: "BLOCK"
```

### Launch Readiness Check

```
=== PRE-LAUNCH COMPLIANCE CHECK ===

Running compliance readiness for: PRODUCTION

BLOCKING ISSUES (must fix before launch):
  ❌ DEBT-001: Tamper-proof audit logging not implemented
  ❌ DEBT-002: MFA not enforced (3 users without MFA)
  ❌ DEBT-005: DPA with Anthropic not signed

WARNINGS (should fix, not blocking):
  ⚠️  Access review not completed this quarter
  ⚠️  2 medium-severity dependency vulnerabilities

PASSING:
  ✅ Encryption at rest enabled
  ✅ Encryption in transit (TLS 1.3)
  ✅ Secret scanning active
  ✅ Rate limiting configured
  ✅ Security headers present
  ✅ RBAC configured
  ✅ Incident response plan documented

LAUNCH READY: ❌ NO
BLOCKING ITEMS: 3
ESTIMATED EFFORT TO RESOLVE: 4-6 weeks

Recommendation: Address DEBT-001, DEBT-002, DEBT-005 before launch.
```

### Platform Compliance Maturity Model

```
┌─────────────────────────────────────────────────────────────────┐
│              PLATFORM COMPLIANCE MATURITY LEVELS                 │
│                  (AgentFlow as a SaaS Product)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  LEVEL 1: FOUNDATION (MVP/Beta - <£10K ARR)                     │
│  ├── Privacy Policy & Terms of Service                          │
│  ├── Basic security controls (HTTPS, auth, encryption)          │
│  ├── Cookie consent banner                                      │
│  ├── Secrets management (never in code)                         │
│  └── Basic audit logging                                        │
│                                                                  │
│  LEVEL 2: GROWTH (£10K-£100K ARR)                               │
│  ├── GDPR compliance (full)                                     │
│  ├── DPA template ready                                         │
│  ├── MFA required everywhere                                    │
│  ├── Role-based access control                                  │
│  ├── Incident response plan                                     │
│  ├── Vendor security assessments                                │
│  └── Penetration testing (annual)                               │
│                                                                  │
│  LEVEL 3: SCALE (£100K-£500K ARR)                               │
│  ├── SOC 2 Type I certification                                 │
│  ├── Formal security program                                    │
│  ├── Security policies documented                               │
│  ├── Change management process                                  │
│  ├── Quarterly access reviews                                   │
│  └── Vulnerability scanning (weekly)                            │
│                                                                  │
│  LEVEL 4: ENTERPRISE (£500K+ ARR)                               │
│  ├── SOC 2 Type II certification                                │
│  ├── ISO 27001 (optional but valuable)                          │
│  ├── HIPAA compliance (if healthcare)                           │
│  ├── Bug bounty program                                         │
│  └── Continuous compliance monitoring                           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Platform Compliance Controls Matrix

These controls apply to the **AgentFlow platform itself**, not to user projects.

```yaml
platform_compliance_controls:
  # ACCESS CONTROL
  access_control:
    controls:
      - id: "AC-001"
        name: "Unique User IDs"
        description: "Every user has a unique identifier"
        frameworks: ["SOC2", "GDPR", "ISO27001"]
        status: "required"
        implementation: "UUID per user account"
        
      - id: "AC-002"
        name: "Multi-Factor Authentication"
        description: "MFA required for all user accounts"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "TOTP (Google Authenticator compatible)"
        
      - id: "AC-003"
        name: "Role-Based Access Control"
        description: "Access based on roles, not individuals"
        frameworks: ["SOC2", "GDPR", "ISO27001"]
        status: "required"
        implementation: "RBAC with principle of least privilege"
        
      - id: "AC-004"
        name: "Access Reviews"
        description: "Quarterly review of all access rights"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Automated quarterly access review workflow"
        
      - id: "AC-005"
        name: "Privileged Access Management"
        description: "Enhanced controls for admin access"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Just-in-time access, session recording"
        
  # DATA PROTECTION
  data_protection:
    controls:
      - id: "DP-001"
        name: "Encryption at Rest"
        description: "All stored data encrypted"
        frameworks: ["SOC2", "GDPR", "ISO27001"]
        status: "required"
        implementation: "AES-256 encryption for databases and backups"
        
      - id: "DP-002"
        name: "Encryption in Transit"
        description: "All data encrypted during transmission"
        frameworks: ["SOC2", "GDPR", "ISO27001"]
        status: "required"
        implementation: "TLS 1.2+ for all connections"
        
      - id: "DP-003"
        name: "Data Minimization"
        description: "Only collect necessary data"
        frameworks: ["GDPR"]
        status: "required"
        implementation: "Regular data audit, justified collection"
        
      - id: "DP-004"
        name: "Data Retention"
        description: "Data deleted after retention period"
        frameworks: ["GDPR", "SOC2"]
        status: "required"
        implementation: "Automated retention policies, deletion workflows"
        
      - id: "DP-005"
        name: "Data Portability"
        description: "Users can export their data"
        frameworks: ["GDPR"]
        status: "required"
        implementation: "JSON/ZIP export feature"
        
  # AUDIT & MONITORING
  audit_monitoring:
    controls:
      - id: "AM-001"
        name: "Security Event Logging"
        description: "Log all security-relevant events"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Centralized logging with tamper protection"
        
      - id: "AM-002"
        name: "Log Retention"
        description: "Logs retained for audit period"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "1 year minimum retention"
        
      - id: "AM-003"
        name: "Anomaly Detection"
        description: "Automated alerting on suspicious activity"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Real-time alerting, pattern detection"
        
      - id: "AM-004"
        name: "Audit Trail Integrity"
        description: "Logs cannot be modified or deleted"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Write-once storage, cryptographic verification"
        
  # CHANGE MANAGEMENT
  change_management:
    controls:
      - id: "CM-001"
        name: "Version Control"
        description: "All code changes tracked"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Git with signed commits"
        
      - id: "CM-002"
        name: "Code Review"
        description: "All changes reviewed before deployment"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "PR reviews, automated checks"
        
      - id: "CM-003"
        name: "Testing Before Deploy"
        description: "Changes tested in staging"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "CI/CD with mandatory test pass"
        
      - id: "CM-004"
        name: "Rollback Procedures"
        description: "Ability to quickly revert changes"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Automated rollback, blue-green deployments"
        
  # INCIDENT RESPONSE
  incident_response:
    controls:
      - id: "IR-001"
        name: "Incident Classification"
        description: "Severity levels defined"
        frameworks: ["SOC2", "ISO27001", "GDPR"]
        status: "required"
        implementation: "Critical/High/Medium/Low with SLAs"
        
      - id: "IR-002"
        name: "Response Procedures"
        description: "Documented incident response"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Playbooks for each incident type"
        
      - id: "IR-003"
        name: "Breach Notification"
        description: "Notify authorities and users of breaches"
        frameworks: ["GDPR", "SOC2"]
        status: "required"
        implementation: "72-hour notification to ICO, user notification"
        
      - id: "IR-004"
        name: "Post-Incident Review"
        description: "Learn from incidents"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Blameless postmortems, action items tracked"
        
  # VENDOR MANAGEMENT
  vendor_management:
    controls:
      - id: "VM-001"
        name: "Vendor Assessment"
        description: "Security review of all vendors"
        frameworks: ["SOC2", "ISO27001"]
        status: "required"
        implementation: "Security questionnaire, compliance verification"
        
      - id: "VM-002"
        name: "DPA with Vendors"
        description: "Data processing agreements in place"
        frameworks: ["GDPR"]
        status: "required"
        implementation: "DPA signed with all sub-processors"
        
      - id: "VM-003"
        name: "Sub-Processor Register"
        description: "Track all data sub-processors"
        frameworks: ["GDPR"]
        status: "required"
        implementation: "Maintained register, disclosed in privacy policy"
```

### Agent Security Requirements

Each agent type has specific security responsibilities:

```yaml
agent_security_requirements:
  orchestrator:
    - "Audit log all agent spawns and decisions"
    - "Validate all inputs before processing"
    - "Enforce rate limits on agent spawning"
    - "Never include secrets in agent context"
    - "Mask sensitive data in activity streams"
    
  project_manager:
    - "Flag tasks with security implications"
    - "Ensure compliance tasks are included in plans"
    - "Track security-related dependencies"
    
  architect:
    - "Design with security-by-default"
    - "Document security architecture in ADRs"
    - "Review data flows for compliance"
    - "Ensure encryption architecture"
    - "Define security boundaries"
    
  frontend_developer:
    - "Implement XSS prevention (output encoding)"
    - "Implement CSRF protection"
    - "Add security headers"
    - "Validate all user inputs"
    - "Never store secrets in frontend"
    - "Implement Content Security Policy"
    - "Use HTTPS for all requests"
    
  backend_developer:
    - "Use parameterized queries (prevent SQL injection)"
    - "Implement authentication properly"
    - "Implement authorization (RBAC)"
    - "Encrypt sensitive data"
    - "Implement rate limiting"
    - "Add audit logging"
    - "Validate all inputs"
    - "Handle errors securely (no stack traces)"
    - "Use secure session management"
    
  tester:
    - "Include security test cases"
    - "Test OWASP Top 10 vulnerabilities"
    - "Test authentication/authorization"
    - "Test input validation"
    - "Test rate limiting"
    - "Verify encryption"
    
  reviewer:
    - "Check for hardcoded secrets"
    - "Verify security controls implemented"
    - "Check for common vulnerabilities"
    - "Verify audit logging"
    - "Check for proper error handling"
    
  git_agent:
    - "Scan for secrets before commit"
    - "Verify .gitignore includes sensitive files"
    - "Block commits with detected secrets"
    - "Sign commits for integrity"
    
  compliance_agent:
    - "Monitor all activities for compliance"
    - "Generate compliance reports"
    - "Track control implementation status"
    - "Validate data handling practices"
    - "Alert on compliance violations"
```

### Platform-Specific Security Concerns

```yaml
agentflow_security_concerns:
  # Code as sensitive data
  code_security:
    risks:
      - "Code leakage between customers"
      - "Code exposed to AI models"
      - "Code in backups"
      - "Code in logs"
      - "Malicious code execution"
    mitigations:
      - "Strict tenant isolation (separate environments)"
      - "Clear disclosure of AI processing, Anthropic DPA"
      - "Encrypted backups with retention limits"
      - "Sanitized logs, no code in error messages"
      - "Sandboxed execution, resource limits"
      
  # AI agent security
  ai_agent_security:
    risks:
      - "Agent accesses wrong project"
      - "Agent leaks data in responses"
      - "Prompt injection attacks"
      - "Agent runs dangerous commands"
      - "Agent costs spiral"
    mitigations:
      - "Auth tokens per project, strict RBAC"
      - "Output filtering, audit logging"
      - "Input sanitization, system prompt protection"
      - "Command allowlisting, sandboxing"
      - "Rate limits, spending caps per project"
      
  # Multi-tenant isolation
  multi_tenant:
    risks:
      - "Data leakage between tenants"
      - "Resource exhaustion by one tenant"
      - "Cross-tenant access"
    mitigations:
      - "Database per customer or strict RLS"
      - "CPU/memory/storage quotas"
      - "Separate VPCs/containers per customer"
      - "Credential isolation per project"
      - "Logs tagged and filtered by customer"
```

### Compliance Reporting System

```yaml
compliance_reporting:
  
  # PLATFORM REPORTS (Our SOC 2 / GDPR compliance)
  platform_reports:
    - type: "platform_compliance_dashboard"
      description: "AgentFlow platform compliance posture"
      contents:
        - "SOC 2 control status"
        - "Platform GDPR compliance"
        - "Audit readiness score"
        - "Open remediation items"
        
    - type: "platform_soc2_report"
      description: "SOC 2 evidence package for auditors"
      contents:
        - "Control implementation by criteria"
        - "Evidence collection status"
        - "Access review records"
        - "Change management logs"
        
    - type: "platform_security_report"
      description: "Platform security posture"
      contents:
        - "Vulnerability scan results"
        - "Penetration test findings"
        - "Security incidents"
        - "Multi-tenant isolation status"
        
  # PROJECT REPORTS (User's project compliance)
  project_reports:
    - type: "project_compliance_summary"
      description: "Compliance status for a specific user project"
      contents:
        - "Enabled frameworks (GDPR, HIPAA, etc.)"
        - "Compliance checks passed/failed"
        - "Code review compliance findings"
        - "Remediation recommendations"
        
    - type: "project_gdpr_report"
      description: "GDPR compliance for user's project (if enabled)"
      contents:
        - "Consent mechanisms implemented"
        - "Data export capability"
        - "Data deletion capability"
        - "Privacy by design checklist"
        
    - type: "project_hipaa_report"
      description: "HIPAA compliance for user's project (if enabled)"
      contents:
        - "PHI handling controls"
        - "Audit logging implementation"
        - "Access control implementation"
        - "Encryption status"
        
  # Common reports
  audit_reports:
  # Automated compliance checks
  automated_checks:
    - name: "Secret Detection"
      frequency: "every_commit"
      action: "block_on_fail"
      
    - name: "Dependency Vulnerabilities"
      frequency: "daily"
      action: "alert_and_ticket"
      
    - name: "Access Review Reminder"
      frequency: "quarterly"
      action: "notify_admins"
      
    - name: "Encryption Verification"
      frequency: "weekly"
      action: "alert_on_fail"
      
    - name: "Audit Log Integrity"
      frequency: "daily"
      action: "alert_on_fail"
      
    - name: "MFA Enforcement"
      frequency: "continuous"
      action: "block_non_compliant"
      
  # Compliance score calculation
  scoring:
    method: "weighted_control_coverage"
    weights:
      critical_controls: 3.0
      high_controls: 2.0
      medium_controls: 1.0
      low_controls: 0.5
    thresholds:
      excellent: 95
      good: 85
      acceptable: 70
      needs_work: 50
      critical: 0
```

### Compliance Agent Detailed Specification

```yaml
# system/agents/compliance_agent.yaml

name: "Compliance Agent"
description: |
  Dedicated agent for monitoring, enforcing, and reporting on security 
  and compliance at TWO levels:
  1. PLATFORM compliance (our SOC 2, GDPR obligations) - always active
  2. PROJECT compliance (user's GDPR, HIPAA, etc.) - when configured

responsibilities:
  # PLATFORM COMPLIANCE (Always Active)
  platform_monitoring:
    - "Monitor orchestrator for SOC 2 compliance"
    - "Ensure platform audit logs are complete"
    - "Verify platform encryption is applied"
    - "Watch for secret exposure in platform operations"
    - "Track multi-tenant isolation"
    
  platform_enforcement:
    - "Block operations that violate platform security"
    - "Enforce platform MFA requirements"
    - "Validate platform data handling"
    - "Ensure platform access controls"
    
  platform_reporting:
    - "Generate platform SOC 2 evidence packages"
    - "Generate platform GDPR compliance reports"
    - "Produce platform security dashboards"
    - "Track platform compliance metrics"
    
  # PROJECT COMPLIANCE (When Project Has Requirements)
  project_advisory:
    - "Read project's compliance requirements from config"
    - "Advise other agents on project-specific compliance"
    - "Review generated code against project frameworks"
    - "Identify compliance gaps in project plans"
    
  project_reporting:
    - "Generate project compliance summaries"
    - "Produce framework-specific reports (GDPR, HIPAA, etc.)"
    - "Track project compliance implementation"

tools:
  # Platform tools
  - platform_audit_log_query
  - platform_compliance_check
  - platform_report_generate
  - platform_control_status
  
  # Project tools
  - project_compliance_config_read
  - project_compliance_check
  - project_report_generate
  
  # Common tools
  - vulnerability_scan
  - secret_scan
  - encryption_verify

triggers:
  # Platform compliance (automatic)
  platform_automatic:
    - "On orchestrator startup"
    - "Weekly platform compliance check"
    - "Before platform deployment"
    - "On security incident detection"
    
  # Project compliance (when configured)
  project_automatic:
    - "Before project code deployment (if project has compliance)"
    - "On project compliance config change"
    - "When reviewing project code"
    
  on_request:
    - "User requests compliance report (platform or project)"
    - "Preparing for audit"
    - "Investigating incident"

outputs:
  platform_outputs:
    - platform_compliance_report.yaml
    - platform_soc2_evidence.zip
    - platform_security_findings.yaml
  project_outputs:
    - project_compliance_summary.yaml
    - project_framework_report.yaml  # GDPR, HIPAA, etc.
    - project_remediation_plan.md
  - compliance_score.json

guardrails:
  - "Never skip compliance checks in production"
  - "Always document compliance decisions"
  - "Escalate critical findings immediately"
  - "Maintain audit trail of own actions"
```

### Privacy by Design Integration

```yaml
privacy_by_design:
  principles:
    - name: "Proactive not Reactive"
      implementation:
        - "Compliance built into architecture from start"
        - "Security controls are default, not optional"
        - "Privacy impact assessments for new features"
        
    - name: "Privacy as Default"
      implementation:
        - "Minimal data collection by default"
        - "Opt-in for additional data processing"
        - "Secure settings out of the box"
        
    - name: "Privacy Embedded into Design"
      implementation:
        - "Privacy requirements in every user story"
        - "Architect reviews data flows"
        - "Compliance Agent reviews all designs"
        
    - name: "Full Functionality"
      implementation:
        - "Privacy and security don't reduce features"
        - "Creative solutions that achieve both"
        
    - name: "End-to-End Security"
      implementation:
        - "Data protected throughout lifecycle"
        - "Secure deletion when no longer needed"
        - "Encryption at every stage"
        
    - name: "Visibility and Transparency"
      implementation:
        - "Clear privacy policy"
        - "Users know what data is collected"
        - "Audit logs for accountability"
        
    - name: "Respect for User Privacy"
      implementation:
        - "User-centric defaults"
        - "Easy data export and deletion"
        - "Consent management"

  project_integration:
    # Every project must consider:
    initialization:
      - "Identify personal data to be processed"
      - "Define lawful basis for processing"
      - "Document data flows"
      - "Plan data retention"
      
    design:
      - "Minimize data collection"
      - "Plan for data subject rights"
      - "Design consent mechanisms"
      - "Consider data portability"
      
    development:
      - "Implement encryption"
      - "Add audit logging"
      - "Build access controls"
      - "Create deletion capabilities"
      
    testing:
      - "Test data handling"
      - "Verify encryption"
      - "Test deletion works completely"
      - "Security testing"
      
    deployment:
      - "Verify compliance controls"
      - "Enable monitoring"
      - "Document processing activities"
```

### Vendor Compliance Tracking

```yaml
vendors:
  # Sub-processors that handle customer data
  sub_processors:
    - name: "Anthropic"
      service: "AI processing, code analysis"
      data_processed: "User prompts, code snippets"
      location: "USA"
      compliance:
        - "SOC 2 Type II"
        - "GDPR DPA available"
      dpa_status: "required"
      notes: "API usage - data not used for training"
      
    - name: "Hetzner"
      service: "Server hosting (EU)"
      data_processed: "All application data"
      location: "Germany (EU)"
      compliance:
        - "ISO 27001"
        - "GDPR compliant"
      dpa_status: "required"
      notes: "EU data residency"
      
    - name: "Stripe"
      service: "Payment processing"
      data_processed: "Payment information"
      location: "USA (with EU)"
      compliance:
        - "PCI DSS Level 1"
        - "SOC 2"
      dpa_status: "required"
      
    - name: "GitHub"
      service: "OAuth, code hosting (if used)"
      data_processed: "Authentication, repositories"
      location: "USA"
      compliance:
        - "SOC 2"
        - "GDPR"
      dpa_status: "required"
      
    - name: "Cloudflare"
      service: "CDN, DDoS protection"
      data_processed: "Traffic data"
      location: "Global"
      compliance:
        - "SOC 2"
        - "ISO 27001"
      dpa_status: "required"

  vendor_assessment_template:
    questions:
      - "What data do they process?"
      - "Where is data stored?"
      - "What security certifications do they have?"
      - "Do they have a DPA?"
      - "What are their breach notification procedures?"
      - "Can data be exported/deleted on request?"
      - "What are their retention policies?"
```

### Incident Response Integration

```yaml
incident_response:
  classification:
    critical:
      description: "Data breach, service down"
      response_time: "1 hour"
      examples:
        - "Customer data exposed"
        - "Complete service outage"
        - "Security compromise confirmed"
      actions:
        - "Immediate containment"
        - "Executive notification"
        - "ICO notification prep (72 hours)"
        
    high:
      description: "Security vulnerability exploited"
      response_time: "4 hours"
      examples:
        - "Active exploitation attempt"
        - "Partial service degradation"
        - "Unauthorized access detected"
      actions:
        - "Isolate affected systems"
        - "Security team notification"
        
    medium:
      description: "Potential security issue"
      response_time: "24 hours"
      examples:
        - "Vulnerability discovered"
        - "Suspicious activity detected"
        - "Compliance gap identified"
      actions:
        - "Assessment and documentation"
        - "Remediation planning"
        
    low:
      description: "Minor security concern"
      response_time: "72 hours"
      examples:
        - "Best practice deviation"
        - "Minor policy violation"
      actions:
        - "Document and track"
        - "Include in next review"

  response_workflow:
    steps:
      - name: "Detect"
        actions:
          - "Monitoring alerts"
          - "Customer reports"
          - "Security scanning"
        owner: "On-call engineer"
        
      - name: "Contain"
        actions:
          - "Isolate affected systems"
          - "Revoke compromised credentials"
          - "Preserve evidence"
        owner: "Security team"
        
      - name: "Assess"
        actions:
          - "Determine scope of impact"
          - "Identify data affected"
          - "Root cause analysis"
        owner: "Security team + Engineering"
        
      - name: "Notify"
        actions:
          - "ICO within 72 hours (if breach)"
          - "Affected customers without undue delay"
          - "Document all notifications"
        owner: "Legal + Executive"
        
      - name: "Remediate"
        actions:
          - "Fix vulnerability"
          - "Restore service"
          - "Implement preventions"
        owner: "Engineering"
        
      - name: "Review"
        actions:
          - "Post-incident report"
          - "Update procedures"
          - "Lessons learned → knowledge base"
        owner: "Security team"

  # Integration with orchestrator
  orchestrator_integration:
    on_incident_detected:
      - "Pause non-critical agent activities"
      - "Spawn Compliance Agent for assessment"
      - "Generate audit trail export"
      - "Notify relevant stakeholders"
      
    evidence_preservation:
      - "Snapshot current state"
      - "Export relevant logs"
      - "Document agent activities"
      - "Preserve context for investigation"
```

---

## Lesson Scoring and Knowledge Base Management

**Critical Requirement:** The self-improvement system must stay high-signal. Not every observation is worth storing — only lessons that will meaningfully improve future agent performance should be committed. **Security and compliance lessons receive automatic priority scoring.**

### Lesson Lifecycle

```
REVIEWER identifies potential lesson during review
  │
  ├─→ Captures lesson candidate with context
  │
  ├─→ Scores lesson across multiple dimensions
  │     └─→ Security/compliance lessons get automatic boost
  │
  ├─→ If score meets threshold → COMMIT to knowledge base
  │
  └─→ If score below threshold → DISCARD (or archive for analysis)
```

### Lesson Scoring Dimensions

```yaml
lesson_scoring:
  dimensions:
    impact:
      weight: 0.30
      description: "How significantly would this lesson improve outcomes?"
      scale:
        5: "Critical - prevents major failures, security issues, or data loss"
        4: "High - prevents significant bugs or architectural drift"
        3: "Medium - improves code quality or efficiency meaningfully"
        2: "Low - minor improvement, nice to have"
        1: "Minimal - barely noticeable improvement"
        
    generalizability:
      weight: 0.25
      description: "How broadly applicable is this lesson?"
      scale:
        5: "Universal - applies to all projects and contexts"
        4: "Broad - applies to most projects of this type"
        3: "Moderate - applies to similar features/patterns"
        2: "Narrow - applies to specific technology/framework"
        1: "Specific - only applies to this exact situation"
        
    actionability:
      weight: 0.20
      description: "How clear and actionable is the lesson?"
      scale:
        5: "Crystal clear - agent can immediately apply"
        4: "Clear - straightforward to implement"
        3: "Moderate - requires some interpretation"
        2: "Vague - guidance but not specific"
        1: "Abstract - philosophical, hard to apply"
        
    novelty:
      weight: 0.15
      description: "Is this new information or already known?"
      scale:
        5: "Completely new insight"
        4: "New angle on existing knowledge"
        3: "Reinforces with new context"
        2: "Mostly duplicates existing lesson"
        1: "Exact duplicate"
        
    recurrence_potential:
      weight: 0.10
      description: "How likely is this situation to occur again?"
      scale:
        5: "Very common - will encounter frequently"
        4: "Common - regular occurrence"
        3: "Occasional - happens sometimes"
        2: "Rare - unusual circumstance"
        1: "One-off - unique situation"

  thresholds:
    commit: 3.5          # Score >= 3.5: commit to knowledge base
    review: 2.5          # Score 2.5-3.5: flag for human review (optional)
    discard: 2.5         # Score < 2.5: discard

  # Auto-commit overrides (bypass scoring) - SECURITY & COMPLIANCE PRIORITY
  auto_commit_triggers:
    - category: "security"
      min_impact: 3
      reason: "Security lessons are always valuable"
    - category: "data_integrity"
      min_impact: 3
    - category: "compliance"
      min_impact: 2
      reason: "Compliance lessons prevent regulatory issues"
    - category: "secrets_exposure"
      min_impact: 1
      reason: "Any secret exposure lesson is critical"
    - category: "vulnerability"
      min_impact: 2
      reason: "Vulnerability lessons prevent exploits"
```

### Compliance-Related Lesson Categories

```yaml
compliance_lesson_categories:
  - category: "security"
    subcategories:
      - "authentication"
      - "authorization"
      - "encryption"
      - "input_validation"
      - "output_encoding"
      - "session_management"
      - "error_handling"
      
  - category: "compliance"
    subcategories:
      - "gdpr"
      - "soc2"
      - "data_protection"
      - "audit_logging"
      - "access_control"
      - "retention"
      
  - category: "secrets_exposure"
    subcategories:
      - "hardcoded_secrets"
      - "logged_secrets"
      - "exposed_credentials"
      - "insecure_storage"
      
  - category: "vulnerability"
    subcategories:
      - "injection"
      - "xss"
      - "csrf"
      - "broken_auth"
      - "sensitive_exposure"
      - "misconfiguration"
```

---

## Hooks System Architecture

**Critical Requirement:** The system needs a comprehensive hooks architecture that allows for extensibility, custom behaviors, and integration points throughout the agent lifecycle and workflow. **Hooks must also support compliance and security monitoring.**

### Hook Categories

#### 1. Agent Lifecycle Hooks

```
AGENT_SPAWN_BEFORE
  → Fires before an agent is spawned
  → Can modify context, cancel spawn, inject data
  → Use cases: Add custom context, apply rate limiting, log spawn attempt
  → COMPLIANCE: Verify agent has appropriate permissions

AGENT_SPAWN_AFTER
  → Fires immediately after agent is spawned
  → Use cases: Start activity timer, notify UI, update monitoring
  → COMPLIANCE: Audit log the spawn event

AGENT_THINKING_START
  → Fires when agent begins reasoning
  → COMPLIANCE: Track context content for sensitive data

AGENT_THINKING_CHUNK
  → Fires for each chunk of thinking output
  → COMPLIANCE: Monitor for sensitive data in thinking

AGENT_RESPONSE_START
  → Fires when agent begins generating response

AGENT_RESPONSE_CHUNK
  → Fires for each chunk of response (streaming)
  → COMPLIANCE: Scan for secrets in response

AGENT_RESPONSE_COMPLETE
  → Fires when agent completes response
  → COMPLIANCE: Full security scan of response, audit log

AGENT_ERROR
  → Fires when agent encounters an error
  → COMPLIANCE: Ensure errors don't leak sensitive info

AGENT_TERMINATE
  → Fires when agent is terminated
  → COMPLIANCE: Ensure cleanup of sensitive context
```

#### 2. Security & Compliance Hooks

```
SECRET_DETECTED
  → Fires when potential secret is detected in any content
  → Actions: Block operation, alert, log
  → CRITICAL: Always blocks commits

COMPLIANCE_VIOLATION
  → Fires when compliance rule is violated
  → Actions: Block or warn depending on severity

SECURITY_SCAN_COMPLETE
  → Fires after security scan of code/content
  → Actions: Report findings, block if critical

DATA_ACCESS
  → Fires on any data access operation
  → Actions: Audit log, verify permissions

SENSITIVE_DATA_DETECTED
  → Fires when PII or sensitive data is detected
  → Actions: Apply data handling rules, log

ENCRYPTION_REQUIRED
  → Fires when unencrypted sensitive data detected
  → Actions: Force encryption, alert

ACCESS_DENIED
  → Fires when access control blocks an operation
  → Actions: Log attempt, alert on patterns

AUTHENTICATION_EVENT
  → Fires on login, logout, token refresh
  → Actions: Audit log, anomaly detection

RATE_LIMIT_EXCEEDED
  → Fires when rate limit hit
  → Actions: Block, log, alert
```

#### 3. Tool Usage Hooks

```
TOOL_CALL_BEFORE
  → Fires before a tool is invoked
  → COMPLIANCE: Verify tool permissions, log intent
  → SECURITY: Validate parameters for injection

TOOL_CALL_AFTER
  → Fires after tool returns result
  → COMPLIANCE: Audit log result, scan for sensitive data

TOOL_ERROR
  → Fires when tool execution fails
  → SECURITY: Ensure error doesn't expose sensitive info

FILE_WRITE_BEFORE
  → Fires before any file write
  → SECURITY: Scan content for secrets
  → COMPLIANCE: Verify write is authorized

FILE_WRITE_AFTER
  → Fires after file write
  → COMPLIANCE: Audit log the write

DATABASE_QUERY_BEFORE
  → Fires before database query
  → SECURITY: Validate query is parameterized
  → COMPLIANCE: Log query for audit

EXTERNAL_API_CALL
  → Fires on external API calls
  → COMPLIANCE: Log data leaving system
  → SECURITY: Verify approved endpoint
```

### Hook Configuration with Compliance

```yaml
# system/hooks/compliance_audit_logging.yaml

_meta:
  type: "hook"
  id: "compliance_audit_logging"
  scope: "system"
  version: "1.0.0"
  compliance_critical: true  # Cannot be disabled

trigger: "DATA_ACCESS"

conditions:
  - data_classification: ["pii", "confidential", "restricted"]

priority: 1  # Runs first

async: false  # MUST complete before operation continues

handler:
  type: "built_in"
  action: "audit_log"
  params:
    include_user_id: true
    include_resource: true
    include_action: true
    include_timestamp: true
    include_result: true
    tamper_proof: true
    
# Compliance hooks CANNOT be overridden by users
overridable: false
```

---

## Tools Architecture: What Each Agent Needs

### Security-Enhanced Tools

```yaml
filesystem_write:
  description: "Write content to file"
  parameters:
    path: string
    content: string | binary
    mode: "create" | "overwrite" | "append"
  security:
    pre_write_scan: true          # Scan for secrets
    block_on_secret: true         # Block if secret detected
    audit_log: true               # Log all writes
    allowed_paths:
      - "projects/${project_id}/**"
    denied_paths:
      - "system/**"
      - "**/.env*"                # Prevent writing env files
      - "**/secrets/**"
      
code_execute:
  description: "Execute code in sandboxed environment"
  parameters:
    language: string
    code: string
    timeout_ms: number
  security:
    sandbox: true                 # Always sandboxed
    network_disabled: true        # No network access by default
    filesystem_restricted: true   # Limited filesystem access
    resource_limits:
      memory_mb: 512
      cpu_seconds: 30
    audit_log: true
    block_dangerous_imports: true
    
database_query:
  description: "Execute database query"
  parameters:
    connection: string
    query: string
    params: array
  security:
    parameterized_only: true      # MUST use parameterized queries
    readonly_default: true        # Read-only unless explicitly allowed
    audit_log: true
    query_timeout_ms: 30000
    result_limit: 10000
```

### Tools Per Agent (Security Enhanced)

```yaml
orchestrator:
  tools:
    - notify_user
    - request_approval
    - update_activity
    - filesystem_read
    - filesystem_write
    - compliance_check          # NEW: Run compliance checks
    - audit_log_write           # NEW: Write to audit log
  security_notes: "All actions audit-logged"

compliance_agent:
  tools:
    - audit_log_query           # Query audit logs
    - compliance_check          # Run compliance checks
    - report_generate           # Generate reports
    - control_status_check      # Check control implementation
    - vulnerability_scan        # Trigger security scans
    - data_flow_analyze         # Analyze data flows
    - access_review_trigger     # Trigger access review
    - encryption_verify         # Verify encryption
    - secret_scan               # Scan for secrets
  security_notes: "Read-heavy, assessment focused, high privilege"

reviewer:
  tools:
    - filesystem_read
    - filesystem_list
    - filesystem_search
    - code_lint
    - code_test
    - git_diff
    - git_log
    - update_activity
    - secret_scan               # NEW: Scan for secrets
    - security_check            # NEW: Check for vulnerabilities
    - compliance_check          # NEW: Verify compliance
  security_notes: "Must check for security issues in all reviews"

backend_developer:
  tools:
    - filesystem_read
    - filesystem_write
    - filesystem_list
    - filesystem_search
    - code_execute
    - code_lint
    - code_format
    - code_test
    - db_query
    - db_migrate
    - web_fetch
    - update_activity
  security_notes: |
    - MUST use parameterized queries
    - MUST implement input validation
    - MUST add audit logging to sensitive operations
    - MUST use secure password hashing (Argon2id or bcrypt)
    - MUST implement proper session management
```

---

## Git Architecture: System vs Project Repositories

*(Previous content retained)*

### Git Security Enhancements

```yaml
git_security:
  pre_commit_hooks:
    - secret_scan:
        enabled: true
        block_on_detection: true
        patterns:
          - "AWS Access Key"
          - "AWS Secret Key"
          - "GitHub Token"
          - "Stripe Secret Key"
          - "Private Key"
          - "Database URL with credentials"
          - "Generic API Key"
          - "Generic Secret"
        
    - sensitive_file_check:
        enabled: true
        block_files:
          - ".env"
          - ".env.*"
          - "*.pem"
          - "*.key"
          - "**/secrets/*"
          - "**/credentials/*"
          
    - compliance_check:
        enabled: true
        warn_on_issues: true
        checks:
          - "audit_logging_present"
          - "input_validation_present"
          - "encryption_used"
          
  commit_signing:
    enabled: true
    required_for_production: true
    
  branch_protection:
    main:
      require_reviews: 1
      require_status_checks: true
      require_signed_commits: true
      no_force_push: true
      
  audit_logging:
    log_all_commits: true
    log_all_pushes: true
    log_branch_changes: true
    retention_days: 365
```

---

## Secrets Management System

*(Previous content retained with enhancements)*

### Enhanced Secret Scanning

```yaml
secret_scanning:
  pre_commit:
    enabled: true
    block_on_detection: true
    
    patterns:
      # Cloud Provider Keys
      - name: "AWS Access Key"
        pattern: "AKIA[0-9A-Z]{16}"
        severity: "critical"
        
      - name: "AWS Secret Key"
        pattern: "[0-9a-zA-Z/+]{40}"
        context: "aws_secret|secret_key"
        severity: "critical"
        
      - name: "GCP Service Account"
        pattern: '"type":\s*"service_account"'
        severity: "critical"
        
      - name: "Azure Key"
        pattern: "[a-zA-Z0-9/+=]{43}="
        context: "azure|subscription"
        severity: "critical"
        
      # API Keys
      - name: "GitHub Token"
        pattern: "ghp_[0-9a-zA-Z]{36}"
        severity: "critical"
        
      - name: "GitLab Token"
        pattern: "glpat-[0-9a-zA-Z-]{20}"
        severity: "critical"
        
      - name: "Stripe Secret Key"
        pattern: "sk_live_[0-9a-zA-Z]{24,}"
        severity: "critical"
        
      - name: "Stripe Restricted Key"
        pattern: "rk_live_[0-9a-zA-Z]{24,}"
        severity: "critical"
        
      - name: "Anthropic API Key"
        pattern: "sk-ant-[0-9a-zA-Z-]{40,}"
        severity: "critical"
        
      - name: "OpenAI API Key"
        pattern: "sk-[0-9a-zA-Z]{48}"
        severity: "critical"
        
      # Database
      - name: "PostgreSQL URL"
        pattern: "postgres(ql)?://[^:]+:[^@]+@"
        severity: "critical"
        
      - name: "MongoDB URL"
        pattern: "mongodb(\\+srv)?://[^:]+:[^@]+@"
        severity: "critical"
        
      - name: "MySQL URL"
        pattern: "mysql://[^:]+:[^@]+@"
        severity: "critical"
        
      # Private Keys
      - name: "RSA Private Key"
        pattern: "-----BEGIN RSA PRIVATE KEY-----"
        severity: "critical"
        
      - name: "EC Private Key"
        pattern: "-----BEGIN EC PRIVATE KEY-----"
        severity: "critical"
        
      - name: "OpenSSH Private Key"
        pattern: "-----BEGIN OPENSSH PRIVATE KEY-----"
        severity: "critical"
        
      - name: "PGP Private Key"
        pattern: "-----BEGIN PGP PRIVATE KEY BLOCK-----"
        severity: "critical"
        
      # Generic Patterns
      - name: "Generic API Key Assignment"
        pattern: "(api[_-]?key|apikey)['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9]{20,}['\"]"
        severity: "high"
        
      - name: "Generic Secret Assignment"
        pattern: "(secret|password|passwd|pwd)['\"]?\\s*[:=]\\s*['\"][^'\"]{8,}['\"]"
        severity: "high"
        
      - name: "Bearer Token"
        pattern: "bearer\\s+[a-zA-Z0-9._-]{20,}"
        severity: "high"
        
      - name: "JWT Token"
        pattern: "eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*"
        severity: "high"

  # Compliance integration
  compliance:
    on_detection:
      - action: "block_commit"
      - action: "create_incident"
        severity_threshold: "critical"
      - action: "notify_security_team"
        severity_threshold: "critical"
      - action: "audit_log"
        always: true
        
    reporting:
      include_in_compliance_report: true
      track_false_positives: true
      track_remediation_time: true
```

---

## Compliance Reporting Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│ COMPLIANCE DASHBOARD                          [Generate Report] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OVERALL COMPLIANCE SCORE                                        │
│  ████████████████████████████░░░░░░ 87% GOOD                    │
│                                                                  │
│  ┌────────────────────┐  ┌────────────────────┐                 │
│  │ GDPR               │  │ SOC 2 (Prep)       │                 │
│  │ ██████████████ 92% │  │ ████████████░░ 78% │                 │
│  │ ✓ 23/25 controls   │  │ ✓ 45/58 controls   │                 │
│  └────────────────────┘  └────────────────────┘                 │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ RECENT COMPLIANCE EVENTS                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 🔴 CRITICAL  2h ago  Secret detected in PR #234                 │
│    Status: Blocked and remediated                                │
│                                                                  │
│ 🟡 WARNING   1d ago  Access review overdue (3 users)            │
│    Status: In progress                                           │
│                                                                  │
│ 🟢 INFO      2d ago  Quarterly access review completed          │
│    Status: Complete                                              │
│                                                                  │
│ 🟢 INFO      3d ago  Penetration test scheduled                 │
│    Status: Scheduled for next week                               │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ CONTROL STATUS BY CATEGORY                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Access Control      ████████████████████ 100% (5/5)             │
│ Data Protection     █████████████████░░░  85% (6/7)             │
│ Audit & Monitoring  ████████████████████ 100% (4/4)             │
│ Change Management   ████████████████░░░░  80% (4/5)             │
│ Incident Response   ████████████████████ 100% (4/4)             │
│ Vendor Management   ██████████████░░░░░░  70% (2/3)             │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ ACTION ITEMS                                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ⚠️ Complete DPA with Anthropic           Due: Jan 30  [Action]  │
│ ⚠️ Schedule quarterly access review      Due: Feb 1   [Action]  │
│ ⚠️ Update data retention policy          Due: Feb 15  [Action]  │
│ ⚠️ Complete vendor security assessment   Due: Feb 28  [Action]  │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ AUDIT READINESS                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Evidence Collection:   ████████████████░░░░ 80% complete        │
│ Policy Documentation:  ██████████████████░░ 90% complete        │
│ Control Testing:       ████████████░░░░░░░░ 60% complete        │
│                                                                  │
│ Estimated SOC 2 Type I Readiness: 6-8 weeks                     │
│                                                                  │
│                    [View Detailed Report] [Export Evidence]      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Initialization Flow (Compliance-Aware)

```
USER: Creates new project

=== STEP 1: Project Basics ===
- Project name, description, platforms
- Assets uploaded

=== STEP 2: Compliance Requirements ===

ORCHESTRATOR → COMPLIANCE AGENT: "Assess compliance requirements"

COMPLIANCE AGENT presents:

"Based on your project, please confirm compliance requirements:

 DATA PROCESSING
 ☑ Will process personal data (GDPR applies)
 ☑ Will process EU resident data
 ☐ Will process health data (HIPAA may apply)
 ☐ Will process financial data (PCI DSS may apply)
 ☐ Will process children's data (COPPA may apply)
 
 DATA STORAGE
 ☑ EU data residency required
 ☐ Specific country requirements
 
 SECURITY REQUIREMENTS
 ☑ SOC 2 compliance planned
 ☐ ISO 27001 required
 ☐ Industry-specific requirements
 
 THIRD PARTY INTEGRATIONS
 ☑ Will use AI services (Anthropic)
 ☐ Will integrate with customer systems
 ☐ Will use payment processing"

USER confirms requirements

=== STEP 3: Compliance Documentation Generated ===

COMPLIANCE AGENT generates:
- compliance.md (requirements and controls)
- data_processing_register.yaml
- Initial control checklist
- DPA requirements list

=== STEP 4: Architecture (Compliance-Aware) ===

ARCHITECT generates architecture with:
- Security architecture (encryption, auth, access control)
- Data flow diagrams (for GDPR)
- Security boundaries
- Audit logging architecture
- Compliance-relevant ADRs

=== STEP 5: Security Setup ===

ORCHESTRATOR ensures:
- .gitignore includes sensitive files
- Secrets management configured
- Audit logging enabled
- Security headers configured
- Encryption configured

=== STEP 6: Compliance Baseline ===

COMPLIANCE AGENT runs initial assessment:
- Current compliance score: 45% (expected for new project)
- Immediate actions required: [list]
- Controls to implement: [checklist]

=== STEP 7: Ready to Build (Compliantly) ===

All agents now have:
- Compliance requirements in context
- Security guardrails active
- Audit logging enabled
- Secret scanning enabled
```

---

## Updated Workspace Structure

```
workspace/
├── orchestrator-system/
│   ├── src/
│   ├── packages/
│   └── .git/
│
├── orchestrator-data/
│   ├── system/
│   │   ├── agents/
│   │   │   └── compliance_agent.yaml    # NEW
│   │   ├── skills/
│   │   ├── guardrails/
│   │   │   ├── security.yaml            # Security guardrails
│   │   │   ├── compliance.yaml          # Compliance guardrails
│   │   │   ├── secret_detection.yaml    # Secret scanning
│   │   │   └── ...
│   │   ├── mcps/
│   │   ├── hooks/
│   │   │   ├── audit_logging.yaml       # Compliance hooks
│   │   │   ├── secret_scanning.yaml
│   │   │   └── ...
│   │   ├── compliance/                   # NEW: Compliance configs
│   │   │   ├── controls/
│   │   │   │   ├── gdpr_controls.yaml
│   │   │   │   ├── soc2_controls.yaml
│   │   │   │   └── security_controls.yaml
│   │   │   ├── policies/
│   │   │   │   ├── data_retention.yaml
│   │   │   │   ├── access_control.yaml
│   │   │   │   └── incident_response.yaml
│   │   │   └── templates/
│   │   │       ├── dpa_template.md
│   │   │       ├── privacy_policy.md
│   │   │       └── compliance_report.md
│   │   └── templates/
│   │
│   ├── user/{user_id}/
│   │   ├── global/
│   │   ├── learnings/
│   │   └── secrets/
│   │       └── vault.encrypted
│   │
│   └── projects/{project_id}/
│       ├── project.yaml
│       ├── .orchestrator/
│       │   ├── state.json
│       │   ├── history.json
│       │   └── activity.log
│       ├── .agents/
│       ├── .lessons/
│       ├── .hooks/
│       ├── architecture/
│       │   ├── architecture.yaml
│       │   ├── security_architecture.yaml  # NEW
│       │   ├── diagrams/
│       │   │   ├── data_flow.mermaid       # For GDPR
│       │   │   ├── security_boundaries.mermaid
│       │   │   └── ...
│       │   └── adrs/
│       ├── compliance/                      # NEW: Project compliance
│       │   ├── compliance.md
│       │   ├── data_processing_register.yaml
│       │   ├── control_status.yaml
│       │   ├── audit_log/                  # Audit trail
│       │   │   └── [date].jsonl
│       │   ├── reports/
│       │   │   ├── gdpr_report_[date].pdf
│       │   │   └── soc2_evidence_[date].zip
│       │   └── incidents/
│       │       └── [incident_id].yaml
│       ├── designs/
│       ├── claude.md
│       └── secrets/
│           └── vault.encrypted
│
├── projects/
│   └── {project_id}/
│       └── [project source code]
│
└── secrets/
    └── system_vault.encrypted
```

---

## Future UI Panels (Updated)

The eventual interface will include:

**Core Panels:**
- Git worktree/projects/files navigator
- Active agents panel
- Activity stream pane
- Orchestrator status pane
- Prompt terminal
- Kanban board
- Architecture visualization pane
- Code editor
- App viewer
- Test runner panel
- Database panel

**Configuration Panels:**
- Agent editor panel
- Skills editor panel
- MCP editor panel
- Guardrails editor panel
- Hooks editor panel
- Configuration layers viewer
- Feature flag dashboard
- Model management panel
- Prompt laboratory

**Design Panels:**
- Design system viewer
- Mockup gallery

**Learning & Improvement:**
- Learning management (with scoring)
- ADR browser

**Security & Compliance Panels:** *(NEW)*
- **Compliance dashboard** (overall score, control status, action items)
- **Compliance reports** (GDPR, SOC 2, security posture)
- **Audit log viewer** (searchable, filterable audit trail)
- **Secrets management panel** (vault management, rotation)
- **Security findings** (vulnerability tracking, remediation)
- **Incident management** (incident tracking, response workflow)
- **Vendor compliance** (sub-processor tracking, DPA status)
- **Access review panel** (user access, RBAC management)
- **Data processing register** (GDPR Article 30 compliance)

**Project Setup:**
- New project wizard (with compliance assessment)
- Import existing repo (with security audit)

**Monitoring:**
- Token/cost tracker
- Approval queue

---

## What I Need From You

### V1 Failure Prevention (CRITICAL - Questions 1-7)

These questions directly address the V1 architectural failures. Answers here are critical.

1. **Structured Output System** — Design the complete agent output system:
    - Define exact JSON schemas for every agent type
    - How does orchestrator validate schemas?
    - How do we handle schema violations?
    - How do schemas evolve over time without breaking?
    - How do agents learn to produce correct schemas?

2. **Orchestrator Decision Engine** — Design the intelligent routing system:
    - How does orchestrator "think" (use Claude for decisions)?
    - What's the decision tree for each agent output type?
    - How do we route based on success/failure/needs_approval?
    - How do we avoid the V1 "dumb stage lookup" pattern?
    - When should orchestrator reason vs. use deterministic rules?

3. **Context Management System** — Design rich context passing:
    - How do we curate context per agent type? (Designer needs different context than Backend Dev)
    - How do we summarize previous agent outputs intelligently? (Not just truncate!)
    - What's the context schema for each agent type?
    - How do we include architecture, design, API specs, test results?
    - How do we manage context window limits without losing critical info?

4. **Feedback Loop Implementation** — Design automatic retry/fix cycles:
    - How does BUILDER → TESTER → BUG_FIXER → TESTER loop work?
    - Maximum retry counts per loop type?
    - How do we scope retests to only failed tests?
    - When do we escalate to user vs. keep retrying?
    - How do we prevent infinite loops?

5. **Agent Response Parsing** — Design the output parsing system:
    - How do we parse agent responses reliably?
    - How do we handle malformed responses?
    - How do we extract routing decisions from structured data?
    - How do we fail gracefully if parsing fails?

6. **Intelligent Task Routing** — Design beyond stage-based lookup:
    - How do we route based on context, not just stage?
    - How do we handle "needs analysis" flags?
    - How do we handle "needs architecture decision" flags?
    - How do we handle "blocked by user" states?
    - How do we parallelize when dependencies allow?

7. **Orchestrator as AI Agent** — Design the thinking orchestrator:
    - What's the orchestrator's system prompt?
    - When should it use Claude for decisions?
    - How does it synthesize information across agents?
    - How does it recognize when it's stuck?
    - How does it decide when to escalate to user?

### Core Architecture (Questions 8-27)

8. **Documentation Analysis** — What features from the Claude platform docs should we implement?

9. **Agent Definitions** — Refine my agent list. **Include the Compliance Agent and Project Analyzer.** How should each agent be structured?

10. **MCP Servers Needed** — What MCP servers should we build or use?

11. **Skills Architecture** — What skills should exist? **Include compliance and security skills.**

12. **Guardrails** — What safety rails and quality gates need to exist? **Include comprehensive security and compliance guardrails.**

13. **Foundational Documents** — What should claude.md contain? **Include compliance context.**

14. **Self-Improvement System** — How should learnings be stored? **Include compliance lesson prioritization.**

15. **State Management** — How do we track state? **Include compliance state.**

16. **Communication Protocol** — How do agents communicate?

17. **Feature Flag Architecture** — Propose a complete feature flag system.

18. **Model Abstraction Design** — Design the provider interface.

19. **Prompt Architecture Blueprint** — Design the prompt hierarchy.

20. **Orchestration Engine Design** — Design the event-driven state machine. **This must address V1 failures — intelligent routing, not dumb stage lookup.**

21. **Design System Integration** — How should the styleguide be structured?

22. **Review Architecture** — Recommend the review strategy. **Include security review requirements.**

23. **System vs. User Configuration** — Design the layered configuration system.

24. **Project Structure** — Propose the directory structure. **Include compliance artifacts.**

25. **User-Created Agent Learning** — Design the learning system.

26. **Project Initialization Flow** — Design the setup flow. **Include compliance assessment.**

27. **Architect Agent Design** — Define Architect invocation patterns. **Include security architecture responsibilities.**

### Integration & Infrastructure (28-35)

28. **Hooks Architecture** — Design the hooks system. **Include compliance and security hooks.**

29. **Tools Architecture** — Design the tools system. **Include security controls on all tools.**

30. **Real-Time Activity System** — Design the activity monitoring. **Include compliance events.**

31. **Lesson Scoring System** — Design the lesson evaluation. **Include compliance lesson prioritization.**

32. **Architecture Visualization System** — Design the visualization. **Include security boundaries and data flows.**

33. **Git Architecture** — Design the multi-repo system. **Include security controls.**

34. **External Project Import** — Design the import workflow. **Include security audit.**

35. **Secrets Management** — Design the complete secrets system.

### Compliance & Security (36-43)

36. **Environment-Aware Compliance** — Design compliance that scales by environment:
    - How do we reliably detect local/dev/staging/production?
    - What controls are mandatory vs. optional in each environment?
    - How do we track "compliance debt" during development?
    - How do we prevent launching with unresolved compliance debt?
    - What's the pre-launch compliance readiness check?
    - How do controls transition from WARN to BLOCK as we approach production?

37. **Platform Compliance Framework** — Design OUR platform's compliance system:
    - How do we track SOC 2 control implementation status?
    - How do we generate platform compliance reports?
    - How do we collect and store audit evidence for OUR platform?
    - How does the Compliance Agent monitor platform health?
    - What platform compliance checks run automatically?
    - How do we prepare for SOC 2 audits?

38. **Project Compliance System** — Design per-project compliance:
    - How do we gather project compliance requirements during initialization?
    - How do we detect compliance indicators when importing repos?
    - How do we store project compliance config?
    - How do agents receive and apply project compliance context?
    - How does Reviewer check against project-specific requirements?
    - How do we handle projects with NO compliance requirements?

39. **Audit Logging System** — Design the platform audit system:
    - What platform events must be logged?
    - How do we ensure log integrity (tamper-proof)?
    - How long do we retain platform logs?
    - How do we query and report on logs?
    - How do we handle log storage at scale?

40. **Security Controls Implementation** — Design platform security:
    - How do we enforce security in the orchestrator?
    - How do we implement rate limiting and abuse prevention?
    - How do we handle security vulnerabilities?
    - What platform security testing is mandatory?

41. **Multi-Tenant Security** — Design tenant isolation:
    - How do we isolate customer project data?
    - How do we prevent cross-tenant access?
    - How do we handle shared infrastructure securely?
    - What are the resource limits per tenant?

42. **Incident Response Integration** — Design incident handling:
    - How does the orchestrator detect platform incidents?
    - What automated responses are appropriate?
    - How do we preserve evidence?
    - How do we integrate with notification systems?
    - How do we track incident resolution?

43. **Data Protection (Platform GDPR)** — Design OUR GDPR compliance:
    - How do we handle data subject requests for platform user data?
    - How do we track user consent for platform features?
    - How do we document OUR data processing activities?
    - How do we handle platform data retention and deletion?
    - How do we handle cross-border data transfers?

### Future Considerations (44-45)

44. **Compliance Reporting & Dashboards** — Design reporting for both tiers:
    - Platform compliance dashboard (SOC 2 readiness, audit status)
    - Project compliance reports (per-project framework status)
    - How do we calculate compliance scores?
    - What dashboards do different stakeholders need?
    - How do we export evidence packages for audits?

45. **Cutting-Edge Additions** — What am I not thinking of? Search for the latest approaches and suggest innovations. **Include emerging compliance requirements (AI Act, etc.).**

---

Think deeply, search extensively, and provide a comprehensive architectural blueprint we can build from. Suggest folder structures, file formats, schemas, and implementation patterns. Be specific and actionable.

**Remember:** 
- This system is being built to become a £billion+ enterprise AI company
- **Platform compliance** (SOC 2, GDPR for US) is mandatory and baked in from day one
- **Project compliance** is user-defined per project — a hobby project needs nothing, an enterprise healthcare app needs HIPAA
- **Environment-aware compliance** — don't slow down development with production-level controls; track compliance debt and enforce before launch
- We want to pass SOC 2 audits, satisfy enterprise security questionnaires, and never have a security incident in the news
- We must NOT repeat V1 failures — the orchestrator must THINK, not just dispatch

**Total Questions: 45**
- V1 Failure Prevention: 1-7
- Core Architecture: 8-27  
- Integration & Infrastructure: 28-35
- Compliance & Security: 36-43
- Future Considerations: 44-45
