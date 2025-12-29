Maximizing Claude Code CLI Productivity for Multi-Agent Development
Building AgentFlow—a Python/FastAPI backend with React/Zustand frontend spanning 11,000+ lines and including large files like orchestrator.py (106KB)—requires mastering Claude Code's advanced features. This comprehensive guide synthesizes 15 critical productivity areas with specific strategies for your stack.

The single biggest quick win: Configure a hierarchical CLAUDE.md with explicit instructions to use Grep before reading large files, combined with PostToolUse hooks for auto-formatting. This alone can reduce token costs by 97% on large file operations and eliminate formatting inconsistencies.

1. Multi-agent development workflows
Running multiple Claude Code agents effectively requires understanding the distinction between subagents (Task tool within a session) and separate terminal sessions (git worktrees).

Key recommendations:

Use subagents for specialized roles within a single session—create backend-engineer, frontend-architect, and code-reviewer agents in .claude/agents/ 
claude +2
Use git worktrees for truly parallel development on independent features 
anthropic +2
Split work by layer for AgentFlow: one Claude on /backend/, another on /frontend/
Maximum practical parallelism: 3-4 concurrent agents before cognitive overhead dominates
Subagents cannot spawn other subagents— 
Claude
the main agent orchestrates all coordination 
claude +3
Implementation for AgentFlow:

Create specialized subagents in .claude/agents/backend-engineer.md: 
claude +2

yaml
---
name: backend-engineer
description: Expert in Python, FastAPI, and SQLAlchemy. Use for API development tasks.
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---
You are the Backend Engineer focusing on FastAPI and Python development.
- NEVER write frontend code
- Follow existing project patterns in the codebase
- Write tests for all new endpoints
- Use Pydantic models for validation
For parallel feature development:

bash
git worktree add ../agentflow-agents -b feature/agent-management main
git worktree add ../agentflow-workflows -b feature/workflow-builder main

# Terminal 1: Backend work
cd ../agentflow-agents && claude

# Terminal 2: Frontend work (mocked API)
cd ../agentflow-workflows && claude

# Merge when complete
git checkout main && git merge feature/agent-management
Anthropic

Common pitfalls: Don't run parallel agents on shared files (Zustand stores, API contracts). 
DEV Community
 Coordinate through file-based handoffs or a shared tasks.md checklist.

2. CLAUDE.md configuration
CLAUDE.md files are the foundation of Claude Code productivity. 
Claude
 Treat them as high-value "ad space"—only document patterns used in 30%+ of workflows.

Key recommendations:

Use hierarchical CLAUDE.md: root-level for shared context, separate files in backend/ and frontend/ 
anthropic
Sshh
Never include sensitive data (API keys, credentials) 
claude
Reference external docs rather than embedding large content 
Sshh
Run /init to auto-generate a starter, then refine based on friction points 
anthropic +2
Use the # key during sessions to add instructions that auto-incorporate 
anthropic +2
Root CLAUDE.md template for AgentFlow:

markdown
# AgentFlow - Multi-Agent Orchestration System

## Project Overview
Python/FastAPI backend (~15 files, ~3000 LOC) with React/Zustand frontend (~40 components, ~8000 LOC).
WebSocket for real-time updates. SQLite WAL mode. Agents execute via Claude Code CLI subprocess.

## Directory Structure
- backend/app/: FastAPI application (routers/, models/, services/, core/)
- frontend/src/: React application (components/, stores/, hooks/, services/)
- Large files requiring targeted reads: orchestrator.py (106KB), ui_designer.py (43KB)

## Commands
```bash
# Backend
cd backend && uvicorn app.main:app --reload     # Dev server
cd backend && pytest tests/ -v --maxfail=3       # Run tests
cd backend && ruff check --fix . && ruff format . # Lint/format

# Frontend
cd frontend && npm run dev      # Dev server
cd frontend && npm run test     # Run tests
cd frontend && npm run lint     # Lint
```

