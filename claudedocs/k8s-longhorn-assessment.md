# k3s + Longhorn 이전 가능성 점검 보고서

- 대상 저장소: `smallmiro/minecraft-server-manager` (작업 시점 HEAD, CLI `2.31.0`, `platform/services/cli/package.json:3`)
- 목표 환경: 라즈베리파이(arm64) 여러 대의 k3s 단일 클러스터 + Longhorn(replica 2, 노드별 USB SSD), local-path 미사용
- 작성일: 2026-10-12
- 추적 이슈: [#641](https://github.com/smallmiro/minecraft-server-manager/issues/641)(k8s 선택형 런타임 지원), 선행 작업 [#640](https://github.com/smallmiro/minecraft-server-manager/issues/640)(Pre-k8s Hardening, 계획은 `pre-k8s-hardening-plan.md`)
- 방식: 읽기 전용 분석. 코드 변경, 브랜치 생성, 커밋 없음. 이 문서만 새로 만들었음
- 표기 규칙
  - 저장소 근거는 `경로:라인`으로 적었다.
  - 외부 도구 동작은 공식 소스나 문서를 직접 읽은 경우에만 사실로 쓰고 URL을 달았다.
  - 확인하지 못한 내용은 **미확인**, 계산이나 경험에 기댄 내용은 **추정**으로 표시했다.
  - 외부 문서 확인 방법: mc-router(main, 2026-10-04 커밋 3b9fb8f), docker-minecraft-server, minecraft-server-charts, longhorn/website(docs 1.13.0), k3s-io/docs, metallb, better-sqlite3, BlueMap, playit-agent 저장소를 clone해서 읽었다. longhorn.io, readthedocs, sqlite.org 사이트는 이 환경에서 접속되지 않았다. 그래서 같은 문서의 GitHub 원본 URL을 출처로 달았다.

---

<a id="summary"></a>

## 1. 요약

### 결론

- **이전은 가능하다.** 다만 단순히 "compose를 매니페스트로 바꾸는" 작업이 아니다. **런타임 계층을 새로 써야 하는 수준의 중대형 작업**이다.
- **난이도: 중상(High-Medium).**
- **가장 쉬운 부분은 이미지 호환성이다.** 쓰는 이미지가 모두 arm64를 지원한다(§6).
- **월드/설정 데이터 유지 요구는 충족할 수 있다.** mc-router가 k8s 모드에서 **StatefulSet 0↔1 자동 스케일**을 공식 지원하므로(§4), "서버별 StatefulSet + Longhorn RWO PVC" 구조면 된다. Pod이 어느 노드에서 다시 떠도 같은 볼륨이 따라붙는다.
- **어려운 부분은 다음 세 가지다.**
  1. 공유 `/worlds/` 디렉터리 모델
  2. mcctl-api가 서버 데이터를 직접 파일로 읽고 쓰는 구조
  3. 코드 전반에 흩어진 Docker CLI 호출

### 가장 큰 장애물 3가지

| # | 장애물 | 이유(근거) |
|---|--------|-----------|
| 1 | **"모든 서버가 하나의 `/worlds/`를 공유하고, 월드는 `LEVEL` 값으로 골라 쓰는" 모델** | `templates/servers/_template/docker-compose.yml:43`, `templates/servers/_template/config.env:57`, `create-server.sh:487`. 이 모델을 그대로 옮기려면 Longhorn RWX(NFS)가 필요하다. 그런데 RWX는 장애 시 IO 차단, 90초 grace, "data loss may occur" 경고가 있다([rwx-volumes.md](https://github.com/longhorn/website/blob/master/content/docs/1.13.0/nodes-and-volumes/volumes/rwx-volumes.md)). 그래서 월드 볼륨을 RWO로 나눠야 하는데, 나누면 월드 재배정, lock, 백업, 통계, 맵 렌더링 로직이 모두 영향을 받는다(§3). |
| 2 | **Docker 호출이 포트(인터페이스) 바깥에도 퍼져 있음** | `shared/src/docker/index.ts`의 자유 함수(포트 없음), bash 스크립트 전체, mcctl-api route의 직접 `spawn('docker', …)`(`routes/servers.ts:580,665`), CLI `lib/shell.ts`. 도메인 계층은 깨끗하지만, 런타임을 갈아 끼울 단일 포트가 없다(§4). |
| 3 | **mcctl-api/console이 호스트 파일시스템 + PM2 + 로컬 SQLite를 전제함** | API가 각 서버의 `/data`와 월드 region 파일을 직접 읽고 쓴다(`routes/servers/files.ts:302`, `services/OpsJsonService.ts:16`, `routes/worlds.ts:145,163`). SQLite 파일은 CLI와 API가 함께 쓴다(`cli/src/infrastructure/di/container.ts:134`, `mcctl-api/src/services/audit-log-service.ts:36`). API/console용 Dockerfile도 없다(저장소의 Dockerfile은 `platform/docker/bluemap/Dockerfile`, `.devcontainer/Dockerfile` 둘뿐). SQLite는 NFS(RWX) 위에 두면 안 되므로, API/console을 한 Pod(또는 한 노드)에 묶어야 한다(§2, §5). |

---

<a id="storage"></a>

## 2. 스토리지 경로 인벤토리와 RWO/RWX 판단

### 2.1 사전 발견 사항 (판단에 영향을 주는 사실)

1. **루트 경로**
   - 모든 데이터는 `MCCTL_ROOT` 아래에 있다. 기본값은 `~/minecraft-servers`다(`platform/services/shared/src/utils/index.ts:99`).
   - 하위 경로는 `Paths` getter가 정한다: servers, worlds, `worlds/.locks`, `shared/plugins`, `shared/mods`, backups, `.services`, `.env`, `docker-compose.yml`(`utils/index.ts:144-196`).

2. **템플릿마다 월드 저장 위치가 다르다(중요).**
   - 저장소 루트 템플릿 `templates/servers/_template/config.env:57`과 `platform/servers/_template/config.env:57`에는 `EXTRA_ARGS=--universe /worlds/`가 있다.
   - npm으로 배포되는 CLI 템플릿 `platform/services/cli/templates/servers/_template/config.env`(`LEVEL=world`, 53행)에는 **`EXTRA_ARGS`가 없다.**
   - 실제 설치에서 쓰이는 템플릿은 CLI 패키지 쪽이다(`utils/index.ts:118-128`, `package.json:14` "files": templates).
   - 따라서 **npm으로 설치한 서버는 월드가 `servers/<name>/data/<LEVEL>`에 생기고, 공유 `/worlds/`를 실제로 쓰지 않을 수 있다.**
   - `mcctl migrate`가 이 줄을 추가하는 마이그레이션을 제공한다(`cli/src/commands/migrate.ts:373,467-476`).
   - 결론: 실제 운영 서버마다 월드가 어디 있는지 이전 전에 **인스턴스별로 조사해야 한다.**

3. **"심볼릭 링크 기반 월드 연결"은 현재 코드에서 만들어지지 않는다.**
   - `create-server.sh:20,263`의 도움말은 "creates symlink"라고 하지만, 실제 구현은 `LEVEL=<world>`를 바꾸는 것뿐이다(`create-server.sh:526-533`).
   - `ln -s`는 셸·TS 어디에도 없다. 심볼릭 링크를 다루는 곳은 서버 삭제 시 경고만 출력하는 `delete-server.sh:236-245`뿐이다.
   - 즉 예전 버전이 만든 링크가 남아 있을 수는 있다(레거시). 새 서버는 `--universe /worlds/` + `LEVEL` 방식이다.

4. **world lock은 서버 기동 시점에 강제되지 않는다.**
   - lock은 `world assign` 명령에만 묶인 논리적 배정이다(`mcctl.sh:339-341` → `lock.sh lock`, `WorldManagementUseCase.ts:413-434`에서 LEVEL 동기화).
   - `cmd_start`(`mcctl.sh:395-427`)와 mc-router의 자동 기동은 lock을 확인하지 않는다.
   - stale 판정은 PID나 컨테이너 상태가 아니라 타임스탬프 24시간 기준이다(`lock.sh:42,131-157`).

### 2.2 인벤토리 표

경로 기준점: `$R = MCCTL_ROOT`(기본 `~/minecraft-servers`). 컨테이너 안 경로는 → 로 표시했다.

| # | 경로 | 용도 | 읽기/쓰기 주체 | 동시 접근 | 관련 파일:라인 | k8s 판단 |
|---|------|------|---------------|-----------|---------------|----------|
| 1 | `$R/servers/<name>/data` → `/data` (bind) | 서버 jar, `server.properties`, `ops.json`/`whitelist.json`, 플러그인 설정. `--universe`가 없으면 월드도 여기 저장 | **W**: MC 컨테이너. **R/W**: mcctl-api 파일 관리자·ops·플레이어 조회·스냅샷 수집, CLI `OpsJsonAdapter` | **있음.** 서버 실행 중 API/CLI가 같은 파일을 읽고 씀 | 템플릿 `templates/servers/_template/docker-compose.yml:41`, 생성 `create-server.sh:597`, API `routes/servers/files.ts:259-302,558`, `services/OpsJsonService.ts:16`, `shared/.../PlayerRepository.ts:30-31`, `FileSystemConfigFileCollector.ts:43-61` | **RWO 충분.** 단, API가 직접 마운트하지 않는 방식으로 바꿔야 한다(사이드카나 exec, §7). 서버당 PVC 1개 |
| 2 | `$R/servers/<name>/logs` → `/data/logs` (bind, #1 안에 중첩) | 서버 로그 | W: MC. R: `logs.sh`는 `docker logs`를 씀 | 낮음 | `docker-compose.yml:42`, `create-server.sh:598` | RWO(#1과 같은 PVC의 하위 경로로 합침). 실시간 로그는 k8s Pod log API로 |
| 3 | `$R/worlds/` → `/worlds` (bind, rw, **모든 서버가 공유**) | 공유 월드 저장소. `--universe /worlds/` + `LEVEL=<world>`. Paper/Spigot은 `<world>_nether`, `<world>_the_end`를 별도 디렉터리로 만든다 | **W**: 그 월드를 LEVEL로 쓰는 MC 서버. **R**: API 월드 목록·통계·플레이어 위치(region/NBT 파싱), BlueMap 렌더(ro), backup.sh rsync. **W**: `world new/delete/import`(API, CLI) | **있음.** 여러 서버 컨테이너가 같은 디렉터리를 마운트하고, API는 실행 중인 월드를 읽음 | `docker-compose.yml:43`, `config.env:57`, `create-server.sh:487,526-533,602`, `WorldRepository.ts:149,244,347-376`, `dimensionRegions.ts:60-83`, `routes/worlds.ts:145,163`, `render-map.sh:236` | 공유 구조를 그대로 두면 **RWX가 필요하다**(위험, §3.3). 권장은 **월드별 또는 서버별 RWO로 분리**(§3) |
| 4 | `$R/worlds/.locks/` (`<world>.lock`, `<world>.lock.flock`) | world lock 파일(`server:ts:pid`), flock | W: lock.sh(CLI·API가 ShellAdapter로 호출). R: `WorldRepository.getLockStatus` | 있음(동시 assign을 flock으로 직렬화) | `lock.sh:39,110-119,192-241`, `init.sh:254`, `WorldRepository.ts:149,255,350,368`, `ShellAdapter.ts:204-221` | 볼륨을 나누면 **의미가 없어짐**. RWO attach 자체가 배타성을 보장하므로 k8s 리소스(어노테이션이나 Lease)로 대체 권장(§3.2) |
| 5 | `$R/servers/_template/` | 새 서버 생성용 템플릿 복사본 | R: create-server.sh(`cp -r`). W: init | 없음 | `create-server.sh:60-66,444`, `utils/index.ts:194-196` | 볼륨 불필요. 매니페스트 템플릿(코드나 ConfigMap)으로 대체 |
| 6 | `$R/servers/<name>/docker-compose.yml`, `$R/servers/compose.yml`, `$R/docker-compose.yml` | 서버별 compose, include 목록, 메인 compose | W: create/delete 스크립트(`sed -i`), mcctl-api `HostnameService`(mc-router.host 라벨 수정), CLI update/upgrade 패치 | 낮음 | `create-server.sh:450-470,605-624`, `delete-server.sh:191`, `HostnameService.ts:31-34,162-209`, `cli/src/commands/update.ts:167`, `upgrade.ts:270,334` | k8s 리소스(StatefulSet/Service 어노테이션)로 대체. 파일 볼륨 불필요 |
| 7 | `$R/servers/<name>/config.env` | 서버별 itzg 환경변수(TYPE, VERSION, MEMORY, LEVEL 등) | W: create-server.sh, `mcctl config`(`IShellPort.setServerConfig`), API. R: API `readServerConfigEnv`, 스냅샷 수집기 | 낮음 | `create-server.sh:477-595`, `shared/src/docker/index.ts:846`, `IShellPort.ts:43` | ConfigMap(+ RCON 비밀번호는 Secret)으로 대체. 파일로 둘 경우 컨트롤 플레인 PVC(RWO) |
| 8 | `$R/.env` | 전역 env: HOST_IP(S), RCON_PASSWORD, DOCKER_GID, PLAYIT_SECRET_KEY, 백업 토큰 등 | R: 모든 서버(`env_file: ../../.env`), 스크립트, API. W: init/upgrade(DOCKER_GID) | 낮음 | `templates/servers/_template/docker-compose.yml:35-37`, `cli/templates/.env.example:17,22,26,40`, `create-server.sh:75-140`, `cli/src/lib/docker-gid.ts:30-35` | ConfigMap + Secret. DOCKER_GID는 k8s에서 불필요 |
| 9 | `$R/.mcctl.json` | mcctl 설정(playit 활성화, 텔레메트리 등) | R/W: CLI, API | 낮음 | `utils/index.ts:203,266`, `shared/src/docker/index.ts:994-995` | ConfigMap, 또는 컨트롤 플레인 PVC(RWO) |
| 10 | `$R/users.yaml` | API 인증 사용자(YAML 저장소) | R: mcctl-api | 낮음 | `mcctl-api/src/routes/auth.ts:80-82` | Secret, 또는 컨트롤 플레인 PVC |
| 11 | `$R/data/audit.db` (SQLite, WAL) | 감사 로그 | **W: CLI와 mcctl-api가 같은 파일을 씀** | **있음(2개 프로세스)** | `cli/src/infrastructure/di/container.ts:134`, `mcctl-api/src/services/audit-log-service.ts:36`, `SqliteAuditLogRepository.ts:35-38` | **RWO 필수. RWX(NFS) 금지**(WAL은 공유 메모리가 필요해 네트워크 FS에서 동작하지 않음, §3.3). CLI는 API를 통해 쓰도록 바꿔야 함 |
| 12 | `$R/data/players.db` (SQLite) | 플레이어 세션 | W: mcctl-api | 단일 프로세스 | `mcctl-api/src/routes/players.ts:145`, `SqlitePlayerSessionRepository.ts:37-38` | RWO |
| 13 | `$R/data/mcctl.db` (SQLite, WAL) | mcctl-console 인증과 사용자-서버 권한 | W: mcctl-console | 단일 프로세스 | `mcctl-console/src/lib/db.ts:12-19,40-44` | RWO. API와 같은 PVC를 쓰려면 같은 Pod이나 같은 노드에 둬야 함(RWO는 노드 단위) |
| 14 | `$R/backups/meta/backup-schedules.db`, `config-snapshots.db` (SQLite, WAL) | 백업 스케줄, 설정 스냅샷 메타 | W: CLI와 mcctl-api 둘 다 | **있음** | `container.ts:153,161`, `mcctl-api/src/routes/backup-schedule.ts:51`, `services/config-snapshot-service.ts:27`, `routes/config-snapshot-schedules.ts:66` | #11과 같음(RWO, 단일 작성자로 통합) |
| 15 | `$R/backups/meta/config-snapshot-storage/<server>/<id>` | 설정 스냅샷 본문(파일 사본) | W: CLI, API | 있음 | `container.ts:172-178`, `config-snapshot-service.ts:40-41`, `FileSystemConfigSnapshotStorage.ts:97` | RWO(컨트롤 플레인 PVC) |
| 16 | `$R/backups/worlds/` (git 작업 디렉터리) | 월드 → GitHub 백업 캐시. `rsync --delete $R/worlds/ → backups/worlds/worlds/` 후 commit/push. 복원은 반대 방향 | W: backup.sh(CLI·API 수동 실행, 스케줄러, `BACKUP_AUTO_ON_STOP`) | 백업 대상 월드에 서버가 쓰는 중이어도 읽음 | `backup.sh:37-38,130-180,477-480`, `mcctl.sh:468`, `mcctl-api/src/routes/backup.ts:158-166,316`, `services/backup-scheduler.ts:148-273,486-497` | RWO(백업 Job용 scratch PVC 또는 emptyDir). 월드를 RWO로 나누면 백업 Job이 그 PVC를 마운트할 수 없다(서버 Pod이 다른 노드에서 실행 중일 때). 서버를 0으로 내린 뒤 실행하거나 Longhorn 스냅샷 기반으로 바꿔야 함(§3) |
| 17 | `$R/maps/<world>/{web,config}`, `$R/maps/.bluemap-data` | BlueMap 렌더 결과(정적 웹)와 렌더 캐시 | W: render-map.sh가 `docker run`으로 BlueMap 실행(월드는 ro 마운트). W: API `BlueMapMarkerWriter`(`maps/<id>/live/markers.json`). R: API(웹맵 제공) | 렌더 중 월드 읽기 | `render-map.sh:49-56,236,252,262-315`, `routes/worlds.ts:150-152,187,416-419,638`, `BlueMapMarkerWriter.ts:115-128` | 결과물: RWO(API Pod와 같이). 렌더러는 k8s Job이며 **월드 PVC를 ro로 마운트해야 함** → 서버가 다른 노드에서 실행 중이면 RWO에서는 불가. 서버 정지 중 렌더, 스냅샷 클론 렌더, 또는 RWX가 필요 |
| 18 | `$R/shared/plugins` → `/plugins:ro`, `$R/shared/mods` | 공유 플러그인/모드 | R: 모든 MC 서버. W: 사용자 | 읽기 전용 다중 | `templates/servers/_template/docker-compose.yml:44`, `utils/index.ts:162-170` | ReadOnlyMany가 이상적. Longhorn에서는 RWX로만 가능(**미확인**: Longhorn ROX 지원). 대안: init container로 각 서버 PVC에 복사, 또는 itzg `MODRINTH_PROJECTS` 같은 다운로드 방식 |
| 19 | `$R/.services/` (node_modules), `$R/ecosystem.config.js` | PM2로 띄우는 API/console 설치 위치 | R: PM2 | 없음 | `utils/index.ts:178`, `templates/ecosystem.config.js:21-56`, `cli/src/commands/console/service.ts:491` | 볼륨 불필요. 컨테이너 이미지 + Deployment로 대체 |
| 20 | `/var/run/docker.sock` | mc-router Docker 발견·자동 스케일 | R: mc-router(ro 마운트) | — | `platform/docker-compose.yml:73-77`, `cli/templates/docker-compose.yml:68-72` | 제거. ServiceAccount + RBAC로 대체(§4) |
| 21 | `/etc/avahi/hosts` (호스트) | mDNS 호스트명 등록(sudo로 수정) | W: create/delete-server.sh | — | `create-server.sh:76,173-215,646`, `delete-server.sh:52,213-214` | 볼륨 아님. §5 참조 |
| 22 | `/tmp/mc-import-<uuid>` | 월드 zip 가져올 때 임시 압축 해제 | W: API, CLI | 없음 | `WorldRepository.ts:465` | emptyDir |
| 23 | Docker 네트워크 `minecraft-net` (172.28.0.0/16) | 서버와 라우터 간 통신 | — | — | `platform/docker-compose.yml:102-108`, `cli/src/commands/init.ts:342-347`, `init.sh:297-299` | k8s Service/ClusterIP로 대체 |

**named volume**: 사용하지 않는다(모든 compose가 bind mount만 씀).

### 2.3 RWO/RWX 판단 요약

- **RWX가 "필요해 보이는" 데이터**는 #3 `/worlds`, #18 shared plugins, 그리고 mcctl-api가 접근하는 #1 `/data`다. 세 경우 모두 RWX가 본질적으로 필요한 것이 아니다. **"여러 프로세스가 같은 호스트 디렉터리를 본다"는 현재 구현 방식** 때문에 생긴 요구다.
  - 월드는 FR-003(`prd.md:51-59`)에 따라 **동시에 한 서버만** 쓴다. 그러므로 월드 데이터 자체는 RWO로 충분하다.
  - 남는 문제는 "실행 중인 서버 데이터를 관리 측이 읽는 경로"다. 사이드카, exec, 또는 RCON으로 해결할 수 있다.
- **SQLite(#11~#14)는 반드시 RWO.** 근거는 §3.3의 sqlite.org 경고와 Longhorn RWX 장애 시 동작이다.
- **결론: Longhorn RWX 없이 RWO만으로 설계할 것을 권장한다.** RWX를 쓰더라도 shared plugins(읽기 전용) 정도로 한정한다.

---

<a id="worlds"></a>

## 3. 공유 `/worlds/` 구조의 영향

### 3.1 선택지 비교

| 방식 | 구성 | 장점 | 단점 / 위험 |
|------|------|------|-------------|
| **A. 하나의 RWX 볼륨 공유** | Longhorn RWX PVC 하나를 모든 MC Pod, mcctl-api, 백업·렌더 Job이 `/worlds`로 마운트 | 현재 코드(`Paths.worlds`, `lock.sh`, `WorldRepository`, `backup.sh`, `render-map.sh`)를 거의 그대로 쓸 수 있음. 월드 재배정이 LEVEL 변경만으로 끝남 | (1) 모든 월드 IO가 `share-manager` Pod 하나의 NFSv4.1 서버를 거침. 이 Pod이 죽으면 **모든 서버의 IO가 차단**되고, 재생성 후 **90초 grace**, 그 사이 NFS4ERR_GRACE, "data consistency may be an issue". 기본 마운트 옵션 `softerr,timeo=600,retrans=5`는 장애가 길어지면 EIO를 반환하며 "data loss may occur"([rwx-volumes.md](https://github.com/longhorn/website/blob/master/content/docs/1.13.0/nodes-and-volumes/volumes/rwx-volumes.md)). (2) 마인크래프트 region 파일(작은 랜덤 쓰기와 주기적 save-all)이 USB SSD → Longhorn replica 동기화 → NFS를 거치게 됨. Longhorn 문서에 RWX 성능 수치는 없음(**미확인**). 라즈베리파이 1GbE 네트워크에서는 체감 지연이 클 것으로 **추정**. (3) 모든 노드에 `nfs-common` 필요([install](https://github.com/longhorn/website/blob/master/content/docs/1.13.0/deploy/install/_index.md)). (4) flock과 마인크래프트 `session.lock`이 NFS 잠금에 의존. grace 기간에 lock reclaim에 실패하면 IO 오류 |
| **B. 월드별 RWO PVC** | 월드 하나 = PVC 하나. 서버 StatefulSet이 배정된 월드 PVC를 `/worlds/<world>`에 마운트(`--universe /worlds/` 유지) | 월드 단위 독립성과 스냅샷. 월드 재배정 개념을 "PVC 교체"로 유지할 수 있음. RWO attach가 배타성을 보장함 | (1) Paper/Spigot은 한 월드가 **디렉터리 3개**(`<w>`, `<w>_nether`, `<w>_the_end`, `WorldRepository.ts:344-376`, `dimensionRegions.ts:60-83`). PVC 3개를 마운트하거나 subPath 구성이 필요. (2) 재배정하려면 StatefulSet의 볼륨 정의를 바꾸고 Pod을 재생성해야 함. mc-router는 replicas만 바꾸므로, 볼륨 교체는 mcctl이 맡아야 함. (3) `/worlds` 전체를 `readdir`하는 로직이 모두 깨짐(아래 3.2) |
| **C. 서버별 RWO PVC에 `/data` + 월드를 함께 저장** (권장) | 서버 StatefulSet 하나 = PVC 하나(`/data`). `--universe`를 쓰지 않고 월드를 `/data/<LEVEL>`에 둠(npm 템플릿의 현재 기본 동작과 같음, §2.1-2) | 가장 단순함. mc-router StatefulSet 0↔1 모델과 1:1로 맞음. Pod이 다른 노드에 떠도 PVC가 따라감. lock이 필요 없음(서버 = 월드 소유자) | "월드를 다른 서버로 옮기기", "서버 없는 월드(`world new`)"(`prd.md:40-49` FR-002) 기능은 **데이터 복사 Job**(서버 정지 → 두 PVC를 마운트한 Job이 rsync)으로 바꿔야 함. 공유 월드 목록 UI는 PVC나 어노테이션을 조회하도록 바꿔야 함 |

**권장: 1단계는 C, 필요하면 나중에 B.** A(RWX)는 SQLite와 같은 이유로 월드 데이터에도 권하지 않는다. 한 Pod 장애가 모든 서버 IO를 막는다는 점도 크다.

### 3.2 볼륨을 나눌 때(B/C) 깨지는 지점

| 지점 | 현재 동작 | 깨지는 이유 | 근거 |
|------|----------|------------|------|
| 월드 목록 | `$R/worlds` 하위 디렉터리를 `readdir`(`.`로 시작하는 항목 제외) | 월드가 각자 다른 볼륨(다른 노드)에 있음 | `WorldRepository.ts:244`, `lock.sh:163` |
| 월드 lock | `$R/worlds/.locks/<w>.lock` + `flock` | 공유 디렉터리가 없어서 lock 파일을 둘 곳이 없음. 프로세스별 flock은 Pod 사이에서 의미가 없음 | `lock.sh:39,192-241` |
| lock 정리 | `is_stale_lock`는 24시간 타임스탬프 기준 | PID 기반이 아니므로 Pod 재시작과 무관하게 남음 | `lock.sh:42,131-157` |
| 월드 배정 | lock.sh lock 후 `config.env`의 `LEVEL` 변경 | B: PVC 교체가 필요. C: 데이터 이동이 필요 | `WorldManagementUseCase.ts:413-434`, `mcctl.sh:339-371` |
| 기동 시 배타성 | **원래 강제되지 않음**. mc-router 자동 기동과 `cmd_start`는 lock을 보지 않음 | 볼륨을 나누면 오히려 RWO attach가 배타성을 보장하게 됨(개선) | `mcctl.sh:395-427` |
| 월드 삭제 | `rm -rf` 후 `_nether`/`_the_end` 위성 디렉터리와 각 lock 파일까지 연쇄 삭제 | PVC 삭제로 대체해야 함 | `WorldRepository.ts:347-376` |
| 월드 통계·플레이어 위치 | API가 region/NBT 파일을 직접 파싱(`AnvilBlockScanner`, `PrismarineWorldDataReader`) | API Pod이 실행 중인 서버의 RWO 볼륨을 마운트할 수 없음(같은 노드가 아니면 attach 불가) | `routes/worlds.ts:145,163`, `routes/servers.ts:467` |
| 월드 크기 | `getWorldDirectorySize` | 같은 문제 | `shared/src/docker/index.ts:713-726` |
| 백업 | `rsync $R/worlds/ → backups/worlds/worlds/` | 모든 월드를 한곳에서 볼 수 없음 | `backup.sh:177-180,477` |
| BlueMap | 월드 차원 경로를 `-v <root>:/worlds/<dim>:ro`로 마운트 | 렌더 Job이 실행 중인 서버의 PVC를 마운트할 수 없음 | `render-map.sh:214-240,312-315` |
| 서버 삭제 | `data/` 안의 심볼릭 링크를 경고만 하고 `rm -rf` | 레거시 링크가 PVC 밖(호스트 경로)을 가리키면 이전 시 링크가 끊김. 이전 도구는 링크를 **따라가서 실제 데이터를 복사**해야 함 | `delete-server.sh:236-245` |
| 서버 생성 | `--world NAME`이면 `$R/worlds/NAME` 존재 여부만 확인 | 존재 확인 대상이 PVC로 바뀜 | `create-server.sh:524-534` |

### 3.3 Longhorn RWX 위의 마인크래프트 월드와 SQLite 위험

- **SQLite**
  - 이 프로젝트의 SQLite 저장소는 모두 `journal_mode = WAL`을 켠다(`SqliteAuditLogRepository.ts:38`, `SqlitePlayerSessionRepository.ts:38`, `SqliteBackupScheduleRepository.ts:34`, `ConfigSnapshotDatabase.ts:30`, `SqliteUserRepository.ts:45`, `mcctl-console/src/lib/db.ts:43`).
  - sqlite.org는 WAL이 네트워크 파일시스템에서 동작하지 않으며, NFS 잠금은 손상을 일으킬 수 있다고 경고한다([wal.html](https://www.sqlite.org/wal.html), [useovernet.html](https://www.sqlite.org/useovernet.html), [howtocorrupt.html](https://www.sqlite.org/howtocorrupt.html)). 단, 이 문서들은 검색 결과와 미러로만 확인했고 원문은 직접 열지 못했다. 정확한 문구는 **미확인**.
  - 게다가 audit.db와 config-snapshots.db는 CLI와 API **두 프로세스가 동시에 쓴다**(§2.2 #11, #14).
  - → **Longhorn RWX 위에 두면 안 된다.**
- **마인크래프트 월드**
  - 서버는 월드 폴더에 `session.lock`을 잡고 region 파일을 주기적으로 덮어쓴다(일반적인 마인크래프트 동작이며, 이 저장소에서 근거를 확인한 것은 아님).
  - RWX에서는 위 §3.1-A의 share-manager 장애/grace 문제로 저장 중 EIO가 나서 청크가 손상될 수 있다. 이는 Longhorn 문서의 "data loss may occur"와 일치한다. 실제 손상 빈도는 **미확인**.
  - 성능 저하(NFS + replica 동기 복제 + 1GbE)는 **추정**이다.

---

<a id="docker-deps"></a>

## 4. Docker 의존성 목록

### 4.1 호출 지점 표

분류: **S** = 서버 수명주기, **Q** = 상태 조회, **E** = exec/RCON, **L** = 로그, **C** = compose/구성, **R** = 라우터, **B** = 빌드/실행(BlueMap), **N** = 네트워크

| 분류 | 위치 (파일:라인) | 현재 호출 | k8s 대체 방안 |
|------|-----------------|----------|--------------|
| S | `platform/scripts/mcctl.sh:426` | `docker compose up -d mc-<s>` | StatefulSet `spec.replicas=1` patch(scale subresource) |
| S | `platform/scripts/mcctl.sh:464` | `docker stop mc-<s>` | replicas=0 |
| S | `platform/scripts/create-server.sh:629,654,658` | `docker compose config/up -d/ps` | Service + StatefulSet + PVC 생성(server-side apply) |
| S | `platform/scripts/delete-server.sh:153-160` | `docker compose stop/rm`, `docker rm -f` | StatefulSet/Service 삭제, PVC 보존 여부 선택 |
| S | `mcctl-api/src/utils/docker-compose.ts:70-101` | `docker compose up -d / stop / restart` | scale 0/1. restart는 `kubectl rollout restart` 방식(pod template 어노테이션 갱신) 또는 Pod 삭제 |
| S | `shared/src/docker/index.ts:313-327` | `docker start/stop` | scale |
| S | `cli/src/lib/shell.ts:297-298,320-321,347-348` | `docker ps … \| xargs docker stop`, `docker compose up/stop`(전체 서버) | 라벨 셀렉터로 StatefulSet 목록 조회 후 일괄 scale |
| S | `cli/src/commands/migrate.ts:557` | `docker stop` | scale 0 |
| Q | `shared/src/docker/index.ts:96-125` | `docker inspect` State/Health | Pod phase + `Ready` 조건, StatefulSet `readyReplicas` |
| Q | `shared/src/docker/index.ts:169-230` | `docker inspect`, `docker ps --filter name=mc-` | `list statefulsets -l app.kubernetes.io/part-of=mcctl` |
| Q | `shared/src/docker/index.ts:441-530` | `docker stats`/`inspect`(가동 시간) | metrics-server(`pods/metrics`). k3s 기본 포함 여부 **미확인** |
| Q | `shared/src/infrastructure/adapters/ServerRepository.ts:112` | `docker inspect -f {{.State.Status}}` | Pod 상태(포트 `IServerRepository.getStatus` 안이라 교체가 쉬움) |
| Q | `shared/src/infrastructure/adapters/WorldRepository.ts:20,301` | `getContainerStatus` | 같음 |
| Q | `platform/scripts/lib/common.sh:146-206` | `docker info/inspect/ps`, 라벨·env 조회 | 같음(스크립트는 폐기 대상) |
| Q | `cli/src/lib/prompts/server-select.ts:108-109` | `docker ps -a --filter name=mc-` | 같음 |
| Q | `shared/src/docker/index.ts:40-90` | `docker info`, `docker compose version` | 클러스터 접근 확인(`/version`, SelfSubjectAccessReview) |
| E | `shared/src/infrastructure/adapters/RconCliAdapter.ts:75,84,95` | `docker exec <c> rcon-cli data get entity …` | Pod exec(`pods/exec`) **또는** RCON TCP 직접 연결(Service:25575) 권장 |
| E | `shared/src/docker/index.ts:574` | `docker exec <c> rcon-cli list` | 같음 |
| E | `cli/src/lib/rcon.ts:16,43`, `cli/src/lib/shell.ts:265` | `docker inspect`, `docker exec rcon-cli` | 같음 |
| E | `cli/src/commands/rcon.ts:24-50` | `docker inspect`로 컨테이너 IP와 RCON env를 얻은 뒤 `rcon-client`로 직접 연결 | Service DNS(`mc-<s>.<ns>.svc`) + Secret의 RCON_PASSWORD. 이미 TCP RCON 클라이언트가 있어 재사용 가능 |
| E | `mcctl-api/src/lib/rcon.ts:33,71` | `docker exec rcon-cli`, `docker inspect` | 같음 |
| E | `mcctl-api/src/routes/servers.ts:665` | `docker exec <c> rcon-cli <cmd>` | 같음 |
| E | `platform/scripts/mcctl.sh:288` | `docker exec -i <c> rcon-cli`(대화형) | `kubectl exec -it` 또는 TCP RCON |
| L | `mcctl-api/src/routes/servers.ts:580` | `docker logs -f --tail 0`(SSE) | `GET pods/<p>/log?follow=true` |
| L | `mcctl-api/src/services/player-session-collector.ts:24-30` | `docker logs --timestamps --since` | `pods/log?timestamps=true&sinceTime=`. 타임스탬프 파서(`PlayerSessionEvent.ts:8-44`)는 RFC3339 형식이라 재사용 가능할 것으로 **추정** |
| L | `shared/src/docker/index.ts:337-338`, `platform/scripts/logs.sh:113-117`, `mcctl.sh:251` | `docker logs` | 같음 |
| C | `mcctl-api/src/services/HostnameService.ts:31-209` | 서버 compose 파일의 `mc-router.host` 라벨을 정규식으로 수정 | Service 어노테이션 `mc-router.itzg.me/externalServerName` patch |
| C | `cli/src/commands/update.ts:167`, `upgrade.ts:270,334`, `cli/src/lib/compose-router-patch.ts` | compose 파일 패치, `docker compose up -d router` | 매니페스트 버전 관리(Helm/Kustomize) |
| C | `cli/src/commands/init.ts:153,342-347,672`, `cli/src/lib/docker-gid.ts:6-35`, `platform/scripts/init.sh:130-152,297-299` | DOCKER_GID, `docker network create`, `docker compose restart mc-router` | 네임스페이스, RBAC, mc-router Deployment 설치 |
| R | `platform/docker-compose.yml:57-79`, `cli/templates/docker-compose.yml:51-74` | mc-router `IN_DOCKER`, docker.sock 마운트 | `IN_KUBE_CLUSTER` + ServiceAccount/RBAC(§4.3) |
| R | 서버 템플릿 라벨 `templates/servers/_template/docker-compose.yml:47-57` | `mc-router.host`, `auto-scale-up/down`, `asleep-motd`, `loading-motd` | Service 어노테이션(§4.3 대조표) |
| R | `shared/src/docker/index.ts:128-160,253,652-700` | `docker inspect mc-router`, `curl 127.0.0.1:25580/routes`, mode 문자열 `'--in-docker'` | mc-router API Service(ClusterIP) 호출. mode 표시 문자열 수정 |
| R | `shared/src/docker/index.ts:971-1075` | playit: `docker compose --profile playit up -d / stop` | playit Deployment scale |
| B | `platform/scripts/render-map.sh:152-164,272,312` | `docker image inspect/build`, `docker run --rm --user` | 미리 빌드한 arm64 이미지 + k8s Job |
| B | `shared/src/infrastructure/adapters/BlueMapCliRenderer.ts:70`, `mcctl-api/src/routes/worlds.ts:186-187` | 위 스크립트를 spawn | Job 생성 adapter(`IMapRenderer` 포트가 이미 있음) |
| S | `mcctl-api/src/routes/servers.ts:873` | `create-server.sh` spawn 후 출력에서 `'docker compose up'` 문자열 파싱(912행) | 생성 use case의 k8s adapter. 진행 상황은 이벤트로 |

### 4.2 Hexagonal 구조에서 k8s adapter를 추가할 수 있는가

- **도메인 계층은 대부분 깨끗하다.** 도메인 디렉터리에 `child_process`나 Docker 호출이 없다.
  - Docker 개념은 `ServerName.containerName = mc-<name>`(`domain/value-objects/ServerName.ts:17-18`)과, `docker logs` 형식을 가정한 `PlayerSessionEvent` 파서(`domain/value-objects/PlayerSessionEvent.ts:8-44`) 정도만 새어 있다.
- **이미 포트 뒤에 있어서 교체하기 쉬운 것들**
  - `IServerRepository`(`ServerRepository.ts:112`의 `docker inspect`)
  - `IRconPort`(`RconCliAdapter`)
  - `IMapRenderer`(`BlueMapCliRenderer`)
  - `IServiceManagerPort`(`Pm2ServiceManagerAdapter`, 문서 `docs/development/cli-architecture.md` Adapters 표)
- **포트가 "Docker 전용 bash 스크립트 위임" 형태인 것**
  - `IShellPort`의 메서드는 `startServer/stopServer/logs/console/worldAssign/backupPush` 등 **업무 단위**다(`IShellPort.ts:23-133`). 그래서 k8s 구현체(`K8sShellAdapter`처럼 이름은 어색하지만)를 만드는 것은 구조적으로 가능하다.
  - 다만 `exec(script, args)`·`execInteractive`(`IShellPort.ts:128-133`)처럼 **스크립트 이름을 직접 받는** 메서드가 섞여 있다. 그래서 포트 계약 자체가 bash 구현에 묶여 있다.
- **포트 밖에 있는 것(주 장애물)**
  - `shared/src/docker/index.ts`의 자유 함수 30여 개(`getContainerStatus`, `getMcContainers`, `getOnlinePlayers`, `getPlayitAgentStatus` 등). 이 함수들은 포트 없이 다음 위치에서 직접 import된다.
    - CLI: `status`, `msg`, `player-online`, `migrate`, `prompts/player-select`
    - API: `routes/players`, `routes/router`, `routes/servers`, `routes/servers/config`, `services/config-snapshot-service`
    - `WorldRepository`
  - mcctl-api route가 `spawn('docker', …)`을 직접 호출함(`routes/servers.ts:580,665`, `lib/rcon.ts`, `utils/docker-compose.ts`, `services/player-session-collector.ts`).
  - CLI의 thin command도 마찬가지다(`cli/src/lib/shell.ts`, `lib/rcon.ts`; 문서에서도 "Thin commands … `docker exec`"라고 명시, `docs/development/cli-architecture.md` "Two Kinds of Commands").
- **결론**
  - k8s adapter를 "추가"하려면 먼저 **`IContainerRuntimePort`(가칭: start/stop/status/list/exec/logs/stats)를 새로 정의**해야 한다.
  - 그다음 위의 자유 함수와 직접 spawn 호출을 이 포트 뒤로 옮기는 **구조 변경(Tidy First 리팩터링)**이 선행되어야 한다. 그 뒤에 `DockerRuntimeAdapter`와 `KubernetesRuntimeAdapter`를 만들면 된다.
  - bash 스크립트(`platform/scripts/*.sh`, 4,471줄)는 Docker를 전제로 하므로 k8s 경로에서는 쓸 수 없다. create/delete/lock/backup/render 로직은 TS use case로 옮겨야 한다.

### 4.3 컨테이너 라벨 → k8s 리소스 매핑

| Docker (현재) | k8s 대응 | 출처 |
|---------------|---------|------|
| 라벨 `mc-router.host: "<s>.local,<s>.<ip>.nip.io"` | Service 어노테이션 `mc-router.itzg.me/externalServerName`(쉼표 구분) | [mc-router server/k8s.go L27-34](https://github.com/itzg/mc-router/blob/main/server/k8s.go), [README Kubernetes Usage](https://github.com/itzg/mc-router/blob/main/README.md#kubernetes-usage) |
| `mc-router.auto-scale-up/down` | `mc-router.itzg.me/autoScaleUp`, `autoScaleDown` | 같음 |
| `mc-router.auto-scale-asleep-motd` / `loading-motd` | `mc-router.itzg.me/autoScaleAsleepMOTD` / `autoScaleLoadingMOTD` | 같음(k8s.go L335-341) |
| (없음) | `mc-router.itzg.me/autoScaleWaitTimeout` | 같음 |
| 컨테이너 이름 `mc-<s>` | **StatefulSet 이름 = `spec.serviceName` = Service 이름**(일치하지 않으면 자동 스케일이 동작하지 않음) | README("otherwise, autoscaling will not trigger"), k8s.go L45, L166-167 |
| 포트 25565 | Service 포트 이름 `mc-router` → `minecraft` → 기본 25565 | k8s.go `buildDetails` |
| docker.sock | RBAC: `services`(watch, list), `apps/statefulsets`(watch, list, patch 또는 get+update), `apps/statefulsets/scale`(get) | README, [kustomize/overlays](https://github.com/itzg/mc-router/tree/main/kustomize/overlays) |

---

<a id="mc-router"></a>

## 5. mc-router k8s 모드 대조표

현재 고정 버전은 `itzg/mc-router:1.47.1`이다(`platform/docker-compose.yml:60`, `cli/templates/docker-compose.yml:54`). 아래 확인은 **main 브랜치(2026-10-04)** 기준이다. 1.47.1에서도 똑같이 동작하는지는 **미확인**이다.

| 현재 사용 기능 | 현재 설정 (근거) | k8s 모드 지원 | 비고 / 출처 |
|---------------|-----------------|--------------|-------------|
| 서비스 자동 발견 | `IN_DOCKER: "true"` + 라벨 (`platform/docker-compose.yml:64`) | **지원**: `IN_KUBE_CLUSTER` / `-in-kube-cluster`, `KUBE_NAMESPACE`(비우면 전체 네임스페이스) | [configs.go](https://github.com/itzg/mc-router/blob/main/server/configs.go), README |
| 호스트명 라우팅(여러 이름) | `mc-router.host` 쉼표 구분 (`create-server.sh:459-470`) | **지원**: `externalServerName` 쉼표/개행 구분 | k8s.go L27-34 |
| `AUTO_SCALE_UP` | `"true"` (`platform/docker-compose.yml:65`) | **지원(StatefulSet만)**. replicas 0→1 | configs.go 도움말, README("Both options require using `kind: StatefulSet`") |
| `AUTO_SCALE_DOWN` | `"true"` (:66) | **지원(StatefulSet만)**. replicas 1→0 | 같음 |
| `AUTO_SCALE_DOWN_AFTER` | `10m`(platform), **`1m`(npm 템플릿)** (`platform/docker-compose.yml:67`, `cli/templates/docker-compose.yml:61`) | **지원**(전역 설정, 기본 10m) | configs.go L12-18 |
| `AUTO_SCALE_ASLEEP_MOTD` | 설정됨 (:70) | **지원**(전역 또는 어노테이션) | README, k8s.go L335-341 |
| `auto-scale-loading-motd` | 라벨로 설정 (`templates/servers/_template/docker-compose.yml:57`) | **지원**(어노테이션 `autoScaleLoadingMOTD`). 단, 플래그 도움말에는 "Docker servers"라고만 적혀 있음 | k8s.go L339, connector.go `getLoadingMOTD` |
| `DOCKER_TIMEOUT` (기동 대기) | `120s`(platform), **`"120"`(npm 템플릿, 단위 없는 정수)** (`platform/docker-compose.yml:69`, `cli/templates/docker-compose.yml:62`) | 대응 설정: 어노테이션 `autoScaleWaitTimeout`(기본 **60s**). 기동 중 들어온 로그인은 500ms 폴링으로 붙잡아 둠. README는 Java 클라이언트의 30초 타임아웃 때문에 **30초 초과는 권장하지 않음** | k8s.go L364+, [connector.go ~L697-706](https://github.com/itzg/mc-router/blob/main/server/connector.go). 참고: platform compose 주석(`:68`)은 단위 없는 정수가 파싱에 실패한다고 경고함. 그런데 npm 템플릿은 `"120"`을 그대로 씀(이전과 무관한 기존 결함 가능성) |
| 관리 API(`API_BINDING :8080`) | npm 템플릿만 사용, 127.0.0.1:25580으로 노출 (`cli/templates/docker-compose.yml:64,67`), 헬스체크용 (`shared/src/docker/index.ts:128-160`) | 플래그 자체는 모드와 무관할 것으로 **추정**. k8s에서는 ClusterIP Service로 노출 | 미확인 |
| Deployment 자동 스케일 | (해당 없음) | **미지원**(StatefulSet만) | README |
| 기본 서버(default) | 사용 안 함 | 지원(`defaultServer` 어노테이션) | k8s.go |
| arm64 이미지 | — | **지원**(amd64, arm64, arm/v6) | README, [.goreleaser.yml](https://github.com/itzg/mc-router/blob/main/.goreleaser.yml) |

### 다른 노드에서 재기동할 때 Longhorn attach 지연의 영향

- **현재 동작**
  - mc-router는 컨테이너를 켠 뒤 클라이언트가 다시 접속하기를 기대한다(`prd.md` 3.3 "Clients must reconnect after server wakes up (typically 30-60 seconds)").
- **k8s에서의 기동 경로**
  - replicas 0→1 → 스케줄링 → **Longhorn 볼륨 attach**(engine/replica 기동) → 이미지 pull(첫 실행 시) → JVM과 월드 로드 → TCP 응답.
- **Longhorn 문서로 확인된 시간**
  - 정상 노드 사이에서 RWO 볼륨을 detach/attach하는 시간: 문서에 수치 없음(**미확인**).
  - 노드 장애 상황: 문서상 수치가 있음([node-failure.md](https://github.com/longhorn/website/blob/master/content/docs/1.13.0/high-availability/node-failure.md)).
    - NotReady 판정까지 약 1분, Pod Unknown까지 약 5분.
    - RWO는 이중 attach가 불가하므로, 새 Pod은 기존 Pod이 Terminating에서 벗어날 때까지 ContainerCreating에 머문다.
    - `Pod Deletion Policy When Node is Down`의 기본값은 `do-nothing`이다. 따라서 **`delete-statefulset-pod`로 바꾸지 않으면 노드 장애 시 자동 복구되지 않는다**([settings.md L467](https://github.com/longhorn/website/blob/master/content/docs/1.13.0/references/settings.md)).
    - 노드가 늦게 복귀하면 재attach에 "1 ~ 7 minutes"가 걸린다.
- **실무적 영향(추정)**
  - 라즈베리파이에서 Paper 서버 기동은 수십 초에서 수 분이 걸린다. 그래서 대기 시간을 30초 이하로 두면 **첫 접속은 loading MOTD를 본 뒤 실패하고, 다시 접속해야 하는 경험이 지금과 같다.** attach 시간만큼 체감 지연이 늘어난다.
  - 이미지를 각 노드에 미리 pull해 두고, 노드 affinity(선호 노드)로 같은 노드에서 다시 뜨게 유도하면 attach 비용을 줄일 수 있을 것으로 **추정**한다. Longhorn의 data locality 설정의 효과는 **미확인**.

---

<a id="host-deps"></a>

## 6. 호스트 의존 기능별 대응 방안

| 기능 | 현재 구현 (근거) | k8s에서의 문제 | 대응 방안 |
|------|-----------------|----------------|-----------|
| **avahi/mDNS** | `/etc/avahi/hosts`에 `<ip> <s>.local` 추가 후 `systemctl restart avahi-daemon`(sudo) (`create-server.sh:76,173-215,646`, `delete-server.sh:52,207-220`). 상태 확인 `shared/src/docker/index.ts:265-290`, `mcctl.sh:119-127`, `init.sh:164-198`, 로그 `logs.sh:240-258` | 컨테이너 안에서 호스트 파일과 systemd를 수정할 수 없음. mDNS 멀티캐스트는 Pod 네트워크(CNI)를 넘지 못함(일반적인 사실이며 k3s 문서로는 **미확인**) | ① mDNS를 포기하고 nip.io와 내부 DNS를 사용(권장). ② 한 노드에서 avahi를 호스트 서비스로 유지하고, `<s>.local`을 고정 LB IP로 등록(수동이거나 별도 에이전트가 처리). ③ hostNetwork DaemonSet으로 avahi 실행. 공식 방법은 **미확인**(커뮤니티 아이디어 수준) |
| **sudo** | `run_with_sudo`, `MCCTL_SUDO_PASSWORD` (`platform/scripts/lib/common.sh:86-140`, `prd.md` FR-017) | 클러스터 안에서 불필요하며 허용해서도 안 됨 | avahi를 없애면 sudo도 함께 사라짐 |
| **nip.io / HOST_IP(S)** | `.env`의 HOST_IP(S)로 `<s>.<ip>.nip.io`를 만들어 mc-router 라벨에 넣음 (`create-server.sh:82-170,452-470`, `migrate-nip-io.sh`, `cli/src/lib/prompts/ip-select.ts`) | 노드가 여러 대라 "호스트 IP"가 하나가 아님 | **변하지 않는 진입 IP 하나**를 정하고 그 IP로 nip.io 이름을 만든다(아래 선택지 표) |
| **playit.gg** | `network_mode: host`, `SECRET_KEY`, `--profile playit` (`platform/docker-compose.yml:88-97`), 시작/정지 `shared/src/docker/index.ts:1032-1075` | host 네트워크와 localhost:25565 전제 | playit-agent Deployment(replica 1). 터널 대상을 mc-router Service DNS나 LB IP로 바꿈. 이미지는 arm64를 지원함([build-release.yml L26-38, L209](https://github.com/playit-cloud/playit-agent/blob/master/.github/workflows/build-release.yml)). 터널 대상을 클러스터 내부 주소로 지정하는 설정 방법은 **미확인** |
| **PM2** | `ecosystem.config.js`로 mcctl-api(:5001), mcctl-console(:5000) 실행 (`templates/ecosystem.config.js:21-56`, `cli/src/commands/console/service.ts:491`, `Pm2ServiceManagerAdapter`) | 컨테이너 이미지가 없음(Dockerfile 없음) | 두 서비스의 arm64 이미지를 빌드해 Deployment로 실행. SQLite와 데이터 디렉터리를 공유하므로 **한 Pod 두 컨테이너 + RWO PVC 1개**가 가장 단순함. `IServiceManagerPort`의 k8s 구현 추가 |
| **호스트 파일 직접 수정** | compose와 config.env를 `sed -i`로 수정(`create-server.sh:450-624`), `HostnameService.ts:209` `writeFileSync`, `docker-gid.ts:30-35`(.env) | 매니페스트가 단일 진실 원천이 되어야 함 | k8s API patch(어노테이션, ConfigMap)로 대체 |
| **Docker 그룹/GID** | `DOCKER_GID`, `group_add` (`platform/docker-compose.yml:76-77`) | 불필요 | ServiceAccount + RBAC로 대체 |
| **백업(GitHub push)** | 호스트에서 git clone/rsync/push (`backup.sh`), API 스케줄러 (`backup-scheduler.ts`) | 월드 볼륨에 접근할 수 없음(RWO) | 서버를 scale 0 → 월드 PVC를 마운트한 Job이 push하는 방식(정지 시점 백업). 또는 Longhorn 스냅샷/백업 타깃 사용(S3/NFS 기능 존재 여부와 세부 사항은 이번에 **미확인**) |

### 진입 IP 선택지 (HOST_IP / nip.io 고정용)

| 선택지 | 동작 (출처) | nip.io에 넣을 IP | 장단점 |
|--------|------------|------------------|--------|
| **k3s ServiceLB (klipper-lb)** | LoadBalancer Service마다 hostPort를 쓰는 `svc-` DaemonSet을 모든 노드(또는 라벨로 지정한 노드 풀)에 띄우고, 노드 IP들을 status에 기록 ([networking-services.md](https://github.com/k3s-io/docs/blob/main/docs/networking/networking-services.md)) | 특정 노드 하나의 IP(또는 여러 개를 HOST_IPS로) | 추가 설치가 없음. **고정 VIP가 없어서**, 이름에 넣은 노드가 죽으면 그 주소로는 접속 불가. `svccontroller.k3s.cattle.io/enablelb` 라벨로 진입 노드를 제한할 수 있음 |
| **MetalLB L2** | 리더 노드 하나가 ARP로 VIP에 응답. 장애 시 몇 초 안에 자동 전환(클라이언트가 gratuitous ARP를 존중할 때). 대역폭은 리더 노드 하나로 몰림 ([layer2.md](https://github.com/metallb/metallb/blob/main/website/content/concepts/layer2.md)). ServiceLB와 함께 쓰려면 `--disable=servicelb` 필요(k3s 문서) | **고정 VIP**(예: 192.168.x.200) | 주소가 변하지 않음 → nip.io 이름도 안정적임(**권장**). 진입 트래픽이 노드 하나를 거침(마인크래프트 트래픽 규모에서는 문제 없을 것으로 **추정**) |
| **kube-vip 등 기타** | 이번에 확인하지 않음 | VIP | **미확인** |

---

<a id="arm64"></a>

## 7. arm64 호환성과 동시 실행 서버 수 추정

### 7.1 이미지와 네이티브 의존성

| 구성요소 | 현재 사용 (근거) | arm64 | 출처 |
|----------|-----------------|-------|------|
| `itzg/minecraft-server:java25` (기본 템플릿) | `templates/servers/_template/docker-compose.yml:30`, `cli/templates/servers/_template/docker-compose.yml:30` | **지원**(amd64, arm64, riscv64) | [docs/versions/java.md](https://github.com/itzg/docker-minecraft-server/blob/master/docs/versions/java.md), 로컬 사본 `docs/itzg-reference/07-java-versions.md:9-22` |
| `java21`, `java17`, `java8` (버전별 자동 선택, `DocsAdapter.ts:314-337`) | — | **모두 지원**(java17/11/8은 armv7도 지원) | 같음 |
| `-alpine`, `-graalvm` 변형 | 사용 안 함 | 지원(graalvm은 Forge 설치 프로그램이 동작하지 않음) | 같음 |
| `itzg/mc-router:1.47.1` | `platform/docker-compose.yml:60` | 지원(amd64, arm64, arm/v6). 1.47.1 태그의 매니페스트 자체는 **미확인** | [.goreleaser.yml](https://github.com/itzg/mc-router/blob/main/.goreleaser.yml) |
| BlueMap 렌더러 (`mcctl-bluemap:5.22`, 로컬 빌드) | 베이스 `eclipse-temurin:25-jre` + BlueMap CLI jar (`platform/docker/bluemap/Dockerfile`) | jar는 순수 Java라 아키텍처와 무관. **eclipse-temurin:25-jre의 arm64 매니페스트는 미확인**. 참고로 공식 `ghcr.io/bluemap-minecraft/bluemap` 이미지는 arm64 빌드를 제공함 | [BlueMap build.yml ~L120](https://github.com/BlueMap-Minecraft/BlueMap/blob/master/.github/workflows/build.yml) |
| `ghcr.io/playit-cloud/playit-agent:0.16` | `platform/docker-compose.yml:90` | 지원(linux/amd64, linux/arm64) | [build-release.yml](https://github.com/playit-cloud/playit-agent/blob/master/.github/workflows/build-release.yml) |
| `better-sqlite3` (CLI `^12.6.2`, `cli/package.json`, console, shared) | 네이티브 모듈 | CI 빌드 매트릭스에 `linux-arm64`, `linuxmusl-arm64` prebuild가 있음(v13 기준). **12.x 릴리스 자산을 실제로 확인하지는 못함**. 없으면 빌드 도구(gcc, make, python)가 필요함(CLAUDE.md System Requirements에도 명시) | [better-sqlite3 build.yml](https://github.com/WiseLibs/better-sqlite3/blob/master/.github/workflows/build.yml) |
| mcctl-api / mcctl-console 이미지 | **없음**(PM2 실행) | 새로 빌드 필요(`node` 공식 이미지 arm64 기반, **미확인**) | — |
| Longhorn | — | AMD64, ARM64 지원 | [best-practices.md](https://github.com/longhorn/website/blob/master/content/docs/1.13.0/best-practices.md) |

### 7.2 동시 실행 서버 수 추정 (**전부 추정**)

**근거로 쓴 사실**
- Longhorn V1 엔진의 최소 권장 사양: **노드 3대, 노드당 4 vCPU / 4 GiB, SSD 권장**. instance-manager Pod마다 할당 가능 CPU의 12%를 기본 예약한다(best-practices.md, settings.md).
- longhorn-manager 메모리는 RWX 볼륨 60개 벤치마크에서 약 405MB였다(fast-failover 문서). instance-manager 메모리는 **미확인**.
- itzg 문서는 라즈베리파이에서 `MEMORY=750m` 수준으로 낮출 수 있다고만 언급한다([raspberrypi.md](https://github.com/itzg/docker-minecraft-server/blob/master/docs/misc/raspberrypi.md)).
- 템플릿 기본값은 `MEMORY=4G`이고, 권장값은 PAPER 2G, FORGE/FABRIC 4G다(`cli/templates/servers/_template/config.env:29-33`).
- **replica 2는 Longhorn 권장(노드 3대 이상)보다 낮다.** 노드 하나가 장애일 때 남는 복제본은 1개뿐이다.

**노드당 시스템 예약(추정)**: OS 약 0.3–0.5GB + k3s agent 약 0.3–0.5GB(server 노드는 더 많음) + Longhorn(manager, instance-manager, CSI) 약 0.5–1GB → **약 1.5–2GB**

**서버 Pod 메모리(추정)**: JVM 힙(`MEMORY`) + 비힙/네이티브 약 25–40% → `MEMORY=2G`이면 limit 약 2.5–3GB

| Pi 사양 | 서버에 쓸 수 있는 메모리(추정) | `MEMORY=1G`(바닐라·소규모) | `MEMORY=2G`(Paper) | `MEMORY=4G`(모드) |
|---------|-------------------------------|---------------------------|--------------------|-------------------|
| 4GB | 약 2–2.5GB | 노드당 1대 | 0~1대(빠듯함) | 불가 |
| 8GB | 약 6GB | 노드당 3–4대 | **노드당 2대** | 노드당 1대 |
| 16GB | 약 14GB | 노드당 8대 이상(CPU가 병목) | 노드당 4–5대 | 노드당 2–3대 |

- 4코어 CPU에서 마인크래프트의 메인 틱은 단일 스레드라, **CPU 기준으로는 노드당 활성 서버 2–3대가 현실적인 상한**으로 추정한다.
- 자동 스케일 다운(유휴 시 0) 덕분에 "정의된 서버 수"가 아니라 "동시에 접속 중인 서버 수"만 위 표에 맞추면 된다.
- 한 노드가 장애로 빠지면 남은 노드가 그 노드의 서버까지 받아야 하므로, 위 수치의 **(N-1)/N** 수준으로 계획할 것을 권장한다.
- 4GB 모델은 Longhorn 최소 권장(4GiB)을 겨우 맞추는 수준이라 **권장하지 않는다.**

---

<a id="roadmap"></a>

## 8. 권장 이전 방식과 단계별 로드맵

### 권장 아키텍처 (목표)

```
LoadBalancer(MetalLB VIP :25565)
        │
   mc-router Deployment (IN_KUBE_CLUSTER, RBAC: services, statefulsets, statefulsets/scale)
        │  Service 어노테이션 externalServerName = <s>.<VIP>.nip.io
        ▼
   StatefulSet mc-<s> (replicas 0↔1, name == serviceName == Service 이름)
     └─ PVC data-mc-<s> (Longhorn RWO, replica 2) → /data  (월드 = /data/<LEVEL>, --universe 미사용)
     └─ RCON :25575 (Service 내부 포트, 비밀번호는 Secret)
     └─ (선택) file-agent 사이드카: API의 파일·ops·월드 통계 읽기와 쓰기를 대행

mcctl Pod (Deployment replica 1, 컨테이너 2개: mcctl-api + mcctl-console)
     └─ PVC mcctl-state (Longhorn RWO) → audit.db, players.db, mcctl.db, backups/meta, maps, users.yaml
     └─ ServiceAccount: statefulsets/scale, pods/log, pods/exec, services patch, jobs create

Job: world-backup / world-copy / bluemap-render (대상 서버를 scale 0으로 내린 뒤 그 PVC를 마운트)
```

### 단계별 로드맵

| 단계 | 내용 | 산출물 / 완료 조건 | 코드 영향 |
|------|------|------------------|-----------|
| **0. 사전 조사** | 각 운영 서버의 실제 월드 위치(`/worlds/<LEVEL>`인지 `/data/<LEVEL>`인지), 레거시 심볼릭 링크 존재 여부, 월드와 서버의 매핑(lock 파일) 수집 | 서버별 데이터 맵 | 없음(§2.1-2, §3.2 마지막 행 참조) |
| **1. 단일 노드 k3s + Longhorn, 월드 데이터만 이전** | k3s 단일 노드(`--disable=local-storage`, 플래그 이름은 **추정**: packaged-components 문서상 AddOn 이름이 `local-storage`) + Longhorn(replica 1). itzg Helm 차트(`workloadAsStatefulSet: true`, `persistence.dataDir.enabled: true`, RWO, [values.yaml](https://github.com/itzg/minecraft-server-charts/blob/master/charts/minecraft/values.yaml)) 또는 직접 만든 StatefulSet으로 서버 1~2대 수동 배포. 월드는 `/data/<LEVEL>`로 복사(C 방식). mc-router k8s 모드 + ServiceLB | mcctl을 쓰지 않고 `kubectl`로 운영. 접속, 자동 스케일 0↔1, 재기동 후 데이터 유지 확인 | **없음.** 기존 Docker 호스트는 그대로 둠 |
| **2. 코드 리팩터링(구조 변경만)** | `IContainerRuntimePort`(가칭) 정의. `shared/src/docker/index.ts` 자유 함수와 API·CLI의 직접 `spawn('docker')`를 포트 뒤로 이동. `DockerRuntimeAdapter`로 기존 동작 유지. CLI가 SQLite를 직접 쓰는 경로(audit, snapshot)를 API 경유로 통합 검토 | 기존 테스트 통과, 동작 변화 없음(Tidy First) | 중간 규모 |
| **3. k8s adapter와 컨트롤 플레인 컨테이너화** | `KubernetesRuntimeAdapter`(scale, status, logs, exec 또는 TCP RCON), `HostnameService` → Service 어노테이션 patch, create/delete를 TS use case + 매니페스트 생성으로 이전. mcctl-api/console arm64 이미지 + Deployment(RWO PVC). PM2 adapter 대체 | 웹 콘솔에서 서버 생성, 시작, 정지, 로그, RCON이 k8s에서 동작 | 큼 |
| **4. 월드 관련 기능 재설계** | 월드 배정을 "복사 Job"으로, 백업과 BlueMap을 "scale 0 → Job" 또는 Longhorn 스냅샷 기반으로 변경. lock.sh를 폐기하고 k8s 어노테이션이나 Lease로 대체. API의 월드 통계와 파일 관리는 사이드카나 exec로 | FR-002/003/013 대체 동작 정의와 테스트 | 큼 |
| **5. 멀티 노드** | 노드 추가(3대 이상 권장), Longhorn replica 2, `Pod Deletion Policy When Node is Down = delete-statefulset-pod`, MetalLB L2 VIP 도입(`--disable=servicelb`), nip.io를 VIP 기준으로 재발급(`migrate-nip-io.sh`와 같은 역할을 Service 어노테이션 patch로). 노드 장애 훈련 | 노드 하나 전원 차단 시 서버가 다른 노드에서 데이터를 유지한 채 기동 | 설정 중심 |
| **6. 호스트 의존 기능 정리** | avahi 폐지 또는 외부 유지 결정, playit Deployment, 문서(EN/KO) 갱신 | — | 작음 |

이 저장소의 규칙(CLAUDE.md "Issue-Driven Development Workflow")에 따라, 2단계부터는 각 단계를 GitHub Issue로 만들고 승인받은 뒤 `/work`로 진행해야 한다.

---

<a id="unverified"></a>

## 9. 확인하지 못한 것 / 추측인 것

### 미확인 (외부)
- **mc-router**
  - 고정 버전 `1.47.1`의 k8s 기능이 main과 같은지. 이번 확인은 main(2026-10-04) 소스 기준이다.
  - Docker Hub 실제 매니페스트(arm64)는 확인하지 않았다(CI 설정과 README만 확인).
- **itzg/minecraft-server**
  - Docker Hub 매니페스트는 확인하지 않았다(공식 문서 표와 CI만 확인).
  - `docs/misc/raspberrypi.md`는 armv7 태그에 `latest`가 포함된다고 하고, 버전 표는 포함되지 않는다고 한다. 공식 문서끼리 모순된다.
- **eclipse-temurin:25-jre**(BlueMap 베이스)의 arm64 지원.
- **better-sqlite3 12.x**의 linux-arm64 prebuild 실제 릴리스 자산(GitHub API 403).
- **sqlite.org 원문**: 사이트에 접속하지 못해 검색 결과와 미러로만 확인했다.
- **Longhorn**
  - 정상 노드 사이에서 RWO detach/attach에 걸리는 일반 시간.
  - RWX 성능 수치.
  - instance-manager 메모리 사용량.
  - ReadOnlyMany 지원 여부.
  - 백업 타깃(S3/NFS)의 세부 동작.
  - data locality 설정이 attach 시간에 미치는 효과.
- **avahi/mDNS**를 k8s에서 운용하는 공식 방법(찾지 못함).
- **playit-agent**의 터널 대상을 클러스터 내부 주소로 지정하는 설정 방법.
- **k3s**
  - local-path를 끄는 정확한 플래그(`--disable=local-storage`로 추정).
  - metrics-server 기본 포함 여부.
  - mDNS 멀티캐스트가 Pod 네트워크를 넘지 못한다는 점의 k3s 문서상 근거.
- **kube-vip** 등 MetalLB 외 VIP 선택지.

### 추정 (계산이나 경험에 기댄 판단)
- §7.2의 노드당 시스템 예약 메모리, JVM 비힙 비율, 동시 실행 서버 수.
- RWX(NFS) 위 월드 IO의 성능 저하 정도와 청크 손상 가능성의 실제 빈도.
- 라즈베리파이에서 서버 기동 시간(수십 초~수 분)과, 그로 인해 첫 접속이 실패하고 재접속이 필요하다는 판단.
- mc-router 관리 API(`API_BINDING`)가 k8s 모드에서도 같은 방식으로 동작한다는 판단.
- `PlayerSessionEvent` 타임스탬프 파서를 k8s 로그 형식에 재사용할 수 있다는 판단.
- MetalLB L2의 단일 리더 대역폭 제약이 마인크래프트 트래픽 규모에서 문제가 되지 않는다는 판단.

### 저장소 관련 관찰 (이전과 별개로 확인이 필요한 기존 불일치)
- npm CLI 템플릿에 `EXTRA_ARGS=--universe /worlds/`가 없다(`platform/services/cli/templates/servers/_template/config.env`). 저장소 루트 템플릿(`templates/servers/_template/config.env:57`)과 다르다.
- npm CLI 템플릿의 `DOCKER_TIMEOUT: "120"`(`cli/templates/docker-compose.yml:62`)과 platform compose의 `"120s"` 및 "Bare integers fail to parse" 주석(`platform/docker-compose.yml:68-69`)이 불일치한다. `AUTO_SCALE_DOWN_AFTER`도 `1m`과 `10m`으로 다르다.
- `create-server.sh:20,263`의 "creates symlink" 문구는 실제 구현(LEVEL 변경)과 다르다.
- 이 세 가지는 이번 범위(읽기 전용)에서 고치지 않았다. 필요하면 별도 이슈로 처리할 것을 권장한다.
