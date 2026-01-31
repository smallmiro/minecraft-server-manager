# Agent Collaboration Guide

Multi-agent collaboration guide for all development work in this project.

---

## 🔴 Critical Rules

> **These rules apply to ALL agents, for ALL work, at ALL times.**

### Rule 1: NEVER Do Another Agent's Work

Each agent has **exclusive ownership** of their module. You must NOT:

| ❌ Forbidden | Explanation |
|-------------|-------------|
| Modify code in another agent's module | Even for "small fixes" or "obvious changes" |
| Create files in another agent's directory | Each agent manages their own files |
| Implement features that belong to another agent | Even if you think you can do it faster |
| Make assumptions about another agent's code | Always request, never assume |

### Rule 2: ALWAYS Collaborate via Protocol

When you need something from another agent:

```markdown
## 📋 DEPENDENCY_NEEDED

**From**: [your agent name]
**To**: [target agent name]
**Issue**: #XX (if applicable)

### Need
[Describe what interface/artifact/spec you need]

### Reason
[Why you need it for your work]

### Expected Format
[How you expect to receive it - interface, file, spec]
```

When you complete work that others depend on:

```markdown
## ✅ DEPENDENCY_READY

**From**: [your agent name]
**To**: [comma-separated list of dependent agents]
**Issue**: #XX

### Artifact
[What is now available]

### Location
[File path or import statement]

### Usage
[How to use the provided artifact]
```

### Rule 3: Report Blockers Immediately

If you are blocked by another agent:

```markdown
## ⚠️ BLOCKING_ISSUE

**From**: [your agent name]
**Blocked By**: [blocking agent name]
**Issue**: #XX

### Blocker
[What is blocking you]

### Impact
[What you cannot do until this is resolved]

### Urgency
[HIGH/MEDIUM/LOW]
```

---

## Team Structure

### Development Agents (Module Ownership)

```
                    ┌─────────────────────────────────────┐
                    │       🎯 ORCHESTRATOR               │
                    │  (Dependency analysis, assignment,  │
                    │       synchronization)              │
                    └──────────────────┬──────────────────┘
                                       │
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        │              │               │               │              │
        ▼              ▼               ▼               ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 🔧 CORE      │ │ 💻 CLI       │ │ 🖥️ BACKEND   │ │ 🎨 FRONTEND  │ │ 🐳 DEVOPS    │
│              │ │              │ │              │ │              │ │              │
│ shared/      │ │ cli/,scripts/│ │ mcctl-api/   │ │ mcctl-console│ │ Integration  │
│              │ │              │ │              │ │              │ │              │
│ Domain &     │ │ Commands &   │ │ REST API     │ │ Web UI       │ │ Docker &     │
│ Interfaces   │ │ Prompts      │ │ Server       │ │ Console      │ │ E2E Tests    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

### Support Agents (Cross-cutting Concerns)

```
┌─────────────────────────────────────┐   ┌─────────────────────────────────────┐
│       📝 TECHNICAL WRITER           │   │       🚀 RELEASE MANAGER            │
│                                     │   │                                     │
│  Invoked by:                        │   │  Invoked by:                        │
│  - /write-docs command              │   │  - User request (릴리즈, 배포)        │
│  - Release Manager (before release) │   │                                     │
│                                     │   │  Invokes:                           │
│  Module: docs/                      │   │  - Technical Writer (documentation) │
│  Output: EN (.md) + KO (.ko.md)     │   │  - Git tagging, Docker deploy       │
└─────────────────────────────────────┘   └─────────────────────────────────────┘
```

## Agent Definitions

### 🎯 Orchestrator Agent

**Role**: Overall project coordination and task distribution

| Attribute | Description |
|-----------|-------------|
| **Responsibilities** | Dependency analysis, parallel task identification, sync point management |
| **Input** | Milestone issue list, agent status reports |
| **Output** | Work assignments, sync requests, progress reports |
| **Tools** | GitHub API, Task Management |

```yaml
orchestrator:
  triggers:
    - milestone_start
    - agent_completion_report
    - blocking_dependency_detected
    - sync_point_reached

  actions:
    - analyze_dependencies
    - assign_parallel_tasks
    - coordinate_sync_points
    - generate_progress_report