## Critical Rules
- NEVER read orchestrator.py or ui_designer.py entirely—use Grep first
- ALWAYS run tests before considering a task complete
- NEVER add new dependencies without asking first
- Commit with descriptive conventional commit messages
Backend-specific CLAUDE.md (backend/CLAUDE.md):

markdown
# Backend - FastAPI

## Patterns
- All routes use /api/v1 prefix
- Async functions for ALL I/O operations
- Type hints required on all functions
- Use Pydantic v2 models for request/response

## Testing
pytest tests/ -v --cov=app    # With coverage
3. Preventing hallucination during development
Claude can invent APIs, function names, or import paths that don't exist. 
Medium
 Grounding strategies prevent these issues.

Key recommendations:

Explicit exploration before coding: "Read relevant files. DO NOT write code yet." 
anthropic
Anthropic
Use extended thinking triggers: "think" < "think hard" < "think harder" < "ultrathink" 
Anthropic
Provide 10-20 lines of existing patterns before requesting new implementations 
Simon Willison
Allow uncertainty: add "Say 'I don't know' if unsure" to CLAUDE.md 
Claude
Verify with subagents independently to prevent implementation overfitting 
anthropic
Anthropic
Exploration-first workflow in CLAUDE.md:

markdown
## Before Making Changes
1. Read existing implementation patterns before modifying
2. Check for similar patterns: `grep -r "pattern" src/`
3. Review tests for expected behavior
4. Create a plan and verify before implementing

## Verification
- After implementation, use a subagent to review changes
- Run existing tests to verify no regressions
- If unsure about an API, grep for its usage first
Pattern example provision:

markdown
## FastAPI Route Pattern (FOLLOW THIS)
```python
@router.post("/agents", response_model=AgentResponse)
async def create_agent(
    agent: AgentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> AgentResponse:
    """Create a new agent."""
    service = AgentService(db)
    return await service.create(agent, current_user.id)
```
Common hallucination types to watch for: inventing library functions that don't exist, mixing syntax from different library versions, fabricating API endpoints, suggesting incorrect import paths. 
Arsturn

4. Guardrails for development
Guardrails prevent accidental damage and enforce quality standards.

Key recommendations:

Use PreToolUse hooks to block risky operations before they happen 
Claude +2
Protect sensitive files: .env, production.*, .git/, lockfiles
Require tests before task completion
Control dependency additions through explicit approval
Prevent over-engineering with clear instructions 
Claude Docs
Settings.json guardrails configuration:

json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python3 -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(x in p for x in ['.env','production.','.git/','package-lock']) else 0)\""
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.command' | { read cmd; if echo \"$cmd\" | grep -qE '^rm\\s+-rf|npm publish|git push.*--force'; then exit 2; fi; }"
          }
        ]
      }
    ]
  }
}
CLAUDE.md guardrails section:

markdown
## Critical Rules - YOU MUST FOLLOW
- NEVER delete files without explicit user approval
- NEVER modify .env, production.*, or deployment configs
- NEVER add new dependencies without asking first
- NEVER commit directly to main/master branch
- ALWAYS run tests before considering a task complete

## Preventing Over-Engineering
- Prefer simple solutions over clever ones
- Don't add abstractions until there are 3+ use cases
- Don't install new packages if stdlib or existing deps work
5. Skills for building projects
Skills are reusable instruction sets stored in .claude/skills/ that Claude automatically applies when relevant. 
claude
claude

Key recommendations:

Create atomic, focused skills that can be composed for complex workflows 
claude
Write specific descriptions with trigger conditions ("Use when creating FastAPI endpoints") 
claude
Store project skills in .claude/skills/ for team sharing via git 
claude
Use YAML frontmatter for metadata (name, description, allowed-tools) 
claude
Test with prompts that match your description 
claude
Five high-impact skills for AgentFlow:

1. FastAPI Endpoint Skill (.claude/skills/fastapi-endpoint/SKILL.md):

yaml
---
name: agentflow-api-endpoint
description: Create FastAPI endpoints with Pydantic schemas and async SQLAlchemy. Use when adding API routes.
allowed-tools: Read, Write, Edit, Bash, Grep
---
# FastAPI Endpoint Creator

