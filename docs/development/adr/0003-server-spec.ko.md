# ADR-0003: ServerSpec, 서버 정의를 하나로

| | |
|---|---|
| **상태** | 제안(2026-10-23) |
| **이슈** | [#675](https://github.com/smallmiro/minecraft-server-manager/issues/675)(강건화 D5, 마일스톤 M4 #645). #715 S8(`create-server.sh` 교체) 포함 |
| **바꾸는 ADR** | [ADR-0001](0001-container-runtime-ports.ko.md): `IServerSpecRepository` 확정, `IHostnameRegistrarPort.register`/`unregister` 추가 |
| **기반** | [ADR-0002](0002-world-server-assignment.ko.md)(#670, 배정의 원천은 `LEVEL`. 머지 전까지 `feature/670-world-server-assignment`에 있음), PR #749(#656: env 코덱, `atomicWriteFile`, API 생성·삭제 대기열), #651, #649, #654 |
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
4. **`config.env`는 계속 손으로 고칠 수 있다.** 헤더 해시로 수정을 감지하고 다음 쓰기 전에 스펙에 흡수한다. compose의 수동 수정은 조용히 덮어쓰지 않는다.
5. **새 포트 없음**(#715). 예약해 둔 `IServerSpecRepository`를 구현하고, 렌더링은 그 어댑터 안의 인프라 세부 사항으로 둔다. `IHostnameRegistrarPort`에 `register`(#735용 `unregister`)를 추가한다.
6. **잠금 파일 없음.** 생성은 `mkdir`로 디렉터리를 선점하고, 수정은 낙관적 리비전(`server.yaml`의 sha256)으로 충돌을 막는다. #749의 API 내부 대기열은 그대로 둔다.
7. **가져오기는 지연·멱등.** `server.yaml`이 없는 서버는 첫 쓰기 때 메모리에서 가져온다. `mcctl migrate spec`으로 명시적으로 가져오고, 4단계부터 `mcctl upgrade`가 전부 가져온다. 한 번도 가져오지 않은 서버도 지금처럼 동작한다.
8. **provision이 `create-server.sh`를 대신한다.** `CreateServerUseCase` 안에서 API SSE가 이미 쓰는 이름으로 진행 이벤트를 내고, 실패하면 전부 되돌려 바로 다시 시도할 수 있게 한다.

## 1. 스키마

타입 정의와 YAML 예시는 영어판 §1을 그대로 쓴다. 필드: `specVersion: 1`, `name`, `type`, `version?`, `memory?`, `image`, `world { level, storage: universe|data }`, `routing { customHostnames[], playitDomain?, autoScale { up, down }, asleepMotd?, loadingMotd? }`, `env`.

| 필드 | 생성 | 가져오기·가져온 스펙 저장 |
|------|------|--------------------------|
| `name` | `ServerName`(DNS-1123, 예약어, #649), 디렉터리 이름과 같아야 함 | `EXISTING_SERVER_NAME_PATTERN` |
| `world.level` | `WORLD_NAME_PATTERN`, `*_nether`/`*_the_end` 금지(ADR-0002) | `EXISTING_WORLD_NAME_PATTERN` |
| `type`, `version`, `memory` | `ServerType`, `McVersion`, `Memory` | env 값 규칙 |
| 호스트명, `playitDomain` | 호스트명 규칙(`HostnameService`에서 도메인으로 이동) | 같음 |
| `env` 키·값 | `ENV_KEY_RE` / `assertEnvFileValue`(#726) | 같음 |

- 생성은 엄격한 값 객체로, 가져오기는 지금 동작하는 값을 받아들이고 엄격 규칙 위반만 보고한다(C1 #7: 알 수 없는 `TYPE`, 스냅샷 `VERSION` 서버가 사라지면 안 된다).
- **관리 키**(`TYPE`, `VERSION`, `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`)는 `env`에 둘 수 없다. `env.EXTRA_ARGS`는 허용하지만 `--universe`는 넣을 수 없다(`world.storage`가 맡음).
- **엄격한 파일**: 알 수 없는 최상위 키와 문자열이 아닌 스칼라는 경로와 함께 거부한다(`version: 1.21`은 float이므로 따옴표를 쓰라고 안내).
- **`specVersion`**: 선택 필드 추가는 올리지 않는다. 호환이 깨지면 올리고, 읽을 때 메모리에서 변환해 다음 저장에 쓴다. 더 높은 버전은 거부한다(mcctl 업그레이드 안내).
- **비밀값**: 버전 1에는 `secretRefs`가 없다. 사용자가 `config.env`에 넣은 비밀값(`CF_API_KEY` 등)은 `env`에 들어간다. `server.yaml`은 `config.env`와 같은 파일 모드를 쓰고, 설정 스냅샷에 함께 들어가며, API로 반환하지 않는다. #641이 선택 필드로 추가한다.
- **계획서 §9.2와 다른 점**(열린 질문 6): `world.source`·`modpack`·`whitelist`는 `env` 키로 둔다. `imageTag` 대신 `image`(사용자 이미지도 손실 없음). `stopGraceSec`·`resources`는 A2/C3에서 추가한다.

## 2. 저장과 동시성

- `servers/<n>/server.yaml`, 고정 키 순서, `atomicWriteFile`(#749).
- **생성**: `mkdir servers/<n>`(재귀 아님)이 선점이다. `EEXIST`는 `already_exists`. CLI와 API 프로세스 사이에서도 동작한다.
- **수정**: `get`이 읽은 바이트의 sha256을 `revision`으로 돌려주고, `save`는 rename 직전에 다시 읽어 비교한다. 다르면 `conflict`이고 `updateServerSpec`이 한 번 재시도한다. `ponytail:` 비교와 rename 사이 마이크로초 창은 남는다. 실제로 갱신 손실이 보이면 `mkdir` 잠금을 추가한다.
- **저장 순서**: `server.yaml` 먼저, 그다음 생성물. 중간에 죽으면 생성물의 해시는 맞고 `spec=`만 이전 값이므로(§3), 다음 저장이나 `mcctl migrate spec`이 다시 렌더링해 중단된 저장을 마무리한다.

## 3. 렌더링

- **경계**: 인프라 내부 인터페이스 `ServerSpecRenderer { render(spec, ctx), renderRemoval(name, ctx) }`. `FileServerSpecRepository`(`IServerSpecRepository` 어댑터)가 생성자로 받는다. 애플리케이션 코드는 렌더러를 부르지 않으므로 포트가 아니다. 런타임을 바꾸려면 컴포지션 루트에서 다른 렌더러로 저장소를 만든다. 지금은 `DockerComposeRenderer`만 구현하고, `KubernetesManifestRenderer`(StatefulSet, Service, PVC)는 #641까지 인터페이스로만 둔다. k8s에서는 `save`가 렌더링과 적용을 하므로 ADR-0001의 `apply(spec)`는 필요 없다.

| 파일 | 방법 | 수정 감지 |
|------|------|-----------|
| `config.env` | 현재 내용(생성 시 번들 템플릿)에 `applyEnvChanges(..., { raw: true })`. 값이 다른 키만 바꾸고 스펙에 없는 키는 지운다. 손대지 않은 줄(주석, 따옴표 값)은 바이트 그대로 | 예 |
| `docker-compose.yml` | 번들 `_template/docker-compose.yml`을 `js-yaml`로 읽어 서비스 키·`container_name`(`mc-<n>`), `image`, 라우터 라벨을 설정하고 `dump` | 예 |
| `servers/compose.yml` | `js-yaml`로 읽어 `<n>/docker-compose.yml`과 같은 항목이 없으면 추가, 다른 항목(긴 형식 포함)은 유지 | 아니오(병합) |
| `data/`, `logs/`, `servers/global.env` | `mkdir -p`, `global.env`가 없으면 템플릿에서 복사(스크립트와 같음) | — |

- **env 투영**: `TYPE`, `VERSION`(없으면 생략), `MEMORY`, `LEVEL`, `PLAYIT_DOMAIN`, `EXTRA_ARGS`, 그다음 `env`. `universe`면 `EXTRA_ARGS` = `--universe /worlds/` + `env.EXTRA_ARGS`, `data`면 `env.EXTRA_ARGS ?? ''`(빈 값도 `global.env`보다 우선, ADR-0002).
- **라우터 호스트명**: `<n>.local`, `hostIps`마다 `<n>.<ip>.nip.io`, `playitDomain`, `customHostnames`(중복 제거). 이 생성기 하나가 `build_hostnames`, `init.ts`의 `buildHostnames`/`mergeHostnames`, `HostnameService`의 시스템 부분을 대신한다(B4). `hostIps`는 `.env`의 `HOST_IPS`, 없으면 `HOST_IP`, 없으면 내부가 아닌 첫 IPv4다.
- **헤더**(감지 대상 파일 첫 줄): `# Generated by mcctl from server.yaml; edits are detected (ADR-0003). mcctl:sha256=<64 hex> spec=<12 hex>`. `sha256`은 나머지 내용의 해시, `spec`은 렌더링 원본 `server.yaml` 리비전의 앞부분이다. 다른 상태 파일은 없다.
- **멱등**: 두 번 렌더링해도 같은 바이트이고, 바뀐 것이 없으면 아무것도 쓰지 않는다.

**수정 감지**(`get` 시점)

| `config.env` | 의미 | 처리 |
|--------------|------|------|
| 해시 일치, `spec=` 현재 | 동기화됨 | — |
| 해시 일치, `spec=` 이전 | `server.yaml`을 손으로 고침 | 다음 저장에서 렌더링 |
| 해시 불일치 또는 헤더 없음 | `config.env`를 고침(또는 렌더링된 적 없음) | 스펙에 흡수(가져오기 1단계와 같음) |
| 해시 불일치, `spec=` 이전 | 둘 다 고침 | `edit_conflict`. `mcctl migrate spec <n> --force`가 `config.env.bak`을 남기고 `server.yaml`로 다시 렌더링 |

| `docker-compose.yml` | 처리 |
|----------------------|------|
| 해시 일치 | 자유롭게 덮어씀(새 mcctl의 템플릿 변경도 반영) |
| 헤더 없음, 알려진 옛 형식(env_file `../../.env` #685, loading-MOTD 라벨 없음)을 정규화하면 `render(spec)`과 의미상 같음 | 채택하고 덮어씀 |
| 그 밖(수동 수정) | 생성 compose를 바꾸는 저장은 `compose_edited`(다른 YAML 경로 목록)로 실패하고, 바꾸지 않는 저장은 파일을 그대로 둔다. `--force`는 `docker-compose.yml.bak`을 남기고 덮어씀 |

## 4. 기존 설치본 가져오기

1. **`config.env`**(`parseEnvDocument`): `TYPE`, `VERSION`, `MEMORY`, `PLAYIT_DOMAIN`은 타입 필드로. `world.level` = `resolveWorldName(env)`(`LEVEL`, 없으면 `WORLD_NAME`, 없으면 `world`. `WORLD_NAME`은 `env`에 남김). 나머지 키는 파일 순서대로 `env`에(알 수 없는 키 보존).
2. **저장 위치**: ADR-0002의 해석을 재사용해 *실제* `EXTRA_ARGS`로 정한다(`config.env`가 빈 값이어도 우선, 없으면 `global.env`, 값 없는 키는 `.env` 값). `--universe /worlds[/]`는 `universe`, `--universe` 없음·`/data`·`.`는 `data`. `--universe` 토큰을 빼고 나머지는 `env.EXTRA_ARGS`로. 디렉터리는 교차 확인만 한다(`worlds/<level>`이 없고 `servers/<n>/data/<level>`이 있으면 경고).
3. **fail-closed**(R7과 같은 방식): 보간되는 관리 키 값(`${...}`)이나 다른 `--universe` 위치는 `undetermined`다. 그 서버는 가져오지 않고 계속 동작하며, 파일을 고칠 때까지 그 서버에 대한 쓰기는 이유와 함께 실패한다.
4. **compose**: 서비스 `mc-<n>` 하나를 기대한다. `image`와 라우터 라벨은 `routing`으로, 호스트명은 시스템(`<n>.local`, `<n>.<IPv4>.nip.io`, playit 도메인)과 사용자 지정으로 나눈다. `EULA`가 아닌 `environment` 항목은 `env`로 옮긴다(둘 다 `global.env`보다 우선하므로 실제 값은 같다). 그다음 §3의 compose 규칙으로 채택 또는 보호를 정한다.
5. **보고**: 서버마다 `imported` | `compose protected` | `refused`와 경고(`global.env`에서 고정한 `EXTRA_ARGS`, 현재 `HOST_IPS`로 다시 만든 옛 nip.io 호스트, 엄격 규칙 위반 값).

**실행 시점**: `get`이 `server.yaml`이 없으면 메모리에서 가져오고 첫 저장이 파일을 쓴다(읽기는 쓰지 않는다). `mcctl migrate spec [<name>|--all] [--dry-run] [--force]`는 명시적으로 가져오기·흡수·렌더링을 하고 보고한다(멱등, `migrate worlds`와 같은 명령 묶음). 4단계부터 `mcctl upgrade`가 `migrate spec --all`을 실행한다. 한 번도 가져오지 않은 서버는 v2.x에서 지금처럼 동작한다. 손으로 복사해 넣은 서버 디렉터리도 첫 쓰기에서 채택된다.

## 5. provision(`create-server.sh` 대체)

`CreateServerUseCase`에 선택 인자 `specRepo?`, `hostnames?`, `runtime?`(#670의 `assignments?` 뒤)를 추가하고 `executeWithConfig(config, options?: { onProgress?, onLog? })`로 바꾼다. `specRepo`가 없으면 deprecated 셸 경로를 쓴다. 대화형 `execute`와 `executeWithConfig`가 같은 흐름을 쓰고, API 라우트는 스크립트 대신 유스케이스를 부른다.

| # | `create-server.sh` | TS provision | 진행 |
|---|--------------------|--------------|------|
| 0 | 인자 해석, 이름·월드 옵션 배타·env 값·모드팩 slug 검증 | `buildCreateSpec`(순수) + `validateServerSpec`, #670 `checkAssign(..., { newServer: true })`. 통과 전에는 I/O 없음 | `initializing`(API) |
| 1–4 | 템플릿 복사, compose·`config.env` `sed`, include 추가, `docker compose config --quiet`, 실패 시 `.bak` 복원 | 한 번의 `specRepo.save(spec, { create: true })`: `mkdir` 선점, `server.yaml`, 렌더링, include 항목, include를 추가할 때만 `docker compose config --quiet`(Docker 어댑터 코드) | `creating` |
| 5 | avahi `<n>.local` → 첫 IP, 최선 노력 | `hostnames.register('<n>.local', hostIps[0])`, 건너뛰면 경고 | `configuring` |
| 6 | `--no-start`가 아니면 `docker compose up -d`, `sleep 2`, `ps` | `autoStart === false`가 아니면 `runtime.start('mc-<n>')`, sleep 없음 | `starting` |

- **이벤트**: API `server-create` SSE와 콘솔 `CreateServerStatus`가 이미 정의한 상태(`creating`, `configuring`, `starting`)를 쓴다. `onLog`는 `server-create-log`가 된다. API는 `initializing`을 먼저 보내고, `completed`/`error`는 stderr 문자열이 아니라 결과로 정한다(#658). 클라이언트 연결이 끊기면 이벤트만 멈추고 생성은 계속한다(지금은 스크립트를 중간에 죽인다).
- **정리(#657)**: `save({ create: true })`는 전부 아니면 전무다. 선점 뒤 실패하면 추가한 include 항목과 만든 디렉터리를 지우고 오류를 던지므로 바로 다시 시도할 수 있다. `worlds/`는 건드리지 않는다. 호스트명 등록은 지금처럼 최선 노력이다. 시작 실패는 열린 질문 1. 생성 중 프로세스가 죽으면 `servers/<n>`이 남을 수 있고 `mcctl delete <n>`으로 지운다(`ponytail:` 표시 파일 없음).
- **avahi 어댑터**는 `README.md` sudoers 줄이 허용하는 명령을 그대로 쓴다: `sudo -n tee -a /etc/avahi/hosts`(stdin `<ip> <host>`), `sudo -n systemctl restart avahi-daemon`. `MCCTL_SUDO_PASSWORD`가 있으면 먼저 `sudo -S -p '' -v`로 인증하고 비밀번호는 명령에 전달되지 않는다(#682). 없으면 stdin이 TTY일 때 stdio를 물려줘 지금처럼 묻고, 아니면 `sudo -n`으로 바로 실패한다(API가 멈추지 않음). 정확 일치(#660), IPv4 검사, `getStatus`로 avahi 확인. API는 요청의 `sudoPassword`를 `env`에 넣어 요청마다 어댑터를 만든다.

**옵션 동등성**: 영어판 §5 표가 CLI와 API가 넘기는 모든 옵션을 스펙 필드로 대응시킨다. 요점: `-t`의 위치 인자 형식은 호출처가 없어 없앤다. 모드팩 타입에 버전이 없으면 `VERSION`을 쓰지 않는다. 메모리는 그대로 반영한다(#737). seed·월드 URL은 `env.SEED`·`env.WORLD`, 모드팩 옵션은 `MODRINTH_*` 또는 `CF_*`, 화이트리스트는 `ENABLE_WHITELIST`/`WHITELIST`(`--no-whitelist` 우선), `--no-playit-domain`은 스크립트처럼 아무것도 하지 않는다.

**bats → vitest**: `get_host_ip` 4개 → `resolveHostIps`. `register_avahi_hostname` 5개 → `PATH`의 가짜 `sudo`/`avahi-daemon`으로 avahi 어댑터 시험. 생성 4개 → 임시 루트에서 provision 시험(실패 뒤 재시도 성공 포함). 심링크 `_template` → "렌더러는 `templatesDir`에 쓰지 않는다". 화이트리스트 3개 → 번들 템플릿과 `ENABLE_WHITELIST=TRUE`가 든 옛 템플릿으로 렌더링 시험. `sudo-password.bats`는 #735까지 남는다.

## 6. 쓰기 경로(3단계)

모든 쓰기는 `updateServerSpec(repo, name, mutate)`를 거친다. `setEnvKey`가 관리 키를 타입 필드로 바꾸므로 범용 설정 쓰기에 키 목록이 필요 없다.

| 지금 쓰는 곳 | 대상 | 3단계 |
|--------------|------|-------|
| CLI `config`, `whitelist`, `op`(`writeConfigValue`) | `config.env` 키 | `setEnvKey`(`LEVEL`/`WORLD_NAME`은 #670 배정 경로) |
| API `ConfigService`, `PlayerFileService`, `ModConfigService`, CLI `mod` | `config.env` 키 | `setEnvKey` |
| `setServerPlayitDomain`(CLI·API playit) | `PLAYIT_DOMAIN`, 호스트 라벨 | `routing.playitDomain`, 본문 위임 후 `@deprecated` |
| API `HostnameService.update` | 호스트 라벨(정규식) | `routing.customHostnames` |
| CLI `init --reconfigure` | 모든 호스트 라벨(정규식) | 스펙 변경 없이 모든 서버 다시 렌더링 |
| CLI `update` | 이미지 태그, loading-MOTD 라벨 | `spec.image`, 라벨은 템플릿에서 |
| CLI upgrade `server-env-migration` | `env_file` 경로 | 렌더링이 옛 형식으로 처리(4단계에서 삭제) |
| `ConfigEnvWorldAssignmentAdapter.assign/release`(#670) | `LEVEL` | 저장소를 거쳐 `world.level` |
| `WorldManagementUseCase` → `shell.setServerConfig` | `SEED`, `LEVEL` | `setEnvKey` |
| `mcctl migrate worlds`(#655) | `EXTRA_ARGS`, `LEVEL` | `world.storage = 'universe'` |
| 설정 스냅샷 복원 | `config.env`, compose | 스냅샷에 `server.yaml`이 있으면 복원 후 렌더링(`KNOWN_CONFIG_FILES`에 추가), 옛 스냅샷은 파일을 쓴 뒤 흡수 |
| `create-server.sh` / `delete-server.sh` | 전부 | provision(§5) / #735의 `repo.delete` |

**#670과 원천 하나.** 쓰기는 `server.yaml`만 바꾸고 `config.env`의 `LEVEL`은 그 투영이다. ADR-0002 어댑터는 계속 `config.env`를 *읽는다*. 컨테이너가 실제로 쓰는 값(아직 흡수되지 않은 수동 수정 포함)이기 때문이다. *쓰기*는 저장소를 거치므로 `assign`/`release`가 `config.env`를 직접 쓰지 않는다. `worldAssignment.ts`의 순수 규칙은 그대로이고, `world.storage === 'data'`가 ADR-0002의 `internal: true`다.

## 7. 단계

| PR | 내용 | 동작 변화 |
|----|------|-----------|
| 1 스키마+가져오기 | 도메인 `ServerSpec`, 검증, `buildCreateSpec`, `IServerSpecRepository` 확정(공개 `ServerSpec` 이름 유지), `get/list`와 가져오기(읽기 전용), `mcctl migrate spec --dry-run`, 지금 `create-server.sh` 출력을 옵션 조합마다 골든 파일로 저장(3단계 동등성 기준) | 없음 |
| 2 렌더러+저장 | `ServerSpecRenderer`, `DockerComposeRenderer`, 헤더·수정 감지, `save`(리비전, 선점, 되돌리기), `mcctl migrate spec` 쓰기 | `migrate spec`만 씀 |
| 3 쓰기 경로(#715 S8) | `register`와 avahi 어댑터, provision, CLI·API 생성(SSE), §6 전체, `create-server.sh`와 bats 3개 삭제, `IShellPort.createServer`·`ShellAdapter.createServer`·`Server.toCliArgs`·`WorldOptions.toCliArgs`·`setServerPlayitDomain`·`replaceRouterHosts`에 `@deprecated`, `test:scripts`·`verify:package` 통과. 3a(생성)·3b(나머지)로 나눌 수 있다 | 있음 |
| 4 이전 형식 지원 종료(v2.x) | `mcctl upgrade`가 전부 가져오고 보고, 옛 형식 패치 전용 코드 삭제(`server-env-migration`, `update`의 라벨 패치, `init`·`HostnameService` 정규식), 저장소 어댑터 밖에서 `config.env`나 서버 compose를 쓰면 실패하는 시험, 문서 EN/KO | upgrade 때 `server.yaml` 생성 |

v2.x에서 "이전 형식 지원 종료"는 **이전 방식으로 쓰는 코드가 하나도 없다**는 뜻이다. `server.yaml`이 없는 서버를 거부하지는 **않는다**. 지연 가져오기는 계속 남으므로(손으로 복사한 서버를 채택하는 방법이기도 하다) 깨지는 것이 없고, PR 4 뒤에 #675를 닫는다. **#736(v3.0.0)으로 미루는 것**: 위 `@deprecated` export와 `IShellPort`/`ShellAdapter` 삭제. v3.0.0에서 ServerSpec 동작은 바뀌지 않는다.

순서: PR 1–2는 #749(#656) 머지 뒤, PR 3은 #670 머지 뒤, #735는 PR 3 뒤.

## 8. 시험(TDD)

각 PR에서 실패하는 시험을 먼저 추가한다. 도메인(검증표, `buildCreateSpec` 옵션별, 호스트명 생성기), 가져오기(템플릿·옛 템플릿, 따옴표·주석·중복 키, `WORLD_NAME`, `global.env`/`.env` 상속과 `--universe` 형식은 ADR-0002와 같은 fixture, 보간 거부, compose `environment`, 수정된 compose 보호), 렌더링(멱등, 변경 없으면 쓰지 않음, 주석 보존, 헤더, 두 감지표, include 정확 일치), 저장소(리비전 충돌·재시도, 선점, 실패 뒤 되돌리기와 재시도 성공), provision·API(골든 동등성, 이벤트 순서, `--no-start`, SSE 순서, 이름에 `error`가 든 서버, sudoers와 같은 avahi argv), 쓰기 경로(§6 행마다 하나, #670 배정 시험 유지). 세부 목록은 영어판 §8.

## 결과

- **+** 서버마다 정의가 하나이고 compose는 생성물이므로 k8s 렌더러는 추가만 하면 된다(#641).
- **+** 호스트명 생성, env 쓰기, YAML 편집이 각각 구현 하나로 줄고 정규식 YAML 편집이 없어진다.
- **+** 생성이 실패하면 스스로 정리하고, 실제 진행 상황을 알리며, bash 없이 동작한다.
- **−** 렌더링된 compose와 `servers/compose.yml`의 주석은 사라진다.
- **−** compose를 손으로 고친 서버는 되돌리거나 강제로 다시 렌더링할 때까지 compose를 바꾸는 쓰기가 막힌다.
- **−** 파생 상태 두 가지(헤더 해시, 리비전)가 정확해야 한다. 수정 감지표가 시험 계약이다.

## 열린 질문

1. **생성 성공 뒤 시작 실패**: (A, 권장) 서버는 생성된 상태로 두고 CLI는 종료 코드 1, API는 "생성됐지만 시작 실패, `mcctl start <n>`"으로 `error`를 보낸다. (B) 전부 되돌린다. #735의 `IContainerRuntimePort.remove`가 먼저 필요하다.
2. **compose 수동 수정**: (A, 권장) 보호 + `--force`(`.bak`). (B) 사용자 소유 `docker-compose.override.yml`도 지원(나중에 추가 가능).
3. **`global.env`/`.env`에서 상속된 `EXTRA_ARGS`**: (A, 권장) 가져올 때 실제 값을 `config.env`에 고정하고 보고. (B) 상속 유지(세 번째 저장 값 `inherit` 필요).
4. **4단계 `mcctl upgrade`**: (A, 권장) 모든 서버에 `server.yaml`을 쓴다. (B) 보고만 하고 지연 가져오기에 맡긴다.
5. **API 생성의 템플릿**: 지금 API는 `<root>/servers/_template`, CLI는 번들 템플릿을 쓴다. (A, 권장) 번들만(#651). (B) 사용자 사본이 있으면 우선.
6. **계획서 §9.2·이슈 본문과 다른 점**: `world.source`/`modpack`/`whitelist`를 `env` 키로, `imageTag` 대신 `image`, `secretRefs`/`stopGraceSec`/`resources` 연기, 서버별 잠금 대신 낙관적 리비전. 확인 필요.
7. **`.mcctl.json`의 `avahiEnabled: false`**: 스크립트는 무시한다. (A, 권장) 그대로 유지. (B) 등록을 건너뛴다.
8. **`unregister`의 sudoers 모양(#735)**: `README.md`는 `sed -i * /etc/avahi/hosts`를 허용하는데 #660의 bash는 `cp`/`tee`/`mv`를 쓴다. #735에서 문서의 sudoers 줄이 허용하는 명령으로 맞춰야 한다.
