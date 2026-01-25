#!/bin/bash

# Update Milestone 5 issues with agent collaboration info

update_issue() {
    local issue_num=$1
    local agent_header=$2

    # Get current body
    local current_body=$(gh issue view $issue_num --json body -q '.body')

    # Check if already has agent info
    if echo "$current_body" | grep -q "## 🤖 Agent Assignment"; then
        echo "Issue #$issue_num already has agent info, skipping..."
        return
    fi

    # Combine new header with existing body
    local new_body="${agent_header}

---

${current_body}"

    # Update issue
    gh issue edit $issue_num --body "$new_body"
    echo "Updated issue #$issue_num"
}

# Phase 8.1 - Core Agent (shared/)
# #80
update_issue 80 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🔧 **Core Agent** |
| **Module** | `platform/services/shared/` |
| **Phase** | 8.1 - Shared Package Extension |
| **Parallel Group** | P1 (can start immediately) |

### Collaboration

| Type | Details |
|------|---------|
| **Parallel With** | #88 (Backend), #95 (Frontend) |
| **Blocks** | #81, #82, #83, #84, #88 |
| **Sync Point** | **SYNC-1**: Share interface with CLI, Backend after completion |

### Agent Instructions
1. Read PRD: `platform/services/shared/prd.md`
2. Update plan: `platform/services/shared/plan.md`
3. Follow Hexagonal Architecture patterns
4. After completion, send **DEPENDENCY_READY** to Orchestrator

### Request Collaboration If Needed
- **Orchestrator**: For dependency issues or blocking problems
- **CLI Agent**: For interface usage clarification'

# #81
update_issue 81 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🔧 **Core Agent** |
| **Module** | `platform/services/shared/` |
| **Phase** | 8.1 - Shared Package Extension |
| **Parallel Group** | P2 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #80 (IUserRepository) |
| **Parallel With** | #82, #89 (Backend), #96 (Frontend) |
| **Blocks** | #84 (CLI admin init) |

### Agent Instructions
1. Wait for #80 completion (SYNC-1)
2. Implement IUserRepository for YAML storage
3. Use bcrypt for password hashing
4. After completion, notify CLI Agent

### Request Collaboration If Needed
- **CLI Agent**: For YAML config file format alignment'

# #82
update_issue 82 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🔧 **Core Agent** |
| **Module** | `platform/services/shared/` |
| **Phase** | 8.1 - Shared Package Extension |
| **Parallel Group** | P2 |
| **Priority** | **LOW** (Optional for v2.0.0) |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #80 (IUserRepository) |
| **Parallel With** | #81, #89, #96 |
| **Blocks** | None (optional) |

### Agent Instructions
1. This is **OPTIONAL** for v2.0.0 release
2. Only implement if time permits after #81, #83
3. Use better-sqlite3 for database operations

### Request Collaboration If Needed
- **Orchestrator**: To confirm if this should be implemented'

# #83
update_issue 83 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🔧 **Core Agent** |
| **Module** | `platform/services/shared/` |
| **Phase** | 8.1 - Shared Package Extension |
| **Parallel Group** | P3 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #80 (IUserRepository interface pattern) |
| **Parallel With** | #84, #90, #91, #92, #97 |
| **Blocks** | #88 (Backend uses this for non-interactive mode) |

### Agent Instructions
1. Implement IPromptPort for API/non-interactive contexts
2. Constructor accepts pre-configured values
3. Throw clear errors for missing required values
4. After completion, send **DEPENDENCY_READY** to Backend Agent

### Request Collaboration If Needed
- **Backend Agent**: For understanding how API will use this adapter'

# Phase 8.2 - CLI Agent
# #84
update_issue 84 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 💻 **CLI Agent** |
| **Module** | `platform/services/cli/` |
| **Phase** | 8.2 - CLI Admin Commands |
| **Parallel Group** | P3 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #80 (IUserRepository), #81 (YamlUserRepository) |
| **Parallel With** | #83, #90, #91, #92, #97 |
| **Blocks** | #85, #86 |

