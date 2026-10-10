# 개발 가이드

이 문서는 `minecraft-server-manager`에 기여하려는 오픈소스 개발자를 위한 가이드입니다. 개발 규칙, 포크 기반 이슈 단위 개발 흐름, 그리고 Claude Code와 이 프로젝트의 커맨드·서브에이전트로 개발하는 방법을 설명합니다.

## 한눈에 보기

```
포크 → 이슈 작성 → 브랜치 생성 → 테스트 먼저(TDD) → 구현 → PR 생성 → 리뷰 반영 → 머지
```

| 규칙 | 내용 |
|------|------|
| 작업 단위 | **이슈 하나 = 브랜치 하나 = PR 하나** |
| 기준 브랜치 | `develop` (브랜치를 `develop`에서 만들고 PR도 `develop`으로 보냅니다) |
| 개발 방식 | TDD (Red → Green → Refactor), Tidy First |
| 아키텍처 | Hexagonal / Clean Architecture |
| 문서 | 영어(`.md`)와 한국어(`.ko.md`)를 함께 유지 |

---

## 1. 사전 준비

| 도구 | 버전 | 용도 |
|------|------|------|
| Node.js | 18 이상 (CI는 20) | 모든 패키지 |
| pnpm | 9 (`packageManager`에 고정) | 모노레포 관리 |
| Docker / Docker Compose | Engine 24+, Compose 2.20+ | 서버 컨테이너, E2E |
| Git, GitHub CLI (`gh`) | 최신 | 포크, 이슈, PR |

지원 OS는 Linux와 macOS입니다. `mcctl` CLI가 bash 스크립트에 의존하기 때문입니다.

## 2. 포크하고 로컬 환경 만들기

```bash
# 1) GitHub에서 smallmiro/minecraft-server-manager 를 포크한 뒤
git clone https://github.com/<내-계정>/minecraft-server-manager.git
cd minecraft-server-manager

# 2) 원본 저장소를 upstream 으로 등록
git remote add upstream https://github.com/smallmiro/minecraft-server-manager.git

# 3) 의존성 설치와 빌드
pnpm install
pnpm build
```

작업을 시작하기 전에 항상 `develop`을 최신으로 맞춥니다.

```bash
git checkout develop
git fetch upstream
git merge --ff-only upstream/develop
git push origin develop
```

## 3. 저장소 구조

| 경로 | 설명 |
|------|------|
| `platform/services/shared/` | `@minecraft-docker/shared`: 도메인 엔티티, 값 객체, 유스케이스, 포트/어댑터 |
| `platform/services/cli/` | `@minecraft-docker/mcctl`: CLI (Hexagonal Architecture) |
| `platform/services/mcctl-api/` | Fastify REST API (포트 5001) |
| `platform/services/mcctl-console/` | Next.js 웹 UI (포트 5000) |
| `platform/services/mod-source-modrinth/` | Modrinth 어댑터 |
| `platform/scripts/` | bash 관리 스크립트 (테스트는 `platform/scripts/tests/`) |
| `templates/` | `mcctl init`이 사용하는 npm 패키지 템플릿 |
| `e2e/` | Playwright E2E 테스트 |
| `docs/` | MkDocs 문서 (영어/한국어) |
| `.claude/` | Claude Code용 서브에이전트, 커맨드, 훅 |

## 4. 이슈 단위 개발 규칙

### 4.1 이슈부터 만든다

코드를 고치기 전에 이슈를 먼저 만듭니다. 이슈에는 다음을 적습니다.

- **Summary**: 문제 또는 기능 요약
- **Root Cause**(버그) 또는 **Requirements**(기능)
- **Solution / Implementation Plan**
- **Files to Modify**
- **Acceptance Criteria**: 체크박스(`- [ ]`) 목록으로 작성합니다. 진행하면서 체크합니다.

오타 수정처럼 한 줄 이내의 사소한 변경은 이슈 없이 진행해도 됩니다.

### 4.2 브랜치

