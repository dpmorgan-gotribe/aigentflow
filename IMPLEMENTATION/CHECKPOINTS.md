# Checkpoint Validation Criteria

> This document defines the acceptance criteria for each checkpoint.
> A checkpoint is only complete when ALL criteria pass.

---

## CP0: Foundation

**Steps:** 01-04b (7 steps)
**Tag:** `cp0-foundation`

### Validation Checklist

```
□ Project Structure
  □ npm install completes without errors
  □ npm run build compiles TypeScript successfully
  □ npm run lint passes with no errors
  □ Folder structure matches specification

□ CLI Commands
  □ aigentflow --version shows version number
  □ aigentflow --help lists all commands
  □ aigentflow init <name> creates project folder
  □ aigentflow status shows "No active project"
  □ aigentflow config shows current configuration

□ State Machine
  □ All workflow states defined
  □ Valid transitions work
  □ Invalid transitions rejected with error
  □ State recovery from crash works
  □ Checkpoint creation works

□ Prompt Architecture (NEW)
  □ 18 prompt layers defined
  □ Token allocator respects layer budgets
  □ Prompt composer assembles layers correctly
  □ Prompt registry loads all templates
  □ Layer priority ordering works

□ Persistence
  □ SQLite database created on first run
  □ State persists across CLI restarts
  □ Audit log captures all operations
  □ Secrets never written to database

□ Hooks & Guardrails (NEW)
  □ Hook manager loads hook definitions
  □ Pre/post hooks execute at correct points
  □ Guardrail validation blocks bad inputs
  □ Secret detection prevents credential leaks
  □ Code security scan runs on file writes
  □ Built-in hooks work (secret-detection, code-scan, audit-log)

□ CLAUDE.md Generator (NEW)
  □ Project analyzer detects tech stack
  □ Framework detection works (React, Vue, Express, etc.)
  □ CLAUDE.md file generated with correct sections
  □ File patterns match project structure
  □ Build commands detected correctly
```

### Automated Test Suite

```bash
# Run all CP0 tests
npm run test:cp0

# Expected output:
# ✓ Project structure valid (3 tests)
# ✓ CLI commands work (5 tests)
# ✓ State machine transitions (8 tests)
# ✓ Prompt architecture (12 tests)
# ✓ Persistence layer (6 tests)
# ✓ Hooks and guardrails (15 tests)
# ✓ CLAUDE.md generator (10 tests)
#
# Total: 59 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP0 Manual Validation

echo "=== CP0: Foundation Validation ==="

# 1. Build check
echo "1. Build check..."
npm run build || exit 1
echo "   ✓ Build passed"

# 2. CLI check
echo "2. CLI check..."
./bin/aigentflow --version || exit 1
echo "   ✓ CLI responds"

# 3. Init check
echo "3. Init check..."
./bin/aigentflow init test-project-cp0
[ -d "projects/test-project-cp0" ] || exit 1
echo "   ✓ Project created"

# 4. CLAUDE.md generation check
echo "4. CLAUDE.md check..."
[ -f "projects/test-project-cp0/CLAUDE.md" ] || exit 1
echo "   ✓ CLAUDE.md generated"

# 5. State persistence check
echo "5. State persistence..."
[ -f "orchestrator-data/aigentflow.db" ] || exit 1
echo "   ✓ Database exists"

# 6. Hook execution check
echo "6. Hook execution..."
./bin/aigentflow hooks list
echo "   ✓ Hooks loaded"

# Cleanup
rm -rf projects/test-project-cp0

echo ""
echo "=== CP0 PASSED ==="
```

---

## CP1: Design System

**Steps:** 05-08 (12 steps including sub-steps)
**Tag:** `cp1-design-system`

### Validation Checklist