```

---

### 🔧 Core Agent (shared/)

**Role**: Shared library and domain layer development

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/shared/` |
| **Label** | `agent:core` |
| **Documents** | `shared/prd.md`, `shared/plan.md` |
| **Expertise** | Hexagonal Architecture, TypeScript, Domain Modeling |

**Example Tasks**:
- Domain entity definitions (Server, World, etc.)
- Port interfaces (IUserRepository, IModSourcePort, etc.)
- Value objects (ServerName, ServerType, McVersion, etc.)
- Infrastructure adapters (YamlUserRepository, etc.)

**Provides** (→ to other agents):
- Domain interfaces → CLI, Backend
- Repository implementations → CLI
- Adapter interfaces → Backend

**Requires** (← from other agents):
- (Often no dependencies - starts first in dependency chains)

---

### 💻 CLI Agent (cli/)

**Role**: CLI command implementation

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/cli/`, `scripts/` |
| **Label** | `agent:cli` |
| **Documents** | `cli/prd.md`, `cli/plan.md` |
| **Expertise** | @clack/prompts, Commander.js, YAML, Shell scripting |

**Example Tasks**:
- New CLI commands (mcctl create, mcctl console, etc.)
- Interactive prompts and wizards
- Bash management scripts
- Configuration file handling

**Provides** (→ to other agents):
- CLI command interface → DevOps
- Config file specifications → Backend, Frontend

**Requires** (← from other agents):
- Domain interfaces ← Core
- Repository implementations ← Core

---

### 🖥️ Backend Agent (mcctl-api/)

**Role**: REST API server development

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/mcctl-api/` |
| **Label** | `agent:backend` |
| **Documents** | `mcctl-api/prd.md`, `mcctl-api/plan.md` |
| **Expertise** | Fastify, REST API, Authentication, OpenAPI |

**Example Tasks**:
- API endpoint implementation
- Authentication and authorization plugins
- OpenAPI/Swagger documentation
- Dockerfile and container builds

**Provides** (→ to other agents):
- REST API endpoint spec → Frontend
- OpenAPI documentation → Frontend, DevOps
- Docker image → DevOps

**Requires** (← from other agents):
- Domain adapters ← Core
- Shared Use Cases ← Core

---

### 🎨 Frontend Agent (mcctl-console/)

**Role**: Web Management Console development

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/mcctl-console/` |
| **Label** | `agent:frontend` |
| **Documents** | `mcctl-console/prd.md`, `mcctl-console/plan.md` |
| **Expertise** | Next.js, React, Tailwind CSS, NextAuth.js |

**Example Tasks**:
- Next.js pages and components
- Authentication integration (NextAuth.js)
- BFF proxy layer
- Dashboard and management UI

**Provides** (→ to other agents):
- Docker image → DevOps
- UI component specifications → (documentation)

**Requires** (← from other agents):
- API endpoint spec ← Backend
- Auth plugin spec ← Backend

---

### 🐳 DevOps Agent (Integration)

**Role**: Docker integration and E2E testing

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/` (docker-compose), `e2e/` |
| **Label** | `agent:devops` |
| **Documents** | `platform/README.md`, `e2e/README.md` |
| **Expertise** | Docker Compose, Playwright, CI/CD |

**Example Tasks**:
- Docker Compose integration
- E2E tests with Playwright
- Service orchestration
- CI/CD pipeline configuration

**Provides** (→ to other agents):
- Integration test results → All
- Deployment configurations → All

**Requires** (← from other agents):
- API Dockerfile ← Backend
- Console Dockerfile ← Frontend
- CLI service command ← CLI

---

## Support Agents

> Support agents handle cross-cutting concerns and are invoked by commands or other agents.

### 📝 Technical Writer Agent (docs/)

**Role**: Bilingual documentation maintenance

| Attribute | Description |
|-----------|-------------|
| **Module** | `docs/` |
| **Command** | `/write-docs` |
| **Documents** | MkDocs i18n structure |
| **Expertise** | MkDocs, Read the Docs, EN/KO translation |

**Invocation**:
- `/write-docs create <path>` - Create new document
- `/write-docs translate <path>` - Translate document
- `/write-docs review <path>` - Review documentation
- Called by Release Manager before releases

**Provides** (→ to other agents):
- Updated documentation → All
- Release notes → Release Manager

