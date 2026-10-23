# ADR-0003: ServerSpec, 서버 정의를 하나로

| | |
|---|---|
| **상태** | system-architect 리뷰 후 수정하여 승인(2026-10-23) |
| **이슈** | [#675](https://github.com/smallmiro/minecraft-server-manager/issues/675)(강건화 D5, 마일스톤 M4 #645). #715 S8(`create-server.sh` 교체) 포함 |
| **바꾸는 ADR** | [ADR-0001](0001-container-runtime-ports.ko.md): `IServerSpecRepository`에 `load`/`write` 추가(v2 메서드 유지), `IHostnameRegistrarPort.register`/`unregister` 추가 |
| **기반** | [ADR-0002](0002-world-server-assignment.ko.md)(#670, 배정의 원천은 `LEVEL`. 머지 전까지 `feature/670-world-server-assignment`에 있음), PR #749(#656: env 코덱, `atomicWriteFile`, API 생성·삭제 대기열), #651, #649, #654, #751(avahi sudoers 모양) |
| **관련** | #735(S7 삭제), #657, #658, #736(S9, v3.0.0), #641(k8s), #655, #737, #726 |

영어판([0003-server-spec.md](0003-server-spec.md))이 원본이다. 이 문서는 결정과 표를 줄여 옮겼다.

## 배경

- 서버 하나의 정의가 7곳(`config.env`, 서버 compose, include 목록, `.env`, `.mcctl.json`, avahi hosts, 잠금 파일)에 흩어져 있고, 쓰는 코드가 10곳이 넘는다. 그중 4곳은 compose YAML을 정규식으로 고친다(B4).
- `create-server.sh`(789줄)는 `cp`와 `sed`로 서버를 만들고, 실패하면 `servers/<n>`을 남기며(#657), API가 해석할 수 없는 진행 문자열을 낸다(#658).
- k8s 어댑터(#641)는 런타임과 무관한 정의 하나에서 매니페스트를 만들어야 한다(계획서 §12 조건 3).

## 결정 요약

1. **`servers/<n>/server.yaml`이 정의다.** `config.env`, 서버 `docker-compose.yml`, include 항목은 여기서 **생성**한다. 플랫폼 파일(`.env`, 메인 compose, `.mcctl.json`)은 스펙에 넣지 않는다.
2. **작은 타입 필드 + `env` 통과값.** mcctl이 판단하거나 렌더러가 변환해야 하는 것(type, version, memory, image, world, routing)만 타입으로 둔다. 나머지 `config.env` 키는 `env`에 그대로 두므로 가져오기에서 손실이 없다.
3. **v2.x에서 읽는 코드는 바꾸지 않는다.** 저장할 때마다 생성물을 다시 쓰므로 기존 리더는 계속 `config.env`와 compose를 읽는다. 쓰는 코드만 옮긴다.
4. **손으로 고친 내용은 잃지 않고 흡수한다.** 헤더 해시로 감지한다. `config.env` 수정과 compose의 스펙 소유 필드(`image`, `mc-router.*` 라벨) 수정은 다음 쓰기 전에 스펙에 흡수한다. 그 밖의 compose 차이는 보호하고 조용히 덮어쓰지 않는다.
5. **새 포트도, 깨지는 export도 없다**(#715, v2.x 규칙). `IServerSpecRepository`와 `ServerSpec`은 v2 모양을 유지한다. 전체 타입은 새 이름 `ServerSpecDocument`이고, 새 동작은 메서드 추가(`load`, `write`)로 얻는다. #670이 `IWorldAssignmentPort`에 쓴 방식과 같다. 렌더링은 저장소 어댑터 안의 인프라 세부 사항이다. `IHostnameRegistrarPort`에 `register`(#735용 `unregister`)를 추가한다.
6. **잠금 파일 없음.** 생성은 `mkdir`로 디렉터리를 선점하고, 수정은 낙관적 리비전(`server.yaml`의 sha256)으로 충돌을 막는다. #749의 API 내부 대기열은 그대로 둔다.
7. **가져오기는 지연 또는 명시적으로만, 일괄로 하지 않는다.** `server.yaml`이 없는 서버는 첫 쓰기 때 메모리에서 가져오고, `mcctl migrate spec`으로 요청할 때 가져온다. `mcctl upgrade`는 아직 가져오지 않은 서버를 보고만 한다. 한 번도 가져오지 않은 서버도 지금처럼 동작한다.
8. **provision이 `create-server.sh`를 대신한다.** `CreateServerUseCase` 안에서 API SSE가 이미 쓰는 이름으로 진행 이벤트를 내고, 실패하면 전부 되돌려 바로 다시 시도할 수 있게 한다.

### 확정된 질문(2026-10-23)

| # | 질문 | 결정 |
|---|------|------|
| 1 | 생성 성공 뒤 시작 실패 | 서버는 생성된 상태로 둔다. CLI는 원인을 출력하고 종료 코드 1. API는 성공으로 응답하되 `server.status: 'created'`와 `warning`을 담는다(SSE `completed`). 콘솔이 "이미 있음"으로 끝날 재시도를 권하지 않게 하기 위해서다 |
| 2 | compose 수동 수정 | 스펙 소유 필드는 흡수하고 나머지는 보호, `--force`는 `.bak`을 남기고 덮어씀. override 파일은 나중에 추가할 수 있다 |
| 3 | `global.env`/`.env`에서 상속된 `EXTRA_ARGS` | 가져올 때 실제 값을 `config.env`에 고정하고 보고 |
| 4 | `mcctl upgrade`의 일괄 가져오기 | 하지 않는다. `upgrade`는 보고만, 가져오기는 지연 또는 `mcctl migrate spec` |
| 5 | 생성에 쓰는 템플릿 | 번들 템플릿만(#651). API는 `<root>/servers/_template`을 더 읽지 않는다 |
| 6 | 계획서 §9.2와 다른 점 | 수용(§1) |
| 7 | `.mcctl.json`의 `avahiEnabled: false` | 스크립트처럼 무시 |
| 8 | `unregister`의 sudoers 모양 | #751이 되돌린 README 모양 `sudo -n sed -i <expr> /etc/avahi/hosts`(ADR-0001) |

## 1. 스키마

타입 정의와 YAML 예시는 영어판 §1을 그대로 쓴다. `ServerSpecDocument extends ServerSpec`: `specVersion: 1`, `name`, `type`, `version?`, `memory?`, `image`, `world { level, storage: universe|data }`, `routing { customHostnames[], playitDomain?, autoScale { up, down }, asleepMotd?, loadingMotd? }`, `env`.

| 필드 | 생성 | 가져오기·가져온 스펙 저장 |
|------|------|--------------------------|
| `name` | `ServerName`(DNS-1123, 예약어, #649), 디렉터리 이름과 같아야 함 | `EXISTING_SERVER_NAME_PATTERN` |
| `world.level` | `WORLD_NAME_PATTERN`, `*_nether`/`*_the_end` 금지(ADR-0002) | `EXISTING_WORLD_NAME_PATTERN` |
| `type`, `version`, `memory` | `ServerType`, `McVersion`, `Memory` | env 값 규칙 |
| 호스트명, `playitDomain` | 호스트명 규칙(`HostnameService`에서 도메인으로 이동) | 같음 |
| `env` 키·값 | `ENV_KEY_RE` / `assertEnvFileValue`(#726) | 같음 |

- 생성은 엄격한 값 객체로, 가져오기는 지금 동작하는 값을 받아들이고 엄격 규칙 위반만 보고한다(C1 #7).
- **관리 키**(`TYPE`, `VERSION`, `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`)는 `env`에 둘 수 없다. `env.EXTRA_ARGS`에는 `--universe`를 넣을 수 없다(`world.storage`가 맡음).
- **엄격한 파일**: 알 수 없는 최상위 키와 문자열이 아닌 스칼라는 경로와 함께 거부한다(`version: 1.21`은 float이므로 따옴표를 쓰라고 안내).
- **오류는 다음 행동을 알려 준다**: `ServerSpecError`는 서버, 파일, 필드와 다음 단계(따옴표 추가, `mcctl migrate spec <n> --force`, mcctl 업그레이드)를 담는다. v2 `{ name }`만 `save`에 넘기면 빠진 필드를 나열한 `invalid_spec`으로 실패한다.
- **`specVersion`**: 선택 필드 추가는 올리지 않는다. 호환이 깨지면 올리고 읽을 때 메모리에서 변환한다. 더 높은 버전은 거부한다.
- **`server.yaml` 손수정**은 허용한다. 그 서버에 대한 다음 mcctl 쓰기나 `mcctl migrate spec <n>`에서 반영된다. `mcctl start`는 렌더링하지 않는다.
- **비밀값**: 버전 1에는 `secretRefs`가 없다. 사용자가 `config.env`에 넣은 비밀값은 `env`에 들어가고, `server.yaml`은 `config.env`와 같은 파일 모드를 쓰며 API로 반환하지 않는다. #641이 선택 필드로 추가한다.
- **계획서 §9.2와 다른 점**(수용): `world.source`·`modpack`·`whitelist`는 `env` 키, `imageTag` 대신 `image`, `stopGraceSec`·`resources`는 A2/C3에서, 서버별 잠금 대신 낙관적 리비전.

## 2. 저장소, 저장, 동시성

- **포트**(전문은 ADR-0001): v2 메서드 `list(): Promise<ServerSpec[]>`, `get`(`@deprecated`, v3.0.0에서 삭제), `save(spec)`(전체 문서인지 검사 후 `write`), `delete`(#735)는 그대로 둔다. #675가 `load(name)` → `{ document, revision, warnings }`와 `write(doc, { expectedRevision?, create?, force?, allowStorageChange? })`를 추가한다.
- `servers/<n>/server.yaml`, 고정 키 순서, `atomicWriteFile`(#749).
- **생성**: `mkdir servers/<n>`(재귀 아님)이 선점이다. `EEXIST`는 `already_exists`.
- **수정**: `load`가 읽은 바이트의 sha256을 `revision`으로 돌려주고, `write`는 rename 직전에 다시 읽어 비교한다. 다르면 `conflict`이고 `updateServerSpec`이 한 번 재시도한다. `ponytail:` 비교와 rename 사이 마이크로초 창은 남는다.
- **월드 보호(R1, R7)**: 렌더링한 `LEVEL`이나 저장 위치가 현재 `config.env`와 다르면 `write`가 ADR-0002의 순수 함수 `checkProposed`를 렌더링한 `config.env`를 넣은 스냅샷으로 실행한다. `IWorldAssignmentPort.preview`와 같은 스냅샷 리더를 직접 쓴다(배정 어댑터가 이 저장소로 쓰므로 포트를 거치면 순환). 저장 위치 변경은 `allowStorageChange` 없이는 거부한다(`storage_change`). 이 옵션은 `mcctl migrate worlds`만 쓴다. "서버가 정지돼 있어야 한다"는 검사는 유스케이스에 남는다(ADR-0002 결정 5).
- **저장 순서**: `server.yaml` 먼저, 그다음 생성물. 중간에 죽으면 생성물의 해시는 맞고 `spec=`만 이전 값이므로(§3), 다음 쓰기나 `mcctl migrate spec`이 다시 렌더링해 마무리한다.

## 3. 렌더링

- **경계**: 인프라 내부 인터페이스 `ServerSpecRenderer { render(doc, ctx) }`. `FileServerSpecRepository`가 생성자로 받는다. 애플리케이션 코드는 렌더러를 부르지 않으므로 포트가 아니다. 지금은 `DockerComposeRenderer`만 구현하고, `KubernetesManifestRenderer`(StatefulSet, Service, PVC)는 #641까지 인터페이스로만 둔다. #641은 렌더러와 함께 스펙 저장·매니페스트 적용에 필요한 k8s 저장소 어댑터를 추가한다. ADR-0001의 `apply(spec)`는 필요 없다. 삭제 시 렌더링할 것(include 항목)은 #735에서 정한다.

| 파일 | 방법 | 수정 감지 |
|------|------|-----------|
| `config.env` | 현재 내용(생성 시 번들 템플릿)에 `applyEnvChanges(..., { raw: true })`. 값이 다른 키만 바꾸고 스펙에 없는 키는 지운다. 손대지 않은 줄은 바이트 그대로 | 예 |
| `docker-compose.yml` | 번들 `_template/docker-compose.yml`을 `js-yaml`로 읽어 서비스 키·`container_name`, `image`, 라우터 라벨을 설정하고 `dump` | 예 |
| `servers/compose.yml` | `js-yaml`로 읽어 같은 항목이 없으면 추가, 다른 항목은 유지. 쓴 뒤 다시 읽어 확인하고 다르면 한 번 재시도. 읽지 못한 파일은 덮어쓰지 않고 아무것도 쓰기 전에 오류로 멈춘다 | 아니오(병합) |
| `data/`, `logs/`, `servers/global.env` | `mkdir -p`, `global.env`가 없으면 템플릿에서 복사 | — |

- **env 투영**: `TYPE`, `VERSION`(없으면 생략), `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`, `EXTRA_ARGS`, 그다음 `env`. `universe`면 `EXTRA_ARGS` = `--universe /worlds/` + `env.EXTRA_ARGS`, `data`면 `env.EXTRA_ARGS ?? ''`.
- **라우터 호스트명**: `<n>.local`, `hostIps`마다 `<n>.<ip>.nip.io`, `playitDomain`, `customHostnames`(중복 제거). 이 생성기 하나가 `build_hostnames`, `init.ts`의 `buildHostnames`/`mergeHostnames`, `HostnameService`의 시스템 부분을 대신한다(B4).
- **호스트 IP**(`resolveHostIps`, shared 인프라, 스크립트와 같은 순서): `.env`의 `HOST_IPS`, 없으면 `HOST_IP`(env 코덱으로 읽음), 없으면 `ip route get 1`의 `src` 주소, 없으면 `hostname -I`의 첫 주소, 없으면(macOS) `os.networkInterfaces()`의 내부가 아닌 첫 IPv4. 모든 단계에서 `docker0`, `br-*`, `veth*` 주소는 건너뛴다. avahi에는 첫 주소를 쓴다.
- **헤더**(감지 대상 파일 첫 줄): `# Generated by mcctl from server.yaml; edits are detected (ADR-0003). mcctl:sha256=<64 hex> spec=<12 hex>`. 다른 상태 파일은 없다.
- **멱등**: 두 번 렌더링해도 같은 바이트이고, 스펙이 그대로면 쓰기가 없다.

**수정 감지**(`load` 시점)

| `config.env` | 의미 | 처리 |
|--------------|------|------|
| 해시 일치, `spec=` 현재 | 동기화됨 | — |
| 해시 일치, `spec=` 이전 | `server.yaml` 손수정 또는 중단된 쓰기 | 다음 쓰기에서 렌더링 |
| 해시 불일치 또는 헤더 없음 | `config.env` 수정(또는 렌더링된 적 없음) | 스펙에 흡수 |
| 해시 불일치, `spec=` 이전 | 둘 다 고침 | `edit_conflict`. `--force`가 `config.env.bak`을 남기고 다시 렌더링 |

| `docker-compose.yml` | 처리 |
|----------------------|------|
| 해시 일치 | 자유롭게 덮어씀(새 mcctl의 템플릿 변경도 반영) |
| 해시 불일치 또는 헤더 없음 | 1. 스펙 소유 필드(`image`, `mc-router.*` 라벨)를 스펙에 흡수, 2. 알려진 옛 형식(env_file `../../.env` #685, loading-MOTD 라벨 없음) 정규화, 3. 나머지를 `render(spec)`과 의미상 비교. 같으면 덮어쓰고, 다르면 보호: compose를 바꾸는 쓰기는 `compose_edited`(다른 YAML 경로 목록)로 실패, 바꾸지 않는 쓰기는 파일을 그대로 둔다. `--force`는 `docker-compose.yml.bak`을 남기고 덮어씀 |

## 4. 기존 설치본 가져오기

1. **`config.env`**: `TYPE`, `VERSION`, `MEMORY`, `PLAYIT_DOMAIN`은 타입 필드로. `world.level` = `resolveWorldName(env)`(`WORLD_NAME`은 `env`에 남김). 나머지 키는 파일 순서대로 `env`에(알 수 없는 키 보존).
2. **저장 위치**: ADR-0002의 해석으로 *실제* `EXTRA_ARGS`를 구한다. `--universe /worlds[/]`는 `universe`, 없음·`/data`·`.`는 `data`. `--universe` 토큰을 뺀 나머지는 `env.EXTRA_ARGS`로(`global.env`에서 왔으면 고정하고 보고). 디렉터리는 교차 확인만 한다.
3. **fail-closed**: 보간되는 관리 키 값(`${...}`)이나 다른 `--universe` 위치는 `undetermined`다. 그 서버는 가져오지 않고 계속 동작하며, 파일을 고칠 때까지 그 서버에 대한 쓰기는 이유와 함께 실패한다.
4. **compose**: 서비스 `mc-<n>` 하나를 기대한다. `image`와 라우터 라벨은 `routing`으로, 호스트명은 시스템과 사용자 지정으로 나눈다. `EULA`가 아닌 `environment` 항목은 `env`로 옮긴다. Compose에서는 `environment`가 `env_file`보다 우선하므로 키가 겹치면 compose 값을 쓰고 보고한다. 스펙 소유 필드나 옮기는 `environment` 항목에 `${...}`가 있으면 `undetermined`, 그 밖에 있으면 보호한다. §3의 의미 비교는 옮기거나 흡수한 항목을 뺀 compose로 한다.
5. **보고**: 서버마다 `imported` | `compose protected` | `refused`와 경고(고정한 `EXTRA_ARGS`, `environment` 충돌, 다시 만든 옛 nip.io 호스트, 엄격 규칙 위반 값).

**실행 시점**: `load`가 `server.yaml`이 없으면 메모리에서 가져오고 첫 쓰기가 파일을 저장한다(읽기는 쓰지 않는다). `mcctl migrate spec [<name>|--all] [--dry-run] [--force]`는 가져오기·흡수·렌더링을 하고 보고한다(멱등). `mcctl upgrade`는 `server.yaml`이 없는 서버와 `migrate spec --dry-run` 결과를 출력만 하고 아무것도 쓰지 않는다. 한 번도 가져오지 않은 서버는 v2.x에서 지금처럼 동작하고, 손으로 복사해 넣은 서버도 첫 쓰기에서 채택된다.

## 5. provision(`create-server.sh` 대체)

`CreateServerUseCase`에 선택 인자 `specRepo?`, `hostnames?`, `runtime?`(#670의 `assignments?` 뒤)를 추가하고 `executeWithConfig(config, options?: { onProgress?, onLog? })`로 바꾼다. `specRepo`가 없으면 deprecated 셸 경로를 쓴다.

| # | `create-server.sh` | TS provision | 진행 |
|---|--------------------|--------------|------|
| 0 | 인자 해석, 이름·월드 옵션 배타·env 값·모드팩 slug 검증 | `buildCreateSpec`(순수) + 검증, #670 `checkAssign(..., { newServer: true })`. 통과 전에는 I/O 없음 | `initializing`(API) |
| 1–4 | 템플릿 복사, `sed`, include 추가, `docker compose config --quiet`, 실패 시 `.bak` 복원 | 한 번의 `specRepo.write(doc, { create: true })`: `mkdir` 선점, `server.yaml`, 렌더링, include 항목(다시 읽어 확인). `docker compose config`는 뺀다: 파일은 `js-yaml`로 생성하고, 깨진 프로젝트는 `start`가 보고한다 | `creating` |
| 5 | avahi `<n>.local` → 첫 IP, 최선 노력 | `hostnames.register('<n>.local', hostIps[0])`, 건너뛰면 경고 | `configuring` |
| 6 | `--no-start`가 아니면 `docker compose up -d`, `sleep 2`, `ps` | `autoStart === false`가 아니면 `runtime.start('mc-<n>')`, sleep 없음 | `starting` |

- **이벤트**: API `server-create` SSE와 콘솔 `CreateServerStatus`가 이미 정의한 상태(`creating`, `configuring`, `starting`)를 쓰고, `onLog`는 `server-create-log`가 된다. `completed`/`error`는 stderr 문자열이 아니라 결과로 정한다(#658). 클라이언트 연결이 끊기면 이벤트만 멈춘다.
- **시작 실패**(결정 1): CLI는 원인과 `mcctl start <n>` 안내 후 종료 코드 1. API는 `201`/SSE `completed`에 `server.status: 'created'`와 `warning`. PR 3에서 콘솔 `CreateServerStatus` 처리가 이 경고를 어떻게 보여 주는지 확인한다.
- **정리(#657)**: `write({ create: true })`는 전부 아니면 전무다. 선점 뒤 실패하면 추가한 include 항목과 만든 디렉터리를 지우고 오류를 던진다. `worlds/`는 건드리지 않는다. 생성 중 프로세스가 죽으면 `servers/<n>`이 남을 수 있고 `mcctl delete <n>`으로 지운다(`ponytail:` 표시 파일 없음).
- **avahi 어댑터**는 `README.md` sudoers 줄이 허용하는 명령을 셸 없이 argv로 실행한다: `sudo -n tee -a /etc/avahi/hosts`(stdin `<ip> <host>`), `sudo -n systemctl restart avahi-daemon`. sudo 비밀번호는 환경 변수가 아니라 어댑터 옵션으로 받는다. CLI는 `--sudo-password`, `MCCTL_SUDO_PASSWORD`, 또는 `promptSudoPasswordIfNeeded`가 물은 값(sudo가 아니라 mcctl이 묻는다)을, API는 요청의 `sudoPassword`를 넘긴다. 비밀번호가 있으면 `sudo -S -p '' -v`가 stdin으로 먼저 읽고 명령에는 전달되지 않는다(#682). 없으면 `sudo -n`으로 NOPASSWD나 캐시된 자격에 기대고, 실패하면 경고다.

**옵션 동등성**: 영어판 §5 표가 CLI와 API가 넘기는 모든 옵션을 대응시킨다. 요점: `-t`의 위치 인자 형식은 없앤다. 모드팩 타입에 버전이 없으면 `VERSION`을 쓰지 않는다. 메모리를 반영한다(#737). `--modpack`/`--modpack-version`/`--mod-loader`/`--exclude-files`는 `MODRINTH`면 `MODRINTH_MODPACK`/`MODRINTH_VERSION`/`MODRINTH_LOADER`/`MODRINTH_EXCLUDE_FILES`, `AUTO_CURSEFORGE`면 `CF_SLUG`/`CF_VERSION`/`CF_LOADER`/`CF_EXCLUDE_MODS`. 화이트리스트는 `ENABLE_WHITELIST`/`WHITELIST`(`--no-whitelist` 우선). **의도된 차이**: 스크립트는 호스트 IP를 찾았을 때만 `--playit-domain` 값을 라우터 호스트에 넣었지만 TS는 항상 넣는다. `--no-playit-domain`과 `--start`는 아무것도 하지 않는다.

**bats → vitest**: `get_host_ip` 4개 → `resolveHostIps`. `register_avahi_hostname` 5개 → 가짜 `sudo`/`avahi-daemon`으로 avahi 어댑터 시험. 생성 시험 → 임시 루트에서 provision 시험(실패 뒤 재시도 성공 포함). "compose config 실패 시 중단" → "`servers/compose.yml`을 읽지 못하면 아무것도 쓰지 않고 중단". 심링크 `_template` → "렌더러는 `templatesDir`에 쓰지 않는다". 화이트리스트 3개 → 렌더링 시험. `sudo-password.bats`는 #735까지 남는다.

## 6. 쓰기 경로

모두 PR 3에서 바꾼다. 모든 쓰기는 `updateServerSpec(repo, name, mutate)`를 거친다. `setEnvKey`가 관리 키를 타입 필드로 바꾼다.

| 지금 쓰는 곳 | 대상 | PR 3 |
|--------------|------|------|
| CLI `config`, `whitelist`, `op`(`writeConfigValue`) | `config.env` 키 | `setEnvKey`(`LEVEL`/`WORLD_NAME`은 #670 배정 경로) |
| API `ConfigService`, `PlayerFileService`, `ModConfigService`, CLI `mod` | `config.env` 키 | `setEnvKey` |
| `setServerPlayitDomain`(CLI·API playit) | `PLAYIT_DOMAIN`, 호스트 라벨 | `routing.playitDomain`, 본문 위임 후 `@deprecated` |
| API `HostnameService.update` | 호스트 라벨(정규식) | `routing.customHostnames` |
| CLI `init --reconfigure` | 모든 호스트 라벨(정규식) | 스펙 변경 없이 모든 서버 다시 렌더링 |
| CLI `update` | 이미지 태그, loading-MOTD 라벨 | `doc.image`, 라벨은 템플릿에서 |
| CLI upgrade `server-env-migration` | `env_file` 경로 | **#736까지 유지**: 가져오지 않은 서버가 남기 때문(결정 4) |
| `ConfigEnvWorldAssignmentAdapter.assign/release`(#670) | `LEVEL` | 저장소를 거쳐 `world.level` |
| `WorldManagementUseCase` → `shell.setServerConfig` | `SEED`, `LEVEL` | `setEnvKey` |
| `mcctl migrate worlds`(#655) | `EXTRA_ARGS`, `LEVEL` | `allowStorageChange`와 함께 `world.storage = 'universe'` |
| 설정 스냅샷 복원 | `config.env`, compose | 스냅샷에 `server.yaml`이 있으면 복원 후 렌더링(`KNOWN_CONFIG_FILES`에 추가), 옛 스냅샷은 파일을 쓴 뒤 흡수 |
| `create-server.sh` / `delete-server.sh` | 전부 | provision(§5) / #735의 `repo.delete` |

**#670과 원천 하나.** 쓰기는 `server.yaml`만 바꾸고 `config.env`의 `LEVEL`은 그 투영이다. ADR-0002 어댑터는 컨테이너가 실제로 쓰는 `config.env`를 계속 *읽고*, *쓰기*는 저장소를 거친다. `worldAssignment.ts`의 순수 규칙은 그대로이고, `world.storage === 'data'`가 ADR-0002의 `internal: true`다.

## 7. 단계

| PR | 내용 | 동작 변화 |
|----|------|-----------|
| 1 스키마+가져오기 | `ServerSpecDocument`, 검증, `buildCreateSpec`, `load`(+ v2 `list`/`get` 구현)와 가져오기(읽기 전용), `mcctl migrate spec --dry-run`, 지금 `create-server.sh` 출력의 골든 파일(3단계 동등성 기준) | 없음 |
| 2 렌더러+쓰기 | `ServerSpecRenderer`, `DockerComposeRenderer`, 헤더·수정 감지, `write`/`save`(리비전, 선점, 되돌리기, 월드 보호), `mcctl migrate spec` 쓰기, `upgrade` 보고 | `migrate spec`만 씀 |
| 3 쓰기 경로(#715 S8) | `register`와 avahi 어댑터, provision, CLI·API 생성(SSE, 시작 실패 경고, 콘솔 확인), §6 전체, `create-server.sh`와 bats 3개 삭제, `IShellPort.createServer`·`ShellAdapter.createServer`·`Server.toCliArgs`·`WorldOptions.toCliArgs`·`setServerPlayitDomain`·`replaceRouterHosts`·`IServerSpecRepository.get`에 `@deprecated`, 저장소 어댑터 밖에서 `config.env`나 서버 compose를 쓰면 실패하는 시험(허용 목록: `server-env-migration`), 문서 EN/KO, `test:scripts`·`verify:package` 통과. 3a·3b로 나눌 수 있다 | 있음 |

#675의 완료 조건 8개는 PR 3에서 모두 충족되므로 **#675는 PR 3 뒤에 닫는다**. 이전의 4단계("이전 형식 지원 종료")는 쓰기 보호 시험과 문서로 줄여 PR 3에 합쳤다. PR 3부터 `server-env-migration` 말고는 이전 방식으로 쓰는 코드가 없다. `server.yaml`이 없는 서버는 지연 가져오기로 계속 지원한다. **#736(v3.0.0)으로 미루는 것**: 위 `@deprecated` export, `IShellPort`/`ShellAdapter`, `server-env-migration` 삭제. v3.0.0에서 ServerSpec 동작은 바뀌지 않는다.

순서: PR 1–2는 #749(#656) 머지 뒤, PR 3은 #670 머지 뒤, #735는 PR 3 뒤.

## 8. 시험(TDD)

각 PR에서 실패하는 시험을 먼저 추가한다. 세부 목록은 영어판 §8.

- **v2 호환**: v2 계약으로 쓴 코드가 컴파일된다(`const s: ServerSpec = { name: 'a' }`, v2 타입으로 `list`/`get`/`save`/`delete` 호출). 패키지 루트가 `ServerSpec`과 `IServerSpecRepository`를 계속 export한다. `save({ name })`는 빠진 필드를 나열한 `invalid_spec`.
- 도메인(검증표, `buildCreateSpec` 옵션별, 호스트명 생성기), 가져오기(옛 템플릿, 따옴표·주석·중복 키, 상속과 `--universe` 형식은 ADR-0002와 같은 fixture, 보간 거부, compose `environment` 충돌 보고, compose `${...}`, image·라벨 흡수, 그 밖의 수정 보호), 렌더링(멱등, 스펙이 그대로면 쓰기 없음, 주석 보존, 헤더, 두 감지표, include 정확 일치·다시 읽기 재시도, 읽지 못한 `servers/compose.yml` 보존), 저장소(리비전 충돌·재시도, 선점, 실패 뒤 되돌리기와 재시도 성공, 월드 보호), 호스트 IP(우선순위, 가짜 바이너리로 탐지 순서, `docker0`/`br-*` 제외), provision·API(골든 동등성, 이벤트 순서, 시작 실패 → `completed` + `created` + `warning`, 이름에 `error`가 든 서버, sudoers와 같은 avahi argv, 비밀번호는 `-S -v`에만 쓰고 자식 환경에 넣지 않음), 쓰기 경로(§6 행마다 하나).

## 결과

- **+** 서버마다 정의가 하나이고 compose는 생성물이므로 k8s 작업(#641)은 호출처를 고치지 않고 렌더러를 추가한다.
- **+** 호스트명 생성, env 쓰기, YAML 편집이 각각 구현 하나로 줄고 정규식 YAML 편집이 없어진다.
- **+** 생성이 실패하면 스스로 정리하고, 실제 진행 상황을 알리며, bash 없이 동작한다.
- **+** `IServerSpecRepository`/`ServerSpec`의 v2 소비자 코드가 그대로 컴파일된다.
- **−** 렌더링된 compose와 `servers/compose.yml`의 주석은 사라진다.
- **−** 스펙 소유 필드가 아닌 compose 수정이 있으면, 되돌리거나 강제로 다시 렌더링할 때까지 compose를 바꾸는 쓰기가 막힌다.
- **−** 파생 상태 두 가지(헤더 해시, 리비전)가 정확해야 한다. 수정 감지표가 시험 계약이다.
- **−** v3.0.0까지 저장소에 v2 `get`/`save`와 `load`/`write`가 함께 있다.
