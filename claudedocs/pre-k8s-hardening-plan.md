# 작업 계획서: k8s 이전 전 현재 구조 강건화 (Pre-k8s Hardening)

> **문서 성격**
> - `/plan-work` Context Mode로 만든 계획서다. 계획만 담았고, 코드 수정·이슈·브랜치·PR은 만들지 않았다.
> - 근거는 두 가지다. 하나는 모듈별 읽기 전용 감사 4건(core/cli/backend/devops 에이전트, 2026-10-12)이고, 다른 하나는 `claudedocs/k8s-longhorn-assessment.md`이다.
> - 고위험 항목은 메인 세션이 코드에서 직접 다시 확인했다(§2의 ✔ 표시). 그 밖의 라인 번호는 감사 보고를 그대로 옮긴 것이다.
> - 보안 관련 항목은 이 문서에 넣지 않고 별도 채널에서 관리한다.

**경로 약어**

| 약어 | 경로 |
|------|------|
| `scripts/` | `platform/scripts/` |
| `cli/` | `platform/services/cli/src/` |
| `api/` | `platform/services/mcctl-api/src/` |
| `shared/` | `platform/services/shared/src/` |
| `docker.ts` | `platform/services/shared/src/docker/index.ts` |
| `CT/` | `platform/services/cli/templates/` (npm으로 배포되고 실제로 쓰이는 템플릿) |
| `RT/` | `templates/` (루트 템플릿) |
| `PT/` | `platform/docker-compose.yml`, `platform/servers/_template/` |

---

## 1. 개요

- **대상**: 대화 컨텍스트에서 도출한 작업. 아직 이슈로 만들지 않았다.
- **목표**
  1. 현재 Docker Compose 구조에서 **데이터 손실, 설정 불일치, 조용한 실패**를 없앤다.
  2. 이후 k8s 런타임 어댑터를 "추가"만 하면 되도록 **런타임 경계(포트)와 서버 정의(ServerSpec)**를 정리한다. k8s 어댑터 자체는 범위 밖이다(YAGNI).
- **영향 모듈**: shared, cli(+bash 스크립트), mcctl-api, 템플릿/플랫폼, CI, docs. mcctl-console은 일부 UI만 바뀐다.
- **예상 실행 방식**: 마일스톤 4개를 순서대로 진행하고, 각 마일스톤 안에서는 Claude Code Teams로 모듈별 병렬 작업을 한다(Git Worktree 사용).
- **규모**: 스토리 31개(S 9, M 19, L 3). 시간 추정은 하지 않았다. 규모는 상대값이다.
  - S: 작은 PR 1개
  - M: 파일 여러 개 또는 모듈 1~2개
  - L: 설계를 먼저 하고 PR 여러 개로 나눔

---

## 2. 핵심 발견 요약 (왜 지금 강건화가 필요한가)