### Agent Instructions
1. Read PRD: `platform/services/cli/prd.md`
2. Update plan: `platform/services/cli/plan.md`
3. Use @clack/prompts for interactive UI
4. Generate `.mcctl-admin.yml` config file
5. Coordinate with Core Agent for YamlUserRepository usage

### Request Collaboration If Needed
- **Core Agent**: For IUserRepository/YamlUserRepository usage
- **Backend Agent**: For API key format alignment'

# #85
update_issue 85 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 💻 **CLI Agent** |
| **Module** | `platform/services/cli/` |
| **Phase** | 8.2 - CLI Admin Commands |
| **Parallel Group** | P4 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #84 (admin init) |
| **Parallel With** | #86, #93, #98, #99 |
| **Blocks** | None |

### Agent Instructions
1. Implement user CRUD operations
2. Both interactive and CLI modes
3. Cannot delete last admin user (safety check)

### Request Collaboration If Needed
- **Core Agent**: For user repository operations'

# #86
update_issue 86 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 💻 **CLI Agent** |
| **Module** | `platform/services/cli/` |
| **Phase** | 8.2 - CLI Admin Commands |
| **Parallel Group** | P4 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #84 (admin init) |
| **Parallel With** | #85, #93, #98, #99 |
| **Blocks** | None |

### Agent Instructions
1. Implement API configuration management
2. Support 5 access modes
3. IP whitelist with CIDR notation support

### Request Collaboration If Needed
- **Backend Agent**: For access mode specification alignment'

# #87
update_issue 87 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 💻 **CLI Agent** |
| **Module** | `platform/services/cli/` |
| **Phase** | 8.2 - CLI Admin Commands |
| **Parallel Group** | P5 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #94 (API Dockerfile), #100 (Console Dockerfile) |
| **Parallel With** | #94, #100 |
| **Blocks** | #101 (DevOps needs this for integration) |

### Agent Instructions
1. Wait for both Dockerfiles to be ready
2. Implement Docker Compose integration
3. Health check verification before reporting "Running"

### Request Collaboration If Needed
- **Backend Agent**: For API container health check endpoint
- **Frontend Agent**: For Console container health check endpoint
- **DevOps Agent**: For Docker Compose configuration'

# Phase 8.3 - Backend Agent
# #88
update_issue 88 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P1 (can start immediately) |

### Collaboration

| Type | Details |
|------|---------|
| **Parallel With** | #80 (Core), #95 (Frontend) |
| **Blocks** | #89, #90, #91, #92, #93, #94 |

### Agent Instructions
1. Read PRD: `platform/services/mcctl-api/prd.md`
2. Update plan: `platform/services/mcctl-api/plan.md`
3. Setup Fastify with TypeScript
4. Create /health endpoint immediately

### Request Collaboration If Needed
- **Core Agent**: For shared package integration'

# #89
update_issue 89 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P2 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #88 (Fastify foundation) |
| **Parallel With** | #81, #82, #96 |
| **Blocks** | #90, #91, #92, #97 (Frontend BFF needs auth spec) |
| **Sync Point** | **SYNC-2**: Share auth spec with Frontend after completion |

### Agent Instructions
1. Implement 5 access modes: internal, api-key, ip-whitelist, api-key-ip, open
2. After completion, send **SYNC-2** to Frontend Agent
3. Include auth spec documentation for BFF proxy

### Request Collaboration If Needed
- **Frontend Agent**: Proactively share auth spec early if requested
- **CLI Agent**: For API key format alignment'

# #90
update_issue 90 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P3 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #89 (Auth plugin) |
| **Parallel With** | #83, #84, #91, #92, #97 |
| **Blocks** | #93 (Swagger needs routes) |

### Agent Instructions
1. Implement server CRUD and control endpoints
2. Use TypeBox for request/response schemas
3. Reuse shared Use Cases where possible

### Request Collaboration If Needed
- **Core Agent**: For shared Use Case integration'