1. Check existing patterns in api/routes/
2. Create Pydantic request/response schemas in schemas/
3. Create SQLAlchemy model if needed
4. Implement endpoint with proper error handling
5. Add OpenAPI documentation

## Pattern
```python
@router.post("/agents", response_model=AgentResponse, status_code=201)
async def create_agent(
    agent: AgentCreate,
    db: AsyncSession = Depends(get_db)
) -> AgentResponse:
    db_agent = Agent(**agent.model_dump())
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    return db_agent
```
2. React Component Skill 3. Zustand Store Skill 4. SQLite Migration Skill 5. Commit Message Skill (auto-generates conventional commits from git diff)

6. MCP servers for development
MCP (Model Context Protocol) servers extend Claude Code's built-in capabilities with external integrations. 
claude

Priority installation order for AgentFlow:

Priority	Server	Purpose	Installation
1	SQLite	Database inspection	claude mcp add sqlite -- uvx mcp-server-sqlite --db-path ./agentflow.db
2	GitHub	PR/issue management	claude mcp add github --env GITHUB_TOKEN=$TOKEN -- npx -y @modelcontextprotocol/server-github
3	Context7	Up-to-date docs	claude mcp add context7 -- npx -y @upstash/context7-mcp
4	Filesystem	Structured access	claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem ./src
5	Memory	Persistent context	claude mcp add memory -- npx -y @modelcontextprotocol/server-memory
Complete .mcp.json for AgentFlow:

json
{
  "mcpServers": {
    "sqlite": {
      "command": "uvx",
      "args": ["mcp-server-sqlite", "--db-path", "./data/agentflow.db"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    },
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"]
    }
  }
}
FastAPI-MCP integration (expose your API as MCP tools):

python
from fastapi import FastAPI
from fastapi_mcp import FastApiMCP

app = FastAPI(title="AgentFlow API")
mcp = FastApiMCP(app, name="AgentFlow MCP", base_url="http://localhost:8000")
mcp.mount()  # Available at /mcp endpoint
7. Token minimization strategies
Token efficiency is critical with large files. Your 106KB orchestrator.py consumes ~26,500 tokens if read entirely.

Key recommendations:

Use Grep/Glob before Read for large files—reduces cost by 97%
Disable unused MCP servers (check with /context) 
ClaudeLog
Use /compact manually at 70% capacity, not 95% 
Richardporter
Batch related file reads together
Structure requests to reference previously-read content
Token-efficient request pattern:

# BAD: Reading entire file (~26,500 tokens)
"Read orchestrator.py"

# GOOD: Targeted approach (~800 tokens)
"Grep for 'class TaskQueue' in orchestrator.py"
"Read orchestrator.py lines 450-550"
"Edit line 485: add error handling"
CLAUDE.md token instructions:

markdown
## Large File Handling (CRITICAL)
- orchestrator.py: 106KB - NEVER read entirely, use Grep first
- ui_designer.py: 43KB - Prefer targeted reads (max 300 lines)

## Read Instructions
1. Grep for target class/function first
2. Read only line ranges (max 500 lines)
3. Use line numbers for all edits
4. Never ask to "read the whole file"
Cost comparison per edit cycle:

Approach	Tokens	Cost @ $3/1M
Full file read	26,500	$0.08
Grep + 200-line read	800	$0.002
Savings	97%	$0.078
8. Effective task decomposition
The optimal task size is one that can be completed in a single focused session without needing /clear.

Key recommendations:

Use "Explore, Plan, Code, Commit" workflow—read files first WITHOUT coding 
anthropic
Anthropic
Break features into 1-4 hour implementation chunks
Let Claude plan for novel architecture; be prescriptive for known solutions
Use subagents for multi-part research to preserve main context 
anthropic
Anthropic
Handle multi-session tasks with external memory files
Decomposition example for AgentFlow feature:

❌ BAD: Monolithic request

"Build the agent orchestration system with workflow execution, state management, and real-time updates"
✅ GOOD: Decomposed tasks