**Rules**:
- ❌ Does NOT implement application features
- ❌ Does NOT make architectural decisions
- ✅ Only modifies files in `docs/` directory
- ✅ Creates both `.md` and `.ko.md` versions

---

### 🚀 Release Manager Agent

**Role**: Version tagging and deployment

| Attribute | Description |
|-----------|-------------|
| **Scope** | Git tags, Docker images, GitHub releases |
| **Trigger** | User request (릴리즈, 배포, release, deploy) |
| **Expertise** | Semantic Versioning, Git Flow, Docker, CI/CD |

**Workflow**:
1. Pre-release checks (branch, uncommitted changes)
2. Version determination (MAJOR/MINOR/PATCH)
3. **Invoke Technical Writer** for documentation update
4. Create Git tag
5. Monitor GitHub Actions
6. Verify Docker deployment

**Provides** (→ to other agents):
- Release tags → All
- Deployment status → DevOps

**Rules**:
- ❌ Does NOT modify application code
- ❌ Does NOT skip documentation update
- ✅ Always invokes Technical Writer before tagging
- ✅ Follows Semantic Versioning

---

## Communication Protocol

### Message Types

Message types used for inter-agent communication:

```typescript
interface AgentMessage {
  id: string;
  type: MessageType;
  from: AgentId;
  to: AgentId | 'orchestrator' | 'broadcast';
  timestamp: string;
  payload: MessagePayload;
}

type MessageType =
  | 'WORK_REQUEST'      // Work assignment
  | 'WORK_COMPLETE'     // Work completion
  | 'DEPENDENCY_READY'  // Dependency available
  | 'DEPENDENCY_NEEDED' // Dependency required
  | 'SYNC_REQUEST'      // Synchronization request
  | 'STATUS_UPDATE'     // Status update
  | 'BLOCKING_ISSUE'    // Blocking issue occurred
  | 'REVIEW_REQUEST'    // Review request
  | 'REVIEW_COMPLETE';  // Review completion

type AgentId =
  | 'core' | 'cli' | 'backend' | 'frontend' | 'devops'  // Development
  | 'technical-writer' | 'release-manager';              // Support
```

### Message Format Examples

**Work Request (WORK_REQUEST)**:
```yaml
type: WORK_REQUEST
from: orchestrator
to: core
payload:
  issue: "#XX"
  title: "feat(shared): Add repository interface"
  priority: high
  deadline: null
  context:
    milestone: N
    phase: "X.Y"
    dependencies: []
```

**Dependency Ready (DEPENDENCY_READY)**:
```yaml
type: DEPENDENCY_READY
from: core
to: broadcast  # to multiple agents
payload:
  issue: "#XX"
  artifact: "IRepository interface"
  location: "shared/src/application/ports/outbound/IRepository.ts"
  exports:
    - "Entity"
    - "IRepository"
  usage_example: |
    import { IRepository, Entity } from '@minecraft-docker/shared';
```

**Work Complete (WORK_COMPLETE)**:
```yaml
type: WORK_COMPLETE
from: core
to: orchestrator
payload:
  issue: "#XX"
  status: completed
  artifacts:
    - path: "shared/src/application/ports/outbound/IRepository.ts"
      type: "interface"
    - path: "shared/src/index.ts"
      type: "export"
  tests_passed: true
  ready_for_merge: true
  unblocks: ["#YY", "#ZZ"]
```

**Blocking Issue (BLOCKING_ISSUE)**:
```yaml
type: BLOCKING_ISSUE
from: frontend
to: orchestrator
payload:
  issue: "#XX"
  blocked_by: "#YY"
  reason: "Need auth plugin spec to implement BFF proxy"
  suggested_action: "Request Backend agent to share auth spec early"
```

---

## Execution Flow

### Phase 1: Initialization

```
Orchestrator                    All Agents
    │                               │
    │  1. WORK_REQUEST (#A)         │
    │──────────────────────────────▶│ Core (foundation tasks)
    │                               │
    │  2. WORK_REQUEST (#B)         │
    │──────────────────────────────▶│ Backend (parallel - foundation)
    │                               │
    │  3. WORK_REQUEST (#C)         │
    │──────────────────────────────▶│ Frontend (parallel - foundation)
    │                               │
```

