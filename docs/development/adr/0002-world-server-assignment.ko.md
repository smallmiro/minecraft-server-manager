# ADR-0002: `LEVEL`에서 파생하는 월드-서버 배정

| | |
|---|---|
| **상태** | 제안됨 (2026-10-23) |
| **이슈** | [#670](https://github.com/smallmiro/minecraft-server-manager/issues/670) (Hardening A4, 결정 D-2), 마일스톤 M3(#644), 에픽 #640. #715 S4(`lock.sh` 제거) 포함 |
| **바꾸는 문서** | [ADR-0001](0001-container-runtime-ports.ko.md): `IWorldAssignmentPort` 확정 |
| **관련** | #652 / PR #741(삭제 시 월드 보존), #655(A5, 서버 내부 월드 이전), #669(A7), #732(S3, 백업 어댑터), #734(S5, `mcctl.sh` 제거), #736(S9, v3.0.0) |

이 문서는 영어판의 요약입니다. 포트 코드, 검사 순서, 테스트 목록 전체는 [영어판](0002-world-server-assignment.md)에 있습니다.

## 배경

- D-2의 R1~R7이 지켜지지 않습니다. `lock.sh`는 `world assign`에서만 잠금 파일을 씁니다. 시작 경로는 이 파일을 읽지 않고, create와 delete는 쓰지도 풀지도 않습니다. 잠금은 24시간 뒤 오래된 것으로 간주되는데, 오래된 잠금은 풀 수 없습니다. 잠금을 읽지 못하면 "잠기지 않음"으로 처리합니다.
- 실제로 의미가 있는 배정은 각 서버 `config.env`의 `LEVEL`입니다. 컨테이너는 이 값으로 월드 디렉터리를 엽니다.
- `ShellAdapter.serverStatus`가 넘기는 인자를 `mcctl.sh status`가 받지 않습니다. 그래서 상태 확인이 항상 실패하고, 서버가 실행 중인데도 `LEVEL`이 바뀝니다.
- 월드를 삭제하거나 API로 초기화할 때 그 월드를 쓰는 서버를 확인하지 않습니다.

## 결정

| # | 결정 |
|---|------|
| 1 | **배정의 원천은 `LEVEL` 하나다(R5).** 서버의 월드는 `resolveWorldName(env)`이다(`LEVEL` → 레거시 `WORLD_NAME` → itzg 기본값 `world`). 서버의 `config.env`가 사라지면 배정도 풀린다(R3). |
| 2 | `IWorldAssignmentPort`는 포트로 남긴다. 비동기 메서드는 `listAssignments`, `assign`, `release`(#715가 요구한 배정 해제) 세 개다. `getAssignment`는 빼고, 필요한 곳에서는 순수 함수 `holdersOf`를 쓴다. |
| 3 | 규칙은 도메인 순수 함수(`checkAssign`, `planRelease`, `holdersOf`, `findDuplicates`)로 둔다. 어댑터는 `config.env`를 읽고 쓰기만 하며, 쓰기 직전에 새로 읽은 스냅숏으로 `checkAssign`을 실행한다. |
| 4 | **fail-closed(R7).** `config.env`를 읽지 못하거나 월드 이름이 `WORLD_NAME_PATTERN`에 맞지 않는 서버는 "판단 불가"(undetermined)로 둔다. 이런 서버가 하나라도 있으면 배정 변경과 월드 삭제·초기화를 모두 거부한다. 목록 조회는 경고와 함께 동작한다. |
| 5 | **`LEVEL`은 정지된 서버에서만 바꾼다.** 상태가 `running`, `paused`, `restarting`, `created`이면 거부한다. 서버를 자동으로 정지하지 않는다. |
| 6 | `mcctl world release <월드>`의 의미를 바꾼다. 그 월드를 가진 서버는 자기 기본 월드 `<서버이름>`으로 돌아간다. `--force`는 받기만 하고 무시한다. |
| 7 | `worlds/.locks`는 무시한다. mcctl은 이 디렉터리를 읽지도, 쓰지도, 지우지도 않는다. `mcctl init`도 더 이상 만들지 않는다. |
| 8 | 중복 배정은 보고만 하고 고치지 않는다(`world list`, `GET /api/worlds`, 콘솔). 시작 경로는 바꾸지 않는다. |
| 9 | `lock.sh`와 `lock.bats`를 지운다. `mcctl.sh world`는 #734까지 남지만 호출처가 없다. |

## 배정 모델

- **차원 폴더**: `<w>_nether`, `<w>_the_end`는 `<w>`의 일부다. `holdersOf(w)`는 세 이름을 모두 비교한다. `_nether`나 `_the_end`로 끝나는 이름은 배정할 수 없다(`invalid_world`).
- **레거시 이름**: `WORLD_NAME`은 읽기만 한다. 패턴에 맞지 않는 이름(공백, `./x`, `x/`)은 디스크에서 어느 디렉터리인지 모호하므로 판단 불가로 처리한다(PR #741과 같은 기준).
- **서버 내부 월드(D-1)**: `EXTRA_ARGS`에 `--universe`가 없으면 `internal: true`로 표시하고, 그 이름은 **예약**한다(PR #741은 삭제 시 이 월드를 `worlds/<LEVEL>`로 옮기고 이름이 겹치면 중단한다). #655로 이전하기 전에는 그 서버에 `assign`과 `release`를 거부한다(`internal_world`). `LEVEL`을 바꾸면 빈 `data/<LEVEL>`이 새로 생기기 때문이다. `worlds/<w>`의 삭제·초기화에서는 내부 월드 서버를 참조 서버로 세지 않는다.

## 포트와 어댑터

```ts
interface WorldAssignment { world: string; server: string; internal: boolean }
interface WorldAssignmentSnapshot { assignments: WorldAssignment[]; undetermined: string[] }

interface IWorldAssignmentPort {
  listAssignments(): Promise<WorldAssignmentSnapshot>; // servers/를 읽지 못할 때만 reject
  assign(world: string, server: string): Promise<void>; // 위반 시 WorldAssignmentError
  release(world: string): Promise<{ server: string; fallback: string }>;
}
```

- 오류 코드: `invalid_world`, `server_not_found`, `conflict`, `undetermined`, `internal_world`, `not_assigned`, `default_world`, `server_running`(유스케이스에서만 발생).
- 어댑터: `shared/src/infrastructure/adapters/ConfigEnvWorldAssignmentAdapter.ts`. `parseEnvDocument`로 읽고, `applyEnvChanges` + `writeFileAtomic`으로 쓴다. 쓸 때 기존 파일 권한을 유지한다(헬퍼 기본값은 `0o600`).
- composition root: CLI `Container`에 getter를 추가한다. API는 D2 전이므로 `routes/worlds.ts`, `routes/servers.ts`의 생성 라우트, `routes/servers/config.ts`에서 `new`로 만든다. 생성 라우트의 `ShellAdapter`는 없어진다.
- `WorldManagementUseCase`에 `assignments`와 `runtime` 인자를 추가한다(필수). `CreateServerUseCase`에는 선택 인자로 추가하되, 없으면 생성을 거부한다. `WorldRepository`는 스냅숏으로 `World.lockTo()`를 채우므로 `isLocked`/`lockedBy`의 뜻은 "배정됨"이 된다. `findAllWithServerStatus`는 컨테이너가 `not_found`여도 `available`이 아니라 `stopped`로 분류한다.
- 프로세스 간 경쟁(CLI와 API가 동시에 검사를 통과하는 경우)은 받아들인다. 중복 보고로 드러난다.
- **`@deprecated`**(삭제는 #736): `IShellPort`/`ShellAdapter`의 `worldAssign`, `worldRelease`, `serverStatus`, 그리고 `WorldRepository.getLockStatus`, `WorldLockData`, `Paths.locks`, `Paths.lockFile`. API의 `isLocked`/`lockedBy`는 v2.x 동안 "배정됨"의 별칭으로 남긴다.

## 검사 위치

| 진입점 | 검사 |
|--------|------|
| `mcctl create [--world W]`, 대화형 생성, API `POST /api/servers` | `checkAssign(W ?? <이름>, <이름>)`. 기본 월드 이름도 검사한다 |
| `world assign`, API assign | 런타임 상태 확인 → `assignments.assign` |
| `mcctl config <서버> LEVEL\|WORLD_NAME`, API PATCH `level` | `assignWorldByName(v, 서버, { requireExisting: false })` |
| `world new --server`, API `POST /api/worlds`(serverName) | 디렉터리를 만들기 전에 상태와 `checkAssign`을 확인한다 |
| `world release`, API release | 가진 서버의 상태 확인 → `assignments.release` |
| `world delete`, API delete | 참조 서버가 있거나 판단 불가이면 거부한다. `--force`로도 우회하지 못한다 |
| API `POST /api/servers/:name/world/reset` | 내부 월드 서버, 다른 서버도 같은 월드를 가진 경우, 판단 불가인 경우 거부한다 |

- 상태 확인은 `runtime.getStatus('mc-<서버>')`를 쓴다. D1에서는 `not_found`가 "런타임에 연결할 수 없음"도 뜻하므로 통과한다. A7(#669) 뒤에는 이 경우를 판단 불가로 처리한다.
- 결과 객체에 `errorCode`를 추가하고, API는 문자열 대신 코드로 응답 코드를 고른다(`invalid_world`는 400, 서버·월드 없음은 404, 나머지는 409).

## `release`, `.locks`, 백업

- `.locks`는 자동으로 지우지 않는다. 릴리스 노트에 지워도 안전하다고 적는다. 다운그레이드해도 문제가 없다.
- 백업(#732): `.locks`는 제외 목록에 그대로 두고, 복원할 때 만들지 않는다(`backup.sh:480`은 지금 만든다). 복원은 `servers/*/config.env`를 건드리지 않으므로 배정이 유지된다.

## 보고와 콘솔

- `mcctl world list`: "locked" 대신 "assigned"로 표시하고, 중복 월드와 판단 불가 서버를 경고로 출력한다. `mcctl status`는 바꾸지 않는다(#655).
- `GET /api/worlds`에 `assignmentWarnings: string[]`을 추가한다.
- 콘솔: 경고를 `Alert`로 표시한다. `WorldCard`는 `servers.length > 1`이면 "Assigned to N servers" 칩을 보여 주고, "Locked" 라벨을 "Assigned"로 바꾼다. `AssignWorldDialog`에서 실행 중인 서버를 비활성화한다. 오류 메시지는 기존 `Alert`와 BFF가 그대로 전달한다.

## `lock.sh` 제거와 테스트

- `lock.sh`, `lock.bats`, 쓰지 않게 된 `require_flock`을 지운다. `init.ts`는 `.locks`를 만들지 않는다. `.gitignore` 템플릿 항목은 남긴다.
- `lock.bats`의 동작 가운데 "다른 서버가 가져갈 수 없음"은 R1 테스트로 남긴다. 나머지는 `LEVEL` 쓰기, `release`, 판단 불가 테스트로 바뀐다. 오래된 잠금이라는 개념은 없어진다.
- TDD: 도메인 순수 함수 → 어댑터(임시 디렉터리 픽스처, `config.env`를 디렉터리로 만들어 EISDIR) → 유스케이스(목 포트) → API·CLI·콘솔 순서로 테스트를 먼저 쓴다.

## PR 분할

| PR | 담당 | 내용 |
|----|------|------|
| PR1 | core-agent | 도메인 규칙, 포트, 어댑터, `WorldRepository`, 유스케이스, `@deprecated`, 생성자 변경에 필요한 CLI·API 연결 |
| PR2 | backend, cli, frontend | API 검사와 오류 코드, `assignmentWarnings`, CLI `config LEVEL`·`world list`·`release`, 콘솔 |
| PR3 | cli, technical-writer | `lock.sh` 삭제, `init.ts`, 문서(EN/KO). PR2에 합쳐도 된다 |

## 확인이 필요한 쟁점

1. **`world release`의 의미**: (A, 권장) `<서버이름>`으로 되돌린다. (B) 폐기하고 "`world assign`을 쓰라"는 오류를 낸다. B로 하면 포트의 `release`를 호출하는 곳이 없어 ADR-0001의 메서드 규칙과 #715 결정에 어긋난다.
2. **`.locks` 정리**: (A, 권장) 자동으로 지우지 않고 문서로만 안내한다. (B) #736의 `mcctl upgrade`가 지운다.
3. **패턴에 맞지 않는 레거시 `LEVEL`** 때문에 설치본 전체의 배정 변경이 막힌다(엄격한 R7). 정확히 같은 이름일 때만 참조로 세는 대안도 있다. 엄격한 쪽을 권장한다.
4. **`world delete --force`**가 참조 중인 월드를 더 이상 지우지 않는다. 동작 변경을 확인해야 한다.
5. **실행 중인 서버에 `world new --server`**: 거부(권장. 자동 정지는 상태 확인 버그 때문에 한 번도 동작하지 않았다)할지, `runtime.stop`으로 자동 정지할지 정해야 한다.
6. **프로세스 간 경쟁**: 받아들일지(권장), 지금 뮤텍스 파일을 추가할지 정해야 한다.