# #91
update_issue 91 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P3 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #89 (Auth plugin) |
| **Parallel With** | #83, #84, #90, #92, #97 |
| **Blocks** | #93 (Swagger needs routes) |

### Agent Instructions
1. Implement world CRUD endpoints
2. Handle lock status properly
3. Cannot delete world while assigned

### Request Collaboration If Needed
- **Core Agent**: For world entity integration'

# #92
update_issue 92 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P3 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #89 (Auth plugin) |
| **Parallel With** | #83, #84, #90, #91, #97 |
| **Blocks** | #93 (Swagger needs routes) |

### Agent Instructions
1. Implement player management endpoints
2. Integrate with player cache from shared package
3. Handle offline server errors gracefully

### Request Collaboration If Needed
- **Core Agent**: For player cache integration'

# #93
update_issue 93 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P4 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #90, #91, #92 (All routes) |
| **Parallel With** | #85, #86, #98, #99 |
| **Blocks** | #94 (Dockerfile), #97 (Frontend needs spec) |
| **Sync Point** | **SYNC-3**: Share OpenAPI spec with Frontend after completion |

### Agent Instructions
1. Use @fastify/swagger and @fastify/swagger-ui
2. Document all routes with schemas and examples
3. After completion, send **SYNC-3** to Frontend Agent

### Request Collaboration If Needed
- **Frontend Agent**: Share spec early if requested for React Query hooks'

# #94
update_issue 94 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🖥️ **Backend Agent** |
| **Module** | `platform/services/mcctl-api/` |
| **Phase** | 8.3 - mcctl-api Service |
| **Parallel Group** | P5 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #93 (All features complete) |
| **Parallel With** | #87, #100 |
| **Blocks** | #101 (DevOps Docker Compose) |
| **Sync Point** | **SYNC-4**: Both #94 and #100 must complete for DevOps |

### Agent Instructions
1. Multi-stage Docker build
2. Image size < 200MB
3. Health check at /health
4. Non-root user for security

### Request Collaboration If Needed
- **DevOps Agent**: For Dockerfile best practices
- **Frontend Agent**: Coordinate SYNC-4 timing'

# Phase 8.4 - Frontend Agent
# #95
update_issue 95 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🎨 **Frontend Agent** |
| **Module** | `platform/services/mcctl-console/` |
| **Phase** | 8.4 - mcctl-console Service |
| **Parallel Group** | P1 (can start immediately) |

### Collaboration

| Type | Details |
|------|---------|
| **Parallel With** | #80 (Core), #88 (Backend) |
| **Blocks** | #96, #97, #98, #99, #100 |

### Agent Instructions
1. Read PRD: `platform/services/mcctl-console/prd.md`
2. Update plan: `platform/services/mcctl-console/plan.md`
3. Setup Next.js 14+ with App Router
4. Configure dark theme with Tailwind CSS
5. Setup shadcn/ui components

### Request Collaboration If Needed
- **Backend Agent**: For API endpoint preview'

# #96
update_issue 96 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🎨 **Frontend Agent** |
| **Module** | `platform/services/mcctl-console/` |
| **Phase** | 8.4 - mcctl-console Service |
| **Parallel Group** | P2 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #95 (Next.js foundation) |
| **Parallel With** | #81, #82, #89 |
| **Blocks** | #97 (BFF needs auth) |

### Agent Instructions
1. Use NextAuth.js v5
2. Credentials provider for username/password
3. Protect all routes except /login

### Request Collaboration If Needed
- **Backend Agent**: For user validation API if needed'

# #97
update_issue 97 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🎨 **Frontend Agent** |
| **Module** | `platform/services/mcctl-console/` |
| **Phase** | 8.4 - mcctl-console Service |
| **Parallel Group** | P3 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #96 (NextAuth), **SYNC-2** (#89 Auth spec) |
| **Parallel With** | #83, #84, #90, #91, #92 |
| **Blocks** | #98, #99 |