### Phase 2: Dependency Resolution

```
Core                 Orchestrator              CLI / Backend
  │                       │                         │
  │ WORK_COMPLETE (#A)    │                         │
  │──────────────────────▶│                         │
  │                       │                         │
  │                       │ DEPENDENCY_READY        │
  │                       │────────────────────────▶│
  │                       │                         │
  │                       │ WORK_REQUEST (next)     │
  │                       │────────────────────────▶│
  │                       │                         │
```

### Phase 3: Parallel Execution

```
┌─────────────────────────────────────────────────────────────────┐
│                    PARALLEL EXECUTION WINDOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Core Agent          CLI Agent         Backend Agent            │
│  ───────────         ──────────        ──────────────           │
│  Repository          CLI commands      Auth Plugin              │
│  implementations          │            API routes               │
│       │                   │                  │                   │
│       ▼                   ▼                  ▼                   │
│  Additional          More commands     More routes              │
│  adapters                 │                  │                   │
│                           │                  │                   │
│                           ▼                  ▼                   │
│                      Service cmd       OpenAPI docs             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: Sync Point - API Spec Ready

```
Backend                Orchestrator              Frontend
   │                        │                        │
   │ WORK_COMPLETE          │                        │
   │ (API Spec Ready)       │                        │
   │───────────────────────▶│                        │
   │                        │                        │
   │                        │ SYNC: API_SPEC_READY   │
   │                        │───────────────────────▶│
   │                        │                        │
   │                        │ WORK_REQUEST (BFF)     │
   │                        │───────────────────────▶│
   │                        │                        │
```

### Phase 5: Docker & Integration

```
Backend / Frontend          Orchestrator              DevOps
       │                         │                       │
       │ WORK_COMPLETE           │                       │
       │ (Dockerfiles)           │                       │
       │────────────────────────▶│                       │
       │                         │                       │
       │                         │ DEPENDENCY_READY      │
       │                         │ (Both Dockerfiles)    │
       │                         │──────────────────────▶│
       │                         │                       │
       │                         │ WORK_REQUEST          │
       │                         │ (Integration)         │
       │                         │──────────────────────▶│
       │                         │                       │
```

---

## Parallel Execution Matrix

### Identifying Parallelizable Tasks

| Criteria | Parallelizable | Sequential |
|----------|----------------|------------|
| No shared dependencies | ✅ Yes | - |
| Different modules | ✅ Yes | - |
| Same module, different features | ⚠️ Depends | - |
| Explicit dependency exists | - | ✅ Required |
| Output of one is input of another | - | ✅ Required |

### Example Parallel Groups

| Group | Agents | Can Run In Parallel | Prerequisites |
|-------|--------|---------------------|---------------|
| **Foundation** | Core, Backend, Frontend | Yes | None |
| **Feature Development** | Core, CLI, Backend, Frontend | Yes | Foundation complete |
| **Dockerization** | Backend, Frontend, CLI | Yes | Features complete |
| **Integration** | DevOps | No (sequential) | Dockerfiles ready |

### Conceptual Dependency Flow

```
Legend: ─── direct dependency
        ··· optional/weak dependency

Foundation:  Core ─────┬─── Adapters ───┬─── CLI Commands ───┐
                       │                │                     │
                       ├─── Optional    │                     ├─── Service Cmd
                       │   (extensions) │                     │
                       │                └··· Backend ─── Auth │─── Routes ───┐
                       │                         │            │               │
                       └─── Interfaces ──────────┘            ├─── More Routes│─── Swagger ─── Dockerfile
                                                              │               │
Frontend:    Foundation ─── Auth ─────────────────────────────┼─── BFF ─── Pages ─── More Pages ─── Dockerfile
                                                              │
                                                              ▼
