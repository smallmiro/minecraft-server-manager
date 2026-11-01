# CLAUDE.md - Docker Minecraft Server Project Guide

This project is a DevOps project for building and operating multiple Minecraft Java Edition servers using the `itzg/minecraft-server` Docker image with `itzg/mc-router` for connection routing and auto-scaling.

## Project Structure

pnpm monorepo. 패키지는 `platform/services/` 아래에 있고, 상세 구조는 파일시스템 탐색 또는 `docs/documentforllmagent.md` 참조.

- `platform/services/cli/templates/` is the single source of the templates for `mcctl init`. `platform/docker-compose.yml`, `platform/servers/_template`, and similar paths are symlinks to it.
- The CLI's `prepack` runs `sync-docker`, which copies `docker/bluemap` into the package. There is no `scripts/`.
- mcctl-api (:5001) and mcctl-console (:5000) run natively under PM2. Minecraft servers and mc-router (:25565) run in Docker.
- Agents are in `.claude/agents/`. Skills are in `.claude/skills/` and run as `/name`: `/plan-work` plans and `/work` executes.

## System Requirements

- **Runtime**: Node.js >= 18, Docker Engine >= 24, Docker Compose >= 2.20 (`include` required), PM2 >= 6. Linux and macOS only.
- **Development**: pnpm >= 8, TypeScript >= 5.3.
- `mcctl console init` requires PM2 on `PATH` and stops otherwise (`shared/src/prerequisite/PrerequisiteChecker.ts`). The `pm2` dependency bundled with `mcctl` is used only by `mcctl console service` (`cli/src/infrastructure/pm2-cli.ts`).
- `better-sqlite3` is a native module, so a build toolchain (gcc, make, python) may be required.

## Development Philosophy

### Development Practices

> 아래 방식은 모든 코드 기여에 적용한다. TDD는 회귀를 막고, Tidy First는 리뷰와 롤백 단위를 깨끗하게 유지하기 위해서다.

| Practice | Enforcement |
|----------|-------------|
| **TDD** | Every new feature or bug fix follows Red → Green → Refactor. Tests come BEFORE implementation |
| **Tidy First** | Structural and behavioral changes go in separate commits |
| **DDD** | Use domain entities, value objects, aggregates |
| **Clean Architecture** | Dependency inversion, use cases, ports/adapters. Business logic stays independent of frameworks |
| **Hexagonal Architecture** | All external dependencies sit behind interfaces |

#### Architecture Enforcement

- The domain layer has NO external dependencies.
- Use cases orchestrate domain logic.
- All I/O operations go through adapters.
- Dependencies are injected for testability.

### CLI-First, Web-Ready

All features are implemented via CLI first, with the Web Management UI following. See [docs/development/cli-architecture.md](docs/development/cli-architecture.md) for the CLI's Hexagonal Architecture.

### Multi-Agent Collaboration

Specialized agents own each module. 메인 세션이 orchestrator 프로토콜로 작업을 접수하고 담당 에이전트에게 위임한다. 3개 이상 모듈에 걸친 작업은 `orchestrator-agent`에 조율을 맡길 수 있다.

| Agent | Module |
|-------|--------|
| 🎯 **Orchestrator** | Coordinates work across three or more modules |
| 🔧 **Core** | `platform/services/shared/`, `platform/services/mod-source-*/` |
| 💻 **CLI** | `platform/services/cli/` |
| 🖥️ **Backend** | `platform/services/mcctl-api/` |
| 🎨 **Frontend** | `platform/services/mcctl-console/` |
| 🐳 **DevOps** | `platform/` outside services, `e2e/`, `.github/workflows/`, `.claude/hooks/` |
| 📝 **Technical Writer** | `docs/`, `README*`, `CHANGELOG.md` |
| 🚀 **Release Manager** | Version tagging, CHANGELOG, deployment |

#### Intake Workflow

