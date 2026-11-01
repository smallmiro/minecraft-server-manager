---
description: "Builds an execution plan with task breakdown, dependencies, parallel groups, and agent assignments, without changing code. Use before multi-module or design-heavy work (작업 계획, 업무 계획 수립)."
argument-hint: "[--issue <N> | --milestone <N> | --issues <N1,N2,...>]"
model: opus
---

# Work Planning - 업무 계획 수립

이 커맨드는 전체 업무, 마일스톤, 이슈 단위로 업무 계획을 수립합니다.
**계획만 수립하고 실행은 하지 않습니다.** 실행은 `/work` 커맨드로 진행합니다.

## Usage

```bash
/plan-work                           # 대화 컨텍스트 기반 계획 수립
/plan-work --issue <number>          # 단일 이슈 작업 계획
/plan-work --milestone <number>      # 마일스톤 전체 작업 계획
/plan-work --issues <n1,n2,n3,...>   # 복수 이슈 작업 계획
```

---

## Options

| Option | Description |
|--------|-------------|
| (none) | **Context Mode**: 대화 내용을 분석하여 계획 수립 |
| `--issue <N>` | 단일 이슈 #N에 대한 작업 계획 |
| `--milestone <N>` | 마일스톤 N의 전체 이슈에 대한 작업 계획 |
| `--issues <N1,N2,...>` | 지정한 이슈들에 대한 작업 계획 |

---

## Core Principle: 계획만 수립, 실행 안 함

이 커맨드의 산출물은 **실행 계획서**입니다:
- 작업 분해 (Work Breakdown Structure)
- 의존성 분석 (Dependency Analysis)
- 병렬 실행 그룹 (Parallel Execution Groups)
- 팀 구성안 (Team Composition) 또는 서브에이전트 구성안
- 예상 작업 흐름 (Expected Workflow)

코드 수정, 브랜치 생성, PR 생성 등의 **실행 작업은 절대 하지 않습니다.**

---

## Phase 1: 정보 수집

### Context Mode (옵션 없음)
```
1. 대화 컨텍스트 분석
2. 요구사항 식별
3. 영향 범위 파악 (어떤 모듈/파일에 영향을 주는지)
```

### Issue Mode (`--issue`)
```bash
gh issue view <number> --json number,title,body,labels,milestone,assignees
```

### Milestone Mode (`--milestone`)
```bash
# 마일스톤 정보
gh api repos/{owner}/{repo}/milestones/<number>

# 마일스톤 내 이슈 목록
gh issue list --milestone <number> --state open --json number,title,body,labels
```

### Multi-Issue Mode (`--issues`)
```bash
# 각 이슈 정보 수집
for N in <issue_numbers>; do
  gh issue view $N --json number,title,body,labels,milestone
done
```

---

## Phase 2: 작업 분해 (Work Breakdown)

수집된 정보를 기반으로 작업을 분해합니다.

### 분해 기준

| 단위 | 설명 | 예시 |
|------|------|------|
| **Epic** | 마일스톤 또는 대규모 기능 | "Management Console v2.0" |
| **Story** | 하나의 GitHub Issue | "#431 TypeError 수정" |
| **Task** | Issue 내 개별 작업 항목 | "null guard 추가", "테스트 작성" |
| **Sub-task** | Task의 세부 구현 단계 | "getNextPageParam 수정" |

### 모듈 영향 분석

각 작업이 어떤 모듈에 영향을 주는지 식별합니다:

| 모듈 | 디렉토리 | 담당 에이전트 |
|------|----------|--------------|
| Core (shared) | `platform/services/shared/` | `core-agent` |
| CLI | `platform/services/cli/` | `cli-agent` |
| Backend API | `platform/services/mcctl-api/` | `backend-agent` |
| Frontend Console | `platform/services/mcctl-console/` | `frontend-agent` |
| DevOps/Platform | `platform/`, `e2e/` | `devops-agent` |

### 설계 필요 여부 판단

> Architect 에이전트(`system-/backend-/frontend-/devops-architect`, `quality-engineer`)는 사용자 레벨 에이전트로 저장소에 포함되어 있지 않아 **선택 사항**입니다. 없으면 메인 세션이나 담당 구현 에이전트가 설계 단계를 맡습니다.

| 조건 | 필요한 설계 에이전트 |
|------|---------------------|
| 새로운 시스템 구조, 모듈 간 인터페이스 | `system-architect` |
| 새로운 API 엔드포인트, DB 스키마 | `backend-architect` |
| 새로운 페이지/컴포넌트 구조 | `frontend-architect` |
| UI/UX 디자인, 화면 레이아웃 | `frontend-design` skill |
| 단순 버그 수정, 기존 패턴 따르는 작업 | 설계 불필요 |