```
□ Agent Framework
  □ BaseAgent class implemented
  □ Agent registry loads all 14 agents
  □ Context manager provides curated context
  □ Structured JSON output validated
  □ Routing hints included in outputs

□ Orchestrator Agent (NEW)
  □ Decision engine implements 85% rules / 15% AI
  □ Routing rules execute in priority order
  □ Security concerns trigger compliance agent
  □ Failure routing works (test failures → bug fixer)
  □ Output synthesis combines agent results
  □ Session management tracks context

□ Project Manager Agent (NEW)
  □ Work breakdown structure generated (Epic → Feature → Task)
  □ Dependency graph built correctly
  □ Cycle detection prevents circular dependencies
  □ Topological sort produces valid order
  □ Critical path identified
  □ Agent assignment based on task type

□ Architect Agent (NEW)
  □ Tech stack recommendations generated
  □ ADR (Architecture Decision Records) created
  □ Architecture artifacts produced
  □ Multiple options presented with rationale
  □ Confidence levels included

□ Analyst Agent (NEW)
  □ Research reports generated
  □ Best practices documented with sources
  □ Comparison reports with pros/cons
  □ Recommendations include confidence levels
  □ Source citations included

□ Project Analyzer Agent (NEW)
  □ Codebase structure detected
  □ Framework/library detection works
  □ Pattern identification runs
  □ CLAUDE.md generated from analysis
  □ Architecture diagrams produced

□ Compliance Agent (NEW)
  □ Platform compliance rules always active
  □ Project compliance configurable (GDPR, SOC2, HIPAA, PCI-DSS)
  □ Violations detected with severity levels
  □ Remediation guidance provided
  □ Compliance report generated
  □ Blocking violations halt execution

□ UI Designer Agent
  □ Accepts requirements input
  □ Generates HTML mockups
  □ Mockups include all specified components
  □ Responsive design considered
  □ Accessibility attributes present

□ Skills Framework (NEW)
  □ Skill loader loads from built-in, project, external paths
  □ Skill registry indexes by category, agent, tag
  □ Skill selection respects token budget
  □ Skill conflicts detected and resolved
  □ Skill injection formats (markdown, XML, plain)
  □ Built-in skill packs: coding, testing, security

□ MCP Server Config (NEW)
  □ Server configs load from JSON files
  □ Stdio transport connects correctly
  □ HTTP transport connects correctly
  □ Tool router discovers available tools
  □ Tool calls routed to correct servers
  □ Built-in configs: filesystem, git, terminal, github, memory, web

□ Design Tokens
  □ Token schema defined
  □ CSS variables generated from tokens
  □ Component-specific styles created
  □ Dark/light theme variants
  □ Tokens stored in project config

□ User Flows
  □ Flow diagrams generated
  □ State transitions documented
  □ Approval gate pauses execution
  □ User can approve/reject
  □ Rejection triggers redesign loop
```

### Automated Test Suite