Task 1: "Create AgentNode Pydantic model in app/models/agent.py with fields:
id, name, type, config, status. Follow existing model patterns."

Task 2: "Implement AgentOrchestrator service in app/services/orchestrator.py.
Read TaskExecutor pattern first. Include: register_agent(), execute_workflow(), get_status()"

Task 3: "Create FastAPI endpoints in app/routers/agents.py. Follow router patterns in app/routers/tasks.py"

Task 4: "Create AgentNode and WorkflowCanvas React components using Zustand store pattern from src/stores/taskStore.ts"
Planning phase prompt pattern:

Read the files in app/services/ and app/models/agent.py.
DO NOT write any code yet.

Think hard about implementing a workflow execution engine that:
- Manages agent state transitions
- Handles concurrent execution
- Supports rollback on failure

Create a plan outlining classes needed, data flow, error handling, and testing approach.
Save to docs/workflow-engine-plan.md
9. Testing and verification workflows
Test-Driven Development (TDD) is Anthropic's explicitly recommended workflow for agentic coding. 
Anthropic
anthropic

Key recommendations:

Write failing tests first, then implement to pass them 
anthropic
Anthropic
Configure PostToolUse hooks for automatic test execution
Define test commands in CLAUDE.md
Use subagents for independent verification 
Anthropic
Create custom slash commands for testing workflows
CLAUDE.md testing configuration:

markdown
## Testing Commands
- pytest -q --maxfail=3 --disable-warnings --cov=src/
- npm test -- --coverage --watchAll=false

## TDD Workflow
1. Write failing tests first
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. NEVER modify tests during implementation phase
PostToolUse hooks for auto-testing:

json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit:*.py|Write:*.py",
        "hooks": [{
          "type": "command",
          "command": "pytest tests/ -q --tb=short --maxfail=3 2>&1 | head -50"
        }]
      },
      {
        "matcher": "Edit:*.tsx|Edit:*.ts",
        "hooks": [{
          "type": "command",
          "command": "cd frontend && npm run test -- --watchAll=false --passWithNoTests 2>&1 | head -50"
        }]
      }
    ]
  }
}
TDD slash command (.claude/commands/tdd.md):

markdown
Implement $ARGUMENTS using Test-Driven Development:
1. Write failing tests that define expected behavior
2. Show tests and wait for approval
3. Implement minimal code to pass tests
4. Run tests after each change
5. Refactor while keeping tests green
IMPORTANT: Do not modify tests during implementation.
10. Context management across sessions
Git commits serve as persistent "memory" between sessions.

Key recommendations:

Use claude --continue or claude --resume for session continuity 
Claude +2
Create session notes in .claude/session-notes/ for complex multi-day features
Use git commits with detailed messages as context bridges
Create a /catchup custom command for session starts 
Sshh
Use /clear between distinct phases rather than waiting for auto-compaction 
Sshh +2
Session transition workflow:

bash
# End of Session 1
"Write a summary of what we accomplished and what's remaining to .claude/session-notes/feature-xyz.md"
git commit -m "feat(orchestrator): refactored TaskQueue with async handlers

Session context: Working on agent orchestration
TODO: Add unit tests for edge cases"

# Start of Session 2
claude --resume  # or use fresh session with context
"Read .claude/session-notes/feature-xyz.md and git log --oneline -5 to continue where we left off"
Custom /catchup command (.claude/commands/catchup.md):

markdown
Review the current project state:
1. Run `git status` to see uncommitted changes
2. Run `git log --oneline -5` for recent commits
3. Read .claude/session-notes/ for any active session notes
4. Summarize the current development state
11. Parallel development strategies
True parallel development requires isolation—either through git worktrees or specialized tooling.

Safe to parallelize:

Separate components (AgentCard + AgentDetail)
Backend routes + Frontend components (with mocked API)
Independent test files
Documentation
Requires coordination:

Shared utilities/hooks
Database schema changes
API contracts
Zustand stores
Git worktree workflow for AgentFlow:

