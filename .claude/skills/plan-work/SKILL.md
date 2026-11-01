---
description: "Builds an execution plan with task breakdown, dependencies, parallel groups, and agent assignments, without changing code. Use before multi-module or design-heavy work (작업 계획, 업무 계획 수립)."
argument-hint: "[--issue <N> | --milestone <N> | --issues <N1,N2,...>]"
model: opus
---

# Work Planning - 업무 계획 수립

전체 업무, 마일스톤, 이슈 단위로 실행 계획서를 만듭니다. **계획만 수립하고 실행은 하지 않습니다.** 코드 수정, 브랜치 생성, PR 생성은 절대 하지 않으며, 실행은 `/work`로 합니다.

| 옵션 | 대상 | 수집 방법 |
|------|------|----------|
| (없음) | 대화 컨텍스트 | 대화에서 요구사항과 영향 범위를 파악 |
| `--issue <N>` | 단일 이슈 | `gh issue view <N> --json number,title,body,labels,milestone,assignees` |
| `--milestone <N>` | 마일스톤 전체 | `gh api repos/{owner}/{repo}/milestones/<N>`, `gh issue list --milestone <N> --state open --json number,title,body,labels` |
| `--issues <N1,N2,...>` | 지정한 이슈들 | 각 이슈에 `gh issue view` |

## 절차

### 1. 작업 분해

Epic(마일스톤), Story(이슈), Task(개별 작업), Sub-task(구현 단계) 단위로 나누고 각 작업의 담당을 정합니다.

| 모듈 | 디렉토리 | 담당 에이전트 |
|------|----------|--------------|
| Core (shared) | `platform/services/shared/` | `core-agent` |
| CLI | `platform/services/cli/` | `cli-agent` |
| Backend API | `platform/services/mcctl-api/` | `backend-agent` |
| Frontend Console | `platform/services/mcctl-console/` | `frontend-agent` |
| DevOps/Platform | `platform/`, `e2e/` | `devops-agent` |

### 2. 설계 필요 여부

| 조건 | 설계 담당 |
|------|----------|
| 새로운 시스템 구조, 모듈 간 인터페이스 | 메인 세션 또는 `core-agent` |
| 새로운 API 엔드포인트, DB 스키마 | `backend-agent` |
| 새로운 페이지/컴포넌트 구조 | `frontend-agent` |
| UI/UX 디자인, 화면 레이아웃 | `frontend-design` skill |
| 단순 버그 수정, 기존 패턴을 따르는 작업 | 설계 불필요 |

### 3. 의존성 분석

1. **이슈 본문**: "depends on #N", "blocked by #N", "after #N"
2. **모듈**: shared가 cli, api, console보다 먼저
3. **파일 충돌**: 같은 파일을 수정하는 작업은 순차 처리
4. **인터페이스**: 타입과 인터페이스 정의가 구현보다 먼저

### 4. 병렬 실행 그룹

서로 다른 파일을 수정하고 의존 관계가 없으면 병렬로 묶습니다. 같은 파일을 수정하거나, 선행 작업의 산출물이나 변경된 공유 인터페이스가 필요하면 순차로 둡니다.

### 5. 실행 구성안

| 조건 | 구성 방식 |
|------|-----------|
| 병렬 작업 2개 이상 | `Agent` 병렬 실행 + `isolation: "worktree"`. 완료 후 하나씩 통합 |
| 3개 이상 모듈 또는 아키텍처 변경 | `orchestrator-agent`에 조율 위임 |
| 순차 작업만 존재 | 서브에이전트 순차 실행 |
| 단일 모듈의 작은 작업 | 담당 에이전트만 지정. `/work`가 티어(T0–T4)로 라우팅하며 T0는 메인 세션이 직접 처리 |

### 6. 계획서 출력

[references/plan-template.md](references/plan-template.md)의 형식으로 출력합니다. 작성 예시도 같은 파일에 있습니다.

## 출력 규칙

1. 코드 수정, 브랜치 생성 등 실행 작업은 하지 않습니다.
2. 병렬 실행 가능 여부를 분석해 표기합니다.
3. 각 태스크에 담당 에이전트를 지정합니다.
4. 병렬 작업은 worktree 사용 여부를 표기합니다.
5. 설계가 필요한 항목을 식별합니다.
6. `/work`로 바로 실행할 수 있을 만큼 구체적으로 씁니다.