```bash
# Run all CP1 tests
npm run test:cp1

# Expected output:
# ✓ Agent framework (10 tests)
# ✓ Orchestrator agent (20 tests)
# ✓ Project manager agent (15 tests)
# ✓ Architect agent (12 tests)
# ✓ Analyst agent (10 tests)
# ✓ Project analyzer agent (12 tests)
# ✓ Compliance agent (18 tests)
# ✓ UI Designer agent (8 tests)
# ✓ Skills framework (15 tests)
# ✓ MCP server config (12 tests)
# ✓ Design token system (6 tests)
# ✓ User flow generation (7 tests)
#
# Total: 145 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP1 Manual Validation

echo "=== CP1: Design System Validation ==="

# 1. Create test project
./bin/aigentflow init design-test
cd projects/design-test

# 2. Verify all agents registered
echo "2. Checking agent registry..."
./bin/aigentflow agents list
# Should show 14 agents

# 3. Test orchestrator decision engine
echo "3. Testing orchestrator..."
./bin/aigentflow test-agent orchestrator --input "security vulnerability found"
# Should route to compliance agent

# 4. Test project manager work breakdown
echo "4. Testing project manager..."
./bin/aigentflow test-agent project-manager --input "Build a todo app"
# Should produce WBS with tasks

# 5. Run design phase
echo "5. Running design generation..."
./bin/aigentflow run "Create a login page with email and password" --stop-at design

# 6. Check outputs
echo "6. Checking outputs..."
[ -f "designs/mockups/login-page.html" ] || exit 1
[ -f "designs/styles/tokens.css" ] || exit 1
[ -f "designs/flows/login-flow.md" ] || exit 1

echo "   ✓ Mockups generated"
echo "   ✓ Styles generated"
echo "   ✓ Flows generated"

# 7. Check skills loaded
echo "7. Checking skills..."
./bin/aigentflow skills list
# Should show coding, testing, security packs

# 8. Check MCP servers
echo "8. Checking MCP servers..."
./bin/aigentflow mcp status
# Should show filesystem, git, memory connected

# 9. Visual inspection
echo ""
echo "9. Manual inspection required:"
echo "   Open: designs/mockups/login-page.html"
echo "   Verify: Form has email and password fields"
echo ""

echo "=== CP1 PASSED (pending manual review) ==="
```

---

## CP2: Git Worktrees

**Steps:** 09-11
**Tag:** `cp2-git-worktrees`

### Worktree Model

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEATURE-BASED WORKTREE MODEL                         │
└─────────────────────────────────────────────────────────────────────────────┘

  Main Repository
  └── main branch
       │
       ├── feature/user-auth (worktree 1)
       │   │
       │   │  DEVELOPMENT PHASE (parallel):
       │   ├── Frontend Agent ──┬── Work in PARALLEL
       │   └── Backend Agent  ──┘
       │   │
       │   │  TESTING PHASE:
       │   ├── Tester Agent ────── Creates e2e tests, runs suite
       │   │
       │   │  FIX LOOP (if tests fail):
       │   ├── Bug Fixer Agent ─── Applies fixes to code
       │   └── Tester Agent ────── Re-runs tests
       │   │
       │   │  REVIEW PHASE:
       │   └── Reviewer Agent ──── Code review (read-only)
       │
       ├── feature/dashboard (worktree 2)
       │   └── ... (same agent workflow)
       │
       └── feature/notifications (worktree 3)
           └── ... (same agent workflow)

  Key Principles:
  • Each FEATURE gets its own worktree (not each developer type)
  • ALL code-modifying agents work within the SAME feature worktree:
    - Frontend + Backend agents work in PARALLEL during development
    - Tester agent creates e2e/integration tests in the worktree
    - Bug Fixer agent applies fixes in the worktree
  • Multiple features can be developed SIMULTANEOUSLY across worktrees
  • Isolation is per-feature, enabling independent feature development
```

### Validation Checklist

```
□ Git Agent
  □ Branch creation works
  □ Branch naming follows convention (feature/<name>)
  □ Worktree creation per feature works
  □ Worktree listing accurate
  □ Worktree cleanup works

□ Feature Worktree Isolation
  □ Each feature has its own worktree
  □ Changes in feature-A worktree don't affect feature-B
  □ Each worktree can build independently
  □ Status shows all active feature worktrees
  □ Multiple features can progress simultaneously

□ Code-Modifying Agents in Worktree
  □ Frontend + Backend agents run in parallel on same worktree
  □ Tester agent creates/modifies tests in worktree
  □ Bug Fixer agent modifies code in worktree
  □ Agents coordinate on shared files (e.g., API contracts)
  □ Lock mechanism prevents conflicting writes
  □ All agents complete before worktree merge

□ Conflict Detection
  □ Overlapping file changes detected across worktrees
  □ Conflict warning before merge to integration
  □ Resolution suggestions provided
  □ Manual resolution workflow works
  □ Merge completes after resolution
```

### Automated Test Suite

```bash
# Run all CP2 tests
npm run test:cp2