Integration:                              Backend + Frontend Dockerfiles ─── Compose ─── E2E Tests
```

---

## Sync Points

### Defining Sync Points

A sync point is required when:
1. One agent's output is needed by another agent
2. Multiple agents must coordinate before proceeding
3. Integration testing requires all components ready

### Example Sync Points

| Sync ID | Condition | From | To | Purpose |
|---------|-----------|------|----|---------|
| **SYNC-INTERFACE** | Interface complete | Core → All | Share domain interfaces |
| **SYNC-AUTH** | Auth spec complete | Backend → Frontend | Share auth configuration |
| **SYNC-API** | API docs complete | Backend → Frontend | Share OpenAPI spec |
| **SYNC-DOCKER** | Dockerfiles complete | Backend, Frontend → DevOps | Docker images ready |
| **SYNC-INTEGRATION** | Integration ready | DevOps → All | Test environment ready |

### Information Shared at Sync Points

**SYNC-INTERFACE: Interface Ready**
```yaml
sync: SYNC-INTERFACE
artifacts:
  - file: "shared/src/application/ports/outbound/IRepository.ts"
    exports: ["Entity", "IRepository"]

usage:
  cli: "Used for repository implementation"
  backend: "Used for API integration"
```

**SYNC-AUTH: Auth Spec Ready**
```yaml
sync: SYNC-AUTH
artifacts:
  - file: "mcctl-api/src/plugins/auth.ts"
    exports: ["AuthPluginOptions"]
  - spec: |
      Access Modes: internal | api-key | ip-whitelist | api-key-ip | open
      Header: X-API-Key
      Response: 401 Unauthorized, 403 Forbidden

usage:
  frontend: "Set X-API-Key header in BFF proxy"
```

**SYNC-API: API Spec Ready**
```yaml
sync: SYNC-API
artifacts:
  - file: "mcctl-api/docs/openapi.json"
  - url: "http://localhost:5001/docs"

endpoints:
  servers: "GET/POST /api/servers, GET/POST/DELETE /api/servers/:name"
  worlds: "GET/POST /api/worlds, GET/DELETE /api/worlds/:name"
  players: "GET /api/servers/:name/players, whitelist, bans, ops"

usage:
  frontend: "Generate React Query hooks, map BFF routes"
```

---

## Work Request/Response Protocol

### Work Request Format

When an agent requests work from another agent:

```markdown
## 📋 WORK_REQUEST

**From**: {requesting_agent}
**To**: {target_agent}
**Issue**: #{issue_number}
**Priority**: {high|medium|low}

### Context
{Background explanation of why this work is needed}

### Requirements
- [ ] {Specific requirement 1}
- [ ] {Specific requirement 2}

### Expected Output
{Expected deliverable format}

### Deadline
{Deadline if any, otherwise "as soon as dependencies met"}
```

### Work Completion Report Format

When an agent reports work completion:

```markdown
## ✅ WORK_COMPLETE

**From**: {completing_agent}
**To**: orchestrator
**Issue**: #{issue_number}

### Completed Tasks
- [x] {Completed task 1}
- [x] {Completed task 2}

### Artifacts
| File | Type | Description |
|------|------|-------------|
| {path} | {type} | {description} |

### Exports (if applicable)
```typescript
// Usage example
import { ... } from '@minecraft-docker/{package}';
```

### Tests
- Unit Tests: ✅ Passed ({n} tests)
- Integration Tests: ✅ Passed ({n} tests)

### Unblocks
The following issues can now start:
- #{issue1} - {title}
- #{issue2} - {title}

### Notes
{Special notes or things subsequent workers should know}
```

---

## Progress Tracking

### Milestone Progress File

Each agent updates their progress in plan.md:

```markdown
<!-- platform/services/{module}/plan.md -->
# Module Plan

## Progress

| Issue | Title | Status | Agent | Updated |
|-------|-------|--------|-------|---------|
| #XX | Feature A | ✅ Complete | {agent} | YYYY-MM-DD |
| #YY | Feature B | 🔄 In Progress | {agent} | YYYY-MM-DD |
| #ZZ | Feature C | ⏳ Pending | - | - |
| #WW | Feature D | 🚫 Blocked by #XX | - | - |

## Dependencies Provided
- [x] Interface A → Other agents
- [ ] Interface B → Other agents

