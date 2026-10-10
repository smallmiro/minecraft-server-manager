# v2.29.0 업그레이드 가이드 (기존 설치 사용자용)

> 대상: v2.28.x 이하에서 v2.29.0(minor)으로 올리는 기존 설치.
> 근거: 이 문서의 동작 설명은 `platform/services/cli/src/commands/{upgrade,update}.ts`,
> `src/lib/{docker-gid,compose-router-patch}.ts`, `platform/docker-compose.yml`,
> `platform/scripts/render-map.sh`를 직접 읽고 작성했습니다. 실제 서버에서 실행해 검증한 것은 아닙니다.

## 1. 이번 릴리즈에서 사용자에게 영향이 있는 변경

| 이슈 | 변경 | 사용자 영향 |
|------|------|-------------|
| #549/#559 | mc-router `1.43.1` → `1.47.1`, router에 `group_add: ["${DOCKER_GID:-999}"]` 추가, `.env`에 `DOCKER_GID` 추가 | **라우터 컨테이너 재생성 필요.** 1.46+는 non-root라서 docker 소켓 그룹이 없으면 라우팅/auto-scale이 동작하지 않을 수 있음 |
| #562/#569 | `mcctl upgrade`가 루트 `docker-compose.yml`의 router 블록(image, group_add)을 패치 | 예전에는 `servers/_template`과 `.env`만 갱신됐음. 이제 compose도 갱신(확인 후 적용, 백업 생성) |
| #567 | console 월드 통계 패널의 Ore & Block Stats 시각화 개선 | console 패키지 갱신 + PM2 재시작 필요 (UI 변경만) |
| #564 | BlueMap 지도 기본 뷰를 overworld로 (`render-map.sh`가 map conf에 `sorting` 기록) | 이미 렌더링한 지도는 **다시 렌더링해야** 반영됨 (아래 5절) |
| #570 | CLI 테스트 복구 + CI 추가 | 사용자 영향 없음 |
| #548 | `docs/itzg-reference` 동기화 | 문서만 변경 |

## 2. 업데이트 전 준비 (권장)

```bash
# 현재 버전 확인
mcctl --version
mcctl status

# 루트 compose / .env 수동 백업 (upgrade도 compose는 백업하지만 .env는 백업하지 않음)
cd <플랫폼 루트>            # docker-compose.yml, .env 가 있는 디렉터리
cp docker-compose.yml docker-compose.yml.pre-2.29.0
cp .env .env.pre-2.29.0

# 월드/서버 설정 백업 (택1, 설정되어 있는 방식으로)
mcctl backup push -m "Before v2.29.0"        # GitHub 월드 백업 (backup init 선행 필요)
mcctl server-backup <server> -m "Before v2.29.0"   # 서버 설정 백업
```

- `mcctl upgrade`는 compose 변경 시 `docker-compose.yml.bak-YYYYMMDDHHMMSS`를 자동 생성합니다(코드: `migrateComposeFile`). `.env`는 `applyEnvDiff`로 새 변수를 **추가**만 하며 별도 백업은 만들지 않습니다.
- 라우터 재생성 중에도 마인크래프트 서버 컨테이너는 중지되지 않습니다(`docker compose up -d router`만 실행). 다만 재생성되는 짧은 시간 동안 25565 접속과 auto-scale 기동이 불가합니다.

## 3. 업데이트 절차

### 3-1. 패키지 업데이트 (CLI + console 서비스)

방법 A: `mcctl update` (권장 — CLI, mcctl-api, mcctl-console, shared를 한 번에)

```bash
mcctl update --check      # 최신 버전 확인만 (업데이트 있으면 exit code 1)
mcctl update              # CLI 설치 → 서비스 설치 → PM2 재시작 → 서버 이미지 태그 정렬 + docker pull
mcctl update --yes        # 확인 프롬프트 생략
```

방법 B: CLI만 직접 설치

```bash
npm install -g @minecraft-docker/mcctl     # 권한 오류 시 sudo
mcctl --version                            # 2.29.0 확인
```

