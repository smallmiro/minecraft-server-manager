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
│ Phase 8.1    │ │ Phase 8.2    │ │ Phase 8.3    │ │ Phase 8.4    │ │ Phase 8.5    │
│ #80-83       │ │ #84-87       │ │ #88-94       │ │ #95-100      │ │ #101-102     │
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
| **Issues** | #80, #81, #82, #83 |
| **Documents** | `shared/prd.md`, `shared/plan.md` |
| **Expertise** | Hexagonal Architecture, TypeScript, Domain Modeling |

**Assigned Tasks**:
```
#80: IUserRepository port interface
#81: YamlUserRepository adapter
#82: SqliteUserRepository adapter (optional)
#83: ApiPromptAdapter for non-interactive mode
```

**Provides** (→ to other agents):
- `IUserRepository` interface → CLI, Backend
- `YamlUserRepository` implementation → CLI
- `ApiPromptAdapter` → Backend

**Requires** (← from other agents):
- (No dependencies - starts first)

---

### 💻 CLI Agent (cli/)

**Role**: mcctl admin command implementation

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/cli/` |
| **Issues** | #84, #85, #86, #87 |
| **Documents** | `cli/prd.md`, `cli/plan.md` |
| **Expertise** | @clack/prompts, Commander.js, YAML |

**Assigned Tasks**:
```
#84: mcctl admin init command
#85: mcctl admin user command
#86: mcctl admin api command
#87: mcctl admin service command
```

**Provides** (→ to other agents):
- Admin config file spec (`.mcctl-admin.yml`) → Backend, Frontend
- CLI command interface → DevOps (service command)

**Requires** (← from other agents):
- `IUserRepository`, `YamlUserRepository` ← Core (#80, #81)
- API/Console Dockerfile ← Backend, Frontend (#94, #100)

---

### 🖥️ Backend Agent (mcctl-api/)

**Role**: REST API server development

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/mcctl-api/` |
| **Issues** | #88, #89, #90, #91, #92, #93, #94 |
| **Documents** | `mcctl-api/prd.md`, `mcctl-api/plan.md` |
| **Expertise** | Fastify, REST API, Authentication, OpenAPI |

**Assigned Tasks**:
```
#88: Fastify project foundation
#89: Authentication plugin (5 access modes)
#90: Server management routes
#91: World management routes
#92: Player management routes
#93: OpenAPI/Swagger documentation
#94: Dockerfile and container build
```

**Provides** (→ to other agents):
- REST API endpoint spec → Frontend
- OpenAPI documentation → Frontend, DevOps
- Docker image → DevOps

