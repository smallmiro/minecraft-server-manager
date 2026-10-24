# ADR-0001: 컨테이너 런타임 포트와 Docker 어댑터

| | |
|---|---|
| **상태** | 제안됨 (2026-10-23) |
| **이슈** | [#654](https://github.com/smallmiro/minecraft-server-manager/issues/654) (Hardening D1), 마일스톤 M2(#643), 에픽 #640 |
| **이 ADR을 바꾸는 후속 이슈** | #665(D4, [포트 경계 정리](#포트-경계-정리665-d4)), #669(A7), C2, #675(D5), #641(k8s 어댑터), #732(S3, [백업 포트](#백업-포트732-s3)), #670(A4: `IWorldAssignmentPort` 확정, [ADR-0002](0002-world-server-assignment.ko.md)), #735(S7, [서버 삭제](#스크립트-제거-s7-delete-serversh735)) |
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
| 3 | `IServerSpecRepository`와 `IWorldAssignmentPort`는 **타입 전용 파일 두 개로 만들고 provisional로 표시한다** | 구현도 호출처도 없다. ServerSpec 스키마(§9.2)와 A4 배정 모델이 확정되면 D5/A4가 모양을 바꾼다. `ServerSpec`은 D5가 대체할 최소 placeholder다. 이후 `IWorldAssignmentPort`는 ADR-0002(#670), `IServerSpecRepository`는 [ADR-0003](0003-server-spec.ko.md)(#675)에서 확정했다 |
| 4 | **두 번째 어댑터(#641)가 생기기 전까지 계약은 잠정적이다.** D4·A7·C2·D5가 시그니처를 바꿀 수 있다 | 호출처는 TS 컴파일러가 찾아 준다. 바꿀 때마다 이 ADR을 고친다 |
| 5 | 지금 동기인 메서드는 **동기를 유지한다**. 비동기화는 C2에서 한다 | 동기 래퍼가 비동기 포트에 위임할 수 없으므로, 바꾸려면 호출처를 전부 바꿔야 한다 |
| 6 | **오류 모델을 바꾸지 않는다**: 센티널 값(`'not_found'`, `'unknown'`, `''`, `null`, `false`, `'-'`)과 throw하지 않는 결과 객체를 그대로 쓴다 | "확인 불가"와 "없음"의 구분(`RuntimeUnavailableError`)은 A7의 동작 변경이다 |
| 7 | D1에서 워크로드 이름은 **Docker 컨테이너 이름**이다(`mc-<server>`, `mc-router`, `playit-agent`) | 이렇게 해야 래퍼가 그대로 위임하고 #720 argv 테스트가 바뀌지 않는다. `ServerName`으로 바꾸는 일은 D4가 한다. #665에서 `ServerName \| string`으로 넓혔다([포트 경계 정리](#포트-경계-정리665-d4)) |
| 8 | **포트 하나에 어댑터 클래스 하나.** Docker 클래스 5개는 모듈 하나(`DockerComposeRuntimeAdapter.ts`)에 두고, Avahi는 파일을 따로 둔다 | 한 클래스로는 구현할 수 없다: playit의 `start()`/`stop()`과 런타임의 `start(name)`/`stop(name)`, 라우터의 `getHealth()`와 `getHealth(name)`이 충돌한다. avahi는 Docker가 아니라 호스트 OS 기능이다 |
| 9 | `docker/index.ts`는 **레거시 퍼사드**가 된다. 48개 export와 시그니처를 유지한다. 리프 함수는 한 줄 위임으로 바꾸고, 합성 함수는 그대로 둔다. 프로세스 헬퍼는 `infrastructure/process.ts`로 옮긴다 | 퍼사드에서 `child_process` import가 사라진다 |
| 10 | **싱글턴을 export하지 않는다.** composition root(D3의 CLI `Container`, D2의 API `container` 플러그인)가 `new`로 만든다 | 서비스 로케이터를 막는다. 퍼사드만 내부 기본 인스턴스를 가진다 |
| 11 | lint: `src/infrastructure/**` 밖에서 `child_process`를 금지한다. 처음에는 **warn**으로 두고, 패키지마다 위반이 0이 되면 **error**로 바꾼다 | 이슈 Solution 3 |

## 포트 요약

시그니처 전체는 영어판에 있습니다. 괄호 안은 원래 함수나 호출 지점입니다.

| 포트 | 메서드 | 동기 여부 |
|------|--------|-----------|
| `IContainerRuntimePort` | `getStatus`, `getHealth`, `exists`, `list({running?})`, `getLogs`, `getStats`, `getUptime` (docker/index.ts 리프) | 동기 |
| | `getStatusAsync(name)` (#665, 요청 경로용 `getStatus`) | 비동기 |
| | `start`, `stop`, `restart` → `RuntimeActionResult` (API `executeServerAction`, `mcctl.sh`) | 비동기, reject하지 않음 |
| | `remove(name)`(#735): 워크로드를 정지하고 삭제한다. 없으면 성공, 런타임을 조회할 수 없으면 실패. 서버 데이터는 런타임 담당이 아니다 (`delete-server.sh` 1단계) | 비동기, reject하지 않음 |
| | `readLogs(name, {since, tail})` (API 세션 수집기), `followLogs(name, onChunk, signal, {tail?, follow?, onExit?})` (API SSE 로그) | 비동기 |
| `IServerConsolePort` | `listPlayers` (`getOnlinePlayers`), `command(name, args)` (rcon-cli 호출 4곳), `getEndpoint` (CLI `mcctl rcon`) | 비동기 |
| `IRouterStatusPort` | `getHealth()` (`getRouterHealthViaApi`), `getHostnames(name)` (`getContainerHostname`) | 동기 |
| `IPlayitAgentPort` | `start()`, `stop()` | 비동기 |
| `IHostnameRegistrarPort` | `getStatus()` (`getAvahiStatus`) | 동기 |
| | `register(hostname, ip)`(#675), `unregister(hostname)`(#735) → `HostnameChangeResult { status: 'changed' \| 'unchanged' \| 'skipped'; reason? }`. 정확히 일치하는 이름만 다룬다(#660). `unregister`는 README sudoers 모양(#751)인 `sudo -n sed -i <expr> /etc/avahi/hosts`를 셸 없이 argv로 실행한다. `<expr>`은 검증된 호스트명을 정규식 이스케이프하고 필드 경계로 앵커를 건다. 비밀번호가 있으면 먼저 `sudo -S -p '' -v` | 비동기, reject하지 않음 |
| `IServerSpecRepository`(#675, ADR-0003) | **v2 계약 유지**: `ServerSpec`은 `{ name }` 그대로, `list(): Promise<ServerSpec[]>`, `get`(`@deprecated`, `load` 사용), `save`(전체 문서인지 검사 후 `write`, `{ name }`만 오면 `invalid_spec`), `delete(name, { deleteWorld?, dryRun? })`(#735, [S7](#스크립트-제거-s7-delete-serversh735); v2 호출 `delete(name)`도 컴파일됨). #675가 추가: `load(name)` → `{ document, revision, warnings }`(`server.yaml`이 없으면 메모리에서 가져오기, 쓰지 않음), `write(doc, { expectedRevision?, create?, force?, allowStorageChange? })`. 전체 타입은 `ServerSpecDocument extends ServerSpec`. 오류는 `ServerSpecError`(`invalid_spec` → 400, `not_found` → 404, 나머지 409) | 비동기 |
| `IRuntimeEnvironmentPort` | `isAvailable()`, `getEngineVersion()`, `getComposeVersion()` | 동기 |

**수명주기 구현**:

| 메서드 | Docker 구현 | 지금 같은 동작을 하는 곳 |
|--------|------------|----------------|
| `start` | `docker compose up -d <name>`(없으면 생성) | `mcctl.sh start`, API start |
| `stop` | `docker stop -- <name>` | `mcctl.sh stop`, `stopContainer`, CLI migrate (API 삭제 경로는 #735부터 `remove`) |
| `restart` | `docker compose restart <name>` | API restart |
| `remove`(#735) | `docker ps -a`로 정확한 이름 확인(조회 실패는 "없음"이 아니라 실패) → compose 프로젝트 소속이면 `docker compose stop`, `docker compose rm -f`, 아니면 `docker rm -f --`. 정지에 실패하면 거기서 멈춘다 | `delete-server.sh` 1단계(#735에서 삭제) |

새 메서드는 이름 앞에 `--`를 넣는다(#720 규칙). 타임아웃은 지금 값을 유지하고, 통일은 C2에서 한다.

#665(D4)부터 서버를 받는 인자(`name`)는 `ServerName | string`이다. 자세한 내용은 [포트 경계 정리](#포트-경계-정리665-d4)에 있다.

### `IWorldAssignmentPort` 확정(#670, [ADR-0002](0002-world-server-assignment.ko.md))

배정은 각 서버 `config.env`의 `LEVEL`에서 파생하며, 따로 기록하지 않는다. #715 결정대로 포트로 남기고, 규칙은 어댑터가 함께 쓰는 도메인 순수 함수(`shared/src/domain/services/worldAssignment.ts`)에 둔다.

| 메서드 | 동작 |
|--------|------|
| `getAssignment(world): Promise<string \| null>` | v2, deprecated. 월드 폴더를 가진 서버 또는 null. 판단 불가 서버가 있으면 null 대신 reject한다 |
| `listAssignments(): Promise<WorldAssignment[]>` | v2 형태. 읽을 수 있는 서버의 배정(`internal`은 선택 필드) |
| `snapshot(): Promise<WorldAssignmentSnapshot>` | `{ assignments, undetermined }`. `servers/`를 읽지 못할 때만 reject한다 |
| `preview(server, configEnv): Promise<WorldAssignmentSnapshot>` | 한 서버의 `config.env`를 바꿨을 때의 스냅숏(스냅숏 복원, migrate). 아무것도 쓰지 않는다 |
| `previewPlatformEnv(dotenv): Promise<WorldAssignmentSnapshot>` | 플랫폼 `.env`를 바꿨을 때의 스냅숏(플랫폼 설정 `EXTRA_ARGS`). 아무것도 쓰지 않는다 |
| `assign(world, server): Promise<void>` | `LEVEL=<world>`를 쓴다. 위반하거나 판단할 수 없으면 `WorldAssignmentError`로 reject한다(R7) |
| `release(world): Promise<{ server, fallback }>` | 배정 해제(#715). 가진 서버의 `LEVEL`을 그 서버의 기본 월드 `<서버이름>`으로 바꾼다 |

v2 멤버인 `getAssignment`(deprecated)와 `listAssignments`는 형태를 유지하고(#715, #736), `snapshot`, `preview`, `release`를 추가했다. 어댑터는 `ConfigEnvWorldAssignmentAdapter`이고, CLI `Container`와 D2 전까지는 API 라우트가 만든다.

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
3. D1에서 `ServerRepository`와 `WorldRepository`는 계속 퍼사드를 쓴다. `world-name-resolution.test.ts`가 퍼사드를 mock하기 때문이다. 포트 주입으로 바꾸는 일은 D4에서 한다. #665에서 끝냈다. 두 저장소는 선택 인자로 `IContainerRuntimePort`를 받고(기본값은 파일 경로로 import한 `new DockerComposeRuntimeAdapter()`), 퍼사드를 import하지 않는다.

## lint 규칙과 현재 위반 수

- 위치: `platform/services/{shared,cli,mcctl-api}/.eslintrc.json`(ESLint 8.57). `no-restricted-imports`로 정적 import를 막는다. 이 규칙은 `import()`와 `require()`를 잡지 못하므로 `no-restricted-syntax`를 함께 쓴다. `overrides`에서 `src/infrastructure/**/*.ts`만 허용한다.
- `pnpm lint`에는 `--max-warnings`가 없어서 경고가 있어도 CI가 실패하지 않는다.

| 패키지 | 지금(2026-10-23 측정) | D1 후 | error로 바꾸는 이슈 |
|--------|------------------|-------|-------------------|
| shared | 2 | 1 (`PrerequisiteChecker` pm2 점검) | D4 |
| cli | 12 | 12 | D3 (#668에서 0건, error로 전환) |
| mcctl-api | 9 (파일 6개) | 9 | D2 |
| 합계 | 23 | 22 | |

스크립트, git, npm, pm2를 실행하는 곳은 런타임 포트 대상이 아닙니다. 그래도 error로 바꾸기 전에 각 패키지의 `src/infrastructure/` 아래로 옮겨야 합니다.

### CLI 정리(#668, D3)

cli의 `child_process` 사용 11곳(파일 11개)을 0으로 줄이고 규칙을 **error**로 바꿨습니다. 포트에 메서드를 더하지 않았습니다.

| 호출 지점 | 바뀐 곳 |
|-----------|---------|
| `lib/rcon.ts` `isContainerRunning` | `runtime.getStatusAsync`. `paused`, `restarting`도 실행 중으로 본다(`{{.State.Running}}`와 같은 의미) |
| `lib/rcon.ts` `execRconWithOutput` | `console.command`. 출력은 `stdout \|\| stderr` 그대로, argv에 `--`가 붙는다 |
| `mcctl exec` (`ShellExecutor.execRcon`) | `console.command`. 출력을 스트리밍하지 않고 명령이 끝난 뒤 stdout, stderr 순으로 출력하며, 다 쓴 뒤에 종료한다. 시그널로 끝난 `docker exec`는 이제 1로 끝난다(예전 0). `execRcon`은 지웠다 |
| `lib/prompts/server-select.ts` | `runtime.list()`와 서버별 `getStatus`. paused는 계속 실행 중으로 본다. 선택지는 이름순으로 나오고, 정확히 `mc-router`만 뺀다(예전에는 `router2` 같은 서버도 숨겨졌다) |
| `commands/migrate.ts` `docker stop` | `runtime.stop`. 실패하면 같은 메시지로 throw한다 |
| `lib/shell.ts`(`ShellExecutor`), `init.ts` 네트워크·라우터 재시작, `upgrade.ts` 라우터 재생성 | 런타임 포트 대상이 아니다. 동작을 바꾸지 않고 `infrastructure/ShellExecutor.ts`(`lib/shell.ts`가 다시 export), `infrastructure/compose-project.ts`로 옮겼다 |
| `update.ts`, `console/init.ts`의 npm, `pm2-utils.ts`, `console/service.ts`의 pm2 | `infrastructure/npm.ts`, `infrastructure/pm2-cli.ts`로 옮겼다 |
| `banner.ts` `getGitHash`(git) | ESM 빌드에서 `require()`가 없어 항상 `undefined`를 돌려주던 죽은 코드라 지웠다 |

## #715(스크립트 제거)와의 정합

| 스크립트 | D1 포트로 표현되는 부분 | 미루는 부분(이유) |
|----------|----------------------|-------------------|
| `logs.sh`(#731에서 제거) | `getLogs`, `followLogs({ tail, follow })`, `readLogs` | 출력 형식은 CLI 표현 문제다. avahi `journalctl` 보기는 삭제했다(`journalctl -u avahi-daemon`을 직접 실행). `followLogs`에 선택 인자 `tail`(기본 0)과 `follow`(기본 true)를 추가해(기존 호출처 불변) "마지막 N줄 다음 follow"를 한 스트림으로 내고, `follow: false`는 마지막 N줄을 stdout·stderr 모두 출력한 뒤 종료한다. `onExit(code, error?)`는 docker 종료 코드나 spawn 오류를 한 번 알리며 promise는 v2.x 계약대로 항상 resolve된다. 호출자는 이로 `docker logs` 실패를 0이 아닌 종료 코드로 바꾼다 |
| `mcctl.sh` | `start`, `stop`, `getStatus`. 콘솔은 `getEndpoint`와 기존 TCP 클라이언트로 처리한다 | TTY를 넘기는 `attach()`는 만들지 않는다 |
| `delete-server.sh`(#735에서 제거) | `stop` | `remove(name)`(`purgeData` 없음: 데이터는 파일), `unregister`, `IServerSpecRepository.delete(name, { deleteWorld, dryRun })`. [S7](#스크립트-제거-s7-delete-serversh735) 참고 |
| `create-server.sh` | `start` | `IServerSpecRepository.write(doc, { create: true })`(compose·include 생성), `register`(#675, ADR-0003 §5). `apply(spec)`는 만들지 않는다: k8s에서는 k8s 저장소 어댑터가 저장과 적용을 맡는다(#641) |
| `backup.sh` | `console.command`로 `save-off`, `save-all flush`, `save-on` | git 저장소는 `IWorldBackupPort`가 맡는다([백업 포트](#백업-포트732-s3)) |
| `lock.sh` | — | `LEVEL`에서 파생하는 `IWorldAssignmentPort.assign`/`release`로 대체. #670에서 `lock.sh` 삭제([ADR-0002](0002-world-server-assignment.ko.md)) |
| `render-map.sh`(#733에서 제거) | — | Docker `IMapRenderer` 어댑터 `BlueMapCliRenderer`로 옮겼다(k8s에서는 Job) |
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

1. **예약 포트**(2026-10-23 해결): 이슈 본문대로 타입 전용 파일 두 개로 만들었다(결정 3). `IWorldAssignmentPort`는 #670에서 확정했다(ADR-0002).
2. **API stop 의미**: `executeServerAction('stop')`(compose stop)을 `runtime.stop`(`docker stop`)으로 옮기면 동작이 조금 바뀐다(compose 프로젝트 밖의 컨테이너에서만 다르다). D2에서 별도 커밋으로 받아들이는 안을 권장한다.
3. **합성 함수 담당**: 합성 함수 12개를 맡은 이슈가 없다. D2의 "가짜 컨테이너로 라우트 테스트"를 하려면 주입할 수 있어야 한다. D4에 넣고 D2보다 먼저 끝내는 안을 권장한다. **#665에서는 하지 않았다.** 완료 조건에 필요하지 않기 때문이다. D2(#667)의 쟁점으로 남는다.
4. **시그니처 변경 순서**: D4가 포트 인자를 `ServerName`으로 바꾼다. D4를 먼저 하고 D2·D3을 하는 안을 권장한다. **#665로 해결됐다.** 인자를 바꾸지 않고 넓혔으므로 D2·D3은 어느 쪽이든 컴파일되고, 호출처를 `ServerName`으로 옮기는 시점을 스스로 정할 수 있다.
5. **error 전환 범위**: 스크립트·git·npm·pm2 실행 위치를 옮기는 일이 D2·D3·D4 범위인지 확인이 필요하다.

## 포트 경계 정리(#665, D4)

구조만 바꿨다(Tidy First). 아래에 적은 곳을 빼면 Docker argv, 반환값, 오류 sentinel은 그대로다. shared export와 시그니처는 하나도 지우지 않았다(#715: v2.x에서는 `@deprecated`만 붙이고, 삭제는 #736에서 v3.0.0으로 한다).

### 이름 규칙을 인프라로 옮김

런타임 이름 규칙은 `infrastructure/adapters/workloadNames.ts`에 있고, 패키지 루트에서 export한다.

| 함수 | 결과 |
|------|------|
| `containerNameOf(server: ServerName \| string)` | `mc-<server>` |
| `serverHostnameOf(server: ServerName \| string)` | `<server>.local` |
| `workloadNameOf(name: ServerName \| string)` | ServerName이면 그 컨테이너, 문자열이면 그대로(컨테이너 이름) |

이 모듈은 런타임 import가 없어서 `@minecraft-docker/shared/naming`이 브라우저에서도 안전하다. `ServerName.containerName`/`hostname`과 `Server.containerName`/`hostname`은 `@deprecated` getter로 남기고 이 함수에 위임한다. 도메인이 인프라를 import하는 곳은 이것 하나이고, #736에서 getter와 함께 사라진다. 예약 이름 오류 메시지(`conflicts with the mc-router container`)도 같은 함수로 만들어 문구가 그대로다.

### 포트 시그니처 변경

| 포트 | 이전(D1) | 이후(#665) |
|------|----------|-----------|
| `IContainerRuntimePort` | `getStatus`, `getHealth`, `exists`, `getLogs`, `getStats`, `getUptime`, `start`, `stop`, `restart`, `readLogs`, `followLogs`가 `name: string`을 받음 | `name: ServerName \| string`. `list()`는 그대로이고 여전히 컨테이너 이름을 돌려준다. `getStatusAsync(name): Promise<ContainerStatus>`를 추가했다(아래 저장소 항목) |
| `IServerConsolePort` | `listPlayers`, `command`, `getEndpoint`가 `name: string`을 받음 | `name: ServerName \| string` |
| `IRouterStatusPort` | `getHostnames(name: string)` | `getHostnames(name: ServerName \| string)` |
| `IRconPort` | `getEntityPosition(container: string, player)` | `getEntityPosition(server: ServerName \| string, player)` |
| `IShellPort` | `exec(script, args)`, `execInteractive(script, args)` | 그대로 두고 `@deprecated`(포트 메서드가 스크립트 이름을 받으면 안 된다) |
| `IPlatformSettingsPort`(신규) | — | `load(): McctlConfig \| null` |

- **의미**: ServerName은 서버이고, 워크로드는 어댑터가 고른다(`workloadNameOf`). 문자열은 D1처럼 워크로드 이름 자체다. 서버에 문자열을 넘기는 형태는 deprecated다. 라우터와 playit 에이전트는 k8s 어댑터(#641)가 전용 메서드를 줄 때까지 컨테이너 이름을 쓴다.
- **overload가 아니라 union인 이유**: 메서드 인자는 bivariant라서 `(name: string)`으로 선언한 v2 구현도 `(name: ServerName | string)`을 만족한다. `(name: ServerName)`과 `(name: string)` overload 쌍은 이 구현을 거부한다. `tests/runtimePorts-v2-compat.test.ts`가 v2 `IRconPort` 구현과 v2 호출 코드를 컴파일해서 이를 지킨다.
- **배포된 포트와 미배포 포트**(#753 리뷰): 넓힌 포트 가운데 v2.33.0(npm)에 들어간 것은 `IRconPort`뿐이다. `IContainerRuntimePort`, `IServerConsolePort`, `IRouterStatusPort`, `IHostnameRegistrarPort`는 v2.33.0 이후 #654에서 추가돼 배포된 구현체가 없다. 그래서 여기에 ServerName을 넘겨도 breaking change가 아니다. shared는 그렇게 한다(`checkServerStopped`, 생성 후 시작하는 `WorldManagementUseCase`, 접속자를 세는 `DeleteServerUseCase`, `ServerRepository.getStatus`). cli와 mcctl-api의 테스트 fake는 `workloadNameOf(name)`으로 바꾼다.
- **`IRconPort`는 v2 런타임 계약을 지킨다**: 호출처(`WorldInfoUseCase.getLivePlayerLocations`, `PlayerManagementUseCase`의 `options.container`, 둘 다 API가 값을 넣음)는 계속 컨테이너 이름 문자열 `mc-<server>`를 넘긴다. v2 구현은 이전과 똑같은 값을 받는다. 두 형태를 모두 받는 것은 `RconCliAdapter`뿐이다. `tests/rconPort-v2-contract.test.ts`가 기록용 v2 구현으로 이를 고정한다. 인프라나 API에서 이름을 새로 계산하는 코드는 `containerNameOf`를 쓴다.

### 저장소는 런타임 포트를 받음

`new ServerRepository(paths?, runtime?)`, `new WorldRepository(paths?, assignments?, runtime?)`. 기본값은 퍼사드가 위임하던 것과 같은 `new DockerComposeRuntimeAdapter()`이고, CLI `Container`는 자기 런타임을 넘긴다. 두 저장소 모두 퍼사드를 import하지 않는다.

- `ServerRepository.getStatus`는 `runtime.getStatusAsync(ServerName.fromExisting(name))`을 기다리고, 이전 매핑을 그대로 쓴다(조회 실패 sentinel인 `not_found`는 `STOPPED`). 동기 `getStatus`(`spawnSync`, 타임아웃 없음)를 쓰면 API의 `findAll()`이 서버마다 이벤트 루프를 막아서(#753 리뷰) `IContainerRuntimePort`에 `getStatusAsync`를 추가했다. Docker 어댑터는 #665 이전 조회를 `execCommandAsync`로 그대로 실행한다(`docker inspect -f {{.State.Status}} -- <container>`, 0이 아닌 종료 코드는 `not_found`, 상태는 소문자로). argv에서 바뀐 것은 #720 규칙의 `--`뿐이다. `getStatus` 자체를 비동기로 바꾸는 일은 모든 호출처를 함께 고치는 C2의 몫이라, 메서드를 추가하는 쪽이 더 단순했다. `fromExisting`이 거부하는 이름이면 `STOPPED` 대신 `UNKNOWN`이다. `findByName`은 그런 이름을 먼저 거르므로 이 경로에 오지 않는다.
- `WorldRepository.findAllWithServerStatus`는 이전과 같은 컨테이너 이름 문자열을 넘긴다. `mc-`로 시작하는 배정 서버를 컨테이너 이름으로 보는 #670 이전 분기도 그대로다. 바꾸면 동작이 바뀐다. 포트를 좁히는 #736에서 지운다.

### 플랫폼 설정 포트(`CreateServerUseCase`)

`CreateServerUseCase`는 `Paths`를 `Config`를 만들어 `.mcctl.json`의 `playitEnabled`를 읽는 데만 썼다. 네 번째 생성자 인자를 `IPlatformSettingsPort | Paths`로 넓혔다. CLI는 `new Config(paths)`를 주입한다. `Config`가 구조적으로 이 포트를 만족하므로 어댑터 클래스는 없다. `Paths`를 넘기거나 아무것도 넘기지 않으면 이전처럼 그 경로의 `.mcctl.json`을 읽는다(deprecated v2 형태). #675가 그대로 rebase할 수 있도록 생성자만 고쳤다.

**새 포트를 만든 이유**: #715는 이슈가 요청할 때만 포트를 추가하고, #665가 이 포트를 지목했다. 플랫폼 설정을 읽는 기존 포트가 없다. `IServerRepository`는 서버별 `config.env`를, `IPlayitAgentPort`는 에이전트 컨테이너를 다루고, `IServerSpecRepository`는 D5의 서버 모델이다. 메서드는 지금 호출자에게 필요한 하나뿐이다.

### 아직 문자열 형태를 쓰는 호출자

| 호출자 | 이유 | 담당 |
|--------|------|------|
| `docker/index.ts` 퍼사드 래퍼 | D1과 같은 argv(결정 9) | #736 |
| `WorldRepository.findAllWithServerStatus` | #670 이전과 같은 컨테이너 이름 | #736 |
| `GitWorldBackupAdapter` | `list()`가 컨테이너 이름을 돌려주고 그 값을 `console.command`에 다시 넘긴다 | #736 또는 서버 이름을 돌려주는 `list()` |
| `PlayerManagementUseCase`(`options.container`), `WorldInfoUseCase.getLivePlayerLocations(container)` | API가 `mc-<name>`을 만든다. 공개 시그니처는 그대로 | D2(#667) |
| 라우터에 대한 `mcctl logs` | `mc-router`는 서버가 아니다 | #641 |
| CLI `lib/rcon.ts` 헬퍼, `mcctl exec`, 플레이어 서버 선택 프롬프트, `migrate worlds` | #668부터 포트를 호출한다. 컨테이너 이름 API는 그대로 두고 `serverOfContainer`로 바꾼다. 보통은 `ServerName`을 넘기고, 올바른 서버 컨테이너 이름이 아닐 때만 문자열을 넘긴다 | #736 |

### #665에서 하지 않은 일

- 합성 함수 query service(쟁점 3): 완료 조건에 필요하지 않다.
- `PrerequisiteChecker`(직접 호출 지점 19행)와 shared lint의 error 전환.
- `ServerStatusUseCase`(클래스 전체가 deprecated)와 `CreateServerUseCase`의 "Connect via" 메시지는 아직 deprecated getter를 읽는다. 생성 경로는 #675가 다시 쓰고, getter는 #736이 지운다.

### #665에서 deprecated한 것(v3.0.0, #736에서 삭제)

`ServerName.containerName`, `ServerName.hostname`, `Server.containerName`, `Server.hostname`, `IShellPort.exec`, `IShellPort.execInteractive`, `ShellAdapter.exec`, `ShellAdapter.execInteractive`, 위 포트들의 서버 인자에 문자열(컨테이너 이름)을 넘기는 형태, `CreateServerUseCase` 네 번째 인자에 `Paths`를 넘기거나 비우는 형태.

## 백업 포트(#732, S3)

상태: 제안됨(2026-10-23). system-architect 리뷰(APPROVE WITH CHANGES)와 Codex 리뷰(R1~R14, S1~S5)를 반영해 고쳤고, `a5d246a`에 대한 architect 재검토(S1~S5)에 따라 단순화했다. #653, #664, #727을 흡수한다. 시그니처, 절차, 버그별 테스트 표 전체는 [영어판](0001-container-runtime-ports.md#backup-port-732-s3)에 있습니다.

**지원 범위**: 로컬 단일 호스트에서만 동작한다. `worlds/`, `servers/<n>/data/`, `backups/`는 같은 파일시스템에 있어야 하고, 일반 파일과 디렉터리만 다룬다. 이 조건에 맞지 않으면 아무것도 바꾸기 전에 거부한다.

| # | 결정 |
|---|------|
| 1 | **포트**: `IWorldBackupPort`(`status`, `history`, `push`, `restore`, `prune`, `testConnection`)를 둔다. 모든 메서드는 비동기이고 reject하지 않는다. `status`도 결과 타입 `{ ok, value } \| { ok: false, error: { code, ... } }`로 돌려준다 |
| 2 | **어댑터**: `GitWorldBackupAdapter({ root, runtime, environment, console, remoteBase? })`다. 설정은 호출할 때마다 `.env`를 env 코덱으로 읽는다. 잠금, flush, 실행 중 확인도 어댑터가 맡는다(B-Q1, S1) |
| 3 | **호환(K1·S3)**: `BackupUseCase`의 두 번째 인자는 `IWorldBackupPort \| IShellPort`로 넓히고, 타입 가드는 `'backupPush' in x`로 한다. 좁히는 일은 #736에서 한다. `IShellPort`가 들어오면 지금 코드를 그대로 쓴다. deprecated된 `ShellAdapter.backup*`은 위임하지 않는다. `backup.sh`를 지우는 PR부터는 "use IWorldBackupPort" 취지의 명확한 실패 결과를 돌려준다. 릴리스 정책은 export 제거와 시그니처 변경을 막을 뿐 동작 변화는 막지 않는다. `IServerConsolePort.command`에는 선택 인자 `signal`을 추가한다. 이 signal로 docker CLI를 죽여도 컨테이너 안의 rcon-cli가 반드시 멈추지는 않는다 |
| 4 | **잠금**: 파일은 `<root>/backups/.backup.lock`이다. 먼저 `mkdir -p`를 하고, 보유자 정보를 완전히 쓴 임시 파일을 `link`로 건다. 보유자가 죽었다고 보는 경우는 **같은 호스트에서 재부팅했거나 pid가 `ESRCH`일 때뿐**이다. `EPERM`은 살아 있는 것으로 본다. 경과 시간으로는 인계하지 않는다. 인계는 rename한 뒤 nonce를 확인하고, nonce가 다르면 되돌린다. 다른 호스트이거나 pid가 살아 있으면 `locked`로 실패하고, 수동 해제 방법은 문서에 적는다. 경쟁자가 셋일 때 남는 한계는 `ponytail:`로 적는다 |
| 5 | **git 환경과 토큰**: `git rev-parse --local-env-vars` 목록과 `GIT_CONFIG_*`만 지운다. 프록시, CA 같은 사용자 설정은 보존한다. `GIT_CONFIG_COUNT=3`으로 extraHeader를 초기화한 뒤 Authorization을 넣고 `credential.helper`를 비운다. `pushurl`을 지운 다음 `set-url`을 한다. 네트워크가 느리면 중단한다(`GIT_HTTP_LOW_SPEED_LIMIT=1000`, `GIT_HTTP_LOW_SPEED_TIME=300`). 모든 git 실행에는 벽시계 상한 4시간을 둔다. git 2.31 이상이 필요하다 |
| 6 | **push 절차**: <br>• 새 clone은 지금처럼 `--depth 50`으로 받는다. <br>• refspec을 명시해 fetch한 뒤 다음처럼 판정한다. (a) `origin`이 로컬의 조상이면 로컬을 그대로 두고 이번 push에서 fast-forward로 함께 올린다. (b) 트리가 같으면 조용히 `checkout -f -B`한다. (c) 그 밖의 분기는 경고를 남기고 `checkout -f -B`한다. <br>• 이전 커밋에 있던 월드가 원본에서 사라졌으면 `missing_worlds`로 실패한다. `--allow-missing`(API `allowMissing`)을 주면 진행한다(R7). `servers/<n>/` 디렉터리 자체가 없어진 서버는 의도한 삭제로 보고 검사에서 뺀다. 스케줄러의 실패 기록 메시지에는 해결 명령을 넣는다. <br>• `isAvailable()`이 false이면 `runtime_unavailable`로 실패한다(K3). <br>• `save-off`와 `flush`는 `AbortSignal.timeout(60s)`로 실행한다. `save-on`은 서버마다 따로 실행하고, 실패하면 경고에 서버 이름을 남긴다. <br>• symlink를 만나면 `unsupported_layout`으로 실패한다. 변경이 없으면 성공이다 |
| 7 | **restore 절차**: <br>• 시작할 때 남은 staging을 정리하고 `worktree prune`을 실행한다. 캐시가 없으면 push의 캐시 준비 단계를 그대로 쓴다. <br>• 실행 중인 서버가 하나라도 있으면 거부한다. 교체 직전에 런타임을 **다시 확인한다**. <br>• 복원할 월드가 하나 이상 있어야 한다. 내부 월드만 있는 커밋도 복원할 수 있다. <br>• 서버의 현재 LEVEL과 커밋의 월드 디렉터리 이름이 다르면 `restore_conflict`로 거부한다. 파일시스템이 다르면 거부한다. <br>• 이전 상태는 시각별 슬롯 `restore-previous/<ISO-ts>/`에 옮긴다. 교체 전에 계획한 대상 목록을 `INCOMPLETE`에 한 번 적어 둔다. 실패하면 메모리에 남긴 단계의 역순으로 되돌린다. <br>• 일부만 되돌려졌으면 `INCOMPLETE`를 남기고, 이후 push와 restore는 `recovery_required`로 막는다. 복구는 수동이다. <br>• 성공하면 완료된 슬롯을 최근 3개만 남긴다. 슬롯은 교체가 성공하기 전에는 지우지 않는다(K2) |
| 8 | **보존 정책**: <br>• 로컬과 origin이 같을 때만 돌리고, 다르면 경고를 남기고 건너뛴다. <br>• 얕은 clone이면 `fetch --unshallow`를 하고, 실패하면 정리하지 않는다. <br>• **tip은 항상 남기고**, 원래 체인 순서대로 `commit-tree`로 다시 만든다. push 전에 `newTip^{tree} == oldTip^{tree}`를 확인한다. <br>• `--force-with-lease`로 push한다. 결과가 불확실하면 `ls-remote`로 원격 상태를 보고 맞춘다. push와 `update-ref` 사이에 죽으면 다음 push가 (b)로 정리한다 |
| 9 | **diff**: 사용자 진입점이 없다(`mcctl backup`, API, 콘솔, 문서 어디에도 없다). 그래서 옮기지 않고, 이를 명시적인 범위 변경으로 기록한다(S4) |
| 10 | **PR 구성**: <br>• PR1: shared(포트, 어댑터, 호환 계층, 테스트) <br>• PR2: CLI와 API. `mcctl.sh`의 auto-on-stop과 `cmd_backup`은 `MCCTL_NODE`/`MCCTL_CLI` 또는 `mcctl`을 거쳐 TS 경로로 보낸다. <br>• PR3: `backup.sh` 삭제와 문서 수정. <br>• **PR2와 PR3는 같은 릴리스로 낸다** |

**B-Q 결정**:

| 쟁점 | 결정 |
|------|------|
| Q1 | 정책은 어댑터에 둔다 |
| Q2 | 생성자 인자를 넓힌다(K1) |
| Q3 | git 2.31 이상을 요구한다 |
| Q4 | diff는 옮기지 않는다 |
| Q5 | `worlds.bak`은 남기고 문서로 안내한다 |
| Q6 | flush가 하나라도 실패하면 push 전체를 실패시킨다 |
| Q7 | 문서로 안내하고 교체 직전에 다시 확인한다. 남는 경쟁 구간은 알려진 한계로 둔다 |
| Q8 | 받아들이고 문서화한다 |
| Q9 | #734가 맡는다 |

**PR #745 리뷰 반영**(2026-10-23):

- `IContainerRuntimePort.list`에 `strict` 옵션을 추가했다. 조회에 실패하면 `[]` 대신 throw한다. 기존 호출자는 D1 계약을 그대로 쓴다.
- 백업의 flush, 복원 확인, 교체 직전 재확인은 strict로 조회하고, 실패하면 `runtime_unavailable`로 아무것도 바꾸기 전에 중단한다.
- 첫 rename 전에 live 대상과 관리 대상 상위 경로(`worlds/`, `servers/<n>/`, `servers/<n>/data/`)를 `lstat`으로 검사한다. symlink이거나 장치가 `backups/`와 다르면 `unsupported_layout`이다. push도 `worlds/`나 `servers/` 루트가 링크이면 거부한다.
- prune은 원격 정규화와 fetch만 하고, 건드리지 않은 로컬 tip을 origin과 비교한다. 다르면 checkout이나 ref 변경 없이 건너뛴다.
- 잠금 해제는 잠금이 자기 것이 아니거나 unlink가 인계에 밀려 실패하면, 자기 nonce가 든 `.stale` 사본을 지운 뒤 잠금을 다시 읽는다. 늦은 인계자가 해제된 잠금을 되돌려 놓는 일을 막는다.
- `save-on`이 실패한 뒤 flush, 복사, git commit·push 중 하나가 실패하면, 그 서버와 원인을 실패 결과(메시지, `servers`)에 남긴다.
- 복원 정리(cleanup) 오류는 주 오류를 덮지 않고 메시지에 덧붙는다.
- 완전히 롤백된 슬롯은 바로 지워서 회전 개수에 들어가지 않는다.

**재검토에서 확정한 것**:

- 옵션 이름은 CLI `--allow-missing`, API `allowMissing`이다.
- `INCOMPLETE` 슬롯은 S3에서 수동 복구로 안내한다.
- 알려진 한계 두 가지(복원 중 자동 기동 경쟁, 잠금 경쟁자 셋)는 받아들인다.

## 스크립트 제거 S5: `mcctl.sh`(#734)

`mcctl.sh`를 지웠다. 새 포트는 없고, 기존 포트에 선택 인자 하나를 더했다.

| 경로 | 이전 | 이후 |
|------|------|------|
| CLI `start`/`stop <server>` | `ShellExecutor.mcctl` → `mcctl.sh` | `ServerName`으로 `IContainerRuntimePort.start`/`stop`(`commands/lifecycle.ts`). 종료 코드는 그대로: 2 = 이미 실행 중(start)/실행 중 아님(stop), 1 = `servers/<name>/docker-compose.yml` 없음 또는 런타임 조회 실패(`not_found`를 `list({ strict: true })`로 확인, `check_docker` 대체) |
| CLI `console <server>` | `docker exec -i mc-<name> rcon-cli` | `mcctl rcon` 세션: `getStatus` + `IServerConsolePort.getEndpoint` + TCP `rcon-client`. 입력은 순서대로 처리하고, EOF는 마지막 응답 뒤에 닫는다. 클라이언트의 `end`는 세션 종료(0), `error`는 종료 코드 1 |
| 정지 시 자동 백업 | `mcctl.sh stop` → `mcctl backup push --auto` | shared `autoBackupOnStop(backup, server)`: `status()` → `configured && autoOnStop` → `push({ lockWaitMs: 600000 })`. `allowMissing`은 넘기지 않고 reject하지 않는다. CLI `stop <server>`는 기다리고(실패 시 경고, 종료 코드 0), API 정지 라우트는 백그라운드로 실행하고 결과를 로그에 남기며, 종료 시 `onClose` 훅이 실행 중인 백업을 최대 `AUTO_BACKUP_CLOSE_WAIT_MS`(2분) 기다려(90초가 지나면 `push`의 `signal`로 중단해 어댑터가 다음 save-off나 복사 파일 전에 멈추고 `save-on`을 보낸 뒤 `aborted`로 끝난다. 생성되는 PM2 설정은 mcctl-api에 `kill_timeout` `API_PM2_KILL_TIMEOUT_MS`, 130초를 준다) 어댑터의 `save-on` 복구가 끊기지 않게 한다(B-Q9 종료). start, restart, `stop --all`, 서버 삭제(S7)는 백업하지 않는다 |
| `createWorld`의 SEED | `IShellPort.setServerConfig` → `mcctl.sh config` | `IWorldAssignmentPort.assign(world, server, { seed })`: `LEVEL`과 함께 한 번에 쓴다(#675부터 ServerSpec을 거친다, ADR-0003 §6). `LEVEL`이 그대로여도 `SEED`는 쓴다. `WorldManagementUseCase`의 `shell` 인자는 쓰지 않는다(`@deprecated`) |
| 정지 확인 | `checkServerStopped`가 `not_found`를 통과시킴 | `list({ strict: true })`가 성공할 때만 `not_found`를 통과시킨다. 런타임에 닿지 않으면 `undetermined`(fail-closed) |
| 삭제 전 정지 | `IShellPort.stopServer` | `DeleteServerUseCase(..., runtime?)`: 주어지면 `runtime.stop`(CLI) 뒤 `delete-server.sh`. #735부터는 따로 멈추지 않고 `deprovision`이 `runtime.remove`로 컨테이너를 멈추고 지운다([S7](#스크립트-제거-s7-delete-serversh735)) |
| API | `lib/world-use-case.ts`의 `new ShellAdapter({ paths })` | 없음. 월드 작업에서 `<root>/scripts`를 찾지 않는다 |

`IShellPort`/`ShellAdapter`의 `startServer`, `stopServer`, `serverStatus`, `setServerConfig`, `logs`, `console`, `status`는 v2 시그니처를 유지하고, 스크립트를 실행하지 않고 `mcctl.sh was removed (#734); use …`를 돌려준다(#736에서 삭제). API 정지 라우트는 `executeServerAction`(`docker compose stop`)을 그대로 쓴다. 쟁점 2는 바뀌지 않았다.

## 스크립트 제거 S7: `delete-server.sh`(#735)

`mcctl delete`와 `DELETE /api/servers/:name`은 TypeScript로 삭제한다(`DeleteServerUseCase.deprovision(name, { deleteWorld })`). 새 포트는 없고, 기존 포트 세 개에 메서드를 더했다(셋 다 v2.33.0에 배포되지 않아 breaking이 아니다).

1. **계획**: `specRepo.delete(name, { deleteWorld, dryRun: true })`. 안전하지 않으면 컨테이너를 건드리기 전에 거부한다.
2. **컨테이너**: `IContainerRuntimePort.remove(name)`. 실패하면 "Nothing was deleted"로 거부한다.
3. **파일**: `specRepo.delete(name, { deleteWorld })`가 다시 계획하고(정지 중에 서버가 폴더를 만들 수 있다), 월드를 옮기고(`rename`, `EXDEV`면 `mv`처럼 `worlds/<w>`를 비재귀 `mkdir`로 먼저 차지한 뒤 복사하고 원본 삭제), `servers/.compose.yml.lock` 잠금(#675 `acquireFileLock`) 안에서 include 항목을 지운 뒤 `servers/<n>`을 지운다. 이동과 `rm`은 잠금 밖이라 긴 복사 동안 다른 쓰기가 `locked`로 실패하지 않는다. 실패하면 컨테이너는 이미 지워졌다는 것, 이미 옮긴 월드, 남은 것(`rm`이 못 지운 파일은 `sudo rm -rf` 안내)을 알린다.
4. **호스트명**: 파일을 지운 뒤 `IHostnameRegistrarPort.unregister('<name>.local')`. 실패는 경고다.

- **월드 계획**(`serverWorldPlan.ts`, #652): `data/<LEVEL>`, `_nether`, `_the_end`(심링크가 아닌 실제 폴더)를 `worlds/`로 옮긴다. 다음이면 아무것도 바꾸지 않고 거부한다: `worlds/<w>`가 이미 있음(`conflict`), 기본 월드 없이 차원 폴더만 있음, `servers/<n>`이나 `data/`가 심링크, 서버 안의 다른 월드 폴더(`level.dat`, `level.dat_old`, `region/`, `*.mca`), 서버 안을 가리키는 심링크(모두 `undetermined`). `deleteWorld`이면 진행한다. `worlds/`가 서버 안으로 해석되면 `deleteWorld`여도 거부한다. **`LEVEL`은 ADR-0002 스냅샷 리더로 읽는다**(Compose와 같은 해석: 따옴표, 줄 끝 주석, 마지막 정의). 스크립트의 "`LEVEL=` 한 줄만" 규칙이 아니다. 리더가 정할 수 없는 서버(잘못되었거나 보간되는 `LEVEL`, 지원하지 않는 `--universe`)는 `deleteWorld`가 아니면 중단한다. 월드 폴더 검사가 남아 있어 `LEVEL`을 잘못 읽어도 다른 월드가 발견되어 삭제가 멈춘다.
- **배정 해제**: 호출할 것이 없다. 배정은 서버의 `LEVEL`이므로(ADR-0002 R3, R5) `servers/<n>/config.env`와 함께 사라진다. `IWorldAssignmentPort.release`는 남는 서버용이다.
- **삭제 전 백업은 하지 않는다.** `remove`는 정지 시 자동 백업(S5) 없이 컨테이너를 멈추므로 `BACKUP_AUTO_ON_STOP` 백업이 돌지 않는다. 월드는 `worlds/`에 보존되고(#652), `--delete-world`는 명시적으로 지우라는 요청이다.
- **`docker compose config` 검증은 뺐다.** include 수정은 YAML 키 하나를 고치는 것(`removeIncludeEntry`)이라 파일이 유효하게 남는다.
- **`unregister` 명령 모양**(README sudoers, #751): `sudo -n sed -i '/^[^#]*[[:space:]]<host>\([[:space:]]\|#\|$\)/d' /etc/avahi/hosts`, 이어서 `sudo -n systemctl restart avahi-daemon`. 셸 없이 argv로 실행한다. `<host>`는 검증된 호스트명에서 `[ ] \ . * ^ $ /`를 이스케이프한 것이다(지운 `avahi_remove_host`와 같은 식). 비밀번호(CLI `--sudo-password`·`MCCTL_SUDO_PASSWORD`·프롬프트, API 요청 본문 `sudoPassword`)는 먼저 `sudo -S -p '' -v`의 stdin으로만 가고 `sed`나 환경 변수로 가지 않는다(#682). 빈 비밀번호는 없는 것으로 본다.
- **API**: `DELETE /api/servers/:name`이 선택 JSON 본문 `{ "sudoPassword": "..." }`를 받는다(생성처럼 write-only, URL은 로그에 남으므로 쿼리가 아님). #735 전에는 스크립트를 비밀번호 없이 실행해 sudo가 비밀번호를 요구하면 avahi 항목이 남았다. 호스트명을 지우지 못하면 200 응답에 선택 필드 `warning`이 붙는다. `force`는 더 이상 동작을 바꾸지 않는다. 생성·삭제 큐(#656)는 그대로다.
- **deprecated**(#736에서 삭제): `IShellPort.deleteServer`, `ShellAdapter.deleteServer`(스크립트 없이 "delete-server.sh was removed in #735; …"로 거부). `DeleteServerUseCase`에 `runtime?`(#734)과 새 선택 인자 `deprovision?`(`{ specRepo, hostnames? }`)이 없으면 같은 메시지로 거부한다.
- **지운 것**: `delete-server.sh`, `delete-server.bats`, `sudo-password.bats`(사례는 avahi 어댑터 vitest로 옮김), `tests/fake-bin/docker`, 그리고 `delete-server.sh`·`mcctl.sh`(S5)나 그 테스트만 쓰던 `lib/common.sh`·`tests/helpers.bash`의 헬퍼 전부. `lib/common.sh`에는 `naming-rules.bats`가 검사하는 이름 검증 함수만 남고, `platform/scripts/` 최상위에는 `*.sh`가 없다.