`develop`에서 브랜치를 만듭니다. 이름에 이슈 번호를 넣습니다.

| 종류 | 패턴 | 예시 |
|------|------|------|
| 기능, 개선, 리팩토링 | `feature/<이슈>-<설명>` | `feature/12-add-backup` |
| 버그 수정 | `bugfix/<이슈>-<설명>` | `bugfix/15-fix-lock` |

`develop`이나 `main`에서 직접 작업하지 않습니다.

### 4.3 TDD

모든 기능, 버그 수정, 개선은 테스트를 먼저 씁니다.

1. **Red**: 기대 동작을 정의하는 실패하는 테스트를 작성합니다.
2. **Green**: 테스트를 통과하는 최소한의 코드를 작성합니다.
3. **Refactor**: 테스트가 통과하는 상태로 정리합니다.

문서만 바꾸거나 로직 없는 설정 변경이 아니라면, 테스트가 없는 PR은 받지 않습니다.

### 4.4 Tidy First

구조 변경(리팩토링)과 동작 변경(기능, 수정)을 같은 커밋에 섞지 않습니다. 리뷰가 쉬워지고 롤백이 안전해집니다.

```bash
git commit -m "refactor: extract validate_world function (#7)"
git commit -m "feat: add world existence check (#7)"
```

### 4.5 커밋 메시지

```
<type>: <description> (#<이슈 번호>)
```

`type`은 `feat`, `fix`, `docs`, `refactor`, `test`, `chore` 중 하나입니다. "fix", "update", "changes" 같은 모호한 메시지는 피합니다.

### 4.6 아키텍처 규칙

TypeScript 코드는 계층을 지킵니다: Presentation(CLI, API 라우트) → Application(유스케이스) → Domain(엔티티, 값 객체, 포트) → Infrastructure(DB, 외부 API, 파일 시스템 어댑터).

- 도메인 계층은 외부 의존성이 없습니다.
- 모든 I/O는 어댑터를 통하고, 의존성은 주입합니다.
- 자세한 내용: [CLI Architecture](cli-architecture.md)

### 4.7 PR 만들기

이슈 하나당 PR 하나를 만들고, 원본 저장소의 `develop`을 대상으로 합니다.

```bash
git push -u origin feature/12-add-backup
gh pr create --repo smallmiro/minecraft-server-manager --base develop \
  --title "feat: add backup script (#12)" --body "Closes #12 ..."
```

PR 체크리스트:

- [ ] 이슈의 체크박스를 모두 체크했다
- [ ] 테스트를 먼저 작성했고 모두 통과한다 (`pnpm test`)
- [ ] `pnpm lint`와 `pnpm build`가 통과한다
- [ ] 외부에서 보이는 동작을 바꿨다면 E2E 테스트를 추가했다
- [ ] 사용자에게 영향이 있다면 문서를 영어/한국어로 함께 갱신했다
- [ ] 구조 변경과 동작 변경이 별도 커밋으로 분리되어 있다

PR이 `develop`으로 열리면 CI가 실행됩니다(`cli-test`, `shared-test`, `e2e`). 통과해야 머지할 수 있습니다.

## 5. 빌드와 테스트

```bash
pnpm build                                   # 전체 빌드
pnpm test                                    # 전체 단위 테스트
pnpm lint                                    # 전체 린트

pnpm --filter @minecraft-docker/shared test  # 패키지 하나만
pnpm --filter @minecraft-docker/mcctl test

pnpm test:e2e                                # API E2E (Playwright)
cd platform/services/cli && pnpm test:e2e    # CLI E2E (Vitest)

bash platform/scripts/tests/<이름>.test.sh   # bash 스크립트 테스트
```

새 REST 엔드포인트는 `e2e/tests/api-*.spec.ts`에, 새 CLI 명령이나 옵션은 `platform/services/cli/tests/e2e/cli-*.test.ts`에 E2E 테스트를 추가합니다.

## 6. 문서