---

## Phase 3: 의존성 분석

### 의존성 식별 방법

1. **이슈 본문 키워드**: "depends on #N", "blocked by #N", "after #N"
2. **모듈 의존성**: shared → cli/api/console (shared가 먼저)
3. **파일 충돌**: 같은 파일을 수정하는 작업은 순차 처리
4. **인터페이스 의존성**: 타입/인터페이스 정의 → 구현

### 의존성 그래프 작성

```
예시:
Task A (shared 타입 정의) ─┬→ Task B (API 구현)
                           └→ Task C (Frontend 구현)
Task B ──→ Task D (E2E 테스트)
Task C ──→ Task D
```

---

## Phase 4: 병렬 실행 그룹 분류

### 병렬 가능 조건

| 조건 | 병렬 가능 |
|------|-----------|
| 서로 다른 모듈 수정 | O |
| 같은 모듈이지만 다른 파일 | O |
| 의존 관계 없음 | O |
| 같은 파일 수정 | X |
| 선행 작업의 산출물 필요 | X |
| 공유 인터페이스 변경 후 사용 | X |

### 그룹 분류 출력 형식

```markdown
### Parallel Groups

| Group | Tasks | 에이전트 | 선행 조건 |
|-------|-------|---------|-----------|
| P1 | Task A, Task B | core-agent, backend-agent | 없음 |
| P2 | Task C, Task D | frontend-agent, cli-agent | P1 완료 |
| P3 | Task E | devops-agent | P2 완료 |
```

---

## Phase 5: 실행 구성안 (Team vs Sub-agent)

병렬 그룹 분석 결과에 따라 **Claude Code Teams** 또는 **단일 서브에이전트** 구성을 제안합니다.

### 구성 판단 기준

| 조건 | 구성 방식 |
|------|-----------|
| 병렬 작업 2개 이상 + 서로 다른 모듈 | **Claude Code Teams** (팀 구성) |
| 병렬 작업 2개 이상 + 동일 모듈 다른 파일 | **Claude Code Teams** + Git Worktree |
| 순차 작업만 존재 | **단일 서브에이전트** 순차 실행 |
| 단일 모듈의 작은 작업 | 계획서에 담당 에이전트만 지정. `/work`가 티어(T0–T4)로 라우팅하며 T0는 메인 세션이 직접 처리 (`work.md` Agent Routing) |

### Teams 구성안 출력 형식

```markdown
### Team Composition

**Team Name**: `feature-<issue>-<description>`

| Role | Agent Type | Task | Worktree |
|------|-----------|------|----------|
| Lead | orchestrator-agent | 전체 조율 | - |
| Member 1 | backend-agent | API 구현 | Yes |
| Member 2 | frontend-agent | UI 구현 | Yes |
| Member 3 | quality-engineer (선택, 없으면 devops-agent) | 테스트/리뷰 | - |

**Sync Points**:
1. SYNC-1: Member 1 API 완료 → Member 2에 스펙 공유
2. SYNC-2: Member 1 + 2 완료 → Member 3 통합 테스트
```

### 서브에이전트 구성안 출력 형식

```markdown
### Sub-agent Plan

| 순서 | Agent Type | Task | 비고 |
|------|-----------|------|------|
| 1 | core-agent | 인터페이스 정의 | - |
| 2 | backend-agent | API 구현 | 1 완료 후 |
| 3 | frontend-agent | UI 구현 | 1 완료 후, 2와 병렬 가능 |
```

---

## Phase 6: 계획서 출력

[references/plan-template.md](references/plan-template.md)의 템플릿대로 계획서를 출력합니다. 작성 예시도 같은 파일에 있습니다.

---

## 출력 규칙

1. **계획만 출력**: 코드 수정, 브랜치 생성 등 실행 작업 금지
2. **병렬 가능성 명시**: 반드시 병렬 실행 가능 여부를 분석하고 표기
3. **에이전트 배정 명시**: 각 태스크에 적합한 에이전트 타입을 지정
4. **Git Worktree 필요 여부**: 병렬 작업 시 worktree 사용 여부 표기
5. **설계 필요 여부**: Architect 에이전트 활용이 필요한 항목 식별
6. **실행 가능한 형태**: `/work` 커맨드 또는 Teams 구성으로 바로 실행 가능한 수준의 구체성
