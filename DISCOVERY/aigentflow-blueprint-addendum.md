# Aigentflow Blueprint Addendum

This document addresses all gaps identified in the Blueprint Comparison Report. It should be read alongside the main architecture blueprint.

---

## 1. Design-First Workflow (CRITICAL)

**Gap:** The blueprint did not mention that EVERY feature starts with UI Designer creating mockups.

### Design-First Workflow Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DESIGN-FIRST WORKFLOW (MANDATORY)                      │
└─────────────────────────────────────────────────────────────────────────────┘

USER REQUEST: "Add user authentication"
       │
       ▼
┌──────────────────┐
│ PROJECT MANAGER  │ → Identifies: "This feature needs UI flows"
└────────┬─────────┘
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

### Design Approval States

```yaml
design_approval_workflow:
  states:
    - "draft"           # Designer working
    - "pending_review"  # Awaiting user review
    - "changes_requested" # User requested changes
    - "approved"        # Can proceed to build
    - "superseded"      # Replaced by newer version
    
  transitions:
    draft → pending_review:
      trigger: "designer_submits"
      action: "notify_user"
      
    pending_review → approved:
      trigger: "user_approves"
      action: "unblock_build_tasks"
      
    pending_review → changes_requested:
      trigger: "user_requests_changes"
      action: "return_to_designer"
      data: "user_feedback"
      
    changes_requested → pending_review:
      trigger: "designer_resubmits"
      action: "notify_user"
      
  rules:
    - "NO build tasks can start until design is 'approved'"
    - "Build tasks MUST reference approved design version"
    - "Design changes after approval require re-approval"
```

### Design Reference in Build Tasks

```typescript
interface BuildTask {
  task_id: string;
  type: "frontend" | "backend";
  
  // MANDATORY for frontend tasks
  design_reference: {
    mockup_id: string;
    mockup_version: string;      // e.g., "v3"
    mockup_path: string;         // "designs/auth/login-v3.html"
    approval_timestamp: string;
    approved_by: string;
    
    // Specific elements this task implements
    implements: string[];        // ["login-form", "error-states", "loading"]
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

### Feature Detection: Does This Need Design?

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
    
  never_requires_design:
    - "API-only changes"
    - "Database schema changes"
    - "Backend service logic"
    - "Performance optimization"
    - "Bug fixes (unless UI affected)"
    - "Refactoring (unless UI affected)"
    - "Documentation"
    
  requires_review:
    # These might need design - PM should check
    - "Text/copy changes"
    - "Icon/image updates"
    - "Color/styling changes"
    - "Responsive adjustments"
```

---

## 2. Overlay Pattern for Existing Repos (CRITICAL)

**Gap:** The blueprint did not address keeping orchestrator files separate from project source code.

### Overlay Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OVERLAY PATTERN ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────┘

The orchestrator NEVER modifies the user's source repository directly.
Instead, it maintains a parallel "overlay" directory with all orchestrator data.

PHYSICAL STRUCTURE:
==================

workspace/
├── orchestrator-system/           # Aigentflow platform code
│   ├── src/
│   └── .git/
│
├── orchestrator-data/             # ALL orchestrator state lives here
│   ├── system/                    # Platform-wide configs
│   │   ├── agents/
│   │   ├── skills/
│   │   ├── guardrails/
│   │   ├── hooks/
│   │   ├── compliance/
│   │   └── templates/
│   │
│   ├── user/{user_id}/
│   │   ├── global/                # User's global preferences
│   │   ├── learnings/             # User's accumulated learnings
│   │   └── secrets/
│   │
│   └── projects/{project_id}/     # Per-project orchestrator data
│       ├── project.yaml           # Project configuration
│       ├── .orchestrator/         # State, history, activity
│       │   ├── state.json
│       │   ├── history.json
│       │   └── activity.log
│       ├── .agents/               # Agent overrides
│       ├── .lessons/              # Project-specific learnings
│       ├── .hooks/                # Project hooks
│       ├── architecture/          # Architecture docs (owned by orchestrator)
│       │   ├── architecture.yaml
│       │   ├── security_architecture.yaml
│       │   ├── diagrams/
│       │   └── adrs/
│       ├── compliance/            # Compliance artifacts
│       ├── designs/               # Design mockups
│       ├── context_bundles/       # Context bundle snapshots
│       └── claude.md              # Orchestrator's context file
│
└── projects/                      # USER'S ACTUAL SOURCE CODE
    └── {project_id}/
        ├── .git/                  # User's git repo (UNTOUCHED by overlay)
        ├── src/
        ├── package.json
        └── ...                    # All user files - orchestrator READS but 
                                   # WRITES go through proper git workflow
```

### Overlay Mapping System

```yaml
overlay_mapping:
  description: |
    Maps between user's repo paths and orchestrator overlay paths.
    This allows orchestrator to "see" a unified view while keeping
    files physically separated.
    
  path_resolution:
    # When orchestrator needs to read/write, resolve path
    
    user_source_files:
      read_from: "projects/{project_id}/**"
      write_to: "projects/{project_id}/**"  # Via git workflow
      method: "git_commit"  # All writes go through git
      
    orchestrator_state:
      read_from: "orchestrator-data/projects/{project_id}/.orchestrator/**"
      write_to: "orchestrator-data/projects/{project_id}/.orchestrator/**"
      method: "direct"  # Orchestrator owns these
      
    architecture_docs:
      read_from: "orchestrator-data/projects/{project_id}/architecture/**"
      write_to: "orchestrator-data/projects/{project_id}/architecture/**"
      method: "direct"
      sync_to_repo: false  # Optional: can sync to user's repo
      
    design_files:
      read_from: "orchestrator-data/projects/{project_id}/designs/**"
      write_to: "orchestrator-data/projects/{project_id}/designs/**"
      method: "direct"
      
  virtual_file_system:
    # Agents see a unified view
    agent_view:
      "/project" → "projects/{project_id}"
      "/state" → "orchestrator-data/projects/{project_id}/.orchestrator"
      "/architecture" → "orchestrator-data/projects/{project_id}/architecture"
      "/designs" → "orchestrator-data/projects/{project_id}/designs"
      "/compliance" → "orchestrator-data/projects/{project_id}/compliance"
