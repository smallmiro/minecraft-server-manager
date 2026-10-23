# ADR-0002: `LEVEL`에서 파생하는 월드-서버 배정

| | |
|---|---|
| **상태** | 채택됨 (2026-10-23), #670에서 구현 |
| **이슈** | [#670](https://github.com/smallmiro/minecraft-server-manager/issues/670) (Hardening A4, 결정 D-2), 마일스톤 M3(#644), 에픽 #640. #715 S4(`lock.sh` 제거) 포함 |
| **바꾸는 문서** | [ADR-0001](0001-container-runtime-ports.ko.md): `IWorldAssignmentPort` 확정 |
| **관련** | #652 / PR #741(삭제 시 월드 보존), #655(A5, 서버 내부 월드 이전), #656(env 파서 통합), #669(A7), #732(S3, 백업 어댑터·엄격한 런타임 조회), #734(S5, `mcctl.sh` 제거), #736(S9, v3.0.0) |

이 문서는 영어판의 요약입니다. 포트 코드, 검사 순서, 테스트 목록 전체는 [영어판](0002-world-server-assignment.md)에 있습니다.

## 배경

- D-2의 R1~R7이 지켜지지 않았습니다. `lock.sh`는 `world assign`에서만 잠금 파일을 썼고, 시작 경로는 이 파일을 읽지 않았으며, create와 delete는 쓰지도 풀지도 않았습니다. 잠금은 24시간 뒤 오래된 것으로 간주되는데 오래된 잠금은 풀 수 없었고, 잠금을 읽지 못하면 "잠기지 않음"으로 처리했습니다.
- 실제로 의미가 있는 배정은 각 서버 `config.env`의 `LEVEL`입니다. 컨테이너는 이 값으로 월드 디렉터리를 엽니다.
- `ShellAdapter.serverStatus`가 넘기는 인자를 `mcctl.sh status`가 받지 않아 상태 확인이 항상 실패했고, 서버가 실행 중인데도 `LEVEL`이 바뀌었습니다.
- 월드 삭제, API 월드 초기화, 설정 스냅숏 복원, `mcctl migrate`가 그 월드를 쓰는 서버를 확인하지 않았습니다.

## 결정

| # | 결정 |
|---|------|
| 1 | **배정의 원천은 `LEVEL` 하나다(R5).** 서버의 월드는 `resolveWorldName(env)`이다(`LEVEL` → 레거시 `WORLD_NAME` → itzg 기본값 `world`). 서버의 `config.env`가 사라지면 배정도 풀린다(R3). |
| 2 | `IWorldAssignmentPort`는 포트로 남긴다. 비동기 메서드는 `listAssignments`, `preview`, `assign`, `release`(#715가 요구한 배정 해제) 네 개다. `getAssignment`는 빼고 `holdersOf`를 쓴다. |
| 3 | 규칙은 도메인 순수 함수로 둔다. 어댑터는 `config.env`를 읽고 쓰기만 하며, 쓰기 직전에 새로 읽은 스냅숏으로 `checkAssign`을 실행한다. |
| 4 | **fail-closed(R7).** `config.env`를 읽지 못하거나, 월드 이름이 `EXISTING_WORLD_NAME_PATTERN`에 맞지 않거나, 월드·`EXTRA_ARGS` 값이 Compose 보간 대상이거나, `--universe`가 지원하지 않는 위치인 서버는 판단 불가(undetermined)다. 하나라도 있으면 배정 변경과 월드 삭제·초기화를 모두 거부한다. 목록 조회는 경고와 함께 동작한다. |
| 5 | **월드는 정지된 서버에서만 바꾼다.** assign, release, `world new --server`, `config LEVEL\|WORLD_NAME`, PATCH `level`, 스냅숏 복원, migrate는 상태가 `running`, `paused`, `restarting`, `created`이면 거부한다. 자동으로 정지하지 않고, `force`로도 우회하지 않는다. |
| 6 | `world release`는 그 월드를 가진 서버를 자기 기본 월드 `<서버이름>`으로 되돌린다. `--force`는 받기만 하고 무시한다. |
| 7 | `worlds/.locks`는 읽지도, 쓰지도, 만들지도, 지우지도 않는다. `mcctl init`도 만들지 않는다. 사용자가 지워도 된다. |
| 8 | 중복 배정은 보고만 하고 고치지 않는다(`world list`, `GET /api/worlds`의 `assignmentWarnings`, 콘솔). 시작 경로는 바꾸지 않는다. |
| 9 | `lock.sh`와 `lock.bats`를 지운다. `mcctl.sh world`는 #734에서 없어질 때까지 제거 안내만 출력한다. |
| 10 | `world delete --force`는 서버가 쓰는 월드를 더 이상 지우지 않는다. `--force`는 확인 질문만 생략한다. |
| 11 | CLI와 API의 동시 변경 경쟁은 받아들인다. 중복 보고로 드러나며 뮤텍스 파일은 두지 않는다. |

## 배정 모델

- **월드 계열**: `<w>_nether`, `<w>_the_end`는 `<w>`에 속한다(`worldFamily`). 조회, 삭제, 초기화, 중복 보고가 양방향으로 계열을 비교한다. 그래서 쓰이는 `w`의 `w_nether`를 지우려 하면 거부되고, 레거시 `LEVEL=w_nether` 서버는 `w`를 가진 서버와 충돌한다. `_nether`나 `_the_end`로 끝나는 이름은 배정할 수 없다.
- **레거시 이름**: 기존 값은 `EXISTING_WORLD_NAME_PATTERN`(`/`, `\`, `.`/`..`, 따옴표, 제어문자 금지)으로 검사하므로 `My World`, `world.old`는 계속 동작한다. 새로 쓰는 `LEVEL`은 `WORLD_NAME_PATTERN`을 따라야 한다.
- **보간**: Compose는 따옴표가 없거나 큰따옴표인 값을 보간하고 홑따옴표 값은 그대로 둔다. `LEVEL=${MC_WORLD:-x}`는 판단 불가이고, `LEVEL='cash$world'`는 리터럴 이름이다.
- **서버 내부 월드(D-1)**: 유효한 `EXTRA_ARGS`는 템플릿 `env_file` 순서를 따른다. 서버 `config.env` 값이 이기고(빈 값도), 없으면 `servers/global.env`를 쓴다(값 없는 `EXTRA_ARGS` 줄은 플랫폼 `.env` 값을 받는다). `--universe /worlds`는 `worlds/`, `--universe`가 없거나 `/data`·`.`이면 `servers/<n>/data/<LEVEL>`(`internal: true`), 그 밖의 위치는 판단 불가다. 내부 월드 서버는 이름을 예약하고, #655로 이전하기 전에는 `assign`/`release`를 거부하며, `worlds/<w>` 삭제·초기화에서는 세지 않는다.

## 포트와 어댑터

```ts
interface IWorldAssignmentPort {
  listAssignments(): Promise<WorldAssignmentSnapshot>;        // servers/를 읽지 못할 때만 reject
  preview(server: string, configEnv: string): Promise<WorldAssignmentSnapshot>; // 쓰지 않음
  assign(world: string, server: string): Promise<void>;       // 위반 시 WorldAssignmentError
  release(world: string): Promise<{ server: string; fallback: string }>;
}
```

- 도메인 함수: `worldFamily`, `holdersOf`, `checkAssign`(선택 인자 `newServer`), `planRelease`, `checkRemoval`(삭제), `checkReset`(초기화), `checkProposed`(복원·migrate), `findDuplicates`, `formatAssignmentWarnings`.
- 어댑터 `ConfigEnvWorldAssignmentAdapter`는 `parseEnvDocument`로 읽고 `applyEnvChanges` + `writeFileAtomic`으로 `LEVEL`만 쓰며 파일 권한을 유지한다.
- API 초기화 라우트는 `planWorldReset`이 돌려준 월드를 지우고, `listWorlds().servers`도 같은 스냅숏에서 만든다. 그래서 따옴표나 주석이 있는 `LEVEL`을 검사와 실행이 같게 읽는다. API `ConfigService` 표시용 파서는 #656까지 그대로 둔다.

### 호환성(v2.x, #715)

- 생성자에는 선택 인자만 뒤에 추가했다: `WorldManagementUseCase(…, assignments?, runtime?)`, `CreateServerUseCase(…, assignments?)`, `ConfigSnapshotUseCaseImpl(…, assignments?, runtime?)`, `WorldRepository(paths?, assignments?)`. 배정 포트가 없으면 배정 변경, 월드 삭제, 서버 생성, `config.env` 복원을 거부한다(`undetermined`). 런타임 포트가 없으면 월드 변경을 거부한다.
- `assignWorldByName`에 선택 인자 `{ requireExisting }`, 결과 객체에 `errorCode`, `WorldReleaseResult`에 `fallbackWorld`·`fallbackExists`를 추가했다. 유스케이스에 `planWorldReset`, `getAssignmentReport`를 추가했다.
- `isLocked`/`lockedBy`의 뜻은 "배정됨"이다. `findAllWithServerStatus`는 컨테이너가 없으면 `stopped`로 분류한다.
- `@deprecated`(삭제는 #736): `IShellPort`/`ShellAdapter`의 `worldAssign`, `worldRelease`, `worldList`, `serverStatus`(월드 메서드는 `lock.sh`가 없어 실패한다), `WorldRepository.getLockStatus`, `WorldLockData`, `Paths.locks`, `Paths.lockFile`.

## 검사 위치

| 진입점 | 검사 |
|--------|------|
| `mcctl create [--world W]`, 대화형 생성, API `POST /api/servers` | `checkAssign(W ?? <이름>, <이름>, { newServer: true })` |
| `world assign`, API assign | `checkAssign` → 런타임 확인 → `assignments.assign` |
| `mcctl config <서버> LEVEL\|WORLD_NAME <v>` | 유효 월드(`LEVEL`, 없으면 `WORLD_NAME`)가 바뀔 때만 `assignWorldByName`. `LEVEL`이 있으면 `WORLD_NAME`은 그대로 쓴다 |
| API PATCH `level` | 다른 필드를 쓰기 전에 `assignWorldByName(level, 이름, { requireExisting: false })`. 다른 필드로 `LEVEL` 줄을 넣을 수 없다(#726) |
| `world new --server`, API `POST /api/worlds`(serverName) | 디렉터리를 만들기 전에 상태와 `checkAssign` 확인 |
| `world release`, API release | `planRelease` → 가진 서버의 상태 확인 → `assignments.release` |
| `world delete`, API delete | `checkRemoval`. `--force`로도 우회하지 못한다 |
| API `POST /api/servers/:name/world/reset` | `planWorldReset`(`checkReset`)이 돌려준 월드만 지운다 |
| 설정 스냅숏 복원(CLI, API) | `config.env`가 있으면 `preview` + `checkProposed`, 배정이 바뀌면 `force`와 상관없이 상태 확인. API는 409 |
| `mcctl migrate worlds` | 새 `config.env`를 먼저 만들어 `preview` + `checkProposed`로 확인한 뒤 데이터를 옮긴다 |

- 상태 확인은 `checkServerStopped`가 `runtime.getStatus('mc-<서버>')`로 한다. **알려진 한계**: D1에서는 `not_found`가 "런타임에 연결할 수 없음"도 뜻하므로 통과한다. 예외는 판단 불가로 처리한다. 후속: #732의 엄격한 조회로 교체(A7, #669).
- API는 `errorCode`로 응답 코드를 고른다(`invalid_world` 400, 서버·월드 없음 404, 나머지 409).

## `.locks`와 백업

- `.locks`는 자동으로 지우지 않는다. `rm -rf worlds/.locks`는 안전하다. 다운그레이드해도 문제가 없다.
- 백업(#732): `.locks`는 제외 목록에 그대로 두고 복원할 때 만들지 않는다. 복원은 `servers/*/config.env`를 건드리지 않으므로 배정이 유지된다.

## 보고와 콘솔

- `mcctl world list`: `assigned: a, b`로 표시하고 중복 월드와 판단 불가 서버를 경고로 출력한다(`--json` 출력은 그대로, 경고는 stderr).
- `GET /api/worlds`에 `assignmentWarnings`, release 응답에 `fallbackWorld`·`fallbackExists`를 추가했다.
- 콘솔: 경고 `Alert`, "Assigned" 라벨과 "Assigned to N servers" 칩, `AssignWorldDialog`에서 실행 중인 서버 비활성화. BFF는 응답 전체를 넘긴다.

## 결과

- **+** 원천이 하나라 TTL도, 오래된 잠금도, 백업하거나 k8s 볼륨으로 옮길 잠금 파일도 없다.
- **+** 규칙이 순수 함수라 ServerSpec이나 k8s 어댑터는 읽기와 쓰기만 다시 구현하면 된다.
- **−** 깨졌거나 보간이 들어간 `config.env` 하나가 고쳐질 때까지 모든 배정 변경을 막는다(R7, 의도한 동작).
- **−** 프로세스 간 경쟁은 막지 않는다. Docker를 조회할 수 없으면 상태 확인이 통과한다(#732/#669까지).
- **−** 기존 중복 배정은 사용자가 정리할 때까지 그대로 실행된다.
