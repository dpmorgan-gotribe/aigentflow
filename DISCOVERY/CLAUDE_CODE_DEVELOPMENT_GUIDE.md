# Claude Code Development Guide for AgentFlow

> **Purpose**: Comprehensive guide for building AgentFlow efficiently using Claude Code CLI
> **Generated**: December 2024

---

## Table of Contents

1. [Multi-Agent Development Workflows](#1-multi-agent-development-workflows)
2. [CLAUDE.md File Configuration](#2-claudemd-file-configuration)
3. [Preventing Hallucination](#3-preventing-hallucination-during-development)
4. [Guardrails for Development](#4-guardrails-for-development)
5. [Skills for Building This Project](#5-skills-for-building-this-project)
6. [MCP Servers for Development](#6-mcp-servers-for-development)
7. [Token Minimization Strategies](#7-token-minimization-strategies)
8. [Effective Task Decomposition](#8-effective-task-decomposition)
9. [Testing and Verification Workflows](#9-testing-and-verification-workflows)
10. [Context Management Across Sessions](#10-context-management-across-sessions)
11. [Parallel Development Strategies](#11-parallel-development-strategies)
12. [Prompt Engineering for Development Tasks](#12-prompt-engineering-for-development-tasks)
13. [Handling Large Files](#13-handling-large-files)
14. [Development Hooks](#14-development-hooks)
15. [Recovery from Mistakes](#15-recovery-from-mistakes)
16. [Quick Wins Summary](#16-quick-wins-summary)

---

## 1. Multi-Agent Development Workflows

### Key Recommendations
- Use the **Task tool** with subagents for parallelizable work (backend + frontend simultaneously)
- Run separate Claude Code terminal sessions for truly independent features
- Use `--model haiku` for quick exploration tasks to save tokens
- Never have multiple agents edit the same file simultaneously

### Implementation Steps

**Scenario: Building a new feature (e.g., "Add cost tracking")**

```bash
# Terminal 1: Backend API
claude "Implement the cost tracking API endpoint in routes/ with database schema"

# Terminal 2: Frontend component (after API is defined)
claude "Build the CostTracker React component using the existing Zustand pattern"
```

**Using Task tool within a session:**
```
You: Build the approval notification feature - backend API and frontend component

Claude will use Task tool to:
1. Spawn subagent for backend (routes/approvals.py)
2. Spawn subagent for frontend (components/dashboard/NotificationPane.jsx)
3. Coordinate and merge results
```

### For AgentFlow Specifically
- **Backend + Frontend split**: Safe to parallelize since your API contracts are well-defined
- **Database changes**: Always do in main session (never parallel) - your migration pattern requires sequential execution
- **Large file edits** (orchestrator.py): Never parallelize - use single session with focused edits

---

## 2. CLAUDE.md File Configuration

### Key Recommendations
- Create a project-level `CLAUDE.md` at `agentflow-v3/CLAUDE.md`
- Use `.claude/rules/` for modular, path-specific rules
- Include your actual patterns extracted from the codebase

### Complete CLAUDE.md Template

Create `agentflow-v3/CLAUDE.md`:

```markdown
# AgentFlow Development Guide

## Project Overview
AgentFlow is a multi-agent orchestration system for automated full-stack development.
- Backend: Python 3.13 + FastAPI + SQLite (WAL mode)
- Frontend: React 18 + Zustand + Tailwind CSS
- Real-time: WebSocket for agent status updates

## Common Commands
- Start backend: `cd backend && python -m uvicorn main:app --reload --port 8000`
- Start frontend: `cd frontend && npm run dev`
- Run tests: `cd backend && pytest` / `cd frontend && npm test`

## Critical Files (Handle with Care)
- `backend/database.py` - Schema changes need migrations
- `backend/agents/orchestrator.py` - 106KB, use targeted edits only
- `backend/websocket.py` - Protocol changes affect frontend
- `frontend/src/hooks/useWebSocket.js` - Must match backend events

## Code Patterns

### Database Access (ALWAYS use this pattern)
```python
from database import get_db_context

async def my_endpoint():
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
        return cursor.fetchone()
```

### WebSocket Broadcasting
```python
from websocket import ws_manager

await ws_manager.broadcast(project_id, {
    "type": "EVENT_TYPE",  # Use WSEventType enum
    "data": {"key": "value"}
})
```

### Zustand Store Pattern
```javascript
// All stores follow this pattern
export const useXxxStore = create((set, get) => ({
  items: [],
  setItems: (items) => set({ items }),

  // Local updates (from WebSocket)
  updateItemLocal: (id, updates) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    }));
  },

  // API updates (user-initiated)
  updateItem: async (id, updates) => {
    const response = await fetch(`/api/items/${id}`, {...});
    // Then update local state
  },
}));
```

### Adding New API Routes
1. Create route file in `backend/routes/`
2. Register in `backend/routes/__init__.py`
3. Add to FastAPI app in `backend/main.py`

### Adding New WebSocket Events
1. Add event type to `WSEventType` enum in `websocket.py`
2. Add handler in `frontend/src/hooks/useWebSocket.js`
3. Update relevant Zustand store

## Guardrails
- NEVER modify database schema without adding migration in `_run_migrations()`
- NEVER change WebSocket message format without updating frontend
- ALWAYS use parameterized queries (no f-strings in SQL)
- ALWAYS run pytest after backend changes
- Large files: Use Grep to find specific functions, don't read entire file

## File References
- Database schema: @backend/database.py
- WebSocket events: @backend/websocket.py
- Store patterns: @frontend/src/stores/projectStore.js
```

### Modular Rules Setup

Create `.claude/rules/backend.md`:
```markdown
---
paths: backend/**/*.py
---

# Backend Rules

- Use type hints for all function parameters and returns
- Database queries use `get_db_context()` context manager
- All routes use async/await
- WebSocket broadcasts use `ws_manager.broadcast()`
- Error responses: `HTTPException(status_code=X, detail="message")`
```

Create `.claude/rules/frontend.md`:
```markdown
---
paths: frontend/**/*.{js,jsx}
---

# Frontend Rules

- Components use functional style with hooks
- State management via Zustand (never local useState for shared data)
- Styling via Tailwind classes (no CSS files)
- API calls go through store methods, not directly in components
- WebSocket events handled in useWebSocket hook only
```

---

## 3. Preventing Hallucination During Development

### Key Recommendations
- **Always read before editing**: Read the target file + 1-2 related files first
- **Provide explicit patterns** in CLAUDE.md
- **Use Grep for large files** instead of reading entirely
- **Reference existing implementations** when asking for new features

### Implementation Steps

**Before asking Claude to add a new route:**
```
You: Read backend/routes/projects.py and backend/routes/tasks.py to understand the route patterns, then add a new route for agent configurations.
```

**For large file edits (orchestrator.py):**
```
You: Use Grep to find the "async def execute_plan" method in backend/agents/orchestrator.py, read just that section (lines X-Y), then modify it to add cost tracking.
```

**Explicit pattern reference:**
```
You: Add a new Zustand store for agent configurations following the exact pattern in frontend/src/stores/projectStore.js - specifically the fetchProjects, updateTask, and updateTaskLocal patterns.
```

### Grounding Techniques

| Situation | Technique |
|-----------|-----------|
| New API route | "Read routes/projects.py first, follow same pattern" |
| New component | "Check components/dashboard/AgentCard.jsx for styling patterns" |
| Database change | "Read database.py migrations section, add new migration" |
| WebSocket event | "Read websocket.py WSEventType enum, add matching handler in useWebSocket.js" |

### Common Hallucination Risks in AgentFlow
1. **Import paths**: Claude may guess wrong paths - always verify with Glob first
2. **Database columns**: Schema is complex - read database.py before SQL
3. **WebSocket event types**: Must match between backend/frontend - read both files
4. **Zustand store methods**: Pattern is specific - reference projectStore.js

---

## 4. Guardrails for Development

### Key Recommendations
- Use Claude Code **hooks** to prevent dangerous operations
- Add guardrails to CLAUDE.md
- Create pre-commit checks

### Hook Configuration

Create/update `.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(x in p for x in ['database.py','package-lock.json','.env']) else 0)\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'File modified - consider running tests'"
          }
        ]
      }
    ]
  }
}
```

### CLAUDE.md Guardrails Section
```markdown
## Guardrails (MUST FOLLOW)

### Protected Operations (Require Explicit Approval)
- Database schema changes -> Add migration, don't modify CREATE TABLE
- Deleting files -> Confirm with user first
- Installing new dependencies -> Explain why needed
- Modifying .env or config files -> Show diff first

### Forbidden Operations
- NEVER use `DROP TABLE` or `DELETE FROM` without WHERE clause
- NEVER hardcode API keys or secrets
- NEVER modify package-lock.json directly
- NEVER force push to git

### Required Checks
- After backend changes: `pytest backend/tests/`
- After frontend changes: `npm run lint`
- Before commits: `git diff --staged` review
```

---

## 5. Skills for Building This Project

### Key Recommendations
- Create project-specific skills in `.claude/skills/`
- Focus on your most common development tasks
- Keep skills focused and composable

### Skill 1: Add API Route

Create `.claude/skills/add-api-route/SKILL.md`:
```yaml
---
name: add-api-route
description: Add a new FastAPI route with database operations. Use when creating new API endpoints for AgentFlow.
---

# Add API Route

## Steps
1. Read `backend/routes/projects.py` for pattern reference
2. Create new route file in `backend/routes/`
3. Add database operations using `get_db_context()` pattern
4. Register route in `backend/routes/__init__.py`
5. Add route to FastAPI app in `backend/main.py`

## Template
```python
from fastapi import APIRouter, HTTPException
from database import get_db_context
import json

router = APIRouter(prefix="/api/{{resource}}", tags=["{{resource}}"])

@router.get("/")
async def list_{{resource}}():
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM {{table}}")
        return [dict(row) for row in cursor.fetchall()]

@router.get("/{id}")
async def get_{{resource}}(id: str):
    with get_db_context() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM {{table}} WHERE id = ?", (id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        return dict(row)

@router.post("/")
async def create_{{resource}}(data: dict):
    with get_db_context() as conn:
        cursor = conn.cursor()
        # Insert logic here
        conn.commit()
        return {"id": new_id}
```
```

### Skill 2: Add WebSocket Event

Create `.claude/skills/add-ws-event/SKILL.md`:
```yaml
---
name: add-ws-event
description: Add a new WebSocket event type with frontend handler. Use when adding real-time features.
---

# Add WebSocket Event

## Steps
1. Add event to `WSEventType` enum in `backend/websocket.py`
2. Broadcast event where needed: `await ws_manager.broadcast(project_id, {"type": "EVENT_NAME", "data": {...}})`
3. Add handler in `frontend/src/hooks/useWebSocket.js` switch statement
4. Update relevant Zustand store

## Backend Pattern
```python
# In websocket.py WSEventType enum
EVENT_NAME = "event_name"

# Broadcasting
await ws_manager.broadcast(project_id, {
    "type": WSEventType.EVENT_NAME,
    "data": {"key": "value"}
})
```

## Frontend Pattern
```javascript
// In useWebSocket.js
case 'event_name':
  useProjectStore.getState().handleEventName(message.data);
  break;
```
```

### Skill 3: Add Zustand Store Action

Create `.claude/skills/add-store-action/SKILL.md`:
```yaml
---
name: add-store-action
description: Add new actions to a Zustand store following AgentFlow patterns. Use when adding state management features.
---

# Add Store Action

## Pattern Reference
See `frontend/src/stores/projectStore.js` for complete patterns.

## Local Update (for WebSocket events)
```javascript
updateXxxLocal: (id, updates) => {
  set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    ),
  }));
},
```

## API Update (for user actions)
```javascript
updateXxx: async (id, updates) => {
  try {
    const response = await fetch(`${API_BASE}/xxx/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (response.ok) {
      set((state) => ({
        items: state.items.map((item) =>
          item.id === id ? { ...item, ...updates } : item
        ),
      }));
    }
  } catch (error) {
    console.error('Failed to update:', error);
    throw error;
  }
},
```

## Fetch Pattern
```javascript
fetchXxx: async (projectId) => {
  try {
    const response = await fetch(`${API_BASE}/xxx/project/${projectId}`);
    if (response.ok) {
      const data = await response.json();
      set({ items: data.items || [] });
      return data.items;
    }
  } catch (error) {
    console.error('Failed to fetch:', error);
  }
  return [];
},
```
```

### Skill 4: Add Database Migration

Create `.claude/skills/add-db-migration/SKILL.md`:
```yaml
---
name: add-db-migration
description: Add a new database column or table with proper migration. Use when modifying the database schema.
---

# Add Database Migration

## Steps
1. Read `backend/database.py` to understand current schema
2. Add migration in `_run_migrations()` function
3. NEVER modify existing CREATE TABLE statements
4. Test migration on fresh and existing databases

## Migration Pattern (Adding Column)
```python
# In _run_migrations() function
def _run_migrations(cursor, conn):
    # ... existing migrations ...

    # Migration: Add new_column to table_name
    try:
        cursor.execute("SELECT new_column FROM table_name LIMIT 1")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE table_name ADD COLUMN new_column TYPE DEFAULT value")
        conn.commit()
        print("Migration: Added new_column to table_name")
```

## Migration Pattern (New Table)
```python
# In init_database() function, add new CREATE TABLE
cursor.execute("""
    CREATE TABLE IF NOT EXISTS new_table (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id),
        name TEXT NOT NULL,
        data JSON DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")

# Add index
cursor.execute("CREATE INDEX IF NOT EXISTS idx_new_table_project ON new_table(project_id)")
```
```

### Skill 5: Add React Component

Create `.claude/skills/add-react-component/SKILL.md`:
```yaml
---
name: add-react-component
description: Add a new React component following AgentFlow patterns. Use when creating new UI components.
---

# Add React Component

## Steps
1. Determine component location (dashboard/, workstation/, project/, shared/)
2. Create component file with proper imports
3. Connect to Zustand stores (not local state for shared data)
4. Use Tailwind CSS for styling
5. Export from component directory if needed

## Component Template
```jsx
import { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useAgentStore } from '../../stores/agentStore';

export default function ComponentName({ projectId, ...props }) {
  // Get state from stores
  const { items, fetchItems, updateItem } = useProjectStore();

  // Local UI state only (not shared data)
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    if (projectId) {
      fetchItems(projectId);
    }
  }, [projectId]);

  // Event handlers
  const handleAction = async () => {
    setIsLoading(true);
    try {
      await updateItem(itemId, { key: 'value' });
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h3 className="text-lg font-semibold text-white mb-4">
        Component Title
      </h3>

      {isLoading ? (
        <div className="text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="p-2 bg-gray-700 rounded">
              {item.name}
            </div>
          ))}
        </div>
      )}

      <button
        onClick={handleAction}
        disabled={isLoading}
        className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-white"
      >
        Action Button
      </button>
    </div>
  );
}
```

## Styling Conventions
- Background colors: `bg-gray-800`, `bg-gray-700`, `bg-gray-900`
- Text colors: `text-white`, `text-gray-300`, `text-gray-400`
- Accent colors: `bg-blue-600`, `bg-green-600`, `bg-red-600`
- Spacing: Use `space-y-*` and `gap-*` for consistent spacing
- Borders: `rounded`, `rounded-lg`, `border border-gray-600`
```

---

## 6. MCP Servers for Development

### Key Recommendations
- Start with **SQLite** and **GitHub** MCP servers
- Add **Puppeteer/Playwright** for UI testing
- Configure via `claude mcp add`

### Priority MCP Servers for AgentFlow

| Priority | Server | Use Case | Setup Command |
|----------|--------|----------|---------------|
| 1 | SQLite | Query agentflow.db directly | See below |
| 2 | GitHub | PR management, issues | See below |
| 3 | Git | Commit, diff, status | See below |
| 4 | Playwright | UI testing | See below |

### Setup Commands (Windows)

```bash
# SQLite - Direct database queries
claude mcp add --scope project sqlite -- cmd /c npx -y @anthropic/mcp-server-sqlite --db-path C:/Development/ps/claude/agent-flow/agentflow-v3/backend/agentflow.db

# GitHub integration
claude mcp add --scope user github --env GITHUB_TOKEN=your_token -- cmd /c npx -y @modelcontextprotocol/server-github

# Git operations
claude mcp add --scope project git -- cmd /c npx -y @modelcontextprotocol/server-git

# Playwright for browser testing
claude mcp add --scope project playwright -- cmd /c npx -y @playwright/mcp-server

# Check status
/mcp
```

### Setup Commands (macOS/Linux)

```bash
# SQLite
claude mcp add --scope project sqlite -- npx -y @anthropic/mcp-server-sqlite --db-path ./backend/agentflow.db

# GitHub
claude mcp add --scope user github --env GITHUB_TOKEN=your_token -- npx -y @modelcontextprotocol/server-github

# Git
claude mcp add --scope project git -- npx -y @modelcontextprotocol/server-git
```

### Use Cases for AgentFlow

**With SQLite MCP:**
```
You: Query the tasks table to show all tasks in 'coding' stage for project X
You: Show me the schema of the pending_approvals table
You: Count how many agents have been spawned today
```

**With GitHub MCP:**
```
You: Create a PR for the current branch with a summary of changes
You: List open issues labeled 'bug'
You: Create an issue for the WebSocket disconnection problem
```

**With Git MCP:**
```
You: Show me the diff of staged changes
You: Create a commit with a proper message for the cost tracking feature
```

---

## 7. Token Minimization Strategies

### Key Recommendations
- **Never read orchestrator.py fully** - use Grep to find specific sections
- **Use `/compact` regularly** during long sessions
- **Clear context between unrelated tasks** with `/clear`
- **Split large files** (orchestrator.py should be refactored)

### Strategies for Your Codebase

| File | Size | Strategy |
|------|------|----------|
| orchestrator.py | 106KB | NEVER read fully. Use Grep to find sections |
| ui_designer.py | 43KB | Read only relevant sections with line offsets |
| database.py | ~50KB | OK to read fully (important schema reference) |
| Frontend components | <10KB each | Read fully - they're small enough |
| projectStore.js | ~20KB | Read fully for pattern reference |

### Practical Commands

```bash
# Instead of reading orchestrator.py fully
You: Use Grep to find the "async def execute_plan" method in backend/agents/orchestrator.py, then read just lines 500-600

# Compact after completing a feature
/compact Focus on the cost tracking implementation we just completed

# Clear before starting new unrelated feature
/clear

# Check current token usage
/cost
```

### File Splitting Recommendation for orchestrator.py

Current structure (problematic):
```
backend/agents/orchestrator.py  # 106KB, ~3000 lines - TOO BIG
```

Recommended structure:
```
backend/agents/orchestrator/
├── __init__.py              # Main OrchestratorAgent class, imports from below
├── prompt_analyzer.py       # PromptAnalyzer class (~400 lines)
├── task_planner.py          # TaskPlanner, TaskBreakdown (~600 lines)
├── agent_selector.py        # AgentSelector logic (~400 lines)
├── execution.py             # ExecutionController (~500 lines)
├── context_manager.py       # Context routing logic (~400 lines)
└── prompts.py               # System prompts as constants (~200 lines)
```

Each file becomes ~15-20KB, manageable for Claude to read fully.

---

## 8. Effective Task Decomposition

### Key Recommendations
- **Medium-sized tasks** work best (not too small, not too large)
- **Specify files upfront** when you know them
- **Let Claude plan** for exploratory work
- **Be explicit about patterns** to follow

### Task Size Guidelines

| Task Size | Example | Recommendation |
|-----------|---------|----------------|
| Too Small | "Add a console.log" | Just do it, no planning needed |
| Good | "Add cost tracking to agent spawning" | Ideal - clear scope, few files |
| Good | "Fix WebSocket reconnection handling" | Ideal - focused bug fix |
| Too Large | "Implement the entire approval system" | Break into 3-5 smaller tasks |

### Task Templates

**Feature Implementation:**
```
Add real-time cost tracking:
1. Backend: Add cost_estimate field to tasks table (migration in database.py)
2. Backend: Calculate cost in agent_lifecycle.py when spawning agents
3. Backend: Broadcast cost updates via WebSocket (COST_UPDATE event)
4. Frontend: Add cost display to AgentCard.jsx
5. Frontend: Add total cost to ExecutionControls.jsx

Follow existing patterns in database.py for migrations and projectStore.js for WebSocket handling.
```

**Bug Fix:**
```
Fix: WebSocket disconnections not handled properly

Symptom: When WebSocket disconnects, UI doesn't show reconnection status
Files to check: frontend/src/hooks/useWebSocket.js, components/layout/StatusBar.jsx

Expected behavior: Show "Reconnecting..." status, auto-reconnect with backoff
```

**Refactoring:**
```
Refactor orchestrator.py - extract task planning logic:
1. Read orchestrator.py lines 200-400 (task planning section)
2. Create new file backend/agents/orchestrator/task_planner.py
3. Move TaskPlanner class to new file
4. Update imports in orchestrator.py

Maintain all existing functionality - just reorganize.
```

---

## 9. Testing and Verification Workflows

### Key Recommendations
- Run tests in **background** while working
- Have Claude **write tests first** for new features (TDD)
- Use **hooks** to remind about tests after edits

### Background Test Running

```bash
# Start tests in background
You: Run pytest in background for backend tests

# Continue working while tests run
You: Now implement the new endpoint

# Check test results
/tasks  # See background task status
```

### Test-First Pattern (TDD)

```
You: I want to add a "pause project" feature.

First, write tests for:
1. API endpoint POST /api/projects/{id}/pause
2. Database status update to 'paused'
3. WebSocket notification EXECUTION_PAUSED

Then implement to make tests pass.
```

### Testing Checklist

**Backend Changes:**
```bash
# After any backend change
pytest backend/tests/ -v

# For specific module
pytest backend/tests/test_routes.py -v

# With coverage
pytest backend/tests/ --cov=backend --cov-report=html
```

**Frontend Changes:**
```bash
# After any frontend change
cd frontend && npm test

# Run specific test file
npm test -- ComponentName.test.jsx

# With coverage
npm test -- --coverage
```

### Hook for Test Reminders

Add to `.claude/settings.json`:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python -c \"import sys,json; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); print('Remember to run: pytest' if 'backend/' in p and 'test' not in p else 'Remember to run: npm test' if 'frontend/src/' in p and 'test' not in p else '')\""
          }
        ]
      }
    ]
  }
}
```

---

## 10. Context Management Across Sessions

### Key Recommendations
- Use **git commits** as context anchors
- Create **session summary** before ending
- Reference **recent commits** at session start

### Session Handoff Pattern

**End of session:**
```
You: Summarize what we accomplished and what's next for the cost tracking feature
```

Claude will output something like:
```
## Session Summary - Cost Tracking Feature

### Completed:
- Added cost_estimate column to tasks table
- Implemented cost calculation in agent_lifecycle.py
- Created COST_UPDATE WebSocket event

### Next Steps:
- Add cost display to AgentCard.jsx
- Add total cost aggregation to ExecutionControls.jsx
- Write tests for cost calculation

### Key Files Modified:
- backend/database.py (lines 105-110)
- backend/services/agent_lifecycle.py (lines 45-60)
- backend/websocket.py (WSEventType enum)
```

**Start of next session:**
```
You: I'm continuing work on cost tracking.
Recent commits: [paste git log --oneline -5]
Last session we completed the backend (database + WebSocket).
Now implement the frontend: AgentCard.jsx and ExecutionControls.jsx cost displays.
Read frontend/src/stores/projectStore.js for the pattern.
```

### Context File (Optional)

Create `CURRENT_WORK.md` to track ongoing work:
```markdown
# Current Work in Progress

## Active Feature: Cost Tracking
Started: 2024-12-20
Status: Backend complete, frontend in progress

### Completed
- [x] Database migration for cost_estimate
- [x] Cost calculation in agent_lifecycle.py
- [x] WebSocket COST_UPDATE event

### In Progress
- [ ] AgentCard.jsx cost display
- [ ] ExecutionControls.jsx total cost

### Files Modified
- backend/database.py
- backend/services/agent_lifecycle.py
- backend/websocket.py

### Notes
- Cost is calculated per 1K tokens
- Rates: Opus=$0.015, Sonnet=$0.003, Haiku=$0.00025
```

---

## 11. Parallel Development Strategies

### Key Recommendations
- Use **separate terminals** for truly independent work
- Use **Task tool subagents** for related but separable work
- **Never parallelize** database schema changes

### Safe Parallelization Matrix

| Work Type | Parallelize? | Method |
|-----------|--------------|--------|
| Backend API + Frontend component | Yes | Separate terminals |
| Two independent features | Yes | Separate terminals |
| Tests + Implementation | Yes | Background task |
| Database + anything | NO | Sequential only |
| Same file edits | NO | Sequential only |
| WebSocket backend + frontend | Careful | Define contract first |

### Practical Workflow

```bash
# Terminal 1: Backend feature
cd agentflow-v3
claude "Add the /api/metrics endpoint for cost tracking"

# Terminal 2: Frontend feature (can start after API contract defined)
cd agentflow-v3
claude "Build MetricsPanel.jsx component that will consume /api/metrics"

# Terminal 3: Tests (independent)
cd agentflow-v3
claude "Write comprehensive tests for the agent_lifecycle service"
```

### Coordination Pattern

When work overlaps:
```
Terminal 1: Define API contract first
  POST /api/metrics
  Response: { total_cost: number, breakdown: [...] }

Terminal 2: Wait for contract, then implement
  "Implement MetricsPanel.jsx that fetches from /api/metrics
   expecting response format: { total_cost: number, breakdown: [...] }"
```

---

## 12. Prompt Engineering for Development Tasks

### Key Recommendations
- **Be specific** about files and patterns
- **Reference existing code** to reduce hallucination
- **State constraints** upfront

### Prompt Templates

**Feature Request:**
```
Add [feature name] to AgentFlow.

Requirements:
- [Specific requirement 1]
- [Specific requirement 2]

Constraints:
- Follow existing patterns in [reference file]
- Use [specific pattern/library]
- Don't modify [protected files]

Start by reading [relevant files] to understand current implementation.
```

**Bug Fix:**
```
Bug: [Description of bug]

Steps to reproduce:
1. [Step 1]
2. [Step 2]

Expected: [Expected behavior]
Actual: [Actual behavior]

Likely files: [List of files]

First, investigate the issue by reading [files]. Then propose a fix.
```

**Refactoring:**
```
Refactor [component/module] to [goal].

Current state: [Description]
Target state: [Description]

Constraints:
- Maintain all existing functionality
- Don't change public APIs
- Add tests for any new code

Read [files] first to understand current implementation.
```

**Code Review:**
```
Review the changes in [files] for:
1. Code quality and patterns
2. Potential bugs
3. Security issues
4. Performance concerns

Compare against patterns in [reference files].
```

### Specificity Examples

**Bad (vague):**
```
Add a new feature for tracking costs
```

**Good (specific):**
```
Add cost tracking to agent spawning:
1. Read backend/services/agent_lifecycle.py to see spawn logic
2. Add cost calculation based on model (opus=$0.015, sonnet=$0.003, haiku=$0.00025 per 1K tokens)
3. Store in tasks.cost_estimate field (already exists in database)
4. Broadcast via WebSocket using AGENT_STATUS_UPDATE event
Follow the existing pattern in agent_lifecycle.py for database updates.
```

---

## 13. Handling Large Files

### Key Recommendations for orchestrator.py (106KB)

1. **Never read the full file**
2. **Use Grep to locate** specific methods/classes
3. **Read targeted line ranges**
4. **Consider refactoring** into smaller modules

### Practical Approach

```
You: I need to modify the task planning logic in orchestrator.py.

Step 1: Use Grep to find "class TaskPlanner" or "def plan_tasks"
Step 2: Read just that section (e.g., lines 850-950)
Step 3: Make targeted edits to just those lines
```

### Common Patterns to Search For

```bash
# Find class definitions
Grep "^class " orchestrator.py

# Find method definitions
Grep "async def " orchestrator.py

# Find specific logic
Grep "task_breakdown" orchestrator.py
Grep "agent_selection" orchestrator.py
```

### Refactoring Plan for orchestrator.py

**Phase 1: Extract Constants**
```python
# Create backend/agents/orchestrator/prompts.py
SYSTEM_PROMPT = """..."""
TASK_ANALYSIS_PROMPT = """..."""
# etc.
```

**Phase 2: Extract Classes**
```python
# Create backend/agents/orchestrator/task_planner.py
class TaskPlanner:
    """Handles task breakdown and dependency resolution."""
    pass

# Create backend/agents/orchestrator/agent_selector.py
class AgentSelector:
    """Selects best agent for a task based on capabilities."""
    pass
```

**Phase 3: Update Main File**
```python
# backend/agents/orchestrator/__init__.py
from .prompts import SYSTEM_PROMPT
from .task_planner import TaskPlanner
from .agent_selector import AgentSelector

class OrchestratorAgent:
    def __init__(self):
        self.planner = TaskPlanner()
        self.selector = AgentSelector()
```

---

## 14. Development Hooks

### Recommended Hooks Setup

Create `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python -c \"import json,sys; d=json.load(sys.stdin); cmd=d.get('tool_input',{}).get('command',''); sys.exit(2 if any(x in cmd for x in ['rm -rf','DROP TABLE','--force','> /dev/null']) else 0)\""
          }
        ]
      },
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); sys.exit(2 if any(x in p for x in ['.env','secrets','credentials','package-lock.json']) else 0)\""
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "python -c \"import json,sys; d=json.load(sys.stdin); p=d.get('tool_input',{}).get('file_path',''); msg='Run pytest' if 'backend/' in p else 'Run npm test' if 'frontend/' in p else ''; print(f'Reminder: {msg}') if msg else None\""
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": ".*",
        "hooks": [
          {
            "type": "command",
            "command": "powershell -Command \"[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); [System.Windows.Forms.MessageBox]::Show('Claude needs your attention', 'Claude Code')\""
          }
        ]
      }
    ]
  }
}
```

### Hook Types Explained

| Hook Event | When It Fires | Use Case |
|------------|---------------|----------|
| PreToolUse | Before any tool runs | Block dangerous commands |
| PostToolUse | After tool completes | Logging, reminders |
| Notification | When Claude needs attention | Desktop alerts |
| Stop | When Claude finishes | Cleanup, summary |

### Exit Codes

- `0` = Allow/Success
- `2` = Block/Deny

---

## 15. Recovery from Mistakes

### Key Recommendations
- **Commit frequently** (every successful change)
- **Use git stash** before risky operations
- **Know the undo commands**

### Recovery Patterns

| Mistake | Recovery Command |
|---------|-----------------|
| Wrong file edited | `git checkout -- path/to/file` |
| Multiple bad changes | `git reset --hard HEAD~1` |
| Want to undo but keep changes | `git reset --soft HEAD~1` |
| Experimental branch went wrong | `git checkout main` |
| Claude went off track | `/clear` and restart |
| Need to see what changed | `git diff` or `git diff HEAD~1` |

### Preventive Workflow

```bash
# Before risky operation
git stash

# After successful implementation
git add -A && git commit -m "feat: add cost tracking to tasks"

# If something goes wrong
git stash pop  # Restore to pre-change state

# Or if you committed bad changes
git reset --soft HEAD~1  # Undo commit, keep changes staged
git checkout -- .        # Discard all changes
```

### When to Restart vs Continue

**Restart (`/clear`) when:**
- Claude is confused about the codebase structure
- Making repeated mistakes on the same issue
- Context has grown too large (check with `/cost`)
- Switching to completely different task

**Continue when:**
- Making incremental progress
- Related follow-up work
- Claude understands the context correctly

---

## 16. Quick Wins Summary

### Today's Actions (Priority Order)

| Action | Time | Impact |
|--------|------|--------|
| Create CLAUDE.md | 30 min | -50% hallucination |
| Set up SQLite MCP | 10 min | -80% DB investigation time |
| Create `.claude/rules/` | 15 min | Better pattern adherence |
| Add basic hooks | 10 min | Prevent dangerous operations |

### This Week

| Action | Time | Impact |
|--------|------|--------|
| Create 3 core skills | 2 hours | -40% repetitive work |
| Split orchestrator.py | 4 hours | -70% tokens on edits |
| Set up GitHub MCP | 15 min | Streamlined PR workflow |

### Impact Summary

| Change | Token Savings | Time Savings | Quality Impact |
|--------|---------------|--------------|----------------|
| CLAUDE.md with patterns | 20% | 30% | -50% hallucination |
| Large file splitting | 70% on those files | 50% | Better edits |
| SQLite MCP | 10% | 80% on DB work | Direct queries |
| Skills for common tasks | 15% | 40% | Consistent patterns |
| Hooks for safety | 0% | Prevents disasters | Guardrails |

### Recommended Order of Implementation

1. **CLAUDE.md** - Immediate impact, foundation for everything else
2. **SQLite MCP** - Quick win for database work
3. **Hooks** - Safety net before making more changes
4. **Skills** - Automate common patterns
5. **File splitting** - Larger effort but significant token savings
6. **GitHub MCP** - Nice to have for PR workflow

---

## Appendix: File Templates

### A. Complete CLAUDE.md Template

See [Section 2](#2-claudemd-file-configuration) for the full template.

### B. Skill Directory Structure

```
.claude/
├── settings.json           # Hooks configuration
├── rules/
│   ├── backend.md          # Python/FastAPI rules
│   └── frontend.md         # React/Zustand rules
└── skills/
    ├── add-api-route/
    │   └── SKILL.md
    ├── add-ws-event/
    │   └── SKILL.md
    ├── add-store-action/
    │   └── SKILL.md
    ├── add-db-migration/
    │   └── SKILL.md
    └── add-react-component/
        └── SKILL.md
```

### C. MCP Configuration File

`.mcp.json` (project-level, committed to git):
```json
{
  "mcpServers": {
    "sqlite": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-server-sqlite", "--db-path", "./backend/agentflow.db"]
    },
    "git": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-git"]
    }
  }
}
```

---

*Document generated for AgentFlow development optimization with Claude Code CLI*