# Expected output:
# ✓ Git agent operations (12 tests)
# ✓ Feature worktree isolation (10 tests)
# ✓ Parallel agent execution (8 tests)
# ✓ Conflict detection (10 tests)
#
# Total: 40 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP2 Manual Validation

echo "=== CP2: Git Worktrees Validation ==="

# 1. Create test project with git
./bin/aigentflow init worktree-test
cd projects/worktree-test
git init
git commit --allow-empty -m "Initial commit"

# 2. Create feature worktrees (one per feature, not per agent type)
echo "2. Creating feature worktrees..."
./bin/aigentflow git worktree create feature/user-auth
./bin/aigentflow git worktree create feature/dashboard

# 3. Verify feature isolation
echo "3. Verifying feature isolation..."
[ -d "../worktree-test-feature-user-auth" ] || exit 1
[ -d "../worktree-test-feature-dashboard" ] || exit 1
echo "   ✓ Feature worktrees created"

# 4. Simulate parallel agent work on same feature
echo "4. Testing parallel agents on feature/user-auth..."
cd ../worktree-test-feature-user-auth
# Frontend and backend would work here simultaneously
echo "   ✓ Parallel agent workspace ready"

# 5. Check status shows all features
echo "5. Checking status..."
cd ../worktree-test
./bin/aigentflow status --worktrees
# Should show: feature/user-auth, feature/dashboard

echo ""
echo "=== CP2 PASSED ==="
```

---

## CP3: Build & Test

**Steps:** 12-16
**Tag:** `cp3-build-test`

### Validation Checklist

```
□ Frontend Developer
  □ Components created with tests first
  □ TypeScript types correct
  □ Styling follows design tokens
  □ Accessibility implemented
  □ Tests pass

□ Backend Developer
  □ Endpoints created with tests first
  □ Input validation present
  □ Error handling implemented
  □ Authentication considered
  □ Tests pass

□ Tester Agent
  □ Test suite executed
  □ Coverage report generated
  □ Failures clearly identified
  □ Security tests included
  □ Results in structured format

□ Bug Fixer Agent
  □ Receives failure context
  □ Generates targeted fix
  □ Fix verified by re-running tests
  □ Max 3 attempts enforced
  □ Escalation on max attempts

□ Reviewer Agent
  □ Code review completed
  □ Quality issues identified
  □ Lessons extracted
  □ Lessons stored in DB
  □ Approval/rejection decision
```

### Automated Test Suite

```bash
# Run all CP3 tests
npm run test:cp3

# Expected output:
# ✓ Frontend developer (15 tests)
# ✓ Backend developer (15 tests)
# ✓ Tester agent (12 tests)
# ✓ Bug fixer agent (8 tests)
# ✓ Reviewer agent (10 tests)
#
# Total: 60 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP3 Manual Validation

echo "=== CP3: Build & Test Validation ==="

# 1. Run full build cycle on test feature
./bin/aigentflow init build-test
cd projects/build-test

# 2. Run feature implementation
echo "2. Running feature build..."
./bin/aigentflow run "Add a counter component that increments on click"

# 3. Verify outputs
echo "3. Checking outputs..."
[ -f "src/components/Counter.tsx" ] || exit 1
[ -f "src/components/Counter.test.tsx" ] || exit 1

# 4. Run tests
echo "4. Running tests..."
npm test || exit 1

# 5. Check coverage
echo "5. Checking coverage..."
npm run test:coverage
# Coverage should be >= 80%

echo ""
echo "=== CP3 PASSED ==="
```

---

## CP4: Integration

**Steps:** 17-20
**Tag:** `cp4-integration`

### Validation Checklist

```
□ Merge Workflow
  □ Worktree changes committed
  □ Worktree merged to feature branch
  □ Worktree cleaned up
  □ Feature branch has all changes