- `mcctl update`는 설치된 `mcctl-api`/`mcctl-console`을 `npm install <pkg>@latest` 후 **PM2 재시작**까지 수행합니다. 재시작 실패는 non-fatal이며 결과 표에 `Updated (restart manually)`로 표시됩니다.
- `--cli-only`를 쓰면 서비스/이미지는 건드리지 않습니다. 이 경우 PM2 서비스는 3-3의 수동 절차가 필요합니다.
- **`mcctl update`는 `mcctl upgrade`를 호출하지 않습니다.** 두 명령은 별개이므로 3-2를 반드시 따로 실행해야 합니다(코드상 `upgradeCommand` 호출처는 `mcctl upgrade`, `mcctl init --upgrade` 두 곳뿐).

> 이 문서 작성 시점 메모(MEMORY): npm 발행이 E404로 실패한 이력이 있어(#554) 릴리즈 직후에는 npm `latest`가 2.29.0인지 먼저 확인하세요: `npm view @minecraft-docker/mcctl version`

### 3-2. 설정 파일 마이그레이션: `mcctl upgrade`

```bash
mcctl upgrade --dry-run          # 변경 내용만 미리 보기 (파일 수정 없음)
mcctl upgrade                    # 대화형: 새 .env 변수 값 입력 + compose diff 확인
mcctl upgrade --non-interactive  # 프롬프트 없이 기본값/자동 적용 (CI, 스크립트용)
```

실행 순서와 동작(`upgradeCommand`):

1. **`.env` 마이그레이션** — 번들 템플릿 `.env.example`과 비교해 없는 변수를 추가. `DOCKER_GID`도 이 단계에서 템플릿 기본값(`999`)으로 들어올 수 있음.
2. **`DOCKER_GID` 자동 설정** — docker 소켓(`/var/run/docker.sock`, `DOCKER_HOST=unix://...`이면 그 경로)의 소유 GID를 `stat`으로 읽어 `.env`에 기록.
   - `.env`에 `DOCKER_GID`가 **없거나 `999`(템플릿 기본값)/빈 값일 때만** 덮어씀. 직접 다른 값을 넣었다면 유지.
   - 소켓 GID가 0(root 소유)이거나 소켓을 읽을 수 없으면 아무것도 쓰지 않음(root 그룹은 부여하지 않음).
   - `--dry-run`에서는 쓰지 않음.
3. **루트 `docker-compose.yml`의 router 패치** (`patchRouterCompose`)
   - `router.image`: `itzg/mc-router:<버전>` 태그가 템플릿보다 **낮을 때만** 올림(`latest` 같은 비버전 태그는 건드리지 않음).
   - `router.group_add`: 없을 때만 템플릿의 `group_add: - "${DOCKER_GID:-999}"` 블록 추가.
   - 그 외 서비스/포트/주석은 수정하지 않으며, 패치 결과를 YAML로 다시 파싱해 image/group_add 외 변경이 있으면 적용을 거부(`invalid`).
   - 변경이 있으면 diff 표시 → (대화형) `Apply to docker-compose.yml?` 확인 → `docker-compose.yml.bak-<타임스탬프>` 백업 → 쓰기 → `docker compose up -d router`로 라우터 재생성. 실패 시 백업에서 복원.
   - router 블록을 찾지 못하거나 파싱이 안 되면 경고만 출력하고 건너뜀: 이 경우 4-2의 수동 수정 필요.
   - 확인에서 `n`을 선택하면 건너뜀 → 이후 compose를 직접 고쳐야 함.
4. **`servers/_template/{docker-compose.yml,config.env}`를 번들 템플릿으로 덮어쓰기.** 이 두 파일을 직접 수정해 쓰고 있었다면 upgrade 전에 백업해 두세요. (이미 만들어진 개별 서버 디렉터리는 수정하지 않음)
5. `mcctl-config`의 `templateVersion`을 CLI 버전으로 갱신.

compose 패치가 실패하면 나머지 단계(템플릿 갱신, 버전 갱신)는 계속 수행한 뒤 종료 코드 1을 반환합니다.

### 3-3. PM2 서비스 재시작 (console/API)

`mcctl update`(기본 모드)가 이미 재시작했다면 생략 가능합니다. `--cli-only`로 올렸거나 `Updated (restart manually)`가 표시된 경우:

```bash
mcctl console service restart     # API + Console 재시작 (console은 API에 의존)
mcctl console service status
```

- 새 console 빌드가 이전 프로세스에 로드되지 않는 증상이 있으면 `--force`(PM2 데몬 kill 후 새로 시작)를 쓸 수 있습니다(코드: restart의 force 분기).
- **Node 버전 주의**: mcctl-console의 `better-sqlite3`는 네이티브 모듈입니다. Node 26 셸에서 PM2를 띄우면 ABI 불일치로 500이 난 사례가 있어, Node 22(LTS 계열)에서 재시작하세요(프로젝트 메모리: `nvm use 22` → `pm2 kill` → 재기동).

### 3-4. 라우터 재생성 (upgrade가 하지 못한 경우만)

```bash
cd <플랫폼 루트>
docker compose up -d router      # compose 변경을 반영해 컨테이너 재생성
```

> 주의: `mcctl router restart`는 내부적으로 `docker compose restart router`입니다. 이 명령은 **컨테이너를 재시작할 뿐 compose 변경(새 이미지, group_add)을 반영하지 않습니다.** 설정 변경 후에는 반드시 `up -d router`를 쓰세요.

## 4. 업데이트 후 체크리스트

### 4-1. 버전/상태

```bash
mcctl --version                      # 2.29.0
mcctl status                         # 전체 상태
mcctl status router                  # mc-router 상태
mcctl console service status         # PM2: API(:5001), Console(:5000)
```

### 4-2. router / docker 소켓 group_add

```bash
# 소켓 GID와 .env 값이 일치하는지
stat -c %g /var/run/docker.sock      # macOS: stat -f %g /var/run/docker.sock
grep '^DOCKER_GID=' .env

# compose에 반영되었는지
grep -n 'mc-router:' docker-compose.yml        # 1.47.1
grep -n -A1 'group_add' docker-compose.yml     # - "${DOCKER_GID:-999}"

# 실제 컨테이너 설정/로그
docker inspect mc-router --format '{{.Config.Image}} {{.HostConfig.GroupAdd}}'
docker logs --tail 50 mc-router
```

정상 기준:
- 이미지가 `itzg/mc-router:1.47.1`, `GroupAdd`에 소켓 GID가 포함됨.
- 로그에 docker 소켓 permission denied 류 오류가 없음.
- `.env`의 `DOCKER_GID`가 소켓 GID와 같음. 다르거나 `999`로 남아 있으면 `.env`를 소켓 GID로 고치고 `docker compose up -d router`.

수동 수정이 필요한 경우(upgrade가 patch를 건너뛴 경우 등) router 서비스에 다음을 넣습니다:

```yaml
  router:
    image: itzg/mc-router:1.47.1
    group_add:
      - "${DOCKER_GID:-999}"
```

참고:
- `DOCKER_GID`가 `999` 기본값인 채로 소켓 GID가 다른 호스트라면 권한 오류가 날 수 있으므로 위 `stat` 비교가 핵심 확인 항목입니다.
- rootless Docker 등 소켓 경로가 다르면 `DOCKER_HOST=unix://...` 환경에서 upgrade/init이 그 경로를 사용하지만, compose의 볼륨 마운트(`/var/run/docker.sock`)는 자동 변경되지 않습니다.
- 신규 `init.sh`의 router 준비 확인이 `docker exec ... nc` 대신 25565 포트 연결 검사로 바뀌었습니다(이미지에 `nc`가 없음). 기존 설치에는 영향 없음.

### 4-3. 접속/라우팅/auto-scale

```bash
mcctl status                         # 서버 상태 확인
# 클라이언트에서 <server>.<HOST_IP>.nip.io:25565 로 접속 → 중지 상태 서버가 기동되는지(auto-scale)
docker ps --format '{{.Names}}\t{{.Status}}' | grep mc-
```

- 중지된 서버에 접속했을 때 기동되면 라우터의 docker 소켓 접근이 정상입니다.
- 접속은 되나 auto-scale이 안 되면 4-2의 `GroupAdd`/로그를 먼저 확인.
- 문제 시 임시 롤백은 5절 참고.

### 4-4. console (Web UI)

- `http://<host>:5000` 로그인 확인, 월드 상세 → 통계 패널에서 Ore & Block Stats가 새 시각화로 표시되는지 확인(브라우저 캐시가 남으면 강력 새로고침).
- `mcctl console service status`에서 API/Console이 online이고 restarts 값이 계속 증가하지 않는지 확인. 계속 증가하면 `pm2 logs`/`mcctl console service logs` 확인(Node 버전 문제는 3-3 참고).

### 4-5. 지도(BlueMap) 기본 뷰

`render-map.sh`는 렌더링할 때마다 `maps/<world>/config/maps/*.conf`를 새로 만들며 이제 `sorting: 0/1/2`(overworld/nether/end)를 기록합니다. 따라서 **업데이트 후 해당 월드를 다시 렌더링해야** 기본 뷰가 overworld로 바뀝니다(console의 지도 렌더링 버튼, 또는 `platform/scripts/render-map.sh <world>`). 캐시 타일을 버리는 전체 재렌더링은 `--force`이며, 단순히 기본 뷰만 바꾸려는 목적이면 필요 여부는 직접 확인이 필요합니다(이 문서에서는 검증하지 못함).

### 4-6. 서버 이미지 / 템플릿

- `mcctl update`가 서버별 `docker-compose.yml`의 `itzg/minecraft-server` 이미지 태그를 VERSION에 맞는 권장 태그로 조정하고(`LATEST`는 `java25`), 이미지를 pull합니다. 변경된 서버는 출력에 `⚠ <server>: A → B`로 표시되며, **재시작해야 반영**됩니다.
- `servers/_template/*`이 갱신되었는지(백업해둔 사용자 수정이 있다면 다시 병합).

## 5. 문제 발생 시 롤백

```bash
cd <플랫폼 루트>
# compose 복원 (upgrade가 만든 백업 중 최신 사용)
ls docker-compose.yml.bak-*
cp docker-compose.yml.bak-<타임스탬프> docker-compose.yml
docker compose up -d router

# CLI 이전 버전으로
npm install -g @minecraft-docker/mcctl@2.28.0
```

- `.env`의 `DOCKER_GID` 줄은 이전 버전에서도 무시되므로 남겨 두어도 됩니다.
- 서비스 패키지를 이전 버전으로 되돌려야 하면 `.services/`(없으면 플랫폼 루트)에서 `npm install @minecraft-docker/mcctl-api@2.28.0 @minecraft-docker/mcctl-console@2.28.0` 후 `mcctl console service restart`.
- mc-router 1.43.1 + `group_add` 유지는 무해하나, 1.46+의 non-root 요구사항(group_add)은 1.47.1을 쓰는 한 필요합니다.

## 6. 요약 체크리스트

- [ ] 백업: `.env`, `docker-compose.yml`, `servers/_template` 수정분, 월드/서버 설정
- [ ] `npm view @minecraft-docker/mcctl version` 이 2.29.0
- [ ] `mcctl update` (또는 `npm install -g @minecraft-docker/mcctl`)
- [ ] `mcctl upgrade --dry-run` → `mcctl upgrade`
- [ ] `docker inspect mc-router`: 이미지 1.47.1, GroupAdd = 소켓 GID
- [ ] 접속 및 auto-scale 기동 확인
- [ ] `mcctl console service status` online, Web UI 통계 패널 확인
- [ ] 필요한 월드 지도 재렌더링(기본 뷰 overworld)
- [ ] 이미지 태그가 바뀐 서버는 재시작