```

### External Project Import with Overlay

```yaml
external_project_import:
  description: |
    When importing an existing repo, we CLONE it and set up overlay.
    The original repo is NEVER modified directly.
    
  workflow:
    step_1_clone:
      action: "Clone user's repo"
      destination: "projects/{new_project_id}/"
      note: "This becomes the working copy"
      
    step_2_security_scan:
      action: "Run security audit"
      checks:
        - secret_detection
        - dependency_vulnerabilities
        - code_security_scan
        - license_compliance
      blocking: true  # Must pass before proceeding
      
    step_3_analysis:
      action: "Run Project Analyzer agent"
      outputs:
        - tech_stack_detection
        - architecture_mapping
        - pattern_recognition
        - compliance_detection
      destination: "orchestrator-data/projects/{project_id}/architecture/"
      
    step_4_overlay_setup:
      action: "Create overlay structure"
      creates:
        - "orchestrator-data/projects/{project_id}/.orchestrator/"
        - "orchestrator-data/projects/{project_id}/architecture/"
        - "orchestrator-data/projects/{project_id}/compliance/"
        - "orchestrator-data/projects/{project_id}/designs/"
        
    step_5_claude_md_generation:
      action: "Generate claude.md from analysis"
      destination: "orchestrator-data/projects/{project_id}/claude.md"
      note: "NOT placed in user's repo"
      
    step_6_git_setup:
      action: "Configure git for orchestrator workflow"
      configs:
        - remote: "origin" (user's original)
        - branch_protection: true
        - pre_commit_hooks: [secret_scan]
```

### What Goes Where

```yaml
file_ownership:
  
  # USER'S REPO (projects/{project_id}/)
  # Orchestrator can READ and PROPOSE changes via git
  user_owned:
    - "src/**"           # Source code
    - "tests/**"         # Test files
    - "package.json"     # Dependencies
    - "README.md"        # User's readme
    - ".gitignore"       # User's gitignore
    - "Dockerfile"       # Container config
    - ".env.example"     # Example env (no secrets)
    
  # ORCHESTRATOR OVERLAY (orchestrator-data/projects/{project_id}/)
  # Orchestrator fully owns these - never in user's repo
  orchestrator_owned:
    - ".orchestrator/**"      # State, history
    - "architecture/**"       # Architecture docs, ADRs
    - "designs/**"            # Design mockups
    - "compliance/**"         # Compliance artifacts
    - ".agents/**"            # Agent configs
    - ".hooks/**"             # Project hooks
    - ".lessons/**"           # Project learnings
    - "context_bundles/**"    # Context snapshots
    - "claude.md"             # Orchestrator context
    - "secrets/vault.encrypted"  # Project secrets
    
  # OPTIONAL SYNC (can be copied to user's repo if desired)
  optional_sync:
    - "architecture/architecture.md" → "docs/architecture.md"
    - "architecture/adrs/**" → "docs/adrs/**"
    - "compliance/compliance.md" → "docs/compliance.md"
```

---

## 3. Complete Workspace Directory Structure (CRITICAL)

**Gap:** The blueprint did not include the complete directory layout.

```
workspace/
│
├── orchestrator-system/                    # PLATFORM CODE
│   ├── src/
│   │   ├── orchestrator/
│   │   │   ├── core/
│   │   │   │   ├── orchestrator.ts         # Main orchestrator
│   │   │   │   ├── decision_engine.ts      # AI routing decisions
│   │   │   │   ├── state_machine.ts        # Workflow states
│   │   │   │   └── context_manager.ts      # Context priming
│   │   │   ├── agents/
│   │   │   │   ├── base_agent.ts
│   │   │   │   ├── project_manager.ts
│   │   │   │   ├── architect.ts
│   │   │   │   ├── ui_designer.ts
│   │   │   │   ├── frontend_developer.ts
│   │   │   │   ├── backend_developer.ts
│   │   │   │   ├── tester.ts
│   │   │   │   ├── bug_fixer.ts
│   │   │   │   ├── reviewer.ts
│   │   │   │   ├── git_agent.ts
│   │   │   │   ├── compliance_agent.ts
│   │   │   │   ├── project_analyzer.ts
│   │   │   │   └── merge_conflict_resolver.ts
│   │   │   ├── tools/
│   │   │   │   ├── filesystem.ts
│   │   │   │   ├── git.ts
│   │   │   │   ├── code_execute.ts
│   │   │   │   ├── database.ts
│   │   │   │   └── security_scan.ts
│   │   │   ├── hooks/
│   │   │   │   ├── hook_engine.ts
│   │   │   │   └── builtin_hooks.ts
│   │   │   ├── compliance/
│   │   │   │   ├── audit_logger.ts
│   │   │   │   ├── secret_scanner.ts
│   │   │   │   └── compliance_checker.ts
│   │   │   └── realtime/
│   │   │       ├── activity_stream.ts
│   │   │       └── websocket_server.ts
│   │   │
│   │   ├── api/                            # REST/GraphQL API
│   │   ├── db/                             # Database layer
│   │   └── utils/
│   │
│   ├── packages/
│   │   ├── @aigentflow/schemas/            # Shared schemas
│   │   ├── @aigentflow/hooks/              # Hook definitions
│   │   └── @aigentflow/ui/                 # UI components (future)
│   │
│   ├── tests/
│   └── .git/
│
├── orchestrator-data/                       # ALL ORCHESTRATOR STATE
│   │
│   ├── system/                              # Platform-wide configs
│   │   ├── agents/
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
│   │   ├── skills/
│   │   │   ├── coding/
│   │   │   │   ├── react.yaml
│   │   │   │   ├── vue.yaml
│   │   │   │   ├── python.yaml
│   │   │   │   ├── typescript.yaml
│   │   │   │   └── database.yaml
│   │   │   ├── testing/
│   │   │   │   ├── jest.yaml
│   │   │   │   ├── pytest.yaml
│   │   │   │   ├── playwright.yaml
│   │   │   │   └── cypress.yaml
│   │   │   ├── security/
│   │   │   │   ├── secret_scanning.yaml
│   │   │   │   ├── sast.yaml
│   │   │   │   ├── dependency_audit.yaml
│   │   │   │   └── owasp_checks.yaml
│   │   │   └── compliance/
│   │   │       ├── gdpr_checks.yaml
│   │   │       ├── soc2_checks.yaml
│   │   │       ├── hipaa_checks.yaml
│   │   │       └── pci_checks.yaml
│   │   │
│   │   ├── guardrails/
│   │   │   ├── input/
│   │   │   │   ├── prompt_injection.yaml
│   │   │   │   ├── pii_detection.yaml
│   │   │   │   └── malicious_content.yaml
│   │   │   ├── output/
│   │   │   │   ├── secret_leakage.yaml
│   │   │   │   ├── hallucination_check.yaml
│   │   │   │   └── format_validation.yaml
│   │   │   ├── code/
│   │   │   │   ├── sql_injection.yaml
│   │   │   │   ├── xss_prevention.yaml
│   │   │   │   ├── hardcoded_secrets.yaml
│   │   │   │   └── dangerous_functions.yaml
│   │   │   └── compliance/
│   │   │       ├── data_privacy.yaml
│   │   │       ├── audit_logging.yaml
│   │   │       └── access_control.yaml
│   │   │
│   │   ├── hooks/
│   │   │   ├── lifecycle/
│   │   │   │   ├── agent_spawn.yaml
│   │   │   │   ├── agent_complete.yaml
│   │   │   │   └── agent_error.yaml
│   │   │   ├── security/
│   │   │   │   ├── secret_detected.yaml
│   │   │   │   ├── vulnerability_found.yaml
│   │   │   │   └── compliance_violation.yaml
│   │   │   ├── tools/
│   │   │   │   ├── file_write.yaml
│   │   │   │   ├── code_execute.yaml
│   │   │   │   └── external_api.yaml
│   │   │   └── workflow/
│   │   │       ├── task_created.yaml
│   │   │       ├── design_approved.yaml
│   │   │       └── build_complete.yaml
│   │   │
│   │   ├── compliance/
│   │   │   ├── controls/
│   │   │   │   ├── gdpr_controls.yaml
│   │   │   │   ├── soc2_controls.yaml
│   │   │   │   └── security_controls.yaml
│   │   │   ├── policies/
│   │   │   │   ├── data_retention.yaml
│   │   │   │   ├── access_control.yaml
│   │   │   │   └── incident_response.yaml
│   │   │   ├── templates/
│   │   │   │   ├── dpa_template.md
│   │   │   │   ├── privacy_policy.md
│   │   │   │   └── compliance_report.md
│   │   │   └── environment_compliance.yaml
│   │   │
│   │   ├── prompts/
│   │   │   ├── meta/
│   │   │   │   ├── system_identity.yaml
│   │   │   │   ├── higher_order.yaml
│   │   │   │   └── self_improving.yaml
│   │   │   ├── agents/
│   │   │   │   └── [agent_name]_prompt.yaml
│   │   │   └── templates/
│   │   │       ├── task_assignment.yaml
│   │   │       ├── handoff.yaml
│   │   │       ├── escalation.yaml
│   │   │       └── review.yaml
│   │   │
│   │   ├── mcps/
│   │   │   ├── filesystem.yaml
│   │   │   ├── git.yaml
│   │   │   ├── database.yaml
│   │   │   ├── terminal.yaml
│   │   │   └── web.yaml
│   │   │
│   │   └── templates/
│   │       ├── new_agent.yaml
│   │       ├── new_skill.yaml
│   │       ├── new_guardrail.yaml
│   │       └── new_hook.yaml
│   │
│   ├── user/{user_id}/
│   │   ├── global/
│   │   │   ├── preferences.yaml
│   │   │   └── style_preferences.yaml
│   │   ├── learnings/
│   │   │   ├── lessons.db              # SQLite with user's learnings
│   │   │   └── embeddings/             # Vector embeddings
│   │   └── secrets/
│   │       └── vault.encrypted
│   │
│   └── projects/{project_id}/
│       ├── project.yaml                # Project configuration
│       │
│       ├── .orchestrator/
│       │   ├── state.json              # Current state
│       │   ├── history.json            # State history
│       │   ├── activity.log            # Activity stream log
│       │   └── task_queue.json         # Pending tasks
│       │
│       ├── .agents/                    # Project agent overrides
│       ├── .skills/                    # Project skill overrides
│       ├── .hooks/                     # Project hooks
│       ├── .lessons/                   # Project learnings
│       │
│       ├── architecture/
│       │   ├── architecture.yaml
│       │   ├── security_architecture.yaml
│       │   ├── diagrams/
│       │   │   ├── c4_context.mermaid
│       │   │   ├── c4_container.mermaid
│       │   │   ├── data_flow.mermaid
│       │   │   └── security_boundaries.mermaid
│       │   └── adrs/
│       │       ├── 0001-tech-stack.md
│       │       └── 0002-auth-approach.md
│       │
│       ├── compliance/
│       │   ├── project_compliance.yaml
│       │   ├── data_processing_register.yaml
│       │   ├── control_status.yaml
│       │   ├── audit_log/
│       │   │   └── [date].jsonl
│       │   ├── reports/
│       │   └── incidents/
│       │
│       ├── designs/
│       │   ├── approved/
│       │   │   └── [feature]/
│       │   │       ├── v1.html
│       │   │       └── approval.json
│       │   ├── pending/
│       │   └── styleguide/
│       │       ├── tokens.json
│       │       └── components.yaml
│       │
│       ├── context_bundles/
│       │   └── [bundle_id].json
│       │
│       ├── claude.md
│       │
│       └── secrets/
│           └── vault.encrypted
│
├── projects/                           # USER SOURCE CODE
│   └── {project_id}/
│       ├── .git/                       # User's git repo
│       ├── src/
│       ├── tests/
│       ├── package.json
│       └── ...
│
└── worktrees/                          # GIT WORKTREES FOR PARALLEL WORK
    └── {project_id}/
        ├── feature-auth-system/        # Worktree for auth feature
        │   └── [project files]
        ├── feature-dashboard/          # Worktree for dashboard
        │   └── [project files]
        └── bugfix-login-error/         # Worktree for bug fix
            └── [project files]
```

---

## 4. Complete Hooks Architecture (CRITICAL)

**Gap:** The blueprint mentioned hooks briefly but not the 30+ hook definitions.

### Hook Categories and Definitions

```yaml
hooks_architecture:
  
  # ═══════════════════════════════════════════════════════════════════
  # CATEGORY 1: AGENT LIFECYCLE HOOKS
  # ═══════════════════════════════════════════════════════════════════
  
  agent_lifecycle:
    
    AGENT_SPAWN_BEFORE:
      description: "Fires before an agent is spawned"
      payload:
        agent_type: string
        task_id: string
        context_size: number
        priority: string
      can_cancel: true
      can_modify_context: true
      compliance_use: "Verify agent has appropriate permissions"
      
    AGENT_SPAWN_AFTER:
      description: "Fires immediately after agent is spawned"
      payload:
        agent_id: string
        agent_type: string
        task_id: string
        spawn_timestamp: string
      compliance_use: "Audit log the spawn event"
      
    AGENT_THINKING_START:
      description: "Fires when agent begins reasoning"
      payload:
        agent_id: string
        context_hash: string
      compliance_use: "Track context content for sensitive data"
      
    AGENT_THINKING_CHUNK:
      description: "Fires for each chunk of thinking output (streaming)"
      payload:
        agent_id: string
        chunk: string
        chunk_index: number
      compliance_use: "Monitor for sensitive data in thinking"
      
    AGENT_RESPONSE_START:
      description: "Fires when agent begins generating response"
      payload:
        agent_id: string
        
    AGENT_RESPONSE_CHUNK:
      description: "Fires for each chunk of response (streaming)"
      payload:
        agent_id: string
        chunk: string
      compliance_use: "Scan for secrets in response chunks"
      
    AGENT_RESPONSE_COMPLETE:
      description: "Fires when agent completes response"
      payload:
        agent_id: string
        response: AgentResponse
        duration_ms: number
        tokens_used: number
      compliance_use: "Full security scan of response, audit log"
      
    AGENT_ERROR:
      description: "Fires when agent encounters an error"
      payload:
        agent_id: string
        error: Error
        recoverable: boolean
      compliance_use: "Ensure errors don't leak sensitive info"
      
    AGENT_TERMINATE:
      description: "Fires when agent is terminated"
      payload:
        agent_id: string
        reason: string
        final_state: object
      compliance_use: "Ensure cleanup of sensitive context"

  # ═══════════════════════════════════════════════════════════════════
  # CATEGORY 2: SECURITY & COMPLIANCE HOOKS
  # ═══════════════════════════════════════════════════════════════════
  
  security_compliance:
    
    SECRET_DETECTED:
      description: "Fires when potential secret is detected"
      payload:
        content_type: string  # "code", "response", "file"
        secret_type: string   # "aws_key", "api_key", etc.
        location: string
        severity: string
      action: "BLOCK"
      compliance_critical: true  # Cannot be disabled
      
    COMPLIANCE_VIOLATION:
      description: "Fires when compliance rule is violated"
      payload:
        rule_id: string
        framework: string    # "GDPR", "SOC2", etc.
        severity: string
        details: object
      action: "BLOCK or WARN"
      
    SECURITY_SCAN_COMPLETE:
      description: "Fires after security scan of code/content"
      payload:
        scan_type: string
        findings: SecurityFinding[]
        critical_count: number
        high_count: number
      action: "Report findings, block if critical"
      
    DATA_ACCESS:
      description: "Fires on any data access operation"
      payload:
        resource: string
        action: string       # "read", "write", "delete"
        user_id: string
        data_classification: string
      compliance_use: "Audit log, verify permissions"
      compliance_critical: true
      
    SENSITIVE_DATA_DETECTED:
      description: "Fires when PII or sensitive data is detected"
      payload:
        data_type: string    # "email", "phone", "ssn", etc.
        location: string
        context: string
      action: "Apply data handling rules, log"
      
    ENCRYPTION_REQUIRED:
      description: "Fires when unencrypted sensitive data detected"
      payload:
        data_type: string
        location: string
      action: "Force encryption, alert"
      
    ACCESS_DENIED:
      description: "Fires when access control blocks an operation"
      payload:
        user_id: string
        resource: string
        action_attempted: string
        reason: string
      action: "Log attempt, alert on patterns"
      
    AUTHENTICATION_EVENT:
      description: "Fires on login, logout, token refresh"
      payload:
        event_type: string   # "login", "logout", "refresh", "failed"
        user_id: string
        ip_address: string
        user_agent: string
      action: "Audit log, anomaly detection"
      
    RATE_LIMIT_EXCEEDED:
      description: "Fires when rate limit hit"
      payload:
        limit_type: string
        current_count: number
        limit: number
        user_id: string
      action: "Block, log, alert"

  # ═══════════════════════════════════════════════════════════════════
  # CATEGORY 3: TOOL USAGE HOOKS
  # ═══════════════════════════════════════════════════════════════════
  
  tool_usage:
    
    TOOL_CALL_BEFORE:
      description: "Fires before a tool is invoked"
      payload:
        tool_name: string
        parameters: object
        agent_id: string
      can_cancel: true
      can_modify_params: true
      compliance_use: "Verify tool permissions, log intent"
      security_use: "Validate parameters for injection"
      
    TOOL_CALL_AFTER:
      description: "Fires after tool returns result"
      payload:
        tool_name: string
        result: object
        duration_ms: number
        success: boolean
      compliance_use: "Audit log result, scan for sensitive data"
      
    TOOL_ERROR:
      description: "Fires when tool execution fails"
      payload:
        tool_name: string
        error: Error
      security_use: "Ensure error doesn't expose sensitive info"
      
    FILE_READ_BEFORE:
      description: "Fires before file read"
      payload:
        path: string
        agent_id: string
      can_cancel: true
      compliance_use: "Verify read authorization"
      
    FILE_WRITE_BEFORE:
      description: "Fires before any file write"
      payload:
        path: string
        content: string
        agent_id: string
      can_cancel: true
      can_modify_content: true
      security_use: "Scan content for secrets"
      compliance_use: "Verify write is authorized"
      
    FILE_WRITE_AFTER:
      description: "Fires after file write"
      payload:
        path: string
        bytes_written: number
      compliance_use: "Audit log the write"
      
    DATABASE_QUERY_BEFORE:
      description: "Fires before database query"
      payload:
        query: string
        params: array
        connection: string
      can_cancel: true
      security_use: "Validate query is parameterized"
      compliance_use: "Log query for audit"
      
    CODE_EXECUTE_BEFORE:
      description: "Fires before code execution"
      payload:
        language: string
        code: string
        sandbox_config: object
      can_cancel: true
      security_use: "Validate code safety"
      
    CODE_EXECUTE_AFTER:
      description: "Fires after code execution"
      payload:
        exit_code: number
        stdout: string
        stderr: string
        duration_ms: number
      compliance_use: "Log execution for audit"
      
    EXTERNAL_API_CALL:
      description: "Fires on external API calls"
      payload:
        url: string
        method: string
        headers: object
      compliance_use: "Log data leaving system"
      security_use: "Verify approved endpoint"

  # ═══════════════════════════════════════════════════════════════════
  # CATEGORY 4: WORKFLOW HOOKS
  # ═══════════════════════════════════════════════════════════════════
  
  workflow:
    
    TASK_CREATED:
      description: "Fires when new task is created"
      payload:
        task_id: string
        task_type: string
        parent_task_id: string
        dependencies: string[]
        
    TASK_STARTED:
      description: "Fires when task execution begins"
      payload:
        task_id: string
        assigned_agent: string
        
    TASK_COMPLETED:
      description: "Fires when task completes"
      payload:
        task_id: string
        status: string
        result: AgentResponse
        
    TASK_FAILED:
      description: "Fires when task fails"
      payload:
        task_id: string
        error: Error
        retry_count: number
        
    DESIGN_SUBMITTED:
      description: "Fires when designer submits mockup for review"
      payload:
        design_id: string
        mockup_path: string
        feature: string
        
    DESIGN_APPROVED:
      description: "Fires when user approves a design"
      payload:
        design_id: string
        approved_by: string
        version: string
      action: "Unblock dependent build tasks"
      
    DESIGN_REJECTED:
      description: "Fires when user rejects a design"
      payload:
        design_id: string
        feedback: string
      action: "Return to designer with feedback"
      
    BUILD_STARTED:
      description: "Fires when build phase starts"
      payload:
        feature_id: string
        design_reference: string
        
    BUILD_COMPLETE:
      description: "Fires when build phase completes"
      payload:
        feature_id: string
        files_created: string[]
        files_modified: string[]
        
    TEST_RUN_STARTED:
      description: "Fires when test suite starts"
      payload:
        test_suite: string
        test_count: number
        
    TEST_RUN_COMPLETE:
      description: "Fires when test suite completes"
      payload:
        passed: number
        failed: number
        failures: TestFailure[]
        
    REVIEW_STARTED:
      description: "Fires when review begins"
      payload:
        review_id: string
        reviewer_agent: string
        
    REVIEW_COMPLETE:
      description: "Fires when review completes"
      payload:
        approved: boolean
        issues: Issue[]
        lessons: Lesson[]

  # ═══════════════════════════════════════════════════════════════════
  # CATEGORY 5: GIT HOOKS
  # ═══════════════════════════════════════════════════════════════════
  
  git:
    
    GIT_COMMIT_BEFORE:
      description: "Fires before git commit"
      payload:
        files: string[]
        message: string
        branch: string
      can_cancel: true
      security_use: "Secret scan all files"
      
    GIT_COMMIT_AFTER:
      description: "Fires after git commit"
      payload:
        commit_hash: string
        branch: string
      compliance_use: "Audit log commit"
      
    GIT_PUSH_BEFORE:
      description: "Fires before git push"
      payload:
        branch: string
        remote: string
        commits: string[]
      can_cancel: true
      
    GIT_MERGE_CONFLICT:
      description: "Fires when merge conflict detected"
      payload:
        branch_from: string
        branch_to: string
        conflicting_files: string[]
      action: "Spawn merge conflict resolver"
      
    GIT_BRANCH_CREATED:
      description: "Fires when new branch created"
      payload:
        branch_name: string
        base_branch: string
        
    WORKTREE_CREATED:
      description: "Fires when git worktree created"
      payload:
        worktree_path: string
        branch: string
        agent_id: string

  # ═══════════════════════════════════════════════════════════════════
  # CATEGORY 6: LEARNING HOOKS
  # ═══════════════════════════════════════════════════════════════════
  
  learning:
    
    LESSON_CANDIDATE_IDENTIFIED:
      description: "Fires when potential lesson identified"
      payload:
        lesson: LessonCandidate
        source_agent: string
        context: object
        
    LESSON_SCORED:
      description: "Fires when lesson has been scored"
      payload:
        lesson_id: string
        score: number
        dimensions: ScoreDimensions
        
    LESSON_COMMITTED:
      description: "Fires when lesson committed to knowledge base"
      payload:
        lesson_id: string
        category: string
        
    LESSON_APPLIED:
      description: "Fires when lesson is applied by an agent"
      payload:
        lesson_id: string
        agent_id: string
        task_id: string
```

### Hook Configuration Schema

```yaml
# system/hooks/example_hook.yaml

_meta:
  type: "hook"
  id: "secret_detection_block"
  version: "1.0.0"
  scope: "system"              # system | project | user
  compliance_critical: true    # Cannot be disabled if true
  
trigger: "FILE_WRITE_BEFORE"

conditions:
  - file_extension: ["js", "ts", "py", "yaml", "json", "env"]
  - content_contains_pattern: true
  
priority: 1                    # Lower = runs first

async: false                   # Must complete before operation

timeout_ms: 5000

handler:
  type: "built_in"             # built_in | script | webhook
  action: "secret_scan"
  params:
    patterns: "all"
    block_on_detection: true
    severity_threshold: "high"
    
on_trigger:
  - action: "block"
    condition: "secret_found"
  - action: "audit_log"
    always: true
  - action: "notify"
    condition: "secret_found"
    channel: "security_team"
    
overridable: false             # Cannot be overridden by project/user
```

---

## 5. Agent Security Matrix (HIGH PRIORITY)

**Gap:** The blueprint mentioned security levels but not per-agent security checklists.

```yaml
agent_security_requirements:

  orchestrator:
    security_level: "system"
    requirements:
      - "Audit log all agent spawns and decisions"
      - "Validate all inputs before processing"
      - "Enforce rate limits on agent spawning"
      - "Never include secrets in agent context"
      - "Mask sensitive data in activity streams"
      - "Verify tenant isolation on every operation"
    tools_allowed:
      - notify_user
      - request_approval
      - update_activity
      - filesystem_read
      - filesystem_write
      - compliance_check
      - audit_log_write
    
  project_manager:
    security_level: "internal"
    requirements:
      - "Flag tasks with security implications"
      - "Ensure compliance tasks are included in plans"
      - "Track security-related dependencies"
      - "Never expose internal architecture details to outputs"
    tools_allowed:
      - filesystem_read
      - filesystem_list
      - update_activity
      
  architect:
    security_level: "internal"
    requirements:
      - "Design with security-by-default"
      - "Document security architecture in ADRs"
      - "Review data flows for compliance"
      - "Ensure encryption architecture"
      - "Define security boundaries"
      - "Consider OWASP Top 10 in all designs"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - filesystem_list
      - web_search
      - update_activity
      
  ui_designer:
    security_level: "internal"
    requirements:
      - "Never include real data in mockups"
      - "Design accessible interfaces (WCAG)"
      - "Include privacy UX patterns"
      - "Design secure form patterns"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - web_search
      - update_activity
      
  frontend_developer:
    security_level: "internal"
    requirements:
      - "Implement XSS prevention (output encoding)"
      - "Implement CSRF protection"
      - "Add security headers (CSP, X-Frame-Options)"
      - "Validate all user inputs client-side"
      - "NEVER store secrets in frontend code"
      - "Implement Content Security Policy"
      - "Use HTTPS for all requests"
      - "Sanitize all dynamic content"
      - "No inline scripts or styles"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - filesystem_list
      - code_execute  # Sandboxed
      - code_lint
      - code_format
      - code_test
      - git_operations
      - update_activity
      
  backend_developer:
    security_level: "internal"
    requirements:
      - "Use parameterized queries (prevent SQL injection)"
      - "Implement authentication properly (bcrypt, JWT)"
      - "Implement authorization (RBAC)"
      - "Encrypt sensitive data at rest"
      - "Implement rate limiting"
      - "Add audit logging for sensitive operations"
      - "Validate ALL inputs server-side"
      - "Handle errors securely (no stack traces in responses)"
      - "Use secure session management"
      - "Implement proper CORS policies"
      - "Use environment variables for config"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - filesystem_list
      - code_execute  # Sandboxed
      - code_lint
      - code_format
      - code_test
      - database_query
      - git_operations
      - update_activity
      
  tester:
    security_level: "internal"
    requirements:
      - "Include security test cases"
      - "Test OWASP Top 10 vulnerabilities"
      - "Test authentication/authorization"
      - "Test input validation boundaries"
      - "Test rate limiting"
      - "Verify encryption"
      - "Test for information disclosure"
      - "Never use production data in tests"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - code_execute  # Sandboxed
      - code_test
      - git_operations
      - update_activity
      
  bug_fixer:
    security_level: "internal"
    requirements:
      - "Prioritize security vulnerabilities as critical"
      - "Never introduce new vulnerabilities in fixes"
      - "Verify fix doesn't break security tests"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - code_execute  # Sandboxed
      - code_lint
      - code_test
      - git_operations
      - update_activity
      
  reviewer:
    security_level: "internal"
    requirements:
      - "Check for hardcoded secrets"
      - "Verify security controls implemented"
      - "Check for common vulnerabilities (OWASP)"
      - "Verify audit logging"
      - "Check for proper error handling"
      - "Verify input validation"
      - "Check authorization on all endpoints"
      - "Verify encryption usage"
    tools_allowed:
      - filesystem_read
      - filesystem_list
      - filesystem_search
      - code_lint
      - code_test
      - git_diff
      - git_log
      - secret_scan
      - security_check
      - compliance_check
      - update_activity
      
  git_agent:
    security_level: "internal"
    requirements:
      - "Scan for secrets before EVERY commit"
      - "Verify .gitignore includes sensitive files"
      - "Block commits with detected secrets"
      - "Sign commits for integrity"
      - "Enforce branch protection rules"
      - "Never push to protected branches directly"
    tools_allowed:
      - git_operations  # Full git access
      - filesystem_read
      - secret_scan
      - update_activity
      
  compliance_agent:
    security_level: "restricted"
    requirements:
      - "Monitor all activities for compliance"
      - "Generate compliance reports"
      - "Track control implementation status"
      - "Validate data handling practices"
      - "Alert on compliance violations"
      - "Maintain audit trail integrity"
    tools_allowed:
      - audit_log_query
      - audit_log_write
      - compliance_check
      - report_generate
      - control_status_check
      - vulnerability_scan
      - data_flow_analyze
      - access_review_trigger
      - encryption_verify
      - secret_scan
      - filesystem_read  # Read-only
      
  project_analyzer:
    security_level: "internal"
    requirements:
      - "Perform security audit of imported code"
      - "Identify potential vulnerabilities"
      - "Detect compliance gaps"
      - "Identify hardcoded secrets"
      - "Analyze dependencies for vulnerabilities"
      - "Never modify source code during analysis"
    tools_allowed:
      - filesystem_read  # Read-only
      - filesystem_list
      - code_lint
      - secret_scan
      - dependency_audit
      - license_check
      - update_activity
      
  merge_conflict_resolver:
    security_level: "internal"
    requirements:
      - "Preserve security-related code during merges"
      - "Never resolve by removing security checks"
      - "Verify merged code passes security tests"
    tools_allowed:
      - filesystem_read
      - filesystem_write
      - git_operations
      - code_test
      - update_activity
```

---

## 6. Tools Architecture with Security Controls (HIGH PRIORITY)

**Gap:** The blueprint didn't detail security controls on each tool.

```yaml
tools_security_architecture:

  filesystem_read:
    description: "Read file contents"
    parameters:
      path: string
    security:
      audit_log: true
      allowed_paths:
        - "projects/${project_id}/**"
        - "orchestrator-data/projects/${project_id}/**"
      denied_paths:
        - "**/.env"
        - "**/.env.*"
        - "**/secrets/**"
        - "**/vault.*"
        - "**/*.pem"
        - "**/*.key"
      sensitive_file_warning: true
      max_file_size_mb: 50
      
  filesystem_write:
    description: "Write content to file"
    parameters:
      path: string
      content: string
      mode: "create" | "overwrite" | "append"
    security:
      pre_write_scan: true           # Scan for secrets
      block_on_secret: true          # Block if secret detected
      audit_log: true
      allowed_paths:
        - "projects/${project_id}/**"
        - "orchestrator-data/projects/${project_id}/**"
      denied_paths:
        - "system/**"
        - "**/.env"
        - "**/.env.*"
        - "**/secrets/**"
        - "**/vault.*"
        - "orchestrator-system/**"   # Platform code
      backup_before_overwrite: true
      max_file_size_mb: 10
      
  filesystem_delete:
    description: "Delete a file"
    parameters:
      path: string
    security:
      audit_log: true
      confirmation_required: true
      allowed_paths:
        - "projects/${project_id}/**"
        - "orchestrator-data/projects/${project_id}/**"
      denied_paths:
        - "**/.git/**"
        - "**/.orchestrator/**"
        - "**/compliance/**"
      backup_before_delete: true
      
  code_execute:
    description: "Execute code in sandboxed environment"
    parameters:
      language: string
      code: string
      timeout_ms: number
    security:
      sandbox: true                  # ALWAYS sandboxed
      network_disabled: true         # No network by default
      filesystem_restricted: true    # Limited filesystem
      resource_limits:
        memory_mb: 512
        cpu_seconds: 30
        processes: 10
        file_descriptors: 100
      audit_log: true
      block_dangerous_imports:
        python:
          - "os.system"
          - "subprocess"
          - "socket"
          - "requests"
        javascript:
          - "child_process"
          - "fs"
          - "net"
      allowed_network_override: false  # Cannot be overridden
      
  database_query:
    description: "Execute database query"
    parameters:
      connection: string
      query: string
      params: array
    security:
      parameterized_only: true       # MUST use parameterized queries
      readonly_default: true         # Read-only unless explicit
      audit_log: true
      query_timeout_ms: 30000
      result_limit: 10000
      blocked_operations:
        - "DROP"
        - "TRUNCATE"
        - "ALTER"
        - "GRANT"
        - "REVOKE"
      sensitive_columns_redact: true  # Redact PII in logs
      
  git_commit:
    description: "Create a git commit"
    parameters:
      files: string[]
      message: string
    security:
      pre_commit_secret_scan: true   # ALWAYS scan
      block_on_secret: true          # ALWAYS block
      audit_log: true
      require_signed_commits: true   # In production
      blocked_file_patterns:
        - "**/.env"
        - "**/*.pem"
        - "**/*.key"
        - "**/secrets.*"
        
  git_push:
    description: "Push commits to remote"
    parameters:
      remote: string
      branch: string
    security:
      audit_log: true
      protected_branch_check: true
      require_ci_pass: true          # In production
      
  external_api_call:
    description: "Call external API"
    parameters:
      url: string
      method: string
      headers: object
      body: object
    security:
      audit_log: true
      allowed_domains:
        - "api.anthropic.com"
        - "api.openai.com"
        # Add approved domains
      blocked_domains:
        - "*.internal"
        - "localhost"
        - "127.0.0.1"
      header_sanitization: true      # Remove sensitive headers from logs
      body_sanitization: true        # Remove sensitive data from logs
      rate_limit:
        requests_per_minute: 60
        
  secret_scan:
    description: "Scan content for secrets"
    parameters:
      content: string
      type: "code" | "file" | "response"
    security:
      audit_log: true                # Log that scan occurred, not results
      patterns_version: string       # Track pattern version
      
  web_search:
    description: "Search the web"
    parameters:
      query: string
    security:
      audit_log: true
      query_sanitization: true       # Remove sensitive terms
      blocked_terms:
        - project secrets
        - api keys
        - passwords
```

---

## 7. Git Worktrees for Parallel Agent Work (HIGH PRIORITY)

**Gap:** Brief mention but not detailed worktree management.

```yaml
git_worktrees_architecture:
  
  description: |
    Git worktrees allow multiple agents to work on different features
    simultaneously without branch switching overhead. Each agent gets
    an isolated working directory.
    
  directory_structure:
    workspace/
      worktrees/
        {project_id}/
          feature-auth-system/      # Agent A working here
          feature-dashboard/        # Agent B working here
          bugfix-login-error/       # Agent C working here
          
  worktree_lifecycle:
    
    creation:
      trigger: "Task assigned to agent"
      steps:
        - "Create feature branch from main"
        - "Create worktree: git worktree add ../worktrees/{project_id}/{branch} {branch}"
        - "Record worktree in orchestrator state"
        - "Assign worktree to agent"
      naming_convention: "{type}-{feature-slug}"
      examples:
        - "feature-user-authentication"
        - "bugfix-login-validation"
        - "hotfix-security-patch"
        
    agent_assignment:
      rules:
        - "One agent per worktree"
        - "Agent works exclusively in assigned worktree"
        - "Agent cannot access other worktrees"
      isolation:
        filesystem: "Restricted to worktree path"
        git: "Only operations on assigned branch"
        
    completion:
      steps:
        - "Agent completes task"
        - "Run tests in worktree"
        - "If tests pass → merge to integration branch"
        - "Remove worktree: git worktree remove {path}"
        - "Delete feature branch (if merged)"
        - "Update orchestrator state"
        
    conflict_handling:
      detection: "Before merge, check for conflicts"
      resolution: "Spawn Merge Conflict Resolver agent"
      
  parallel_execution_example:
    
    scenario: "Building auth system and dashboard simultaneously"
    
    flow:
      - orchestrator_creates:
          worktree_1:
            path: "worktrees/project-123/feature-auth-system"
            branch: "feature/auth-system"
            assigned_agent: "backend_developer_001"
          worktree_2:
            path: "worktrees/project-123/feature-dashboard"
            branch: "feature/dashboard"
            assigned_agent: "frontend_developer_001"
            
      - agents_work_in_parallel:
          backend_developer_001:
            working_dir: "worktrees/project-123/feature-auth-system"
            task: "Build authentication API"
          frontend_developer_001:
            working_dir: "worktrees/project-123/feature-dashboard"
            task: "Build dashboard UI"
            
      - completion:
          - "backend_developer_001 completes → merge auth-system to integration"
          - "frontend_developer_001 completes → merge dashboard to integration"
          - "Both worktrees removed"
          
  worktree_state_tracking:
    
    schema:
      worktrees:
        - id: "wt-001"
          project_id: "project-123"
          path: "worktrees/project-123/feature-auth"
          branch: "feature/auth-system"
          created_at: "2024-01-15T10:00:00Z"
          assigned_agent_id: "backend_dev_001"
          status: "active"  # active | merging | removing | removed
          task_id: "task-456"
          
  branch_protection:
    
    main:
      allow_direct_push: false
      require_pull_request: true
      require_reviews: 2
      require_ci_pass: true
      require_signed_commits: true
      
    integration:
      allow_direct_push: false
      require_ci_pass: true
      auto_delete_head_branches: true
      
    feature/*:
      allow_force_push: false
      require_secret_scan: true
```

---

## 8. Real-Time Activity System (HIGH PRIORITY)

**Gap:** Not specifically addressed in the blueprint.

```yaml
realtime_activity_system:
  
  description: |
    Provides real-time visibility into orchestrator activity via WebSocket
    streaming. UI can subscribe to activity feeds and receive live updates.
    
  architecture:
    transport: "WebSocket"
    fallback: "Server-Sent Events (SSE)"
    message_format: "JSON"
    
  event_types:
    
    # Agent events
    agent.spawned:
      payload:
        agent_id: string
        agent_type: string
        task_id: string
        timestamp: string
        
    agent.thinking:
      payload:
        agent_id: string
        chunk: string         # Streaming thinking
        chunk_index: number
        
    agent.response:
      payload:
        agent_id: string
        chunk: string         # Streaming response
        chunk_index: number
        
    agent.completed:
      payload:
        agent_id: string
        status: string
        duration_ms: number
        tokens_used: number
        
    agent.error:
      payload:
        agent_id: string
        error: string
        recoverable: boolean
        
    # Task events
    task.created:
      payload:
        task_id: string
        title: string
        type: string
        priority: string
        
    task.started:
      payload:
        task_id: string
        agent_id: string
        
    task.progress:
      payload:
        task_id: string
        progress_percent: number
        current_step: string
        
    task.completed:
      payload:
        task_id: string
        status: string
        
    # Workflow events
    design.submitted:
      payload:
        design_id: string
        mockup_path: string
        
    design.approved:
      payload:
        design_id: string
        approved_by: string
        
    build.started:
      payload:
        feature_id: string
        
    test.running:
      payload:
        test_suite: string
        current_test: string
        passed: number
        failed: number
        
    review.complete:
      payload:
        review_id: string
        approved: boolean
        
    # Git events
    git.commit:
      payload:
        commit_hash: string
        message: string
        branch: string
        
    git.merge:
      payload:
        from_branch: string
        to_branch: string
        
    git.conflict:
      payload:
        files: string[]
        
    # Compliance events
    compliance.violation:
      payload:
        rule_id: string
        severity: string
        
    secret.detected:
      payload:
        type: string
        location: string
        blocked: boolean
        
    # Orchestrator events
    orchestrator.decision:
      payload:
        decision_type: string
        reasoning: string
        next_action: string
        
    orchestrator.escalation:
      payload:
        reason: string
        requires_user_input: boolean
        
  subscription_model:
    
    channels:
      project.{project_id}:
        events: ["all events for this project"]
        
      agent.{agent_id}:
        events: ["all events for this agent"]
        
      task.{task_id}:
        events: ["all events for this task"]
        
      compliance:
        events: ["all compliance events"]
        
    filters:
      by_event_type: ["agent.spawned", "task.completed"]
      by_severity: ["critical", "high"]
      by_agent_type: ["backend_developer", "tester"]
      
  activity_feed_ui:
    
    features:
      - "Live streaming of events"
      - "Filter by event type"
      - "Filter by agent"
      - "Filter by task"
      - "Search within events"
      - "Auto-follow mode (scroll to latest)"
      - "Pause/resume stream"
      - "Event details on click"
      - "Link to related resources"
      
    display_format:
      timestamp: "HH:mm:ss"
      agent_badge: "colored by agent type"
      status_icon: "✓ ✗ ⚠ ⏳"
      expandable_details: true
      
  persistence:
    
    hot_storage:
      type: "Redis Streams"
      retention: "24 hours"
      max_length: 100000
      
    warm_storage:
      type: "PostgreSQL"
      retention: "30 days"
      
    cold_storage:
      type: "S3"
      retention: "1 year"
      format: "JSONL compressed"
```

---

## 9. Complete Lesson Scoring Algorithm (MEDIUM PRIORITY)

**Gap:** The blueprint mentioned learning but not the specific scoring formula.

```yaml
lesson_scoring_system:
  
  scoring_dimensions:
    
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
    review: 2.5          # Score 2.5-3.5: flag for human review
    discard: 2.5         # Score < 2.5: discard
    
  formula: |
    final_score = (
      impact * 0.30 +
      generalizability * 0.25 +
      actionability * 0.20 +
      novelty * 0.15 +
      recurrence_potential * 0.10
    ) * category_multiplier * recency_factor
    
  category_multipliers:
    security: 2.0        # Security lessons always valuable
    compliance: 2.0      # Compliance lessons prevent issues
    secrets_exposure: 2.5  # Critical - any exposure lesson matters
    vulnerability: 2.0   # Prevent exploits
    performance: 1.2     # Performance improvements valuable
    code_quality: 1.0    # Standard multiplier
    documentation: 0.8   # Less critical
    
  recency_factor: |
    # Lessons decay over time if not used
    recency_factor = exp(-0.5 * days_since_created / 30)
    # 30-day half-life
    
  auto_commit_triggers:
    # These bypass scoring and auto-commit
    - category: "security"
      min_impact: 3
      reason: "Security lessons are always valuable"
      
    - category: "compliance"
      min_impact: 2
      reason: "Compliance lessons prevent regulatory issues"
      
    - category: "secrets_exposure"
      min_impact: 1
      reason: "Any secret exposure lesson is critical"
      
    - category: "vulnerability"
      min_impact: 2
      reason: "Vulnerability lessons prevent exploits"
      
  usage_boost: |
    # Lessons that get used are more valuable
    # Boost score when lesson is successfully applied
    usage_boost = min(2.0, 1.0 + log(usage_count + 1) * 0.2)
    
  deduplication:
    method: "semantic_similarity"
    threshold: 0.85
    action: "merge_with_existing"
    
  lesson_schema:
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
    score_breakdown:
      impact: number
      generalizability: number
      actionability: number
      novelty: number
      recurrence_potential: number
    usage_count: number
    last_used: timestamp
    embedding: vector
```

---

## 10. Secret Detection Patterns Library (MEDIUM PRIORITY)

**Gap:** Secret scanning mentioned but not the comprehensive pattern library.

```yaml
secret_detection_patterns:
  
  # ═══════════════════════════════════════════════════════════════════
  # CLOUD PROVIDER KEYS
  # ═══════════════════════════════════════════════════════════════════
  
  cloud_providers:
    
    - name: "AWS Access Key ID"
      pattern: "AKIA[0-9A-Z]{16}"
      severity: "critical"
      
    - name: "AWS Secret Access Key"
      pattern: "[0-9a-zA-Z/+]{40}"
      context: "aws_secret|secret_access_key"
      severity: "critical"
      
    - name: "AWS Session Token"
      pattern: "FwoGZXIvYXdzE[0-9a-zA-Z/+=]+"
      severity: "critical"
      
    - name: "Google Cloud API Key"
      pattern: "AIza[0-9A-Za-z-_]{35}"
      severity: "critical"
      
    - name: "Google Cloud Service Account"
      pattern: '"type":\\s*"service_account"'
      severity: "critical"
      
    - name: "Azure Storage Key"
      pattern: "[a-zA-Z0-9/+=]{86}=="
      context: "azure|storage|account"
      severity: "critical"
      
    - name: "Azure Connection String"
      pattern: "DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+"
      severity: "critical"
      
  # ═══════════════════════════════════════════════════════════════════
  # API KEYS
  # ═══════════════════════════════════════════════════════════════════
  
  api_keys:
    
    - name: "Anthropic API Key"
      pattern: "sk-ant-[a-zA-Z0-9-]{40,}"
      severity: "critical"
      
    - name: "OpenAI API Key"
      pattern: "sk-[a-zA-Z0-9]{48}"
      severity: "critical"
      
    - name: "GitHub Personal Access Token"
      pattern: "ghp_[0-9a-zA-Z]{36}"
      severity: "critical"
      
    - name: "GitHub OAuth Token"
      pattern: "gho_[0-9a-zA-Z]{36}"
      severity: "critical"
      
    - name: "GitLab Personal Access Token"
      pattern: "glpat-[0-9a-zA-Z-]{20}"
      severity: "critical"
      
    - name: "Stripe Live Secret Key"
      pattern: "sk_live_[0-9a-zA-Z]{24,}"
      severity: "critical"
      
    - name: "Stripe Live Publishable Key"
      pattern: "pk_live_[0-9a-zA-Z]{24,}"
      severity: "high"
      
    - name: "Stripe Restricted Key"
      pattern: "rk_live_[0-9a-zA-Z]{24,}"
      severity: "critical"
      
    - name: "Twilio Account SID"
      pattern: "AC[a-z0-9]{32}"
      severity: "high"
      
    - name: "Twilio Auth Token"
      pattern: "[a-f0-9]{32}"
      context: "twilio|auth_token"
      severity: "critical"
      
    - name: "SendGrid API Key"
      pattern: "SG\\.[a-zA-Z0-9-_]{22}\\.[a-zA-Z0-9-_]{43}"
      severity: "critical"
      
    - name: "Mailchimp API Key"
      pattern: "[a-f0-9]{32}-us[0-9]{1,2}"
      severity: "critical"
      
    - name: "Slack Bot Token"
      pattern: "xoxb-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24}"
      severity: "critical"
      
    - name: "Slack User Token"
      pattern: "xoxp-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{32}"
      severity: "critical"
      
    - name: "Slack Webhook URL"
      pattern: "https://hooks\\.slack\\.com/services/T[a-zA-Z0-9]+/B[a-zA-Z0-9]+/[a-zA-Z0-9]+"
      severity: "high"
      
  # ═══════════════════════════════════════════════════════════════════
  # DATABASE CREDENTIALS
  # ═══════════════════════════════════════════════════════════════════
  
  database:
    
    - name: "PostgreSQL Connection URL"
      pattern: "postgres(ql)?://[^:]+:[^@]+@[^/]+/[^\\s]+"
      severity: "critical"
      
    - name: "MySQL Connection URL"
      pattern: "mysql://[^:]+:[^@]+@[^/]+/[^\\s]+"
      severity: "critical"
      
    - name: "MongoDB Connection URL"
      pattern: "mongodb(\\+srv)?://[^:]+:[^@]+@[^/]+(/[^\\s]*)?"
      severity: "critical"
      
    - name: "Redis Connection URL"
      pattern: "redis://:[^@]+@[^/]+(/[0-9]+)?"
      severity: "critical"
      
  # ═══════════════════════════════════════════════════════════════════
  # PRIVATE KEYS
  # ═══════════════════════════════════════════════════════════════════
  
  private_keys:
    
    - name: "RSA Private Key"
      pattern: "-----BEGIN RSA PRIVATE KEY-----"
      severity: "critical"
      
    - name: "DSA Private Key"
      pattern: "-----BEGIN DSA PRIVATE KEY-----"
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
      
    - name: "PKCS8 Private Key"
      pattern: "-----BEGIN PRIVATE KEY-----"
      severity: "critical"
      
    - name: "PKCS8 Encrypted Private Key"
      pattern: "-----BEGIN ENCRYPTED PRIVATE KEY-----"
      severity: "critical"
      
  # ═══════════════════════════════════════════════════════════════════
  # GENERIC PATTERNS
  # ═══════════════════════════════════════════════════════════════════
  
  generic:
    
    - name: "Generic API Key Assignment"
      pattern: "(api[_-]?key|apikey)['\"]?\\s*[:=]\\s*['\"][a-zA-Z0-9_-]{20,}['\"]"
      severity: "high"
      case_insensitive: true
      
    - name: "Generic Secret Assignment"
      pattern: "(secret|password|passwd|pwd|token)['\"]?\\s*[:=]\\s*['\"][^'\"]{8,}['\"]"
      severity: "high"
      case_insensitive: true
      
    - name: "Generic Private Key Assignment"
      pattern: "(private[_-]?key)['\"]?\\s*[:=]\\s*['\"][^'\"]+['\"]"
      severity: "high"
      case_insensitive: true
      
    - name: "Bearer Token"
      pattern: "[Bb]earer\\s+[a-zA-Z0-9._-]{20,}"
      severity: "high"
      
    - name: "JWT Token"
      pattern: "eyJ[a-zA-Z0-9_-]*\\.eyJ[a-zA-Z0-9_-]*\\.[a-zA-Z0-9_-]*"
      severity: "high"
      
    - name: "Basic Auth Header"
      pattern: "[Bb]asic\\s+[a-zA-Z0-9+/=]{20,}"
      severity: "high"
      
  # ═══════════════════════════════════════════════════════════════════
  # HIGH ENTROPY STRINGS
  # ═══════════════════════════════════════════════════════════════════
  
  high_entropy:
    
    - name: "High Entropy String (Hex)"
      pattern: "[a-f0-9]{32,}"
      entropy_threshold: 3.5
      context_required: "key|secret|token|password"
      severity: "medium"
      
    - name: "High Entropy String (Base64)"
      pattern: "[A-Za-z0-9+/=]{40,}"
      entropy_threshold: 4.0
      severity: "medium"
      
  # ═══════════════════════════════════════════════════════════════════
  # FALSE POSITIVE EXCLUSIONS
  # ═══════════════════════════════════════════════════════════════════
  
  exclusions:
    
    - pattern: "AKIA[A-Z0-9]{16}"
      exclude_if_context: "example|test|sample|placeholder"
      
    - pattern: "sk-[a-zA-Z0-9]{48}"
      exclude_if_value: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
      
    - pattern: ".*"
      exclude_in_files:
        - "**/*.md"
        - "**/README*"
        - "**/*.example"
        - "**/test/**"
        - "**/__tests__/**"
```

---

## 11. Context Priming System (FROM SECOND RESEARCH)

**Gap:** The second research covered this but should be integrated into the main blueprint.

```yaml
context_priming_architecture:
  
  description: |
    Context priming ensures each agent receives ONLY the context it needs,
    not everything available. This prevents context window exhaustion and
    improves agent focus.
    
  principles:
    - "Agents receive curated context, not raw dumps"
    - "Context is tailored per agent type"
    - "Smart summarization, not truncation"
    - "Context bundles enable recovery"
    
  agent_context_profiles:
    
    orchestrator:
      required_context:
        - project_state            # Current workflow state
        - active_tasks             # All in-progress tasks
        - agent_statuses           # What each agent is doing
        - recent_decisions         # Last 5 routing decisions
        - pending_approvals        # Items awaiting user input
      optional_context:
        - error_history            # Recent errors
        - performance_metrics      # Token usage, costs
      max_tokens: 30000
      
    project_manager:
      required_context:
        - project_requirements     # User's original request
        - architecture_summary     # High-level architecture
        - existing_epics           # Current plan structure
        - completed_tasks          # What's been done
      optional_context:
        - user_preferences         # Communication style
        - compliance_requirements  # If any
      max_tokens: 40000
      
    ui_designer:
      required_context:
        - feature_requirements     # What to design
        - existing_designs         # Reference designs
        - styleguide               # Design tokens, components
        - user_flow_context        # Where this fits in UX
      optional_context:
        - brand_guidelines
        - accessibility_requirements
      max_tokens: 35000
      
    frontend_developer:
      required_context:
        - approved_design          # Mockup to implement
        - api_specification        # Available endpoints
        - component_library        # Existing components
        - coding_standards         # Style guide
        - architecture_frontend    # Frontend architecture
      optional_context:
        - test_patterns            # How to write tests
        - performance_requirements
      max_tokens: 50000
      
    backend_developer:
      required_context:
        - api_specification        # What to build
        - database_schema          # Current schema
        - architecture_backend     # Backend architecture
        - coding_standards
        - security_requirements    # Auth, encryption, etc.
      optional_context:
        - performance_requirements
        - scaling_considerations
      max_tokens: 50000
      
    tester:
      required_context:
        - test_targets             # Files/features to test
        - acceptance_criteria      # What to verify
        - existing_tests           # Current test patterns
        - api_specification        # For API tests
      optional_context:
        - security_test_patterns
        - performance_benchmarks
      max_tokens: 40000
      
    bug_fixer:
      required_context:
        - failure_details          # Exact error, stack trace
        - failed_test_code         # The failing test
        - source_file_content      # The buggy code
        - recent_changes           # Git diff
        - previous_fix_attempts    # What didn't work
      optional_context:
        - related_tests
        - architecture_context
      max_tokens: 45000
      
    reviewer:
      required_context:
        - files_to_review          # Changed files
        - git_diff                 # What changed
        - coding_standards
        - security_checklist
        - acceptance_criteria
      optional_context:
        - architecture_context
        - previous_reviews         # Pattern recognition
      max_tokens: 50000
      
  context_bundle_schema:
    
    bundle_id: string
    version: "1.0.0"
    created_at: timestamp
    agent_type: string
    task_id: string
    
    # Context sections
    sections:
      - name: string
        type: "required" | "optional"
        content: string
        token_count: number
        source: string           # Where this came from
        freshness: timestamp     # When this was gathered
        
    # For recovery
    checkpoint:
      state_hash: string
      can_resume_from: boolean
      
    # Audit trail
    audit:
      context_sources: string[]
      sensitive_data_present: boolean
      pii_redacted: boolean
      
  context_retrieval_strategies:
    
    just_in_time:
      description: "Load context only when needed via tool calls"
      use_when: "Large knowledge base, uncertain relevance"
      latency: "Higher (per retrieval)"
      
    pre_loading:
      description: "Load all anticipated context upfront"
      use_when: "Focused tasks, predictable needs"
      latency: "Lower (after initial load)"
      
    hybrid:
      description: "Pre-load essential (20%), JIT for rest"
      use_when: "Most production scenarios"
      recommended: true
      
  relevance_scoring:
    
    formula: |
      relevance_score = (
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

## 12. Standardized Prompt Hierarchy (FROM SECOND RESEARCH)

**Gap:** The blueprint had 4-level hierarchy; the research expanded to 18 layers.

```yaml
prompt_hierarchy_18_layer:
  
  description: |
    A comprehensive 18-layer prompt architecture for consistent agent behavior.
    Layers can be composed, versioned, and selectively activated.
    
  layers:
    
    # ═══════════════════════════════════════════════════════════════════
    # IDENTITY LAYER (1-3) - Rarely changes
    # ═══════════════════════════════════════════════════════════════════
    
    1_system_purpose:
      description: "Overall system identity and purpose"
      scope: "system"
      example: |
        You are part of Aigentflow, an enterprise multi-agent orchestrator
        system for building full-stack applications. You work collaboratively
        with other specialized agents under orchestrator coordination.
        
    2_agent_goals:
      description: "This agent's specific goals and mission"
      scope: "agent"
      example: |
        Your goal is to create high-quality, accessible UI mockups that
        translate user requirements into visual designs. You optimize for
        user experience, consistency, and implementability.
        
    3_role_specialization:
      description: "Agent's role and expertise area"
      scope: "agent"
      example: |
        You are a UI Designer agent specializing in creating mockups for
        web and mobile applications. You understand design systems, component
        libraries, and responsive design patterns.
        
    # ═══════════════════════════════════════════════════════════════════
    # OPERATIONAL LAYER (4-6) - Changes by task type
    # ═══════════════════════════════════════════════════════════════════
    
    4_workflow_instructions:
      description: "Step-by-step workflow for this task type"
      scope: "task_type"
      example: |
        For creating a new feature mockup:
        1. Analyze the feature requirements
        2. Review existing designs for consistency
        3. Create wireframe layout
        4. Apply design tokens and styling
        5. Add all interaction states (hover, active, disabled, error)
        6. Verify accessibility compliance
        7. Submit for approval
        
    5_output_format:
      description: "How to structure outputs"
      scope: "task_type"
      example: |
        Return your response as JSON:
        {
          "status": "completed",
          "mockup_path": "designs/feature-name/v1.html",
          "design_decisions": [...],
          "accessibility_notes": [...],
          "routing_hints": { "needs_user_approval": true }
        }
        
    6_behavioral_instructions:
      description: "Specific behavioral rules"
      scope: "task_type"
      example: |
        - Never use real user data in mockups
        - Always include error and empty states
        - Design mobile-first, then scale up
        - Use only approved design tokens
        
    # ═══════════════════════════════════════════════════════════════════
    # CONTEXT LAYER (7-9) - Changes frequently
    # ═══════════════════════════════════════════════════════════════════
    
    7_project_metadata:
      description: "Project-specific information"
      scope: "project"
      injected_fields:
        - project_name
        - project_type
        - target_platforms
        - compliance_requirements
        
    8_codebase_structure:
      description: "Project structure awareness"
      scope: "project"
      injected_fields:
        - directory_tree
        - key_files
        - technology_stack
        
    9_relevant_files:
      description: "Files relevant to current task"
      scope: "task"
      injected_fields:
        - file_contents
        - related_components
        - dependencies
        
    # ═══════════════════════════════════════════════════════════════════
    # REASONING LAYER (10-13) - Enables decision making
    # ═══════════════════════════════════════════════════════════════════
    
    10_control_flow:
      description: "Decision-making guidelines"
      scope: "agent"
      example: |
        Decision points:
        - If requirements are ambiguous → Request clarification via routing_hints
        - If conflicts with existing design → Escalate to human
        - If accessibility cannot be achieved → Document limitation
        
    11_variables:
      description: "Dynamic variable injection"
      scope: "task"
      injected_fields:
        - task_id
        - timestamp
        - user_id
        - previous_attempt_count
        
    12_examples:
      description: "Few-shot examples for the task"
      scope: "task_type"
      example: |
        Example good mockup structure:
        <example>
        Input: "Login page with email and password"
        Output: mockup with form, validation states, forgot password link,
                social login options, responsive breakpoints
        </example>
        
    13_delegate_prompt:
      description: "Instructions for delegating to other agents"
      scope: "agent"
      example: |
        If you need information you don't have:
        - Technical architecture questions → Request Architect consultation
        - Implementation details → Note in handoff for developers
        - Research needed → Request Analyst support
        
    # ═══════════════════════════════════════════════════════════════════
    # META LAYER (14-18) - Advanced behaviors
    # ═══════════════════════════════════════════════════════════════════
    
    14_expertise_injection:
      description: "Domain expertise context"
      scope: "task"
      injected_fields:
        - relevant_lessons
        - best_practices
        - anti_patterns
        
    15_higher_order:
      description: "Meta-instructions about prompting"
      scope: "agent"
      example: |
        Approach this task methodically:
        1. First, understand the full scope before starting
        2. Think step by step through your approach
        3. Consider edge cases and error states
        4. Validate your output before submitting
        
    16_template_usage:
      description: "How to use templates"
      scope: "agent"
      example: |
        You have access to design templates in /templates/designs/.
        Use these as starting points, customizing for the specific feature.
        
    17_self_improving:
      description: "Learning and adaptation instructions"
      scope: "agent"
      example: |
        After completing this task:
        - Note any patterns that worked well
        - Identify any challenges or blockers
        - Suggest improvements for future similar tasks
        Record these in your observations field.
        
    18_template_structure:
      description: "Actual output template structure"
      scope: "task_type"
      example: |
        Your response MUST follow this structure:
        {
          "status": "...",
          "agent_type": "ui_designer",
          "task_id": "${task_id}",
          "data": { ... },
          "routing_hints": { ... },
          "audit": { ... },
          "observations": { ... }
        }
        
  composition_patterns:
    
    sequential:
      description: "Chain layers in order"
      pattern: "[1] → [2] → [3] → ... → [18]"
      
    hierarchical:
      description: "Nest with increasing specificity"
      pattern: "System → Agent → Task → Context"
      
    conditional:
      description: "Activate layers based on task"
      pattern: "If complex task → include [15] chain-of-thought"
      
  token_allocation:
    system_prompt: 5000        # 5% - identity layers
    tools: 10000               # 10% - capabilities
    examples: 15000            # 15% - few-shot
    context: 50000             # 50% - RAG + project
    message_history: 15000     # 15% - conversation
    buffer: 5000               # 5% - response space
```

---

## Summary

This addendum addresses all critical and high-priority gaps identified in the Blueprint Comparison Report:

| Gap | Status |
|-----|--------|
| 1. Design-First Workflow | ✅ Complete |
| 2. Overlay Pattern | ✅ Complete |
| 3. Workspace Directory Structure | ✅ Complete |
| 4. Complete Hooks Architecture | ✅ Complete |
| 5. Agent Security Matrix | ✅ Complete |
| 6. Tools Security Controls | ✅ Complete |
| 7. Git Worktrees Architecture | ✅ Complete |
| 8. Real-Time Activity System | ✅ Complete |
| 9. Lesson Scoring Algorithm | ✅ Complete |
| 10. Secret Detection Patterns | ✅ Complete |
| 11. Context Priming System | ✅ Complete |
| 12. 18-Layer Prompt Hierarchy | ✅ Complete |

This document should be read alongside the main Aigentflow Architecture Blueprint to provide a complete implementation reference.
