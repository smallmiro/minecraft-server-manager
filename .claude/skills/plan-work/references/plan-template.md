# 작업 계획서 형식

## Contents

- 계획서 템플릿
- 작성 예시

## 계획서 템플릿

```markdown
# 작업 계획서

## 개요
- **대상**: Issue #<N> / Milestone #<N>
- **목표**: <목표 설명>
- **영향 모듈**: <모듈 목록>
- **예상 실행 방식**: 병렬 서브에이전트 / 순차 서브에이전트 / `/work` (T0는 메인 세션)

## 작업 분해 (WBS)

| # | Task | 모듈 | 에이전트 | 의존성 |
|---|------|------|---------|--------|
| 1 | <task 1> | shared | core-agent | - |
| 2 | <task 2> | api | backend-agent | Task 1 |
| 3 | <task 3> | console | frontend-agent | Task 1 |
| 4 | <task 4> | e2e | devops-agent | Task 2, 3 |

## 의존성 그래프

```
Task 1 ─┬→ Task 2 ─┐
        └→ Task 3 ─┤→ Task 4
```

## 병렬 실행 그룹

| Group | Tasks | 병렬 가능 | 선행 조건 |
|-------|-------|----------|-----------|
| P1 | Task 1 | - | 없음 |
| P2 | Task 2, Task 3 | Yes | P1 |
| P3 | Task 4 | - | P2 |

## 실행 구성안

### Option A: 병렬 서브에이전트 (권장)
<그룹별 에이전트, worktree 사용 여부, 통합 순서>

### Option B: 순차 서브에이전트
<순차 실행 상세>

## 설계 필요 사항
- [ ] <설계가 필요한 항목과 설계 담당>

## 브랜치 전략
- Base: `develop`
- Branch: `feature/<issue>-<description>` 또는 `bugfix/<issue>-<description>`

## 다음 단계
계획 승인 후 `/work --issue <N>` 또는 병렬 구성으로 실행
```

## 작성 예시

### Input
```
/plan-work --milestone 8
```

### Output
```markdown
# 작업 계획서

## 개요
- **대상**: Milestone #8 "v2.1.0 - Mod Management"
- **목표**: 모드 검색, 설치, 관리 기능 추가
- **영향 모듈**: shared, cli, mcctl-api, mcctl-console
- **예상 실행 방식**: 병렬 서브에이전트 (4개 모듈, `orchestrator-agent` 조율)

## 작업 분해 (WBS)

| # | Task | 모듈 | 에이전트 | 의존성 |
|---|------|------|---------|--------|
| 1 | Mod 도메인 엔티티 정의 | shared | core-agent | - |
| 2 | Modrinth API 어댑터 | shared | core-agent | Task 1 |
| 3 | mod search CLI 커맨드 | cli | cli-agent | Task 1, 2 |
| 4 | mod install API 엔드포인트 | api | backend-agent | Task 1, 2 |
| 5 | Mod 관리 UI 페이지 | console | frontend-agent | Task 4 |
| 6 | E2E 테스트 | e2e | devops-agent | Task 4, 5 |

## 의존성 그래프

Task 1 → Task 2 ─┬→ Task 3 (CLI)
                  ├→ Task 4 (API) → Task 5 (UI) ─┐
                  └────────────────────────────────┤→ Task 6

## 병렬 실행 그룹

| Group | Tasks | 병렬 | 선행 조건 |
|-------|-------|------|-----------|
| P1 | Task 1, 2 | 순차 | 없음 |
| P2 | Task 3, Task 4 | Yes | P1 |
| P3 | Task 5 | - | Task 4 |
| P4 | Task 6 | - | P2, P3 |

## 실행 구성안

### Option A: 병렬 서브에이전트 (권장)
- P2: cli-agent (Task 3, worktree), backend-agent (Task 4, worktree)
- P3: frontend-agent (Task 5, worktree)
- SYNC: Task 4 완료 후 API 스펙을 frontend-agent 위임 프롬프트에 포함

### Option B: 순차 서브에이전트
- core-agent → cli-agent → backend-agent → frontend-agent → devops-agent

## 설계 필요 사항
- [ ] Mod 도메인 모델 설계 → core-agent
- [ ] Mod 관리 UI 디자인 → frontend-design skill

## 다음 단계
계획 승인 후 P1부터 실행 시작
```