```
❌ WRONG: 사용자 요청 → 바로 코드 수정
✅ RIGHT: 사용자 요청 → 분석 → 계획 또는 이슈 → 담당 에이전트 위임 → 결과 종합
```

메인 세션의 역할:

1. **작업 접수**: 요청을 분석하여 관련 모듈 식별
2. **에이전트 위임**: 담당 에이전트에게 분석/구현 작업 할당 (경로 매핑·난이도 등급은 `.claude/skills/work/SKILL.md`)
3. **의존성 관리**: 작업 순서와 의존성 추적
4. **병렬 실행**: 독립적인 작업을 worktree로 병렬 처리
5. **동기화 조율**: 에이전트 간 핸드오프와 통합 관리

See [docs/development/agent-collaboration.md](docs/development/agent-collaboration.md) for the collaboration guide and [docs/orchestrator-workflow.md](docs/orchestrator-workflow.md) for the step-by-step workflow.

#### Model Assignment

모델은 버전 없는 별칭(`opus`, `sonnet`)만 쓴다. 새 모델이 나와도 파일을 고치지 않기 위해서다.

| 모델 | 대상 | 이유 |
|------|------|------|
| `opus` | orchestrator-agent, `/plan-work`, `/build-kb` | 작업 분해, 대규모 코드 분석 |
| `sonnet` | core/backend/cli/frontend/devops-agent, release-manager, technical-writer, `/work`, `/sync-docs`, `/write-docs`, `/update-docs` | 범위가 정해진 구현, 절차형 작업, 문서 작성 |

`/work`는 도메인 타입 변경, 미확정 원인, 보안, 데이터 손실 위험이 있는 작업(T2)에서 호출별로 `opus`를 지정한다.

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

Co-Authored-By: Claude <noreply@anthropic.com>
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

**PRs without tests will be rejected** unless they are documentation-only changes or configuration changes with no code logic.

#### Tidy First

**Never mix structural and behavioral changes in the same commit.**

```bash
# Good: Two separate commits
git commit -m "refactor: extract validate_world function"
git commit -m "feat: add world existence check (#7)"

# Bad: Mixed in one commit - AVOID
git commit -m "feat: add validation with new helper function"
```

#### Task Checkpoint (task.md)

Use `task.md` (gitignored) for local work-in-progress tracking.

See [docs/development/git-workflow.md](docs/development/git-workflow.md) for complete details.

#### Issue-Driven Development Workflow

> 이 워크플로우는 모든 개발 작업(버그 수정, 새 기능, 개선, 리팩토링)은 이 프로세스를 따릅니다. **develop 브랜치에서 직접 코드를 수정하는 것은 금지됩니다.**

```
❌ WRONG: 문제 발견 → 바로 코드 수정 → 커밋
✅ RIGHT: 문제 발견 → 분석 → GitHub Issue 생성 → 사용자 승인 → /work 실행
```

**Phase 1: 분석 (Analysis)** - 코드 수정 금지

1. 메인 세션이 문제/요청을 접수하고, 필요 시 담당 에이전트에게 분석을 위임합니다
2. 버그: 근본 원인(Root Cause)과 해결 방안을 도출합니다
3. 기능 요청: 요구사항 분석, 영향 범위, 구현 방안을 도출합니다
4. **이 단계에서 코드 수정은 절대 금지합니다**

**Phase 2: 이슈 생성 (Issue Creation)**

1. 분석 결과를 바탕으로 GitHub Issue를 생성합니다
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
| Orchestrator Workflow | [docs/orchestrator-workflow.md](docs/orchestrator-workflow.md) |
| CLI Architecture | [docs/development/cli-architecture.md](docs/development/cli-architecture.md) |
| Git Workflow | [docs/development/git-workflow.md](docs/development/git-workflow.md) |
| itzg Reference | [docs/itzg-reference/](docs/itzg-reference/) |
| Troubleshooting | [docs/troubleshooting/index.md](docs/troubleshooting/index.md) |