### Agent Instructions
1. **IMPORTANT**: Wait for SYNC-2 from Backend Agent
2. Forward requests to mcctl-api with auth headers
3. Create React Query hooks for data fetching

### Request Collaboration If Needed
- **Backend Agent**: Request early auth spec share if blocked
- **Orchestrator**: If SYNC-2 is delayed'

# #98
update_issue 98 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🎨 **Frontend Agent** |
| **Module** | `platform/services/mcctl-console/` |
| **Phase** | 8.4 - mcctl-console Service |
| **Parallel Group** | P4 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #97 (BFF proxy) |
| **Parallel With** | #85, #86, #93, #99 |
| **Blocks** | #100 (Dockerfile) |

### Agent Instructions
1. Implement dashboard with server status cards
2. Real-time updates with 5s refresh interval
3. Quick actions for start/stop all

### Request Collaboration If Needed
- **Backend Agent**: For API response format verification'

# #99
update_issue 99 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🎨 **Frontend Agent** |
| **Module** | `platform/services/mcctl-console/` |
| **Phase** | 8.4 - mcctl-console Service |
| **Parallel Group** | P4 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #98 (Dashboard) |
| **Parallel With** | #85, #86, #93 |
| **Blocks** | #100 (Dockerfile) |

### Agent Instructions
1. Server list with filtering/search
2. Server detail with tabs (Overview, Players, Console, Config)
3. Console log viewer with RCON input

### Request Collaboration If Needed
- **Backend Agent**: For RCON command execution API'

# #100
update_issue 100 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🎨 **Frontend Agent** |
| **Module** | `platform/services/mcctl-console/` |
| **Phase** | 8.4 - mcctl-console Service |
| **Parallel Group** | P5 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #99 (All features complete) |
| **Parallel With** | #87, #94 |
| **Blocks** | #101 (DevOps Docker Compose) |
| **Sync Point** | **SYNC-4**: Both #94 and #100 must complete for DevOps |

### Agent Instructions
1. Multi-stage Docker build with Next.js standalone
2. Image size < 150MB
3. Health check at /api/health
4. Non-root user for security

### Request Collaboration If Needed
- **DevOps Agent**: For Dockerfile best practices
- **Backend Agent**: Coordinate SYNC-4 timing'

# Phase 8.5 - DevOps Agent
# #101
update_issue 101 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🐳 **DevOps Agent** |
| **Module** | `platform/` |
| **Phase** | 8.5 - Integration & Testing |
| **Parallel Group** | P6 |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | **SYNC-4** (#94 + #100 Dockerfiles), #87 (CLI service cmd) |
| **Parallel With** | None (sequential after SYNC-4) |
| **Blocks** | #102 (E2E tests) |
| **Sync Point** | **SYNC-5**: Notify all agents when integration env ready |

### Agent Instructions
1. Wait for SYNC-4 (both Dockerfiles ready)
2. Create docker-compose.admin.yml
3. Configure networking, volumes, health checks
4. After completion, send **SYNC-5** to all agents

### Request Collaboration If Needed
- **Backend Agent**: For API container configuration
- **Frontend Agent**: For Console container configuration
- **CLI Agent**: For mcctl admin service integration'

# #102
update_issue 102 '## 🤖 Agent Assignment

| Attribute | Value |
|-----------|-------|
| **Assigned Agent** | 🐳 **DevOps Agent** |
| **Module** | `e2e/` |
| **Phase** | 8.5 - Integration & Testing |
| **Parallel Group** | P6 (final) |

### Collaboration

| Type | Details |
|------|---------|
| **Depends On** | #101 (Docker Compose integration) |
| **Parallel With** | None (final issue) |
| **Blocks** | None (milestone completion) |

### Agent Instructions
1. Setup Playwright with all dependencies
2. Create test suites: auth, dashboard, servers, worlds
3. Configure GitHub Actions workflow
4. Screenshot capture on failure

### Request Collaboration If Needed
- **All Agents**: For bug fixes if E2E tests reveal issues
- **Orchestrator**: Report milestone completion status'

echo "All issues updated!"