사용자에게 보이는 변경은 문서도 함께 고칩니다. 문서는 영어(`page.md`)와 한국어(`page.ko.md`)를 한 쌍으로 유지합니다. 코드, 명령어, 파일 경로, 변수명은 번역하지 않습니다. 문서를 쓸 때는 `/write-docs` 커맨드(7장 참고)를 쓰면 이 규칙이 적용됩니다.

`docs/itzg-reference/`는 공식 문서에서 동기화하는 디렉터리이므로 직접 수정하지 않습니다.

---

## 7. Claude Code로 개발하기

이 저장소는 Claude Code용 설정을 함께 제공합니다. 저장소 루트에서 `claude`를 실행하면 `CLAUDE.md`(개발 규칙)와 `.claude/`의 서브에이전트, 커맨드가 자동으로 로드됩니다. 따로 설치할 것은 없습니다.

### 7.1 준비

- Claude Code 설치 및 로그인
- `gh auth login` 완료 (이슈, PR 작업에 사용)
- `/work`는 코드 리뷰에 `/code-review:code-review`를 씁니다. `code-review` 플러그인을 설치해 두세요.
- 선택: 여러 서브에이전트를 팀으로 병렬 실행하려면 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`을 설정합니다. 설정하지 않아도 `Agent` 도구와 git worktree로 병렬 작업이 가능합니다.

### 7.2 커맨드

| 커맨드 | 용도 |
|--------|------|
| `/plan-work` | 작업을 시작하기 전에 계획을 세웁니다 (`--issue <N>`, `--milestone <N>`, `--issues <N1,N2>`). 계획만 세우고 실행하지 않습니다. |
| `/work` | 이슈 또는 마일스톤을 **완료까지** 실행합니다. 브랜치, TDD 구현, PR, 코드 리뷰까지 진행합니다. |
| `/write-docs` | 영어/한국어 이중 언어 기술 문서를 작성합니다. |
| `/sync-docs` | `CLAUDE.md`, `README.md` 등 문서를 코드와 동기화합니다. |
| `/update-docs` | `docs/itzg-reference/`를 공식 문서 기준으로 갱신합니다. |
| `/build-kb` | 소스 코드를 깊이 분석해 LLM용 지식 베이스를 만듭니다. |

### 7.3 서브에이전트

작업 성격에 맞는 서브에이전트가 `.claude/agents/`에 정의되어 있습니다. 모델은 난이도에 맞춰 지정되어 있습니다.

| 에이전트 | 담당 | 모델 |
|----------|------|------|
| `orchestrator-agent` | 모든 작업의 진입점. 요청을 분석해 전문 에이전트에게 나누고 조율합니다. | opus |
| `core-agent` | `platform/services/shared/` 도메인 설계 | opus |
| `cli-agent` | `platform/services/cli/`, bash 스크립트 | sonnet |
| `backend-agent` | `platform/services/mcctl-api/` (Fastify, OpenAPI) | sonnet |
| `frontend-agent` | `platform/services/mcctl-console/` (Next.js, React) | sonnet |
| `devops-agent` | Docker, CI, `e2e/` | sonnet |
| `technical-writer` | `docs/` 이중 언어 문서 | sonnet |
| `release-manager` | 버전 태깅, 릴리즈 (메인테이너용) | sonnet |

### 7.4 권장 흐름

1. 하고 싶은 일을 대화로 설명합니다. 이 저장소의 규칙상 요청은 먼저 `orchestrator-agent`가 접수해 분석하고 전문 에이전트에게 나눕니다. 이 단계에서는 코드를 수정하지 않습니다.
2. 분석 결과로 이슈를 만듭니다.
3. 큰 작업이면 `/plan-work --issue <N>`으로 계획을 세우고 검토합니다.
4. 계획에 동의하면 `/work --issue <N>`으로 실행합니다.
5. PR이 열리면 변경 내용을 직접 한 번 더 읽고 리뷰합니다.

```text
> 로그인 서버 목록에 정렬 옵션을 추가하고 싶어요. 분석해서 이슈로 만들어 주세요.
> /plan-work --issue 42
> /work --issue 42
```

특정 영역만 맡기고 싶으면 에이전트를 직접 지정할 수 있습니다.

```text
> cli-agent로 mcctl backup 명령에 --dry-run 옵션을 추가해 주세요 (이슈 #42)
```

### 7.5 `/work`가 하는 일

`/work`를 실행하는 것은 그 작업을 끝까지 진행해도 좋다는 승인입니다. 순서는 다음과 같습니다.

1. 이슈를 읽고 `develop`에서 브랜치를 만듭니다.
2. TDD로 구현하며, 체크포인트마다 이슈 이름이 들어간 커밋을 만들고 이슈의 체크박스를 갱신합니다.
3. 필요하면 E2E 테스트를 추가합니다.
4. PR을 만들고 코드 리뷰를 실행해 지적 사항을 고칩니다.
5. 머지합니다.

**완료 조건은 훅이 강제합니다.** `/work`는 시작할 때 `.claude/work-state` 파일(gitignore 대상)에 작업 정보를 기록합니다. Claude가 멈추려고 할 때마다 `.claude/hooks/work-done-check.sh`가 GitHub와 git의 실제 상태를 확인하고, 조건이 부족하면 남은 항목을 알려 주며 작업을 이어가게 합니다.

| 모드 | 완료 조건 |
|------|-----------|
| 이슈 | 이슈 본문 체크박스가 모두 체크됨, PR이 머지됨, 코드 리뷰 완료, 커밋되지 않은 변경 없음 |
| 마일스톤 | 마일스톤의 열린 이슈가 없음, 커밋되지 않은 변경 없음 |

안전장치로, `gh` 조회가 실패하면 검증을 건너뛰고, 30회 넘게 막으면 포기합니다. 해결할 수 없는 문제를 만나면 Claude는 사유를 보고하고 `.claude/work-state`를 지운 뒤 멈춥니다.

### 7.6 포크에서 `/work` 사용할 때 주의

`/work`의 마지막 단계는 PR 머지입니다. 원본 저장소에 쓰기 권한이 없는 기여자는 그 PR을 직접 머지할 수 없습니다. 기여자는 다음과 같이 사용하세요.

- `gh repo set-default`로 PR을 보낼 저장소(원본 `smallmiro/minecraft-server-manager`)를 지정합니다.
- PR이 원본 저장소에 열리고 코드 리뷰까지 끝나면 작업은 거기까지입니다. 머지는 메인테이너가 합니다.
- 이때 완료 조건(PR 머지)이 충족되지 않아 훅이 계속 작업을 요구하면, `.claude/work-state` 파일을 삭제해서 훅을 끄세요.

### 7.7 지켜야 할 것

- `develop`이나 `main`에서 직접 수정하지 않습니다. 항상 이슈 브랜치에서 작업합니다.
- 실패하는 테스트를 건너뛰거나 주석 처리해서 통과시키지 않습니다.
- Claude가 만든 변경도 사람이 읽고 책임집니다. PR을 올리기 전에 `git diff`를 직접 확인하세요.
- 여러 에이전트가 동시에 코드를 고칠 때는 `isolation: "worktree"`로 작업 디렉터리를 분리해 충돌을 피합니다.

---

## 8. 리뷰와 머지

- 메인테이너가 PR을 리뷰합니다. 리뷰 의견은 같은 브랜치에 커밋을 추가해서 반영하세요.
- PR이 오래되면 `upstream/develop`을 받아 충돌을 해결한 뒤 테스트를 다시 돌립니다.
- 머지 후에는 로컬과 포크의 작업 브랜치를 지웁니다.

```bash
git branch -d feature/12-add-backup
git push origin --delete feature/12-add-backup
```

## 참고

- [Git Workflow](git-workflow.md): 브랜치, 커밋, 버전 규칙의 전체 설명
- [CLI Architecture](cli-architecture.md): CLI 계층 구조
- [Agent Collaboration](agent-collaboration.md): 에이전트 협업 방식
- [CLI 명령어](../cli/commands.md)
