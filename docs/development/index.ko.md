# 개발 가이드

`minecraft-server-manager`의 개발 환경, 저장소 구조, 기여 절차를 안내합니다.

!!! tip "기여자 가이드"
    기준 문서는 저장소 루트의 [`DEVELOPMENT.md`](https://github.com/smallmiro/minecraft-server-manager/blob/develop/DEVELOPMENT.md)입니다. 이 페이지는 문서 사이트용 요약입니다.

## 한눈에 보기

```text
원본 저장소에 이슈 생성 → 포크 → 브랜치 생성 → 테스트 먼저 작성(TDD) → 구현 → 원본 저장소로 PR → 리뷰 반영 → 머지
```

| 규칙 | 내용 |
|------|------|
| 작업 단위 | **이슈 1개 = 브랜치 1개 = PR 1개** |
| 위치 | 이슈는 원본 저장소에 만듭니다. 작업은 포크에서 하고, PR은 포크에서 원본 저장소로 보냅니다. |
| 기준 브랜치 | `develop` (`develop`에서 브랜치를 만들고 `develop`으로 PR) |
| 방법론 | TDD (Red → Green → Refactor), Tidy First |
| 아키텍처 | Hexagonal / Clean Architecture |
| 문서 | 영어(`.md`)와 한국어(`.ko.md`)를 함께 유지 |

## 사전 요구 사항

| 도구 | 버전 | 용도 |
|------|------|------|
| Node.js | 18 이상 (CI는 20) | 모든 패키지 |
| pnpm | 9 (`packageManager`에 고정) | 모노레포 관리 |
| Docker / Docker Compose | Engine 24+, Compose 2.20+ | 서버 컨테이너, E2E |
| Git, GitHub CLI (`gh`) | 최신 | 포크, 이슈, PR |

`mcctl` CLI가 bash 스크립트에 의존하므로 지원 OS는 Linux와 macOS입니다. mcctl-console이 사용하는 `better-sqlite3`는 네이티브 모듈이라 환경에 따라 빌드 도구(gcc, make, python)가 필요합니다.

## 포크와 로컬 설정 {#fork-and-set-up}

```bash
# 1) GitHub에서 smallmiro/minecraft-server-manager를 포크한 뒤:
git clone https://github.com/<your-account>/minecraft-server-manager.git
cd minecraft-server-manager

# 2) 원본 저장소를 "upstream"으로 등록
git remote add upstream https://github.com/smallmiro/minecraft-server-manager.git

# 3) gh가 이슈와 PR에 원본 저장소를 사용하도록 설정
gh repo set-default smallmiro/minecraft-server-manager

# 4) 의존성 설치 및 빌드
pnpm install
pnpm build
```

작업을 시작하기 전에 `develop`을 최신 상태로 맞춥니다:

```bash
git checkout develop
git fetch upstream
git merge --ff-only upstream/develop
git push origin develop
```

### 소스에서 CLI 실행

```bash
# 로컬 빌드를 전역 mcctl 명령으로 링크
cd platform/services/cli
pnpm link --global
mcctl --version

# 또는 빌드 결과를 직접 실행
node platform/services/cli/dist/index.js --version
```

## 저장소 구조

| 경로 | 설명 |
|------|------|
| `platform/services/shared/` | `@minecraft-docker/shared`: 도메인 엔티티, 값 객체, 유스케이스, 포트/어댑터 |
| `platform/services/cli/` | `@minecraft-docker/mcctl`: CLI (Hexagonal Architecture) |
| `platform/services/mcctl-api/` | `@minecraft-docker/mcctl-api`: Fastify REST API (포트 5001) |
| `platform/services/mcctl-console/` | `@minecraft-docker/mcctl-console`: Next.js 웹 UI (포트 5000) |
| `platform/services/mod-source-modrinth/` | `@minecraft-docker/mod-source-modrinth`: Modrinth 어댑터 |
| `platform/scripts/` | Bash 관리 스크립트 (테스트는 `platform/scripts/tests/`) |
| `templates/` | `mcctl init`이 복사하는 플랫폼 템플릿 |
| `e2e/` | Management Console용 Playwright E2E 테스트 |
| `docs/` | MkDocs 문서 (영어/한국어) |
| `website/` | 프로젝트 랜딩 페이지 |
| `.github/workflows/` | CI, 릴리즈, 웹사이트 배포 워크플로우 |
| `.claude/` | Claude Code 서브에이전트, 커맨드, 훅 |

### 패키지와 빌드 순서

`pnpm build`는 `pnpm -r build`를 실행하며, 워크스페이스 패키지를 의존성 순서대로 빌드합니다:

```text
1. @minecraft-docker/shared                (워크스페이스 의존성 없음)
2. @minecraft-docker/mod-source-modrinth   (shared)
3. @minecraft-docker/mcctl                 (shared, mod-source-modrinth)
   @minecraft-docker/mcctl-api             (shared, mod-source-modrinth)
   @minecraft-docker/mcctl-console         (shared)
```

릴리즈 태그를 푸시하면 다섯 패키지가 같은 버전으로 npm에 발행됩니다. [Git 워크플로우](git-workflow.md#release-process)를 참고하세요.

## 스크립트

### 루트

| 명령 | 설명 |
|------|------|
| `pnpm install` | 모든 의존성 설치 |
| `pnpm build` | 모든 패키지를 의존성 순서대로 빌드 |
| `pnpm dev` | 각 패키지의 `dev` 스크립트를 병렬 실행 (shared/cli는 `tsc --watch`, mcctl-api는 `tsx watch`, mcctl-console은 `next dev -p 5000`) |
| `pnpm lint` | 모든 패키지 린트 |
| `pnpm test` | 모든 단위 테스트 실행 |
| `pnpm clean` | 빌드 결과물 삭제 |
| `pnpm test:e2e` | Management Console E2E 실행 (Playwright, mcctl-api + mcctl-console) |
| `pnpm test:e2e:ui` | 같은 테스트를 Playwright UI 모드로 실행 |

### 빌드와 테스트 {#build-and-test}

```bash
pnpm build                                   # 전체 빌드
pnpm test                                    # 전체 단위 테스트
pnpm lint                                    # 전체 린트

pnpm --filter @minecraft-docker/shared test  # 특정 패키지만
pnpm --filter @minecraft-docker/mcctl test

pnpm test:e2e                                # Management Console E2E (Playwright)
cd platform/services/cli && pnpm test:e2e    # CLI E2E (Vitest)

bash platform/scripts/tests/<name>.test.sh   # bash 스크립트 테스트
```

새 REST 엔드포인트의 E2E 테스트는 `e2e/tests/api-*.spec.ts`에, 콘솔 UI 흐름은 `e2e/tests/*.spec.ts`에, 새 CLI 명령이나 옵션은 `platform/services/cli/tests/e2e/cli-*.test.ts`에 추가합니다.

## 기여 절차

1. **원본 저장소에 이슈를 먼저 만듭니다.** Summary, Root Cause(버그) 또는 Requirements(기능), Solution / Implementation Plan, Files to Modify, 체크박스 목록 형태의 Acceptance Criteria를 포함합니다. 오타 수정 같은 1줄짜리 변경은 이슈를 생략할 수 있습니다.
2. **포크에서 `develop` 기준으로 브랜치를 만듭니다**: `feature/<issue>-<description>` 또는 `bugfix/<issue>-<description>`. `develop`이나 `main`에서 직접 작업하지 않습니다.
3. **TDD**: 실패하는 테스트를 먼저 쓰고, 최소한의 코드로 통과시킨 뒤 리팩터링합니다. 문서 전용 변경과 로직 없는 설정 변경을 제외하고, 테스트가 없는 PR은 받지 않습니다.
4. **Tidy First**: 구조 변경(리팩터링)과 동작 변경(기능, 수정)을 한 커밋에 섞지 않습니다.
5. **커밋** 형식은 `<type>: <description> (#<issue-number>)`이며, `type`은 `feat`, `fix`, `docs`, `refactor`, `test`, `chore` 중 하나입니다.
6. **이슈마다 PR 1개**를 포크에서 원본 저장소의 `develop`으로 엽니다. 본문에 `Closes #<issue>`를 넣습니다.

```bash
git push -u origin feature/12-add-backup
gh pr create --repo smallmiro/minecraft-server-manager --base develop \
  --head <your-account>:feature/12-add-backup \
  --title "feat: add backup script (#12)" --body "Closes #12 ..."
```

### CI

`develop`으로 향하는 PR의 검사는 머지 전에 통과해야 합니다. `ci.yml`이 경로 필터 없이 모든 PR에서 실행됩니다:

| 잡 | 내용 |
|----|------|
| `lint, typecheck, test` | 모든 패키지를 빌드하고 `pnpm lint`, `pnpm typecheck`, `e2e`를 제외한 전 패키지 테스트, cli `verify:package` 드리프트 검사를 실행 |
| `script tests` (ubuntu, macos) | `pnpm test:scripts`(bats)와 `pnpm lint:scripts`(shellcheck) |
| `docker compose config` (platform, templates) | 두 compose 파일 검증 |

`e2e.yml`은 매일 03:00 KST와 수동 실행 시에만 돌고 **PR에서는 실행되지 않습니다**. mcctl-api와 mcctl-console을 띄우고 Playwright 테스트를 실행합니다. API나 콘솔 동작을 바꿨다면 로컬에서 `pnpm test:e2e`를 실행하세요.

브랜치 이름, 커밋 규칙, 버전 관리, 릴리즈 절차는 [Git 워크플로우](git-workflow.md)에 있습니다.

## Claude Code로 개발하기

저장소에 Claude Code 설정이 포함되어 있습니다. 저장소 루트에서 `claude`를 실행하면 `CLAUDE.md`와 `.claude/`의 서브에이전트, 커맨드, 훅이 자동으로 로드됩니다.

| 커맨드 | 용도 |
|--------|------|
| `/plan-work` | 작업 착수 전 계획 수립 (`--issue <N>`, `--milestone <N>`, `--issues <N1,N2>`). 계획만 세우고 실행하지 않습니다. |
| `/work` | 이슈나 마일스톤을 완료까지 실행: 브랜치, TDD 구현, PR, 코드 리뷰 |
| `/write-docs` | 영어/한국어 기술 문서 작성 |
| `/sync-docs` | `CLAUDE.md`, `README.md` 등 문서를 코드와 동기화 |
| `/update-docs` | 공식 문서로부터 `docs/itzg-reference/` 갱신 |
| `/build-kb` | 소스를 심층 분석해 LLM 지식 베이스 생성 |

일반적인 흐름은 변경 내용을 설명하고, 분석 결과로 이슈를 만들고, 큰 작업은 `/plan-work --issue <N>`으로 계획한 뒤 `/work --issue <N>`을 실행하는 것입니다. 서브에이전트, `/work`의 라우팅, 완료 조건 강제 방식은 [에이전트 협업](agent-collaboration.md)을 참고하세요.

## 아키텍처 개요

TypeScript 코드는 **Hexagonal Architecture**(Ports & Adapters)와 **Clean Architecture** 계층을 따릅니다:

```text
+---------------------+
| Presentation Layer  |  CLI 명령, API 라우트
+----------+----------+
           |
+----------v----------+
| Application Layer   |  유스케이스, 애플리케이션 서비스
+----------+----------+
           |
+----------v----------+
|    Domain Layer     |  엔티티, 값 객체, 포트
+----------+----------+
           |
+----------v----------+
| Infrastructure      |  어댑터: 파일 시스템, Docker, 외부 API
+---------------------+
```

- 도메인 계층은 외부 의존성을 갖지 않습니다.
- 모든 I/O는 어댑터를 거치며, 의존성은 주입합니다.

자세한 내용은 [CLI 아키텍처](cli-architecture.md)를 참고하세요.

## 관련 문서

- [`DEVELOPMENT.md`](https://github.com/smallmiro/minecraft-server-manager/blob/develop/DEVELOPMENT.md) - 전체 기여자 가이드
- [Git 워크플로우](git-workflow.md) - 브랜치, 커밋, 버전 관리, 릴리즈
- [CLI 아키텍처](cli-architecture.md) - CLI 계층 구조와 명령 추가 방법
- [에이전트 협업](agent-collaboration.md) - Claude Code 서브에이전트와 `/work` 워크플로우
- [CLI 명령어](../cli/commands.md) - 전체 CLI 레퍼런스

## 문제 해결

### 빌드 오류

```bash
# 정리 후 다시 빌드
pnpm clean
pnpm install
pnpm build
```

### 링크 후 `mcctl`을 찾을 수 없음

```bash
# pnpm이 사용하는 전역 bin 디렉터리 확인
pnpm bin --global

# 필요하면 PATH에 추가 (pnpm setup이 대신 설정해 줌)
pnpm setup
```

### Docker 권한 거부

```bash
docker --version
docker compose version

# 사용자를 docker 그룹에 추가
sudo usermod -aG docker $USER
newgrp docker
```