□ Integration Branch
  □ Feature merged to integration
  □ Integration tests pass
  □ No merge conflicts
  □ Commit history clean

□ CI/CD Integration
  □ GitHub Actions workflow exists
  □ Lint check runs
  □ Test check runs
  □ Security scan runs
  □ All checks pass

□ Release Workflow
  □ Integration merged to main
  □ Version tag created
  □ Changelog updated
  □ Release notes generated
```

### Automated Test Suite

```bash
# Run all CP4 tests
npm run test:cp4

# Expected output:
# ✓ Merge workflow (10 tests)
# ✓ Integration branch (8 tests)
# ✓ CI/CD integration (12 tests)
# ✓ Release workflow (8 tests)
#
# Total: 38 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP4 Manual Validation

echo "=== CP4: Integration Validation ==="

# 1. Complete a full feature cycle
./bin/aigentflow init integration-test
cd projects/integration-test
git init
git checkout -b integration

# 2. Run feature and merge
echo "2. Running feature cycle..."
./bin/aigentflow run "Add user profile page" --auto-merge

# 3. Verify integration branch
echo "3. Checking integration branch..."
git log --oneline -5
git diff integration main

# 4. Check CI config
echo "4. Checking CI configuration..."
[ -f ".github/workflows/ci.yml" ] || exit 1

echo ""
echo "=== CP4 PASSED ==="
```

---

## CP5: Self-Evolution

**Steps:** 21-24
**Tag:** `cp5-self-evolution`

### Validation Checklist

```
□ Execution Tracing
  □ All executions traced
  □ Traces stored in database
  □ Trace includes agent path
  □ Trace includes outcomes
  □ Traces queryable

□ Pattern Detection
  □ Pattern miner runs
  □ Intervention patterns detected
  □ Capability gaps identified
  □ Routing inefficiencies found
  □ Patterns stored for review

□ Agent Generation
  □ DSPy integration works
  □ Agent config generated from pattern
  □ Constitutional validation passes
  □ Test suite auto-generated
  □ Agent enters shadow mode

□ Tournament & Promotion
  □ TrueSkill ratings work
  □ Tournament matches run
  □ Ratings converge (12+ matches)
  □ Promotion criteria evaluated
  □ Canary deployment works
```

### Automated Test Suite

```bash
# Run all CP5 tests
npm run test:cp5

# Expected output:
# ✓ Execution tracing (15 tests)
# ✓ Pattern detection (20 tests)
# ✓ Agent generation (18 tests)
# ✓ Tournament system (15 tests)
#
# Total: 68 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP5 Manual Validation

echo "=== CP5: Self-Evolution Validation ==="

# 1. Generate trace data
echo "1. Generating trace data (this takes a while)..."
./bin/aigentflow evolution seed-traces --count 50

# 2. Run pattern detection
echo "2. Running pattern detection..."
./bin/aigentflow evolution detect-patterns
PATTERNS=$(./bin/aigentflow evolution list-patterns --count)
[ "$PATTERNS" -gt 0 ] || exit 1
echo "   ✓ Found $PATTERNS patterns"

# 3. Generate agent from pattern
echo "3. Generating agent from top pattern..."
./bin/aigentflow evolution generate-agent --pattern-id 1

# 4. Run tournament
echo "4. Running tournament matches..."
./bin/aigentflow evolution tournament --matches 15

# 5. Check ratings
echo "5. Checking TrueSkill ratings..."
./bin/aigentflow evolution ratings

echo ""
echo "=== CP5 PASSED ==="
```

---

## CP6: Enterprise Operations

**Steps:** 25-28 (4 steps)
**Tag:** `cp6-enterprise-ops`

### Validation Checklist

```
□ Incident Response
  □ Incident detector monitors system health
  □ Severity classification (P0-P4) works correctly
  □ Runbook system loads and executes runbooks
  □ Alert router sends to correct channels
  □ Incident timeline captures all events
  □ Post-incident review template generated
  □ MTTR tracking works

