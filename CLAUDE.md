# CLAUDE.md - Docker Minecraft Server Project Guide

This project is a DevOps project for building and operating multiple Minecraft Java Edition servers using the `itzg/minecraft-server` Docker image with `itzg/mc-router` for connection routing and auto-scaling.

## Project Structure

> pnpm monorepo. 상세 구조는 파일시스템 탐색 또는 `docs/documentforllmagent.md` 참조.

| Directory | Description |
|-----------|-------------|
| `platform/` | Docker platform runtime (docker-compose, .env, servers/, worlds/, shared/) |
| `platform/scripts/` | Bash management scripts (backup.sh, create-server.sh, lock.sh 등) |
| `platform/services/shared/` | `@minecraft-docker/shared` - Domain entities, value objects, use cases, ports/adapters |
| `platform/services/cli/` | `@minecraft-docker/mcctl` - npm CLI (Hexagonal Architecture) |
| `platform/services/mcctl-api/` | `@minecraft-docker/mcctl-api` - Fastify REST API (:5001) |
| `platform/services/mcctl-console/` | `@minecraft-docker/mcctl-console` - Next.js Web UI (:5000) |
| `platform/services/mod-source-modrinth/` | `@minecraft-docker/mod-source-modrinth` - Modrinth adapter |
| `platform/backups/` | Backup storage (worlds/, meta/) |
| `templates/` | npm package templates for `mcctl init` |
| `docs/` | MkDocs documentation (EN/KO), LLM Knowledge Base |
| `e2e/` | Playwright E2E tests |
| `.claude/agents/` | Multi-agent definitions (orchestrator, core, cli, backend, frontend, devops, etc.) |
| `.claude/commands/` | Custom slash commands (work, update-docs, sync-docs, write-docs, build-kb) |

## Custom Commands

> **Note**: Commands are invoked as `/command-name` (not `/project:command-name`)

| Command | Description |
|---------|-------------|
| `/work` | Execute development work based on GitHub Issues/Milestones |
| `/update-docs` | Update docs/itzg-reference/ from official documentation |
| `/sync-docs` | Sync project documentation (CLAUDE.md, README.md) with codebase |
| `/write-docs` | Bilingual (EN/KO) technical documentation writer |
| `/build-kb` | Deep source code analysis to build comprehensive LLM Knowledge Base (2,500-3,000 lines) |

See `.claude/commands/` for detailed command specifications.

## System Requirements

### Runtime (Production)

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| **Node.js** | >= 18.0.0 | All packages |
| **Docker Engine** | >= 24.0.0 | Minecraft server containers |
| **Docker Compose** | >= 2.20.0 | `include` feature required |
| **PM2** | >= 6.0.14 | mcctl-api, mcctl-console process management |

**OS**: Linux, macOS only (mcctl CLI depends on bash scripts)

**Ports**:

| Service | Port |
|---------|------|
| mcctl-api | 5001 |
| mcctl-console | 5000 |
| mc-router | 25565 |

**Notes**:
- PM2 is bundled as a dependency of `mcctl` CLI and installed automatically
- `better-sqlite3` (mcctl-console dependency) is a native module; build toolchain (gcc, make, python) may be required on some environments

### Development Only

| Component | Minimum Version | Notes |
|-----------|-----------------|-------|
| **pnpm** | >= 8.0.0 | Monorepo workspace management |
| **TypeScript** | >= 5.3.0 | Build time |

## Quick Start

```bash
# Install CLI globally
npm install -g @minecraft-docker/mcctl

# Initialize platform
mcctl init

# Create a server
mcctl create myserver -t PAPER -v 1.21.1

# Start all infrastructure
mcctl up

# Check status
mcctl status
```

For full CLI reference, see [docs/cli/commands.md](docs/cli/commands.md).

## Architecture Overview

### Multi-Server with mc-router

```
┌──────────────────────┐  ┌────────────────────┐  ┌─────────────────────┐
│  mc-router (:25565)  │  │  avahi-daemon      │  │  playit-agent       │
│  hostname routing    │  │  (system service)  │  │  (optional)         │
│  auto-scale up/down  │  │  mDNS broadcast    │  │  external access    │
├──────────────────────┤  ├────────────────────┤  ├─────────────────────┤
│ <server>.local ─→    │  │ /etc/avahi/hosts:  │  │ playit.gg cloud ─→  │
│  mc-<server>         │  │  <server>.local    │  │  localhost:25565    │
└──────────────────────┘  └────────────────────┘  └─────────────────────┘
```