bash
# Create isolated worktrees
git worktree add ../agentflow-backend -b feature/api main
git worktree add ../agentflow-frontend -b feature/ui main

# Run Claude in each (separate terminals)
cd ../agentflow-backend && claude "Implement CRUD endpoints for agents"
cd ../agentflow-frontend && claude "Build AgentList components with mocked API"

# Merge and connect
git checkout main
git merge feature/api
git merge feature/ui
claude "Connect frontend to real API, remove mocks"
Anthropic

Terminal management: Use tmux or iTerm2 split panes. Consider Claude Squad (brew install claude-squad) for TUI-based multi-session management. 
GitHub

12. Prompt engineering for development tasks
Structure prompts with XML tags—Claude is fine-tuned to recognize this structure.

Effective prompt pattern:

xml
<context>
Stack: FastAPI, SQLAlchemy, Pydantic v2
Existing patterns: See app/routers/users.py
Database: SQLite with async SQLAlchemy
</context>

<task>
Create an agent execution endpoint that:
1. Accepts workflow via POST /api/v1/agents/execute
2. Validates against AgentWorkflow Pydantic model
3. Queues execution via BackgroundTasks
4. Returns execution_id immediately
</task>

<constraints>
- Follow error handling patterns in app/core/exceptions.py
- Use dependency injection for services
- NO mock implementations
</constraints>

<verification>
Run: pytest tests/routers/test_agents.py -v
</verification>
Thinking triggers for complex reasoning:

"think" → standard thinking
"think hard" → extended reasoning
"think harder" → deep analysis
"ultrathink" → maximum computation
Use prescriptive prompts when: following established patterns, time-critical fixes, safety-critical code. Use autonomous prompts when: exploring new architecture, strategic refactoring, prototyping.

13. Handling large files
Your 106KB orchestrator.py should be split into 5-7 focused modules.

Navigation guide for CLAUDE.md:

markdown
## orchestrator.py Navigation (106KB)
NEVER read entirely. Key sections (approximate):
- Lines 1-100: Imports and constants
- Lines 100-400: TaskQueue class
- Lines 400-700: Handler classes
- Lines 700-1000: Worker management
- Lines 1000-1500: State management
- Lines 1500-2500: Event processing, utilities

ALWAYS use Grep first:
- Find classes: `class\s+\w+`
- Find methods: `def\s+\w+`
Recommended split structure:

orchestrator/
├── __init__.py           # Re-exports public API
├── core.py              # Core orchestration (~20KB)
├── task_queue.py        # TaskQueue and related (~25KB)
├── handlers.py          # Handler classes (~20KB)
├── workers.py           # Worker pool (~15KB)
├── state.py             # State management (~15KB)
└── utils.py             # Utilities (~10KB)
Incremental refactoring approach:

Session 1: Extract TaskQueue (lines ~100-400)
- Grep for TaskQueue class and dependencies
- Read targeted sections only
- Create task_queue.py, update imports
- Commit

Session 2: /clear, then extract Handlers
[Repeat for each module]
14. Development hooks
Hooks automate formatting, testing, and safety checks. 
claude

Complete hooks configuration for AgentFlow:

json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "python3 -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(x in p for x in ['.env','production.','.git/']) else 0)\""
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "jq -r '.tool_input.file_path' | { read fp; if echo \"$fp\" | grep -q '\\.py$'; then ruff format \"$fp\" 2>/dev/null; ruff check --fix \"$fp\" 2>/dev/null; elif echo \"$fp\" | grep -qE '\\.(ts|tsx)$'; then npx prettier --write \"$fp\" 2>/dev/null; npx eslint --fix \"$fp\" 2>/dev/null; fi; }"
        }]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [{
          "type": "command",
          "command": "osascript -e 'display notification \"Claude needs input\" with title \"AgentFlow\"' 2>/dev/null || true"
        }]
      }
    ]
  }
}
Hook events:

PreToolUse: Block dangerous operations (exit code 2 blocks) 
Claude
PostToolUse: Auto-format after edits
Stop: Run verification when Claude finishes
Notification: Desktop alerts when input needed
15. Recovery from mistakes
Built-in checkpointing plus Git strategies provide robust recovery. 
Claude

Primary recovery methods:

Esc+Esc or /rewind: Session-level recovery (every prompt creates a checkpoint) 
Anthropic
Claude
git checkout -- .: Discard uncommitted changes
git reset --hard HEAD~1: Undo last commit with changes
git stash: Save work before experimenting
Recovery scenarios:

Wrong changes to multiple files:

bash
# Option 1: Claude Code rewind
Press Esc+Esc → Select checkpoint → "Both code and conversation"

# Option 2: Git (uncommitted)
git checkout -- .

# Option 3: Selective recovery
git checkout HEAD -- src/orchestrator.py src/agents/worker.py
Claude going down wrong path:

Press Esc to interrupt
"Stop. That approach won't work because [reason]. Let's try [new approach]."

# If context polluted
/clear
# Start fresh with better instructions
CLAUDE.md recovery section:

markdown
## Git Workflow
- I (developer) handle all git operations
- Claude: Make code changes only, don't commit
- Always check `git diff` before accepting changes
- Commit at logical checkpoints

## Recovery Commands
- Undo uncommitted: `git checkout -- .`
- Undo last commit (keep changes): `git reset --soft HEAD~1`
- View file at commit: `git show HEAD~1:path/to/file`
When to restart vs continue:

Continue: Minor corrections, Claude understands goal but chose wrong approach
Restart (/clear): Repeated mistakes, context polluted, fundamentally different approach needed 
DoltHub
Summary answers to key questions
1. Biggest quick win for immediate productivity gain
Configure hierarchical CLAUDE.md with Grep-first instructions for large files plus PostToolUse auto-formatting hooks. This combination:

Reduces token costs by 97% on large file operations
Eliminates formatting inconsistencies automatically
Provides consistent patterns for Claude to follow
Takes 30 minutes to set up, saves hours daily
2. Optimal CLAUDE.md template for Python/FastAPI + React/Zustand
See the complete template in Topic 2 above. Key elements:

Project overview with file size warnings
Separate backend/frontend CLAUDE.md files
Testing commands with --maxfail flags
Critical rules section (Grep before Read, tests before complete)
Pattern examples for both stacks
3. Priority MCP servers to install first
Order	Server	Setup Command
1	SQLite	claude mcp add sqlite -- uvx mcp-server-sqlite --db-path ./agentflow.db
2	GitHub	claude mcp add github --env GITHUB_TOKEN=$TOKEN -- npx -y @modelcontextprotocol/server-github
3	Context7	claude mcp add context7 -- npx -y @upstash/context7-mcp
4. How to split large files (100KB+)
Split orchestrator.py into 5-7 modules by responsibility:

core.py: Main orchestration logic
task_queue.py: Queue management
handlers.py: Handler classes
workers.py: Worker pool
state.py: State management
utils.py: Utilities
Use incremental refactoring: one module per session, Grep to find boundaries, commit between extractions.

5. Five most impactful custom skills
fastapi-endpoint: Create endpoints with Pydantic schemas, async SQLAlchemy, OpenAPI docs
react-component: TypeScript components with Zustand integration, Tailwind styling
zustand-store: Type-safe stores with devtools, persistence, async actions
sqlite-migration: Alembic migrations with async patterns
commit-message: Generate conventional commits from git diff
6. Ideal multi-agent workflow for parallel development
For AgentFlow's backend/frontend split:

Create git worktrees for isolation:
bash
   git worktree add ../agentflow-api -b feature/api main
   git worktree add ../agentflow-ui -b feature/ui main
Run backend Claude with mocked responses, frontend Claude with mocked API
Coordinate shared code (Zustand stores, API types) through one agent only
Merge both branches, then run integration session to connect real API
Use subagents within sessions for specialized tasks (code review, testing) 
Icodewith
Key constraints: Maximum 3-4 parallel agents, never share files across agents, coordinate API contracts before implementation, run quality gates before merging.