## Sync Points
- [x] SYNC-1: Interface shared
- [ ] SYNC-2: Pending
```

### Dashboard View

```
┌─────────────────────────────────────────────────────────────────┐
│                    MILESTONE PROGRESS DASHBOARD                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Overall: ████████░░░░░░░░░░░░ 35% (X/Y issues)                 │
│                                                                  │
│  🔧 Core (shared/)      ████████████░░░░░░░░ 50% (A/B)          │
│                                                                  │
│  💻 CLI (cli/)          ████░░░░░░░░░░░░░░░░ 25% (C/D)          │
│                                                                  │
│  🖥️ Backend (mcctl-api/) ██████░░░░░░░░░░░░░░ 29% (E/F)          │
│                                                                  │
│  🎨 Frontend (console/)  ████████░░░░░░░░░░░░ 33% (G/H)          │
│                                                                  │
│  🐳 DevOps (integration) ░░░░░░░░░░░░░░░░░░░░ 0% (I/J)           │
│                                                                  │
│  Legend: ✅ Complete  🔄 In Progress  ⏳ Pending  🚫 Blocked     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Handling Blockers

```yaml
scenario: "Frontend blocked by Backend dependency"

resolution_steps:
  1. Frontend sends BLOCKING_ISSUE to Orchestrator
  2. Orchestrator checks Backend progress
  3. Options:
     a. If dependency near completion → Wait
     b. If dependency delayed → Request early spec sharing
     c. If dependency blocked → Escalate and replan

message_flow:
  frontend → orchestrator: "BLOCKING_ISSUE: need dependency from backend"
  orchestrator → backend: "SYNC_REQUEST: Share spec early"
  backend → frontend: "DEPENDENCY_READY: Spec (partial)"
  frontend: Proceeds with partial spec, marks for later update
```

### Rollback Handling

```yaml
scenario: "Integration test fails"

resolution_steps:
  1. DevOps reports BLOCKING_ISSUE with test results
  2. Orchestrator analyzes failure root cause
  3. Assigns fix task to responsible agent
  4. Re-runs integration after fix

message_flow:
  devops → orchestrator: "BLOCKING_ISSUE: Integration failure in E2E"
  orchestrator → {responsible_agent}: "REVIEW_REQUEST: Fix issue"
  {responsible_agent} → orchestrator: "WORK_COMPLETE: Fix applied"
  orchestrator → devops: "WORK_REQUEST: Re-run E2E tests"
```

---

## Quick Reference

### Agent Module Mapping

| Agent | Module | Label | Primary Focus |
|-------|--------|-------|---------------|
| 🔧 Core | `platform/services/shared/` | `agent:core` | Domain/Ports |
| 💻 CLI | `platform/services/cli/`, `scripts/` | `agent:cli` | Commands |
| 🖥️ Backend | `platform/services/mcctl-api/` | `agent:backend` | API Routes |
| 🎨 Frontend | `platform/services/mcctl-console/` | `agent:frontend` | UI Pages |
| 🐳 DevOps | `platform/`, `e2e/` | `agent:devops` | Docker/E2E |
| 📝 Docs | `docs/` | `agent:docs` | Documentation |
| 🚀 Release | Git tags, releases | `agent:release` | Releases |

### Typical Dependency Flow

```
Core (Foundation)
   ├─→ CLI (Commands, uses Core interfaces)
   ├─→ Backend (API, uses Core interfaces)
   │      └─→ Frontend (UI, uses Backend API)
   │              └─→ DevOps (Integration, uses all Dockerfiles)
   └─→ DevOps (Service scripts)
```

### Command Reference

```bash
# Orchestrator commands
/work --milestone N              # Start milestone orchestration
/work --issue XX                 # Work on specific issue

# Agent-specific
/work --agent core --issue XX    # Assign to Core agent
/work --agent backend --parallel # Run backend tasks in parallel

# Status
/status --milestone N            # Show progress
/status --agent core             # Show agent status
/deps --issue XX                 # Show dependencies for issue
```

---

## Agent Prompt Files

Each agent has its own prompt file in `.claude/agents/`:

| Agent | Prompt File |
|-------|-------------|
| Orchestrator | `.claude/agents/orchestrator-agent.md` |
| Core | `.claude/agents/core-agent.md` |
| CLI | `.claude/agents/cli-agent.md` |
| Backend | `.claude/agents/backend-agent.md` |
| Frontend | `.claude/agents/frontend-agent.md` |
| DevOps | `.claude/agents/devops-agent.md` |
| Technical Writer | `.claude/agents/technical-writer.md` |
| Release Manager | `.claude/agents/release-manager.md` |

Use these prompts to spawn specialized agents for each domain.