□ GDPR Operations
  □ DSAR handler processes data subject requests
  □ Consent manager tracks consent per purpose
  □ Retention enforcer applies retention policies
  □ Article 30 records generated correctly
  □ Data export produces portable format
  □ Deletion cascade removes all related data
  □ Consent withdrawal triggers data cleanup

□ Compliance Dashboards
  □ Real-time compliance status displayed
  □ Evidence collector gathers audit artifacts
  □ Attestation manager tracks certifications
  □ Gap analysis identifies missing controls
  □ Report generator produces audit reports
  □ Historical compliance data retained
  □ Alert on compliance drift

□ Vendor Security
  □ Vendor questionnaire system works
  □ Risk scoring calculates vendor risk
  □ Dependency scanner detects vulnerabilities
  □ License compliance checker validates licenses
  □ SLA monitoring tracks vendor performance
  □ Vendor audit trail maintained
  □ Third-party access reviewed
```

### Automated Test Suite

```bash
# Run all CP6 tests
npm run test:cp6

# Expected output:
# ✓ Incident response (18 tests)
# ✓ GDPR operations (22 tests)
# ✓ Compliance dashboards (15 tests)
# ✓ Vendor security (17 tests)
#
# Total: 72 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP6 Manual Validation

echo "=== CP6: Enterprise Operations Validation ==="

# 1. Test incident detection
echo "1. Testing incident detection..."
./bin/aigentflow incident trigger --type test --severity P3
./bin/aigentflow incident list
echo "   ✓ Incident created"

# 2. Test GDPR operations
echo "2. Testing GDPR operations..."
./bin/aigentflow gdpr dsar --type export --subject-id test-user
./bin/aigentflow gdpr consent list --subject-id test-user
echo "   ✓ GDPR operations work"

# 3. Test compliance dashboard
echo "3. Testing compliance dashboard..."
./bin/aigentflow compliance dashboard --format json
./bin/aigentflow compliance report --standard SOC2
echo "   ✓ Compliance dashboard works"

# 4. Test vendor security
echo "4. Testing vendor security..."
./bin/aigentflow vendor scan --check-licenses
./bin/aigentflow vendor assess --vendor test-vendor
echo "   ✓ Vendor security works"

echo ""
echo "=== CP6 PASSED ==="
```

---

## CP7: Platform Infrastructure

**Steps:** 29-32 (4 steps)
**Tag:** `cp7-platform-infra`

### Validation Checklist

```
□ Model Abstraction Layer
  □ Provider interface defined correctly
  □ Anthropic provider implements interface
  □ OpenAI provider implements interface
  □ Model router selects optimal model
  □ Fallback routing works on failure
  □ Cost tracking per request
  □ Token counting accurate
  □ Rate limiting per provider

□ Multi-Tenant Security
  □ Tenant context middleware works
  □ Data isolation enforced (RLS pattern)
  □ Tenant quotas tracked and enforced
  □ Rate limiting per tenant
  □ Cross-tenant access blocked
  □ Tenant provisioning works
  □ Tenant suspension works
  □ Audit log per tenant

□ Feature Flags
  □ Flag evaluation engine works
  □ Targeting rules match correctly
  □ Percentage rollout distributes properly
  □ A/B experiment tracking works
  □ Flag overrides for testing
  □ Flag change audit trail
  □ Stale flag detection
  □ Emergency kill switch works

□ GenUI Output Style
  □ Structured output schema validates
  □ CLI renderer formats correctly
  □ Streaming output works
  □ Progress indicators display
  □ Error formatting consistent
  □ Output builder produces valid JSON
  □ Markdown rendering works
  □ Color/styling in terminal
```

### Automated Test Suite

```bash
# Run all CP7 tests
npm run test:cp7

