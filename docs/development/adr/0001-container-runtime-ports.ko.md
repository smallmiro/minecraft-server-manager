# ADR-0001: 컨테이너 런타임 포트와 Docker 어댑터

| | |
|---|---|
| **상태** | 제안됨 (2026-10-23) |
| **이슈** | [#654](https://github.com/smallmiro/minecraft-server-manager/issues/654) (Hardening D1), 마일스톤 M2(#643), 에픽 #640 |
| **이 ADR을 바꾸는 후속 이슈** | #665(D4), #669(A7), C2, #675(D5), #641(k8s 어댑터) |
| **사용하는 이슈** | #667(D2, API), #668(D3, CLI), #666(E3, 계약 테스트), #715(스크립트 제거) |

이 문서는 영어판의 요약입니다. 포트 시그니처 전체, 48개 함수 매핑, 호출 지점 표, 구현 단계는 [영어판](0001-container-runtime-ports.md)에 있습니다.

## 배경

- `platform/services/shared/src/docker/index.ts`에 **자유 함수 48개**가 있고, CLI와 mcctl-api가 이 함수들을 직접 import합니다. 다른 런타임을 끼울 자리가 없습니다.
- CLI와 mcctl-api도 `docker`를 직접 실행하는 곳이 약 20군데 있습니다.
- 기존 포트(`IShellPort`, `IRconPort`, `IServerRepository`)로는 상태, 로그, exec, 수명주기, 통계를 다룰 수 없습니다.

이 이슈는 **구조 변경만** 합니다(Tidy First). 동작, argv, 반환값, 타이밍은 그대로입니다.

## 결정

| # | 결정 | 근거 |
|---|------|------|
| 1 | D1에서 포트 6개를 만든다: `IContainerRuntimePort`, `IServerConsolePort`, `IRouterStatusPort`, `IPlayitAgentPort`, `IHostnameRegistrarPort`, `IRuntimeEnvironmentPort` | 이슈 Solution 1 |
| 2 | 메서드는 **지금 옮겨 올 호출처가 있을 때만** 포트에 넣는다(`docker/index.ts` 함수, 또는 D2·D3이 옮길 CLI·API의 직접 호출) | YAGNI. D2와 D3이 shared를 고치지 않고 병렬로 진행할 수 있다(SYNC-3) |
| 3 | `IServerSpecRepository`와 `IWorldAssignmentPort`는 **타입 전용 파일 두 개로 만들고 provisional로 표시한다** | 구현도 호출처도 없다. ServerSpec 스키마(§9.2)와 A4 배정 모델이 확정되면 D5/A4가 모양을 바꾼다. `ServerSpec`은 D5가 대체할 최소 placeholder다 |
| 4 | **두 번째 어댑터(#641)가 생기기 전까지 계약은 잠정적이다.** D4·A7·C2·D5가 시그니처를 바꿀 수 있다 | 호출처는 TS 컴파일러가 찾아 준다. 바꿀 때마다 이 ADR을 고친다 |
| 5 | 지금 동기인 메서드는 **동기를 유지한다**. 비동기화는 C2에서 한다 | 동기 래퍼가 비동기 포트에 위임할 수 없으므로, 바꾸려면 호출처를 전부 바꿔야 한다 |
| 6 | **오류 모델을 바꾸지 않는다**: 센티널 값(`'not_found'`, `'unknown'`, `''`, `null`, `false`, `'-'`)과 throw하지 않는 결과 객체를 그대로 쓴다 | "확인 불가"와 "없음"의 구분(`RuntimeUnavailableError`)은 A7의 동작 변경이다 |
| 7 | D1에서 워크로드 이름은 **Docker 컨테이너 이름**이다(`mc-<server>`, `mc-router`, `playit-agent`) | 이렇게 해야 래퍼가 그대로 위임하고 #720 argv 테스트가 바뀌지 않는다. `ServerName`으로 바꾸는 일은 D4가 한다 |
| 8 | **포트 하나에 어댑터 클래스 하나.** Docker 클래스 5개는 모듈 하나(`DockerComposeRuntimeAdapter.ts`)에 두고, Avahi는 파일을 따로 둔다 | 한 클래스로는 구현할 수 없다: playit의 `start()`/`stop()`과 런타임의 `start(name)`/`stop(name)`, 라우터의 `getHealth()`와 `getHealth(name)`이 충돌한다. avahi는 Docker가 아니라 호스트 OS 기능이다 |
| 9 | `docker/index.ts`는 **레거시 퍼사드**가 된다. 48개 export와 시그니처를 유지한다. 리프 함수는 한 줄 위임으로 바꾸고, 합성 함수는 그대로 둔다. 프로세스 헬퍼는 `infrastructure/process.ts`로 옮긴다 | 퍼사드에서 `child_process` import가 사라진다 |
| 10 | **싱글턴을 export하지 않는다.** composition root(D3의 CLI `Container`, D2의 API `container` 플러그인)가 `new`로 만든다 | 서비스 로케이터를 막는다. 퍼사드만 내부 기본 인스턴스를 가진다 |
| 11 | lint: `src/infrastructure/**` 밖에서 `child_process`를 금지한다. 처음에는 **warn**으로 두고, 패키지마다 위반이 0이 되면 **error**로 바꾼다 | 이슈 Solution 3 |

## 포트 요약

시그니처 전체는 영어판에 있습니다. 괄호 안은 원래 함수나 호출 지점입니다.

| 포트 | 메서드 | 동기 여부 |
|------|--------|-----------|
| `IContainerRuntimePort` | `getStatus`, `getHealth`, `exists`, `list({running?})`, `getLogs`, `getStats`, `getUptime` (docker/index.ts 리프) | 동기 |
| | `start`, `stop`, `restart` → `RuntimeActionResult` (API `executeServerAction`, `mcctl.sh`) | 비동기, reject하지 않음 |
| | `readLogs(name, {since, tail})` (API 세션 수집기), `followLogs(name, onChunk, signal)` (API SSE 로그) | 비동기 |
| `IServerConsolePort` | `listPlayers` (`getOnlinePlayers`), `command(name, args)` (rcon-cli 호출 4곳), `getEndpoint` (CLI `mcctl rcon`) | 비동기 |
| `IRouterStatusPort` | `getHealth()` (`getRouterHealthViaApi`), `getHostnames(name)` (`getContainerHostname`) | 동기 |
| `IPlayitAgentPort` | `start()`, `stop()` | 비동기 |
| `IHostnameRegistrarPort` | `getStatus()` (`getAvahiStatus`) | 동기 |
| `IRuntimeEnvironmentPort` | `isAvailable()`, `getEngineVersion()`, `getComposeVersion()` | 동기 |

**수명주기 구현**:

| 메서드 | Docker 구현 | 지금 같은 동작을 하는 곳 |
|--------|------------|----------------|
| `start` | `docker compose up -d <name>`(없으면 생성) | `mcctl.sh start`, API start |
| `stop` | `docker stop -- <name>` | `mcctl.sh stop`, `stopContainer`, CLI migrate, API 삭제 경로 |
| `restart` | `docker compose restart <name>` | API restart |

새 메서드는 이름 앞에 `--`를 넣는다(#720 규칙). 타임아웃은 지금 값을 유지하고, 통일은 C2에서 한다.

## 48개 함수 분류

| 분류 | 개수 | 처리 |
|------|------|------|
| 프로세스를 실행하는 리프 함수 | 20 | 어댑터로 옮기고 퍼사드는 위임한다. `startContainer`, `stopContainer`, `checkDockerCompose`는 대응하는 포트 메서드가 없어서 `@deprecated` 추가 메서드로 둔다 |
| 프로세스 헬퍼(`execCommand`, `execCommandAsync`, `execScript`, `execScriptInteractive`) | 4 | `infrastructure/process.ts`로 옮기고 퍼사드가 re-export한다 |
| 합성 함수(`getPlatformStatus`, `getServerDetailedInfo`, `getRouterDetailInfo`, `getPlayitAgentStatus` 등) | 12 | 퍼사드에 그대로 둔다. 나중에 포트를 받는 애플리케이션 조회 서비스로 바꾼다 |
| 순수 함수·설정 파일 함수(`parseRconPlayerList`, `formatBytes`, `readServerConfigEnv` 등) | 12 | 포트를 만들지 않는다(설정은 D5, env 파서 통합은 A6) |

## 의존 방향 규칙

1. 어댑터와 `process.ts`는 `docker/index.ts`를 import하지 않는다.
2. `docker/index.ts`는 어댑터를 **파일 경로로** import한다. barrel(`infrastructure/index.js`)은 `ServerRepository`를 거쳐 퍼사드로 돌아오므로 순환이 생긴다.
3. D1에서 `ServerRepository`와 `WorldRepository`는 계속 퍼사드를 쓴다. `world-name-resolution.test.ts`가 퍼사드를 mock하기 때문이다. 포트 주입으로 바꾸는 일은 D4에서 한다.

## lint 규칙과 현재 위반 수

- 위치: `platform/services/{shared,cli,mcctl-api}/.eslintrc.json`(ESLint 8.57). `no-restricted-imports`로 정적 import를 막는다. 이 규칙은 `import()`와 `require()`를 잡지 못하므로 `no-restricted-syntax`를 함께 쓴다. `overrides`에서 `src/infrastructure/**/*.ts`만 허용한다.
- `pnpm lint`에는 `--max-warnings`가 없어서 경고가 있어도 CI가 실패하지 않는다.

| 패키지 | 지금(2026-10-23 측정) | D1 후 | error로 바꾸는 이슈 |
|--------|------------------|-------|-------------------|
| shared | 2 | 1 (`PrerequisiteChecker` pm2 점검) | D4 |
| cli | 12 | 12 | D3 |
| mcctl-api | 9 (파일 6개) | 9 | D2 |
| 합계 | 23 | 22 | |

스크립트, git, npm, pm2를 실행하는 곳은 런타임 포트 대상이 아닙니다. 그래도 error로 바꾸기 전에 각 패키지의 `src/infrastructure/` 아래로 옮겨야 합니다.

## #715(스크립트 제거)와의 정합

| 스크립트 | D1 포트로 표현되는 부분 | 미루는 부분(이유) |
|----------|----------------------|-------------------|
| `logs.sh` | `getLogs`, `followLogs`, `readLogs` | 출력 형식은 CLI 표현 문제다 |
| `mcctl.sh` | `start`, `stop`, `getStatus`. 콘솔은 `getEndpoint`와 기존 TCP 클라이언트로 처리한다 | TTY를 넘기는 `attach()`는 만들지 않는다 |
| `delete-server.sh` | `stop` | `remove`, `unregister`, `IServerSpecRepository.delete`(아직 TS 호출처가 없다) |
| `create-server.sh` | `start` | `apply(spec)`, `register`, `save`(D5) |
| `backup.sh` | `command(['save-all'])`로 flush, 또는 `stop` | git 저장소는 백업 어댑터가 맡는다 |
| `lock.sh` | — | `IWorldAssignmentPort`(A4) |
| `render-map.sh` | — | Docker `IMapRenderer` 어댑터 안에 둔다(k8s에서는 Job) |
| `player.sh` | — | #730에서 제거했다 (`mcctl player info`가 대체) (`init.sh`는 #729에서 제거했다) |

지금 포트에 추가해야 할 메서드는 없습니다. 미룬 메서드는 모두 지금 TS 호출처가 없습니다.

## 구현 단계(core-agent)

1. 포트 인터페이스 6개를 추가한다(typecheck).
2. 프로세스 헬퍼를 `infrastructure/process.ts`로 옮긴다(shared 테스트).
3. 어댑터 특성 테스트(red) → 리프 20개를 어댑터로 옮기고 퍼사드를 위임으로 바꾼다(green). `docker-shell-injection.test.ts`는 고치지 않는다.
4. 테스트(red) → `start`/`stop`/`restart`, `readLogs`, `followLogs`, `command`, `getEndpoint`를 호출 지점 코드에서 복사한다(green). 원본은 D2·D3까지 둔다.
5. 테스트(red) → `AvahiHostnameRegistrarAdapter`(green).
6. lint 규칙을 warn으로 추가한다(경고 1/12/9, exit 0).
7. 루트에서 `pnpm build && pnpm lint && pnpm typecheck && pnpm test`. 기준선: shared 60 파일, 988 테스트 통과.

## 확인이 필요한 쟁점

1. **예약 포트**(2026-10-23 해결): 이슈 본문대로 타입 전용 파일 두 개로 만들었다(결정 3).
2. **API stop 의미**: `executeServerAction('stop')`(compose stop)을 `runtime.stop`(`docker stop`)으로 옮기면 동작이 조금 바뀐다(compose 프로젝트 밖의 컨테이너에서만 다르다). D2에서 별도 커밋으로 받아들이는 안을 권장한다.
3. **합성 함수 담당**: 합성 함수 12개를 맡은 이슈가 없다. D2의 "가짜 컨테이너로 라우트 테스트"를 하려면 주입할 수 있어야 한다. D4에 넣고 D2보다 먼저 끝내는 안을 권장한다.
4. **시그니처 변경 순서**: D4가 포트 인자를 `ServerName`으로 바꾼다. D4를 먼저 하고 D2·D3을 하는 안을 권장한다.
5. **error 전환 범위**: 스크립트·git·npm·pm2 실행 위치를 옮기는 일이 D2·D3·D4 범위인지 확인이 필요하다.