**Key Features**:
- Single port (25565) for all servers via hostname routing
- Auto-scale: servers start on client connect, stop after idle timeout
- **nip.io** (Recommended): `<server>.<HOST_IP>.nip.io:25565`
- **mDNS**: `<server>.local:25565` (requires avahi/Bonjour)
- **playit.gg** (External): `xx-xx.craft.playit.gg` (no port forwarding needed)

## Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `EULA` | **Required** | `TRUE` - Minecraft EULA agreement |
| `TYPE` | Recommended | Server type (PAPER, FORGE, NEOFORGE, FABRIC) |
| `VERSION` | Recommended | Minecraft version |
| `MEMORY` | Recommended | JVM memory (e.g., `4G`) |

## Development Philosophy

### Mandatory Development Practices

> **IMPORTANT**: The following practices are **MANDATORY**, not optional. All code contributions MUST follow these principles.

#### Required Practices (Non-Negotiable)

| Practice | Description | Enforcement |
|----------|-------------|-------------|
| **TDD** | Test-Driven Development: Red → Green → Refactor | All new features MUST have tests written BEFORE implementation |
| **Tidy First** | Never mix structural and behavioral changes | Separate commits for refactoring vs features |
| **DDD** | Domain-Driven Design | Use domain entities, value objects, aggregates |
| **Clean Architecture** | Dependency inversion, use cases, ports/adapters | Business logic independent of frameworks |
| **Hexagonal Architecture** | Ports & Adapters pattern | All external dependencies behind interfaces |

#### TDD is NOT Optional

```
❌ WRONG: Write code first, add tests later (or skip tests)
✅ RIGHT: Write failing test → Write minimal code → Refactor
```

Every new command, feature, or bug fix MUST follow the TDD cycle:
1. **Red**: Write a failing test that defines the expected behavior
2. **Green**: Write the minimum code to make the test pass
3. **Refactor**: Clean up while keeping tests green

#### Architecture Enforcement