| # | 발견 | 대표 근거 | 확인 |
|---|------|----------|------|
| 1 | **템플릿이 3벌이라 수정이 회귀했다.** #162에서 루트 템플릿을 `CT/`로 복사했고, 런타임도 `CT/`를 먼저 쓰도록 바꿨다. 그 뒤 #165는 `EXTRA_ARGS=--universe /worlds/`를 `RT/`에만 넣었다. 그래서 npm 설치본은 월드를 `servers/<n>/data/<LEVEL>`에 만든다. | `CT/servers/_template/config.env:53` vs `RT/servers/_template/config.env:57`; `shared/utils/index.ts:118-128` | ✔ |
| 2 | **서버를 삭제하면 월드도 지워진다.** 1번 때문에 월드가 서버 디렉터리 안에 있는데, 삭제 스크립트가 그 디렉터리를 `rm -rf`한다. 그런데도 완료 메시지는 "World data … preserved"라고 출력한다. 컨테이너 정지 오류는 `\|\| true`로 무시한다. CLI는 확인 프롬프트를 띄우지 않는다(문서와 다름). | `scripts/delete-server.sh:154-160,246,265`; `docs/cli/commands.md:597-598` | ✔ |
| 3 | **백업이 월드를 놓치거나 일관되지 않다.** (1) 대상이 `worlds/`뿐이다. (2) 실행 중인 서버에 저장 flush를 하지 않는다. (3) 복원할 때 실행 중인 서버를 확인하지 않는다. (4) npm 설치본에서는 API 백업이 스크립트를 찾지 못해, 월드를 동기화하지 않은 채 git만 커밋한다. (5) "변경 없음"(종료 코드 2)이 실패로 기록된다. | `scripts/backup.sh:37,170-183,244-246,461-480`; `api/routes/backup.ts:151-166,191-197`; `api/services/backup-scheduler.ts:474-498,531-541`; `cli/commands/init.ts:119-126` | ✔ |
| 4 | **월드 배타성(FR-003)이 실제로 보장되지 않는다.** PRD는 완료로 표시하지만 다음과 같다. (1) 어떤 시작 경로도 lock을 확인하지 않는다. (2) 오래된 lock은 `world release`로도 풀 수 없다(`set -e` 상태에서 `check`가 종료 코드 2를 반환해 스크립트가 중단됨). (3) 월드를 새로 만들어 배정할 때 서버 상태 확인이 항상 실패해서, 서버가 실행 중인 채로 `LEVEL`이 바뀐다. | `prd.md:51-59`; `scripts/mcctl.sh:23,306-307,359,394-428`; `scripts/lock.sh:316-320`; `shared/infrastructure/adapters/ShellAdapter.ts:160-162` → `scripts/mcctl.sh:89-104`; `shared/application/use-cases/WorldManagementUseCase.ts:163-168` | ✔ |
| 5 | **정지 유예 시간이 설정되어 있지 않다.** 어떤 템플릿에도 `stop_grace_period`가 없다. itzg 이미지는 정지할 때 최대 60초를 기다리지만, Docker 기본 유예 시간이 지나면 강제 종료될 위험이 있다(Docker 기본값 10초는 미확인). | `docs/itzg-reference/03-variables.md:118`; 템플릿 전체(grep 결과 없음) | ✔ |
| 6 | **이름을 부분 일치로 비교한다.** (1) 서버를 삭제하면 이름이 겹치는 다른 서버의 include 줄과 avahi 줄까지 지운다. (2) 등록할 때는 이름이 겹치면 이미 있는 것으로 보고 건너뛴다. (3) `mcctl down`은 호스트에서 이름에 `mc-`가 들어간 컨테이너를 모두 멈춘다. Docker의 `name` 필터는 이름의 일부만 맞아도 걸린다([docker/cli 문서](https://github.com/docker/cli/blob/master/docs/reference/commandline/container_ls.md)). | `scripts/delete-server.sh:177-178,212-213`; `scripts/create-server.sh:190`; `cli/lib/shell.ts:296-299` | ✔ |
| 7 | **실패가 조용히 묻힌다.** (1) `init --reconfigure`가 존재하지 않는 서비스 `mc-router`를 재시작한다(서비스 이름은 `router`). (2) 런타임 오류가 "컨테이너 없음"으로 해석되어, 파괴적인 작업이 그대로 진행될 수 있다. | `cli/commands/init.ts:672` vs `platform/docker-compose.yml:57`; `docker.ts:22-35,96-106` | ✔ / 보고 |
| 8 | **API 응답이 멈출 수 있다.** 요청을 처리하는 중에 프로세스를 동기로 실행하고 타임아웃도 없다. 서버 목록 한 번에 프로세스를 1+4N회 실행한다. | `docker.ts:22-35`; `api/routes/servers.ts:157-159,212-235` | 보고 |
| 9 | **운영 기본값이 없다.** (1) 로그 회전이 없다(PRD FR-004는 완료로 표시). (2) 컨테이너 메모리 제한이 없다. (3) PM2 부팅 자동 시작이 설정되지 않아, 재부팅하면 API와 콘솔이 내려간 채로 남는다. | `prd.md:66,483-490`; `cli/commands/console/service.ts:315,445` | ✔ / 보고 |
| 10 | **CI가 비어 있다.** PR에서 도는 것은 경로 필터가 걸린 CLI·shared 테스트뿐이다. API·console·modrinth 테스트, lint, 타입 검사, 스크립트 검사는 어디서도 실행되지 않는다. 릴리스도 테스트를 통과하지 않아도 나간다. CLAUDE.md의 "All PRs must pass lint, type-check, test, build"와 맞지 않는다. | `.github/workflows/{cli-test,shared-test,e2e,release}.yml` | ✔ |
| 11 | **런타임 경계가 없다.** (1) `docker.ts`에 포트 없는 자유 함수가 43개 있다. (2) CLI와 API가 `docker`를 직접 부르는 곳이 약 20군데다. (3) API에는 조립 지점(composition root)이 없다. (4) 서버 정의가 config.env, 서버별 compose, include 목록, `.env`, `.mcctl.json`, avahi, lock 파일에 흩어져 있고, 이를 쓰는 코드가 8곳 이상이다. | `api/routes/servers.ts:465-468,769-775`; `api/routes/worlds.ts:118-196` | ✔ / 보고 |

---

## 3. 먼저 결정할 것 (P0)

### D-1. 월드 저장 위치의 표준
이 결정은 A1, A3a, A5, B1, D5에 영향을 준다.

| 선택지 | 내용 | 장점 | 단점 |
|--------|------|------|------|
| **a. `/worlds` 공유 복원** (권장) | `CT/`에 `--universe /worlds/`를 다시 넣는다. 기존 설치본(`data/<LEVEL>`)은 감지해서 사용자가 원할 때만 이전한다(A5). | PRD FR-002, 문서, 월드 관리 UI, 백업 범위(`worlds/`)와 일치한다. #165의 원래 의도를 회복한다. | 혼재된 설치본을 계속 지원해야 한다. k8s 단계에서는 서버별 볼륨으로 다시 나눠야 한다. 단, ServerSpec의 `world.storage`로 흡수할 수 있다. |
| b. `/data/<LEVEL>` 서버별 저장을 표준으로 | 현재 npm 설치본의 동작을 공식 표준으로 삼는다. | 마이그레이션이 필요 없다. k8s 평가 보고서 §3의 "옵션 C"와 같은 방향이다. | 공유 월드 기능(배정·새 월드), 백업, lock을 모두 이 구조에 맞게 다시 설계해야 한다. RT/PT 템플릿과 문서도 바꿔야 한다. |

> 어느 쪽을 고르든 A1과 A3a는 **두 배치를 모두 처리**해야 한다. 이미 혼재된 설치본이 있기 때문이다.

### D-2. 월드 배타성을 보장하는 방식 (A4)

| 선택지 | 내용 | 평가 |
|--------|------|------|
| **a. 배정 시점 배타성** (권장) | "한 월드는 한 서버의 `LEVEL`에만 연결된다"는 불변식을 **쓰는 시점**(create/assign/config)에 강제한다. lock 상태는 `LEVEL`과 런타임 상태에서 파생하고, 판단할 수 없으면 거부(fail-closed)한다. | mc-router 자동 기동을 포함한 **모든 시작 경로가 자연스럽게 보호된다**. k8s에서는 같은 불변식이 PVC 소유로 이어진다. |
| b. 컨테이너 안 `PRE_START_SCRIPT` 가드 | 컨테이너가 시작될 때 lock을 확인한다. | 보조 수단으로만 쓴다. 고정 태그(`java25`)에서 이 기능이 지원되는지는 미확인이다. |
| c. 현행 lock 파일 유지 + 모든 시작 경로에서 검사 | — | 라우터 자동 기동 경로를 막을 수 없다. |

### D-3. macOS 지원 범위 (C7)
- **a. 유지**: C7과 macOS CI를 수행한다.
- **b. Linux 전용으로 축소**: 문서와 `package.json`의 `os`를 고친다.

CLAUDE.md와 NFR-004는 현재 macOS를 지원 대상으로 명시한다. 그런데 스크립트에는 GNU 전용 문법이 20곳 넘게 있고, macOS에는 `flock`이 없다.

---

## 4. 작업 분해 (WBS)

각 행이 GitHub Issue 하나에 해당한다. 유형은 Git-Flow 브랜치 유형(bugfix/feature)과 성격(refactor/chore/docs)을 함께 적었다.

### Track A — 데이터 안전성

| ID | 스토리 | 유형 | 모듈 | 에이전트 | 규모 | 의존성 | 대표 근거 |
|----|--------|------|------|---------|------|--------|-----------|
| A1 | **서버 삭제 시 월드 보호**: `data/*/level.dat`가 있으면 `--delete-data` 없이는 거부한다. 정지에 실패하면 중단한다. 스크립트 안에서 이름을 검증한다. CLI에 확인 프롬프트를 넣고, 완료 메시지를 정확하게 고친다. | bugfix | scripts, cli, shared | cli-agent (+frontend-agent: 콘솔 삭제 대화상자) | S | B2, E2 | `scripts/delete-server.sh:154-160,246,265`; `cli/commands/delete.ts`; `docs/cli/commands.md:597-598` |
| A2 | **정지 유예 보장**: 템플릿에 `stop_grace_period`(≥ STOP_DURATION)를 넣는다. 기존 서버는 `mcctl upgrade`로 패치한다. Compose 값이 `docker stop`과 mc-router의 정지에도 적용되는지 먼저 확인하고, 적용되지 않으면 stop 경로마다 타임아웃 인자를 넘긴다. | bugfix | templates (+shared, api, cli) | devops-agent (→ core-agent) | S | B1 (코드 경로를 고쳐야 하면 D1) | `docs/itzg-reference/03-variables.md:118`; `scripts/mcctl.sh:464`; `docker.ts:325-332`; `api/utils/docker-compose.ts:83`; `cli/lib/shell.ts:298,348` |
| A3a | **backup.sh 일관성**: 실행 중인 서버는 저장을 flush하거나 정지를 요구한다. 전역 잠금을 건다. 복원은 비대화형(`--yes`)으로 하고, 실행 중인 서버가 있으면 거부한다. `.locks`를 보존하고, checkout을 깨끗하게 해서 이전 커밋과 섞이지 않게 한다. `.bak`를 정리하고 원본이 비어 있으면 중단한다. `data/<LEVEL>` 월드도 백업에 포함한다. | bugfix | scripts | cli-agent | M | B2, E2, D-1 | `scripts/backup.sh:37,170-183,244-246,453,461-480` |
| A3b | **API 백업 경로**: 번들 스크립트 해석(`resolveScriptPath`)을 쓰고 git 대체 경로는 없앤다. 종료 코드 2를 성공으로 처리한다. 스케줄러와 뮤텍스를 공유한다. 보존 정책의 이력 재작성을 안전하게 바꾼다(try/finally, `--force-with-lease`, 타임아웃, `maxAgeDays` 버그). `BackupUseCase`의 `exec('git')`이 항상 실패하는 문제도 고친다. | bugfix | api, shared | backend-agent | M | A3a | `api/routes/backup.ts:151-166,191-197`; `api/services/backup-scheduler.ts:192-273,474-498,531-541`; `shared/application/use-cases/BackupUseCase.ts:213-217` |
| A4 | **월드 배타성 강제(FR-003 실제 구현)**: D-2 방식으로 bash와 TS의 규칙을 하나로 만들고 fail-closed로 동작하게 한다. 월드를 삭제하거나 초기화할 때 그 월드를 참조하는 모든 서버를 확인한다. `world release`가 오래된 lock을 풀지 못하는 문제와, 재배정할 때 서버 상태 확인이 실패하는 문제를 고친다. | feature | shared, scripts, api | core-agent(설계) → cli-agent, backend-agent | L | D-2, D1 | `prd.md:51-59`; `scripts/lock.sh:42,131-157,316-320`; `shared/application/use-cases/WorldManagementUseCase.ts:163-168,773-797`; `shared/infrastructure/adapters/WorldRepository.ts:254-278`; `api/routes/servers/config.ts:207-251` |
| A5 | **`mcctl migrate` 안전화**: 원본을 `LEVEL` 기준으로 찾고, 없으면 중단한다. 이전하는 동안 라우터 자동 기동을 막는다. 런타임 오류가 나면 중단한다. 차원 디렉터리 이름을 최종 `LEVEL` 기준으로 맞춘다. | bugfix | cli | cli-agent | M | D-1, E2 | `cli/commands/migrate.ts:238,346,371-377,417-421,441-492,514-519,557` |
| A6 | **설정 쓰기의 원자성·동시성**: shared에 원자적 쓰기(tmp+rename)와 env 코덱 하나를 둔다. 현재 env 파서가 7개다. 스크립트에서는 compose.yml과 `.env`를 편집할 때 `flock`을 건다. API의 생성·삭제는 한 번에 하나만 실행되게 한다. | feature | shared, scripts, api | core-agent → cli-agent, backend-agent | M | B2 | `scripts/create-server.sh:444,613-638`; `scripts/delete-server.sh:174-200`; `api/services/HostnameService.ts:209`; `api/services/ConfigService.ts:324,339,451`; `docker.ts:846-882` |
| A7 | **런타임 오류 시 fail-closed**: "확인할 수 없음"과 "없음"을 구분한다(`RuntimeUnavailableError`). API는 503을 반환하고 파괴적인 작업은 중단한다. | bugfix | shared, api | core-agent → backend-agent | M | D1 | `docker.ts:22-35,96-106`; `shared/infrastructure/adapters/ServerRepository.ts:119-121`; `WorldRepository.ts:309-312`; `api/routes/servers/config.ts:215-221` |

### Track B — 단일 원천과 설정 일관성

| ID | 스토리 | 유형 | 모듈 | 에이전트 | 규모 | 의존성 | 대표 근거 |
|----|--------|------|------|---------|------|--------|-----------|
| B1 | **템플릿 단일화 + `EXTRA_ARGS` 회귀 복구**: `CT/`를 단일 원천으로 삼고 RT/PT는 생성하거나 삭제한다. CI에 드리프트 검사와 `docker compose config` 검증을 넣는다. `DOCKER_TIMEOUT`(`"120"` vs `"120s"`), `AUTO_SCALE_DOWN_AFTER`(1m vs 10m), 포트(3000/3001 vs 5000/5001), playit, `API_BINDING`, 네트워크 정의를 맞춘다. | bugfix | templates, CI | devops-agent | M | D-1, E1 | `CT/servers/_template/config.env:53` vs `RT/servers/_template/config.env:57`; `CT/docker-compose.yml:61-62` vs `platform/docker-compose.yml:67-69`; `shared/utils/index.ts:118-128`; #162, #165 |
| B2 | **스크립트 사본 단일화**: `cli/scripts` 사본을 추적에서 빼고 빌드할 때 생성한다. `docker/bluemap`을 패키지에 포함한다. CI에 diff 검사를 넣는다. | chore | cli, CI | cli-agent | S | — | `diff -rq platform/scripts platform/services/cli/scripts`(5개 파일 차이, `render-map.sh` 누락); `shared/utils/index.ts:105-116`; `scripts/render-map.sh:47-49` |
| B3 | **이름 정확 일치**: avahi 등록과 삭제, include 삭제에서 이름을 정확히 비교한다. | bugfix | scripts | cli-agent | S | B2, E2 | `scripts/create-server.sh:190`; `scripts/delete-server.sh:177-178,212-213` |
| B4 | **설정 편집 안전화 + 호스트명 적용**: `update`와 `init --reconfigure`의 정규식 편집을 compose-router-patch 방식(재파싱+백업)으로 바꾼다. 호스트명 생성기를 하나로 합친다. 호스트명을 바꾼 뒤 컨테이너를 재생성(apply)하는 경로를 만든다. 지금은 `recreateRequired`만 반환한다. | bugfix | cli, api | cli-agent, backend-agent (+frontend-agent: 적용 버튼) | M | A6 | `cli/commands/update.ts:83-86,153,164-174`; `cli/commands/init.ts:696-753`; `api/services/HostnameService.ts:162-209`; `api/routes/servers/hostnames.ts:154` |
| B5 | **라벨 기반 서버 발견**: `io.mcctl.server`와 `io.mcctl.role` 라벨을 붙인다. `down`은 compose가 관리하는 대상만 멈춘다. 기존 서버에는 라벨을 보강한다. | feature | templates, shared, cli, scripts | core-agent → devops-agent, cli-agent | M | B1, D1 | `docker.ts:195-233`; `scripts/lib/common.sh:180-187`; `cli/lib/shell.ts:296-299`; `cli/lib/prompts/server-select.ts:108-121` |
| B6 | **이미지 태그 정책**: 서버를 만들 때 MC 버전에 맞는 Java 태그를 고른다(지금은 `update`에서만 적용됨). 릴리스마다 태그를 고정하고(digest), Renovate를 도입한다. | feature | templates, shared, cli | devops-agent, core-agent | M | B1 | 템플릿 `:30`의 `java25` 고정; `cli/commands/update.ts:60,654`; `shared/domain/value-objects/McVersion.ts:60-75`; `platform/docker/bluemap/Dockerfile:17` |
| B7 | **이름·경로 규칙 단일화**: ServerName 규칙을 하나로 만든다(k8s DNS-1123 호환, `router` 같은 예약어 포함). `LEVEL`용 WorldName 값 객체를 만든다. 루트 경로(MCCTL_ROOT/PLATFORM_PATH)와 월드 이름 해석도 하나로 통일한다. | refactor (feature 브랜치) | shared, api, scripts | core-agent → backend-agent | S | — | `shared/domain/value-objects/ServerName.ts:28-61`(규칙 3종 중 하나); `api/config/index.ts:153-163`; `docker.ts:639` vs `:930` |

### Track C — 운영 안정성

| ID | 스토리 | 유형 | 모듈 | 에이전트 | 규모 | 의존성 | 대표 근거 |
|----|--------|------|------|---------|------|--------|-----------|
| C1 | **조용한 실패 제거**: 다음을 고친다. (1) 라우터 서비스 이름. (2) `startAll`/`stopAll`에 pipefail이 없어 실패해도 성공으로 감사되는 문제. (3) 스크립트를 `set -Eeuo pipefail`로 바꾸고 정리 trap을 넣는다(생성 실패 시 잔여물 정리). (4) `.env`를 셸로 source하지 않고 안전하게 파싱한다. (5) init이 네트워크를 `.env`에서 읽게 한다. (6) API에 전역 오류 처리를 넣고 감사 로그를 best-effort로 바꾼다. (7) `findByName`이 일부 서버를 놓치는 문제. | bugfix | cli, scripts, api, shared | cli-agent, backend-agent | M | B2, E2 | `cli/commands/init.ts:342-352,672`; `cli/lib/shell.ts:320-322,347-349`; `scripts/create-server.sh:444`; `scripts/mcctl.sh:34`; `api/routes/servers.ts:935-996`; `api/routes/servers/actions.ts:88`; `shared/infrastructure/adapters/ServerRepository.ts:59-95` |
| C2 | **API 비동기화·타임아웃**: 동기 프로세스 실행을 없앤다. 상태 조회는 공유 폴러 하나와 TTL 캐시로 처리한다. SSE를 정리한다(close 핸들러를 먼저 등록, error 핸들러 추가, 동시 연결 상한). RCON, 스크립트, 맵 렌더링, 외부 fetch에 타임아웃을 건다. | feature | shared, api | core-agent → backend-agent | M | D1, D2 | `docker.ts:22-35`; `api/routes/servers.ts:157-159,212-235,509-521,580,873`; `api/routes/players.ts:158-167,298-310` |
| C3 | **로그 회전·자원 제한**: router, 서버, playit 컨테이너에 json-file `max-size`/`max-file`을 설정한다. 서버를 만들 때 `mem_limit`(MEMORY + 여유분)을 넣는다. BlueMap 렌더링에도 메모리 제한을 건다. | feature | templates, scripts | devops-agent | S | B1 | `prd.md:66,483-490`(완료 표시와 불일치); `scripts/render-map.sh:312` |
| C4 | **서비스 지속성과 종료 처리**: `mcctl console service enable`(pm2 startup + save) 또는 systemd 유닛을 제공한다. PM2_HOME을 분리한다. API 종료에 타임아웃을 두고 진행 중인 작업을 마무리한다(drain). CLI로 만든 백업 스케줄도 API가 반영하게 한다. | feature | cli, api | cli-agent, backend-agent | M | — | `cli/commands/console/service.ts:315,350-374,445`; `cli/lib/pm2-utils.ts:50-57`; `api/app.ts:116-129` |
| C5 | **SQLite 견고화**: 공통 open 헬퍼를 만든다(busy_timeout 명시, WAL). DB마다 핸들을 하나만 쓰고 지연 open한다. 감사 로그 보존 기간에 기본값을 둔다. | bugfix | shared, api | core-agent → backend-agent | S | D2 | `api/services/config-snapshot-service.ts:27` + `api/routes/config-snapshot-schedules.ts:66`(같은 DB를 두 번 open); `api/services/audit-log-service.ts:202,227` |
| C6 | **서버 생성 진행 상황 계약**: 스크립트가 `##STAGE:` 또는 JSON 줄을 출력하게 한다. API는 성패를 종료 코드로 판단한다. 계약 테스트를 추가한다. 지금 API가 기다리는 진행 문자열 5개 중 4개는 스크립트가 출력하지 않는다. | bugfix | scripts, api | cli-agent → backend-agent | S | B2 | `api/routes/servers.ts:903-927,938,970-973`; `scripts/create-server.sh:443-664`; `platform/services/mcctl-api/tests/servers.test.ts:66-74` |
| C7 | **macOS 이식성** (D-3이 a일 때): `sed -i`를 헬퍼로 감싸고, `flock` 대체 수단을 쓰고, `grep -P`와 `ip route`를 없앤다. macOS CI를 추가한다. | chore | scripts | cli-agent | M | D-3, E2 | `scripts/lock.sh:194`; `create-server.sh` 등의 `sed -i` 20여 곳 |

### Track D — 런타임 경계 (k8s 준비, Tidy First)

| ID | 스토리 | 유형 | 모듈 | 에이전트 | 규모 | 의존성 | 대표 근거 |
|----|--------|------|------|---------|------|--------|-----------|
| D1 | **런타임 포트 정의 + Docker 어댑터로 이전** (동작 변화 없음): §9.1의 포트를 정의한다. `docker.ts`를 `DockerComposeRuntimeAdapter`로 옮긴다. infrastructure 밖에서 `child_process`를 쓰지 못하게 lint로 막는다. | refactor (feature 브랜치) | shared | core-agent | L | B7 | `docker.ts`(자유 함수 43개); 직접 호출 지점(`cli/lib/shell.ts:145-348`, `api/routes/servers.ts:580,665`, `api/lib/rcon.ts:33,71`) |
| D2 | **API composition root**: Fastify 플러그인 `container`를 만든다. 라우트는 주입받은 포트만 쓴다. 테스트는 `buildApp({container})`로 한다. | refactor (feature 브랜치) | api | backend-agent | M | D1 | `api/routes/servers.ts:465-468,769-775`; `api/routes/worlds.ts:118-196`; `api/routes/players.ts:140-153` |
| D3 | **CLI의 직접 호출을 포트로 전환** | refactor (feature 브랜치) | cli | cli-agent | M | D1 | `cli/lib/shell.ts:145-348`; `cli/lib/rcon.ts`; `cli/commands/rcon.ts:24,39`; `cli/commands/init.ts:342-347`; `cli/commands/migrate.ts:557`; `cli/commands/upgrade.ts:334` |
| D4 | **포트 경계 정리**: IShellPort에서 `exec`와 `execInteractive`를 뺀다. 저장소가 런타임 상태를 직접 조회하지 않게 한다. use case가 `Paths`에 의존하지 않게 한다. 도메인에 박힌 `mc-`와 `.local` 규칙을 어댑터로 옮긴다. | refactor (feature 브랜치) | shared | core-agent | M | D1 | `shared/application/ports/outbound/IShellPort.ts:128-133`; `shared/infrastructure/adapters/ServerRepository.ts:109-142`; `WorldRepository.ts:298-301`; `shared/application/use-cases/CreateServerUseCase.ts:36-42`; `shared/domain/value-objects/ServerName.ts:17-26` |
| D5 | **ServerSpec 단일 모델**: 서버 정의를 `servers/<n>/server.yaml` 하나로 두고 원자적으로 쓴다. config.env, 서버 compose, include 목록은 여기서 생성한다. 기존 설정은 가져오기로 변환하고, 사람이 직접 고친 내용은 감지한다. `world.storage: universe\|data`를 둔다(§9.2). | feature | shared, cli, api, scripts | core-agent(설계·구현) + 전원 | L | A6, B1, B7, D1 | §2-11 (서버 정의가 7곳에 흩어져 있고, 쓰는 코드가 8곳 이상) |

### Track E — 테스트·CI

| ID | 스토리 | 유형 | 모듈 | 에이전트 | 규모 | 의존성 | 대표 근거 |
|----|--------|------|------|---------|------|--------|-----------|
| E1 | **PR CI 확장**: 모든 패키지에 lint, 타입 검사, 테스트를 돌린다. 템플릿·스크립트 드리프트 검사와 `docker compose config` 검증을 넣는다. 릴리스는 이 검사를 통과해야 나가게 한다. e2e의 기본 API URL을 고친다(지금 :5000). | chore | CI | devops-agent | M | — | `.github/workflows/*.yml`; `DEVELOPMENT.md:180`; `e2e/tests/api-backup.spec.ts:3` |
| E2 | **스크립트 테스트 기반**: bats를 도입하고, PATH에 호출만 기록하는 가짜 `docker`를 둔다. shellcheck를 추가한다. | chore | scripts, CI | devops-agent (+cli-agent) | M | — | `scripts/tests/*.test.sh`(수동 실행); 나머지 스크립트는 테스트 없음 |
| E3 | **공유 테스트 더블과 포트 계약 테스트**: `shared/testing`(FakeRuntime, 메모리 저장소)을 만든다. 같은 계약 테스트를 Docker 어댑터와 (향후) k8s 어댑터에 적용한다. CLI mock을 타입 검사 대상에 넣는다. 실제 docker를 호출하는 테스트는 분리한다. | chore | shared, cli, api | core-agent | M | D1 | `platform/services/shared/prd.md:62`; `platform/services/cli/tests/mocks/MockShellAdapter.ts:1-7`; `platform/services/shared/tests/playit-docker.test.ts:74-106`; `platform/services/mcctl-api/tests/servers.test.ts:404-408` |

### Track F — 문서 정합화

| ID | 스토리 | 유형 | 모듈 | 에이전트 | 규모 | 의존성 | 대표 근거 |
|----|--------|------|------|---------|------|--------|-----------|
| F1 | **문서 정합화**: PRD FR-003/FR-004의 실제 상태, `create-server.sh` 도움말의 "creates symlink", 삭제 확인 관련 문서, README의 유휴 시간, 템플릿 원천 위치를 바로잡는다. 바뀐 동작은 EN/KO로 반영한다. | docs (feature 브랜치) | docs | technical-writer | S | 각 트랙 완료 후 | `prd.md:51-68`; `scripts/create-server.sh:20,263`; `docs/cli/commands.md:597-598` |

---

## 5. 의존성 그래프

```
결정 D-1 ──┬─────────────────► B1 ──┬──► A2(템플릿)
           │                        ├──► C3
           │                        ├──► B5 ◄── D1
           │                        └──► B6
           ├──► A3a ──► A3b
           ├──► A5
           └──► D5
결정 D-2 ─────────────────────────────► A4 ◄── D1
결정 D-3 ─────────────────────────────► C7

E1 ──┐  (이후 모든 PR을 검증)
E2 ──┼──► A1, B3, A3a, A5, C1, C6, C7   (스크립트는 TDD: 실패하는 bats 테스트부터)
B2 ──┘──► A1, B3, A3a, A6, C1, C6       (사본 정리 후 스크립트 수정 → #165 재발 방지)

B7 ──► D1 ──┬──► D2 ──┬──► C2
            │         └──► C5
            ├──► D3
            ├──► D4
            ├──► A7
            ├──► E3
            └──► A4, B5, (A2 코드 경로)
A6 ──┬──► B4
     └──► D5 ◄── B1, B7, D1
모든 트랙 ──► F1
```

---

## 6. 병렬 실행 그룹

| Group | Tasks | 병렬 | 선행 조건 | 모듈별 배치 |
|-------|-------|------|-----------|-------------|
| P0 | D-1, D-2, D-3 결정 | — | 없음 | 사용자 결정 |
| P1 | E1, E2, B2, B7, C4 | Yes | 없음 | devops: E1, E2 / cli: B2, C4(CLI) / core: B7 / backend: C4(API) |
| P2 | B1, A1 → B3 → A3a, D1 | Yes (모듈 간) | P1, D-1 | devops: B1 / cli: A1 → B3 → A3a(순차, 같은 스크립트) / core: D1 |
| P3 | A2, C3, B6, A3b, D2, D3, A5, C1, C6, D4, A6, E3 | Yes (모듈 간) | P2 | devops: A2, C3, B6 / backend: A3b, D2 / cli: D3, A5, C1, C6 / core: D4, A6, E3 |
| P4 | A7, C2, C5, A4, B5, B4, C7 | Yes (모듈 간) | P3, D-2, D-3 | core: A7, C2(어댑터), A4(설계), B5 / backend: C2(API), C5, B4(API) / cli: B4(CLI), C7, A4(스크립트) |
| P5 | D5, F1 | — | P4 | core가 주도하고 전원이 참여(ServerSpec은 설계 리뷰 후 PR을 여러 단계로 나눔) / technical-writer: F1 |

> 같은 모듈 안에서는 순서대로 진행한다. 특히 cli-agent 트랙은 `create-server.sh`, `delete-server.sh`, `backup.sh`를 여러 스토리가 함께 고치므로 순서를 지킨다.

---

## 7. 실행 구성안

### Option A: Claude Code Teams (권장)

- **Team Name**: 마일스톤별로 만든다(예: `hardening-m1-safety-net`).

| Role | Agent Type | 담당 | Worktree |
|------|-----------|------|----------|
| Lead | orchestrator-agent | 조율, 동기화, 리뷰 | - |
| Member 1 | core-agent | B7, D1, D4, A6, E3, A7, C2(어댑터), A4(설계), B5, D5 | Yes |
| Member 2 | cli-agent | B2, A1, B3, A3a, A5, C1, C6, D3, C7, B4(CLI), C4(CLI) | Yes |
| Member 3 | backend-agent | A3b, D2, C5, C2(API), B4(API), C4(API), A4(API) | Yes |
| Member 4 | devops-agent | E1, E2, B1, A2, C3, B6, B5(템플릿) | Yes |
| Member 5 | frontend-agent | A1, B4의 콘솔 UI(필요할 때만) | Yes |
| Member 6 | technical-writer | F1, 이슈 작성 | - |

**Sync Points**

1. **SYNC-0** D-1~D-3 결정 → B1, A3a, A5, A4, C7 착수
2. **SYNC-1** E1·E2 준비 → 스크립트 수정은 실패하는 bats 테스트부터 시작(TDD)
3. **SYNC-2** B2 완료 → 모든 스크립트 수정 착수(사본을 이중으로 고치는 일 방지)
4. **SYNC-3** D1 포트 인터페이스 확정 → D2, D3, D4, A7, C2, A4, B5
5. **SYNC-4** B1 템플릿 단일화 → A2, C3, B5, B6의 템플릿 수정
6. **SYNC-5** A6 원자적 쓰기·env 코덱 → B4, D5

### Option B: 순차 서브에이전트

devops(E1, E2) → cli(B2) → core(B7) → devops(B1) → cli(A1, B3, A3a) → core(D1) → backend(A3b, D2) → cli(D3, A5, C1, C6) → core(D4, A6, E3, A7) → backend(C2, C5) → core·cli·backend(A4) → … → core(D5) → technical-writer(F1)

충돌 관리는 단순하지만 전체 기간이 길어진다.

---

## 8. 설계 필요 사항

- [ ] **D1 런타임 포트 인터페이스**: system-architect(없으면 core-agent). §9.1 초안이 출발점이다.
- [ ] **A4 월드 배타성 규칙과 상태 모델**: system-architect → core-agent. D-2 결정을 반영한다.
- [ ] **D5 ServerSpec 스키마, 저장 방식, 마이그레이션**: system-architect → core-agent. §9.2 초안이 출발점이다.
- [ ] **A3 백업 일관성 절차**(flush 또는 정지, 잠금, 복원 순서): devops-architect(없으면 devops-agent).
- [ ] **B5 라벨 체계**: core-agent + devops-agent.
- [ ] **A1·B4 콘솔 UX**: frontend-design skill(필요할 때만).

---

## 9. 설계 초안 (참고, core 감사 제안 요약)

### 9.1 런타임 포트

| 포트 | 메서드 | 대체 대상 |
|------|--------|-----------|
| `IContainerRuntimePort` | `getState(name)` → `{phase: running\|starting\|stopping\|stopped\|absent, health, startedAt?}`, 확인할 수 없으면 `RuntimeUnavailableError` / `list({phase?})`(라벨 기반) / `start`, `stop({graceSec})`, `restart` / `apply(spec)`, `remove({purgeData})` / `logs()`, `followLogs(signal)` / `stats()` / `exec(argv, {timeoutMs})` | `docker.ts`의 상태·목록·수명주기·로그·통계 함수, `IShellPort.start/stop/create/delete`, API의 직접 spawn |
| `IServerConsolePort` | `command(name, cmd)`, `listPlayers(name)` | `IRconPort`(컨테이너 이름 기반), `rcon-cli` 직접 호출 |
| `IRouterStatusPort` | `getStatus()`, `listRoutes()` | 라우터 상태 조회 함수들 |
| `IPlayitAgentPort` | `getStatus()`, `start()`, `stop()` | playit 함수들 |
| `IHostnameRegistrarPort` | `getStatus()`, `register(host, ip)`, `unregister(host)` | avahi 상태 조회와 스크립트 내 편집 |
| `IRuntimeEnvironmentPort` | `check()` | `checkDocker` 등 |
| `IServerSpecRepository` | `list/get/save/delete` | config.env·compose를 읽고 쓰는 흩어진 코드 |
| `IWorldLockPort` | `acquire/release/get` | `lock.sh`, `WorldRepository.getLockStatus` |

포트로 만들지 않는 것도 있다.
- `execScript`는 Compose 어댑터 안으로 숨긴다.
- `parseRconPlayerList`와 `formatBytes`는 순수 함수로 남긴다.
- `getWorldDirectorySize`는 `WorldRepository`로 옮기고 비동기로 바꾼다.

### 9.2 ServerSpec

- **필드**:
  - `specVersion`, `name`, `type`, `version`, `imageTag`, `memory`
  - `world { level, storage: universe|data, source: new(seed)|existing|download(url) }`
  - `routing { hostnames[], autoScale, motd }`
  - `playitDomain?`, `modpack?`, `whitelist`, `env`(검증된 통과값), `secretRefs`, `stopGraceSec`, `resources?`
- **저장**: `servers/<n>/server.yaml`. 원자적으로 쓰고 서버별 잠금을 건다.
- **생성물**: config.env, 서버 `docker-compose.yml`, `servers/compose.yml` include 목록. 다음 단계에서 k8s 렌더러(StatefulSet/Service/PVC)를 추가한다.
- **가져오기**:
  - config.env와 compose의 라벨·이미지 태그를 읽어 ServerSpec을 만든다.
  - 알 수 없는 키는 보존한다.
  - 내용 해시로 사람이 직접 고친 부분을 감지한다.
  - 월드가 `data/`와 `worlds/` 중 어디에 있는지 판별한다.

---

## 10. 브랜치·커밋 전략

- **Base**: `develop`. 이슈 하나에 브랜치 하나.
- **브랜치 이름**
  - `bugfix/<issue>-<desc>`: A1, A2, A3a, A3b, A5, A7, B1, B3, B4, C1, C5, C6
  - `feature/<issue>-<desc>`: A4, A6, B5, B6, B7, C2, C3, C4, C7, D1~D5, E1~E3, F1(리팩터링과 문서 포함, CLAUDE.md 기준)
- **TDD**: 모든 이슈는 실패하는 테스트(bats, vitest, 계약 테스트)로 시작한다.
- **Tidy First**: D1~D4는 구조만 바꾸고 동작은 그대로 둔다. 동작 변화(A7, C2, A4)는 별도 이슈와 별도 커밋으로 진행한다.
- **하위 호환**: 기존 설치본은 `mcctl upgrade`와 `migrate`로 보강한다(A2, B5, B6, D5). 파일을 바꾸기 전에 백업 파일을 남긴다.

---

## 11. 마일스톤(릴리스 묶음) 제안

| 마일스톤 | 포함 | 완료 기준 |
|----------|------|-----------|
| **M1 안전망** | E1, E2, B2, B7, B1, A1, B3, A2, C3, A3a, A3b | 삭제·백업·강제 종료로 데이터가 사라지는 경로를 막는다. 템플릿과 스크립트의 원천을 하나로 만든다. 모든 패키지가 PR CI를 거친다. |
| **M2 런타임 경계** | D1, D4, E3, D2, D3, A7, C2, C5, C1, C6 | `docker` 호출이 어댑터 안에만 있다. API가 비동기로 동작하고 fail-closed다. 포트 계약 테스트가 있다. |
| **M3 월드·설정 정합성** | A4, A5, A6, B4, B5, B6, C4, C7 | FR-003이 실제로 보장된다. 설정 쓰기가 원자적이다. 서버를 라벨로 발견한다. 재부팅 후에도 서비스가 살아난다. |
| **M4 ServerSpec** | D5, F1 | 서버 정의의 원천이 하나이고 compose는 생성물이다. 문서가 실제 동작과 맞다. |

---

## 12. k8s 단계 진입 조건 (Definition of Ready)

아래 조건을 모두 만족하면 `k8s-longhorn-assessment.md` §8의 3단계(k8s 어댑터)를 시작한다.

1. `child_process`와 `docker` 호출이 Docker 어댑터 안에만 있고, lint로 강제된다.
2. 템플릿과 스크립트의 원천이 하나이고, CI가 드리프트를 검사한다.
3. 서버 정의가 ServerSpec 하나이고, compose 파일은 생성물이다.
4. 월드 배타성 규칙이 `IWorldLockPort` 뒤에 있고 fail-closed로 동작한다.
5. 서버를 라벨로 발견하고, 서버 이름은 DNS-1123과 호환된다.
6. API에 composition root가 있고, SQLite에 쓰는 주체는 API 하나다.
7. 모든 패키지 테스트와 스크립트 테스트가 PR CI에서 돌고, 포트 계약 테스트가 있다.
8. 백업과 복원이 일관되고 잠금으로 보호된다.

---

## 13. 미확인 사항

- Minecraft의 `session.lock`이 같은 호스트에서 두 JVM이 한 월드를 여는 것을 막는지. 막는다면 A4의 위험이 줄어든다(NFS/RWX에서는 해당하지 않음).
- Docker 기본 정지 유예 시간(10초)과 mc-router가 유휴 서버를 멈출 때 쓰는 타임아웃.
- Compose의 `stop_grace_period`가 `docker stop`과 mc-router의 정지에도 적용되는지(A2의 범위를 정한다).
- `DOCKER_TIMEOUT: "120"`이 mc-router 1.47.1에 실제로 어떤 영향을 주는지.
- 고정 태그 `java25`에서 `PRE_START_SCRIPT`를 쓸 수 있는지(D-2의 b안).
- `docker compose restart`가 라벨 변경을 반영하지 않는다는 점(B4의 근거, Docker 문서 기준).
- better-sqlite3의 기본 busy timeout(5000ms).
- macOS 동작: `flock` 부재, BSD `sed -i`.
- 복원 시 overlay checkout으로 월드가 섞이는 현상, API 복원이 `read -p`에서 멈추는 현상, 깨끗한 npm 설치에서 API 백업이 대체 경로로 빠지는 현상. 셋 다 코드를 읽고 추론한 것이며 실행으로 재현하지는 않았다.
- Docker `name` 필터에서 `^`로 앵커를 걸 수 있는지(B5가 끝나면 필요 없어짐).

---

## 14. 다음 단계

1. 사용자가 D-1, D-2, D-3을 결정한다.
2. technical-writer가 스토리마다 GitHub Issue를 만든다(CLAUDE.md Phase 2 형식: Summary / Root Cause 또는 Requirements / Solution / Files / Branch Strategy / Acceptance Criteria). 마일스톤 M1~M4도 만든다.
3. 승인되면 `/work --milestone <M1>` 또는 Teams 구성으로 P1부터 실행한다.