**Requires** (← from other agents):
- `ApiPromptAdapter` ← Core (#83)
- shared Use Cases ← Core (existing)

---

### 🎨 Frontend Agent (mcctl-console/)

**Role**: Web Management Console development

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/services/mcctl-console/` |
| **Issues** | #95, #96, #97, #98, #99, #100 |
| **Documents** | `mcctl-console/prd.md`, `mcctl-console/plan.md` |
| **Expertise** | Next.js, React, Tailwind CSS, NextAuth.js |

**Assigned Tasks**:
```
#95: Next.js project foundation
#96: NextAuth.js authentication
#97: BFF proxy layer
#98: Dashboard UI
#99: Server management pages
#100: Dockerfile and container build
```

**Provides** (→ to other agents):
- Docker image → DevOps
- UI component spec → (documentation)

**Requires** (← from other agents):
- API endpoint spec ← Backend (#88-92)
- Auth plugin spec ← Backend (#89)

---

### 🐳 DevOps Agent (Integration)

**Role**: Docker integration and E2E testing

| Attribute | Description |
|-----------|-------------|
| **Module** | `platform/` (docker-compose), `e2e/` |
| **Issues** | #101, #102 |
| **Documents** | `platform/README.md`, `e2e/README.md` |
| **Expertise** | Docker Compose, Playwright, CI/CD |

**Assigned Tasks**:
```
#101: Docker Compose integration
#102: E2E tests with Playwright
```

**Provides** (→ to other agents):
- Integration test results → All
- Deployment guide → (documentation)

**Requires** (← from other agents):
- API Dockerfile ← Backend (#94)
- Console Dockerfile ← Frontend (#100)
- CLI service command ← CLI (#87)

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
  issue: "#80"
  title: "feat(shared): Add IUserRepository port interface"
  priority: high
  deadline: null
  context:
    milestone: 5
    phase: "8.1"
    dependencies: []
```

**Dependency Ready (DEPENDENCY_READY)**:
```yaml
type: DEPENDENCY_READY
from: core
to: broadcast  # to both cli and backend
payload:
  issue: "#80"
  artifact: "IUserRepository interface"
  location: "shared/src/application/ports/outbound/IUserRepository.ts"
  exports:
    - "User"
    - "IUserRepository"
  usage_example: |
    import { IUserRepository, User } from '@minecraft-docker/shared';
```

**Work Complete (WORK_COMPLETE)**:
```yaml
type: WORK_COMPLETE
from: core
to: orchestrator
payload:
  issue: "#80"
  status: completed
  artifacts:
    - path: "shared/src/application/ports/outbound/IUserRepository.ts"
      type: "interface"
    - path: "shared/src/index.ts"
      type: "export"
  tests_passed: true
  ready_for_merge: true
  unblocks: ["#81", "#82", "#84", "#88"]
```

**Blocking Issue (BLOCKING_ISSUE)**:
```yaml
type: BLOCKING_ISSUE
from: frontend
to: orchestrator
payload:
  issue: "#97"
  blocked_by: "#89"
  reason: "Need auth plugin spec to implement BFF proxy"
  suggested_action: "Request Backend agent to share auth spec early"
```

---

## Execution Flow

### Phase 1: Initialization

```
Orchestrator                    All Agents
    │                               │
    │  1. WORK_REQUEST (#80)        │
    │──────────────────────────────▶│ Core
    │                               │
    │  2. WORK_REQUEST (#88)        │
    │──────────────────────────────▶│ Backend (parallel - foundation)
    │                               │
    │  3. WORK_REQUEST (#95)        │
    │──────────────────────────────▶│ Frontend (parallel - foundation)
    │                               │
```

### Phase 2: Dependency Resolution

```
Core                 Orchestrator              CLI / Backend
  │                       │                         │
  │ WORK_COMPLETE (#80)   │                         │
  │──────────────────────▶│                         │
  │                       │                         │
  │                       │ DEPENDENCY_READY        │
  │                       │────────────────────────▶│
  │                       │                         │
  │                       │ WORK_REQUEST (#81,#84)  │
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
│  #81 YamlRepo        #84 admin init    #89 Auth Plugin          │
│       │                   │                  │                   │
│       ▼                   ▼                  ▼                   │
│  #82 SqliteRepo      #85 user cmd      #90 Server Routes        │
│  (optional)               │                  │                   │
│       │                   │                  │                   │
│       ▼                   ▼                  ▼                   │
│  #83 ApiPrompt       #86 api cmd       #91 World Routes         │
│                           │                  │                   │
│                           ▼                  ▼                   │
│                                         #92 Player Routes       │
│                                              │                   │
│                                              ▼                   │
│                                         #93 Swagger             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 4: Sync Point - API Spec Ready

```
Backend                Orchestrator              Frontend
   │                        │                        │
   │ WORK_COMPLETE (#93)    │                        │
   │ (Swagger Ready)        │                        │
   │───────────────────────▶│                        │
   │                        │                        │
   │                        │ SYNC: API_SPEC_READY   │
   │                        │───────────────────────▶│
   │                        │                        │
   │                        │ WORK_REQUEST (#97)     │
   │                        │───────────────────────▶│
   │                        │                        │
```

### Phase 5: Docker & Integration

```
Backend / Frontend          Orchestrator              DevOps
       │                         │                       │
       │ WORK_COMPLETE           │                       │
       │ (#94, #100)             │                       │
       │────────────────────────▶│                       │
       │                         │                       │
       │                         │ DEPENDENCY_READY      │
       │                         │ (Both Dockerfiles)    │
       │                         │──────────────────────▶│
       │                         │                       │
       │                         │ WORK_REQUEST (#101)   │
       │                         │──────────────────────▶│
       │                         │                       │
```

---

## Parallel Execution Matrix

### Identifying Parallelizable Tasks

| Group | Issues | Agents | Prerequisites |
|-------|--------|--------|---------------|
| **P1** | #80, #88, #95 | Core, Backend, Frontend | None (start) |
| **P2** | #81, #82, #89, #96 | Core, Backend, Frontend | P1 complete |
| **P3** | #83, #84, #90, #91, #92, #97 | Core, CLI, Backend, Frontend | Partial dependencies |
| **P4** | #85, #86, #93, #98, #99 | CLI, Backend, Frontend | P3 complete |
| **P5** | #87, #94, #100 | CLI, Backend, Frontend | P4 complete |
| **P6** | #101, #102 | DevOps | P5 complete |

### Detailed Dependency Graph

```
Legend: ─── direct dependency
        ··· optional/weak dependency

#80 ───┬─── #81 ───┬─── #84 ─── #85 ───┐
       │           │                    │
       ├─── #82    │                    ├─── #86 ─── #87
       │   (opt)   │                    │
       │           └··· #88 ─── #89 ───┼─── #90 ───┐
       │                       │       │           │
       └─── #83 ───────────────┘       ├─── #91 ──┼─── #93 ─── #94
                                       │           │
                                       └─── #92 ───┘
                                               │
#95 ─── #96 ───────────────────────────────────┼─── #97 ─── #98 ─── #99 ─── #100
                                               │
                                               ▼
                                    #94 + #100 ─── #101 ─── #102
```

---

## Sync Points

### Required Synchronization Points

| Sync ID | Condition | Participating Agents | Purpose |
|---------|-----------|---------------------|---------|
| **SYNC-1** | #80 complete | Core → All | Share IUserRepository interface |
| **SYNC-2** | #89 complete | Backend → Frontend | Share Auth spec (for BFF) |
| **SYNC-3** | #93 complete | Backend → Frontend | Share OpenAPI spec |
| **SYNC-4** | #94, #100 complete | Backend, Frontend → DevOps | Docker images ready |
| **SYNC-5** | #101 complete | DevOps → All | Integration test environment ready |

### Information Shared at Sync Points

**SYNC-1: Interface Ready**
```yaml
sync: SYNC-1
artifacts:
  - file: "shared/src/application/ports/outbound/IUserRepository.ts"
    exports: ["User", "IUserRepository"]

usage:
  cli: "Used for YamlUserRepository implementation"
  backend: "Used for future DB integration"
```

**SYNC-2: Auth Spec Ready**
```yaml
sync: SYNC-2
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

**SYNC-3: API Spec Ready**
```yaml
sync: SYNC-3
artifacts:
  - file: "mcctl-api/docs/openapi.json"
  - url: "http://localhost:3001/docs"

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
<!-- platform/services/shared/plan.md -->
# Shared Package Plan (Phase 8.1)

## Progress

| Issue | Title | Status | Agent | Updated |
|-------|-------|--------|-------|---------|
| #80 | IUserRepository port | ✅ Complete | core | 2025-01-26 |
| #81 | YamlUserRepository | 🔄 In Progress | core | 2025-01-26 |
| #82 | SqliteUserRepository | ⏳ Pending | - | - |
| #83 | ApiPromptAdapter | ⏳ Blocked by #80 | - | - |

## Dependencies Provided
- [x] IUserRepository → CLI, Backend
- [ ] YamlUserRepository → CLI
- [ ] ApiPromptAdapter → Backend

## Sync Points
- [x] SYNC-1: IUserRepository interface shared
```

### Dashboard View

```
┌─────────────────────────────────────────────────────────────────┐
│                  MILESTONE 5 PROGRESS DASHBOARD                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Overall: ████████░░░░░░░░░░░░ 35% (8/23 issues)                │
│                                                                  │
│  🔧 Core (shared/)      ████████████░░░░░░░░ 50% (2/4)          │
│     #80 ✅  #81 🔄  #82 ⏳  #83 ⏳                               │
│                                                                  │
│  💻 CLI (cli/)          ████░░░░░░░░░░░░░░░░ 25% (1/4)          │
│     #84 🔄  #85 ⏳  #86 ⏳  #87 ⏳                               │
│                                                                  │
│  🖥️ Backend (mcctl-api/) ██████░░░░░░░░░░░░░░ 29% (2/7)          │
│     #88 ✅  #89 🔄  #90 ⏳  #91 ⏳  #92 ⏳  #93 ⏳  #94 ⏳       │
│                                                                  │
│  🎨 Frontend (console/)  ████████░░░░░░░░░░░░ 33% (2/6)          │
│     #95 ✅  #96 🔄  #97 ⏳  #98 ⏳  #99 ⏳  #100 ⏳              │
│                                                                  │
│  🐳 DevOps (integration) ░░░░░░░░░░░░░░░░░░░░ 0% (0/2)           │
│     #101 ⏳  #102 ⏳                                             │
│                                                                  │
│  Legend: ✅ Complete  🔄 In Progress  ⏳ Pending  🚫 Blocked     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Handling Blockers

```yaml
scenario: "Frontend #97 blocked by Backend #89"

resolution_steps:
  1. Frontend sends BLOCKING_ISSUE to Orchestrator
  2. Orchestrator checks Backend progress
  3. Options:
     a. If #89 near completion → Wait
     b. If #89 delayed → Request early spec sharing
     c. If #89 blocked → Escalate and replan

message_flow:
  frontend → orchestrator: "BLOCKING_ISSUE: #97 needs #89"
  orchestrator → backend: "SYNC_REQUEST: Share auth spec early"
  backend → frontend: "DEPENDENCY_READY: Auth spec (partial)"
  frontend: Proceeds with partial spec, marks for later update
```

### Rollback Handling

```yaml
scenario: "Integration test fails in #101"

resolution_steps:
  1. DevOps reports BLOCKING_ISSUE with test results
  2. Orchestrator analyzes failure root cause
  3. Assigns fix task to responsible agent
  4. Re-runs integration after fix

message_flow:
  devops → orchestrator: "BLOCKING_ISSUE: API auth failure in E2E"
  orchestrator → backend: "REVIEW_REQUEST: Auth plugin issue"
  backend → orchestrator: "WORK_COMPLETE: Fix applied"
  orchestrator → devops: "WORK_REQUEST: Re-run E2E tests"
```

---

## Quick Reference

### Agent Contact Points

| Agent | Module | PRD | Plan | Primary Focus |
|-------|--------|-----|------|---------------|
| 🔧 Core | shared/ | shared/prd.md | shared/plan.md | Domain/Ports |
| 💻 CLI | cli/ | cli/prd.md | cli/plan.md | Commands |
| 🖥️ Backend | mcctl-api/ | mcctl-api/prd.md | mcctl-api/plan.md | API Routes |
| 🎨 Frontend | mcctl-console/ | mcctl-console/prd.md | mcctl-console/plan.md | UI Pages |
| 🐳 DevOps | platform/ | - | - | Docker/E2E |

### Issue Quick Map

```
Phase 8.1 (Core):     #80 → #81 → #82* → #83
Phase 8.2 (CLI):      #84 → #85 → #86 → #87
Phase 8.3 (Backend):  #88 → #89 → #90,#91,#92 → #93 → #94
Phase 8.4 (Frontend): #95 → #96 → #97 → #98 → #99 → #100
Phase 8.5 (DevOps):   #101 → #102

* #82 is optional
```

### Command Reference

```bash
# Orchestrator commands
/work --milestone 5              # Start milestone orchestration
/work --issue 80                 # Work on specific issue

# Agent-specific
/work --agent core --issue 80    # Assign to Core agent
/work --agent backend --parallel # Run backend tasks in parallel

# Status
/status --milestone 5            # Show progress
/status --agent core             # Show agent status
/deps --issue 97                 # Show dependencies for issue
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

Use these prompts to spawn specialized agents for each domain.