All TypeScript code MUST follow this layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│              (CLI commands, API routes)                  │
├─────────────────────────────────────────────────────────┤
│                    Application Layer                     │
│           (Use cases, application services)              │
├─────────────────────────────────────────────────────────┤
│                      Domain Layer                        │
│    (Entities, Value Objects, Domain Services, Ports)     │
├─────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                   │
│       (Adapters: DB, External APIs, File System)         │
└─────────────────────────────────────────────────────────┘
```

**Key Rules**:
- Domain layer has NO external dependencies
- Use cases orchestrate domain logic
- All I/O operations go through adapters
- Dependency injection for testability

### XP (Extreme Programming) Methodology

This project follows **XP (Extreme Programming)** practices as the core development methodology.

**Core Practices**:
- **TDD (Test-Driven Development)**: Red → Green → Refactor cycle **(MANDATORY)**
- **Tidy First**: Never mix structural and behavioral changes **(MANDATORY)**
- **Pair Programming**: For complex features and architecture decisions
- **Continuous Integration**: All PRs must pass lint, type-check, test, build
- **Small Releases**: Frequent, incremental deployments

**XP Values**:

| Value | Application |
|-------|-------------|
| Communication | PR reviews, pair programming, documentation |
| Simplicity | YAGNI, minimal code to solve the problem |
| Feedback | TDD, CI/CD, code reviews |
| Courage | Refactoring, addressing technical debt |
| Respect | Code review etiquette, team collaboration |

### CLI-First, Web-Ready

All features are implemented via CLI first, with Web Management UI available.

- **Phase 1**: CLI with Interactive Mode (`platform/services/cli`)
- **Phase 2**: Management Console - REST API + Web Console
  - `mcctl-api`: Fastify REST API on port 5001
  - `mcctl-console`: Next.js Web UI on port 5000

### CLI Architecture

The CLI uses **Hexagonal Architecture** (Ports & Adapters) with **Clean Architecture** principles. This is **MANDATORY** for all CLI code.

See [docs/development/cli-architecture.md](docs/development/cli-architecture.md) for details.

### Multi-Agent Collaboration

This project uses a **Multi-Agent Collaboration** system where specialized agents are responsible for different modules.

> **MANDATORY**: 모든 작업은 반드시 **Orchestrator Agent**를 통해 시작해야 합니다. 사용자의 요청을 직접 처리하지 말고, 먼저 `orchestrator-agent`로 작업을 접수하여 적절한 전문 에이전트에게 분석/구현을 위임하세요.

| Agent | Module | Role |
|-------|--------|------|
| 🎯 **Orchestrator** | All modules | **Entry point for ALL tasks**. 작업 분배, 의존성 추적, 에이전트 간 동기화 조율 |
| 🔧 **Core** | `platform/services/shared/` | Domain entities, value objects, use cases, ports/adapters |
| 💻 **CLI** | `platform/services/cli/`, `scripts/` | CLI commands, interactive prompts, bash scripts |
| 🖥️ **Backend** | `platform/services/mcctl-api/` | Fastify REST API, authentication, OpenAPI/Swagger |
| 🎨 **Frontend** | `platform/services/mcctl-console/` | Next.js Web UI, React components, hooks |
| 🐳 **DevOps** | `platform/`, `e2e/` | Docker, docker-compose, Playwright E2E tests |
| 📝 **Technical Writer** | `docs/` | MkDocs documentation, bilingual (EN/KO) |
| 🚀 **Release Manager** | Git tags, Docker | Version tagging, CHANGELOG, deployment |

#### Orchestrator-First Workflow

```
❌ WRONG: 사용자 요청 → 바로 코드 수정
✅ RIGHT: 사용자 요청 → Orchestrator 접수 → 분석 에이전트 위임 → 결과 종합 → 실행
```

**Orchestrator Agent의 역할**:
1. **작업 접수**: 사용자의 요청/문제를 분석하여 관련 모듈 식별
2. **에이전트 위임**: 적절한 전문 에이전트에게 분석/구현 작업 할당
3. **의존성 관리**: 에이전트 간 작업 순서와 의존성 추적
4. **병렬 실행**: 독립적인 작업을 병렬로 처리하여 효율 극대화
5. **동기화 조율**: 에이전트 간 핸드오프와 통합 관리

See [docs/development/agent-collaboration.md](docs/development/agent-collaboration.md) and [`.claude/agents/orchestrator-agent.md`](.claude/agents/orchestrator-agent.md) for the complete collaboration guide.

### Git-Flow Workflow

This project follows **Git-Flow** branching strategy with **Semantic Versioning**.

| Branch Type | Pattern | Example |
|-------------|---------|---------|
| Feature | `feature/<issue>-<desc>` | `feature/12-add-backup` |
| Bugfix | `bugfix/<issue>-<desc>` | `bugfix/15-fix-lock` |
| Release | `release/<version>` | `release/1.0.0` |

#### Commit Message Format

```
<type>: <description> (#<issue-number>)

<body>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

#### TDD (Test-Driven Development) - MANDATORY

> **This is NOT optional.** Every feature, bug fix, or enhancement MUST follow TDD.

Follow the **Red → Green → Refactor** cycle:
1. **Red**: Write a failing test first
2. **Green**: Write minimal code to make the test pass
3. **Refactor**: Clean up while keeping tests green

**PRs without tests will be rejected** unless:
- Documentation-only changes
- Configuration changes with no code logic

```bash
# Example TDD workflow for a new command
# 1. RED: Write failing test
pnpm test -- --watch src/commands/newcmd.test.ts

# 2. GREEN: Implement minimal code
# 3. REFACTOR: Clean up, then commit
git commit -m "feat(cli): add newcmd command (#123)"
```

#### Tidy First - MANDATORY

> **This is NOT optional.** Structural and behavioral changes MUST be in separate commits.

**Never mix structural and behavioral changes in the same commit.**

```bash
# Good: Two separate commits
git commit -m "refactor: extract validate_world function"
git commit -m "feat: add world existence check (#7)"

# Bad: Mixed in one commit - AVOID
git commit -m "feat: add validation with new helper function"
```

**Why this matters**:
- Easier code review (reviewers can focus on one type of change)
- Safer rollbacks (can revert behavior without losing refactoring)
- Cleaner git history

#### Task Checkpoint (task.md)

Use `task.md` (gitignored) for local work-in-progress tracking:

```markdown
## Working On
- [ ] Implementing lock.sh (#5)

## Context
- Branch: feature/5-world-locking

## Notes
- lock file format: <server>:<timestamp>:<pid>
```

See [docs/development/git-workflow.md](docs/development/git-workflow.md) for complete details.

#### Issue-Driven Development Workflow - MANDATORY

> **IMPORTANT**: 이 워크플로우는 **필수**입니다. 모든 개발 작업(버그 수정, 새 기능, 개선, 리팩토링)은 반드시 이 프로세스를 따릅니다. **develop 브랜치에서 직접 코드를 수정하는 것은 금지됩니다.**

```
❌ WRONG: 문제 발견 → 바로 코드 수정 → 커밋
✅ RIGHT: 문제 발견 → 분석 → GitHub Issue 생성 → 사용자 승인 → /work 실행
```

**Phase 1: 분석 (Analysis)** - 코드 수정 금지

1. `orchestrator-agent`가 문제/요청을 접수하고, 필요 시 전문 에이전트에게 분석을 위임합니다
   - `core-agent`: shared 패키지 관련
   - `cli-agent`: CLI/스크립트 관련
   - `backend-agent`: mcctl-api 관련
   - `frontend-agent`: mcctl-console 관련
   - `devops-agent`: Docker/배포 관련
2. 버그: 근본 원인(Root Cause)과 해결 방안을 도출합니다
3. 기능 요청: 요구사항 분석, 영향 범위, 구현 방안을 도출합니다
4. **이 단계에서 코드 수정은 절대 금지합니다**

**Phase 2: 이슈 생성 (Issue Creation)**

1. `technical-writer`가 분석 결과를 바탕으로 GitHub Issue를 생성합니다
2. 이슈에 반드시 포함할 내용:
   - **Summary**: 문제/기능 요약
   - **Root Cause** (버그) 또는 **Requirements** (기능): 분석 결과
   - **Solution / Implementation Plan**: 해결 방안 또는 구현 계획
   - **Files to Modify**: 수정 대상 파일 목록
   - **Branch Strategy**: Git-Flow 브랜치 전략 (아래 표 참조)
   - **Acceptance Criteria**: 완료 조건
3. 브랜치 전략 결정 기준:

| 유형 | 브랜치 | 기준 |
|------|--------|------|
| **hotfix** | `hotfix/<version>` | 운영 환경 장애, 긴급 버그, 데이터 손실 위험 |
| **bugfix** | `bugfix/<issue>-<desc>` | 일반 버그, 비긴급 수정 |
| **feature** | `feature/<issue>-<desc>` | 새 기능, 개선, 리팩토링 |

**Phase 3: 승인 및 실행 (Approval & Execution)**

1. 사용자에게 생성된 이슈를 공유하고 작업 진행 여부를 확인합니다
2. 승인 시 컨텍스트를 정리한 후 `/work` 명령으로 이슈 기반 작업을 시작합니다
3. `/work`가 이슈 내용에 따라 적절한 브랜치를 생성하고 Git-Flow 워크플로우를 따라 작업합니다

**예외 사항**:
- 오타 수정, 주석 수정 등 1줄 이내의 사소한 변경은 이 워크플로우를 생략할 수 있습니다
- 사용자가 명시적으로 "바로 수정해주세요"라고 요청해도 이슈 생성을 먼저 권고합니다

## Documentation Reference

| Topic | Document |
|-------|----------|
| CLI Commands | [docs/cli/commands.md](docs/cli/commands.md) |
| Getting Started | [docs/getting-started/quickstart.md](docs/getting-started/quickstart.md) |
| Agent Collaboration | [docs/development/agent-collaboration.md](docs/development/agent-collaboration.md) |
| CLI Architecture | [docs/development/cli-architecture.md](docs/development/cli-architecture.md) |
| Git Workflow | [docs/development/git-workflow.md](docs/development/git-workflow.md) |
| itzg Reference | [docs/itzg-reference/](docs/itzg-reference/) |
| Troubleshooting | [docs/troubleshooting/index.md](docs/troubleshooting/index.md) |

## External Resources

- **Official Docs**: https://docker-minecraft-server.readthedocs.io/
- **GitHub**: https://github.com/itzg/docker-minecraft-server
- **Docker Hub**: https://hub.docker.com/r/itzg/minecraft-server/