# Expected output:
# ✓ Model abstraction layer (20 tests)
# ✓ Multi-tenant security (22 tests)
# ✓ Feature flags (18 tests)
# ✓ GenUI output style (15 tests)
#
# Total: 75 tests passed
```

### Manual Validation Script

```bash
#!/bin/bash
# CP7 Manual Validation

echo "=== CP7: Platform Infrastructure Validation ==="

# 1. Test model abstraction
echo "1. Testing model abstraction..."
./bin/aigentflow models list
./bin/aigentflow models test --provider anthropic
./bin/aigentflow models test --provider openai
echo "   ✓ Model providers work"

# 2. Test multi-tenant
echo "2. Testing multi-tenant security..."
./bin/aigentflow tenant create --id test-tenant
./bin/aigentflow tenant switch --id test-tenant
./bin/aigentflow tenant quota --id test-tenant
echo "   ✓ Multi-tenant works"

# 3. Test feature flags
echo "3. Testing feature flags..."
./bin/aigentflow flags create --name test-flag --default false
./bin/aigentflow flags evaluate --name test-flag --context '{"userId": "123"}'
./bin/aigentflow flags rollout --name test-flag --percentage 50
echo "   ✓ Feature flags work"

# 4. Test GenUI output
echo "4. Testing GenUI output..."
./bin/aigentflow output test --format structured
./bin/aigentflow output test --format streaming
echo "   ✓ GenUI output works"

# Cleanup
./bin/aigentflow tenant delete --id test-tenant
./bin/aigentflow flags delete --name test-flag

echo ""
echo "=== CP7 PASSED ==="
```

---

## Full System Validation

After all checkpoints pass, run the complete system test:

```bash
#!/bin/bash
# Full System Validation

echo "=== FULL SYSTEM VALIDATION ==="

# 1. Fresh install
rm -rf node_modules orchestrator-data projects
npm install
npm run build

# 2. Initialize project
./bin/aigentflow init full-test

# 3. Run complete workflow
./bin/aigentflow run "Build a task management app with:
  - User authentication (login/register)
  - Task CRUD operations
  - Task categories and filtering
  - Due date reminders"

# 4. Verify all artifacts
echo "Checking artifacts..."
[ -d "projects/full-test/designs" ] || exit 1
[ -d "projects/full-test/src" ] || exit 1
[ -f "projects/full-test/package.json" ] || exit 1
[ -f "projects/full-test/CLAUDE.md" ] || exit 1

# 5. Run project tests
cd projects/full-test
npm test || exit 1
npm run build || exit 1

# 6. Check compliance
cd ../..
./bin/aigentflow compliance check --project full-test

# 7. Check self-evolution
./bin/aigentflow evolution status

echo ""
echo "=== FULL SYSTEM VALIDATION PASSED ==="
echo ""
echo "Aigentflow is ready for production use!"
```

---

## Test Count Summary

| Checkpoint | Original Tests | New Tests | Total |
|------------|----------------|-----------|-------|
| CP0 | 22 | 37 | 59 |
| CP1 | 31 | 114 | 145 |
| CP2 | 40 | 0 | 40 |
| CP3 | 60 | 0 | 60 |
| CP4 | 38 | 0 | 38 |
| CP5 | 68 | 0 | 68 |
| CP6 | 0 | 72 | 72 |
| CP7 | 0 | 75 | 75 |
| **Total** | 259 | 298 | **557** |

---

## Checkpoint Sign-off Template

When completing a checkpoint, create a sign-off record:

```markdown
## Checkpoint Sign-off: CP[X]

**Date:** YYYY-MM-DD
**Completed by:** [Name]
**Git Tag:** cp[x]-[name]

### Validation Results

- [ ] All automated tests pass
- [ ] Manual validation script passes
- [ ] All checklist items verified
- [ ] No critical issues found

### Deviations from Plan

[Document any changes from the original plan]

### Known Issues

[List any non-critical issues to address later]

### Sign-off

- [ ] Ready for next checkpoint
```
