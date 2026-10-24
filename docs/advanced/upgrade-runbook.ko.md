# 업그레이드 런북 (릴리즈 공통)

새 릴리즈가 나올 때마다 **같은 순서**로 전체 시스템(CLI, API, Console, 플랫폼 설정, router, 서버, 지도)을 올리는 절차입니다. 버전에 상관없이 `NEW` 변수만 바꿔서 사용합니다. 릴리즈별 특이사항은 해당 릴리즈의 [CHANGELOG](https://github.com/smallmiro/minecraft-server-manager/blob/main/CHANGELOG.md)와 릴리즈 노트를 먼저 읽으세요.

!!! warning "먼저 알아둘 것"
    - `mcctl update`는 패키지(CLI/API/Console/shared)만 올립니다. **`mcctl upgrade`(.env, `servers/_template`, 루트 compose의 router)는 자동 실행되지 않으므로 반드시 별도로 실행**합니다.
    - 모든 명령은 **PM2가 사용하는 Node 버전의 셸**에서 실행합니다(아래 0단계). 셸 Node와 PM2 Node가 다르면 `better-sqlite3` ABI 불일치로 Console이 500을 반환할 수 있습니다.

## v3.0.0 업그레이드 스크립트 {#v300-upgrade-script}

v2.x에서 v3.0.0으로 올릴 때는 `scripts/upgrade-v3.sh`가 아래 단계를 차례로 안내하고, 바꾸기 전에 묻습니다. 먼저 점검만 해 보고 실행하세요.

```bash
# 1. 드라이런: 점검과 계획만 보여 주고 아무것도 바꾸지 않음
curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash -s -- --dry-run
# 2. 실행 (바꾸는 단계마다 물음)
curl -fsSL https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh | bash
```

실행 전에 스크립트를 읽어 보려면:

```bash
curl -fsSLO https://raw.githubusercontent.com/smallmiro/minecraft-server-manager/main/scripts/upgrade-v3.sh
less upgrade-v3.sh
bash upgrade-v3.sh --dry-run
```

`bash`로 파이프해도 안전합니다. 질문은 터미널에서 읽고, 스크립트가 띄우는 모든 명령은 빈 입력을 받으며, 다운로드가 중간에 끊기면 아무것도 실행하지 않습니다. Linux와 macOS(bash 3.2)를 지원합니다. 터미널이 없고 `--yes`도 없으면 바꾸는 단계는 건너뜁니다. 출력 전체는 `upgrade.log`에도 남습니다(백업 폴더, 드라이런이면 임시 폴더).

| 옵션 | 의미 |
|---|---|
| `--root <dir>` | 플랫폼 루트(기본 `$MCCTL_ROOT`, 없으면 `~/minecraft-servers`) |
| `--yes` | 묻지 않고 각 질문의 기본 답을 사용 |
| `--dry-run` | 점검과 계획만 보여 주고 아무것도 바꾸지 않음 |
| `--skip-update` | `mcctl update`를 하지 않음(CLI를 이미 올렸거나 로컬 빌드) |
| `--remove-scripts` | 백업한 뒤 `<root>/scripts`를 묻지 않고 삭제 |
| `--help` | 옵션 보기 |

첫 단계 전에 `mcctl --version`과 `npm view @minecraft-docker/mcctl version`을 읽습니다. CLI가 이미 3.x면 업데이트를 건너뜁니다. npm `latest`가 3.x가 아니면 멈춥니다(v3 빌드가 있으면 `--skip-update`).

| 단계 | 하는 일 | 종류(기본 답) |
|---|---|---|
| 0 사전 점검 | 루트 파일, `which -a mcctl`, PM2와 셸의 Node 메이저, 백업용 git 2.31, `scripts/*.sh`·`player lookup\|uuid`를 부르는 cron·타이머, macOS의 `mcctl console` 안내 | 자동(읽기 전용) |
| 1 백업 | [1단계](#1-백업)의 파일과 `<root>/scripts`를 `<root>/backups/upgrade-v3-<시각>/`에 복사. 선택: `mcctl backup push` | 선택(예, push는 아니요) |
| 2 업데이트 | `mcctl update --yes` 후 버전이 3.x인지 확인 | 선택(예) |
| 3 업그레이드 | `mcctl upgrade --dry-run`을 보여 주고 `mcctl upgrade --non-interactive` 실행 | 선택(예) |
| 4 `<root>/scripts` | 폴더 유지 또는 삭제(백업한 뒤에만, 링크면 링크만 제거) | 선택(유지) |
| 5 `ecosystem.config.cjs` | v2.32.0 미만이면 옛 `AUTH_MODE` 값 수정([4-1](#4-1-v2320-이상으로-올릴-때-콘솔-접근-모드-확인-633)), mcctl-api에 `kill_timeout` 추가([4-2](#pm2-kill-timeout)), 이어서 `mcctl console service restart --force` | 선택(AUTH_MODE 아니요, kill_timeout은 `BACKUP_AUTO_ON_STOP=true`면 예, 재시작 예) |
| 6 ServerSpec | `mcctl migrate spec --all --dry-run`을 보여 주고 선택 시 실행 | 선택(아니요) |
| 7 월드 | `mcctl world list`를 보여 주고 중복·경고 줄을 강조 | 자동 |
| 8 검증 | `mcctl --version`, `docker compose config -q`, PM2 상태, API `/health`(`ecosystem.config.cjs`가 있을 때만) | 자동 |
| 9 요약 | 단계별 결과, 남은 일, 롤백, 로그 위치 | 자동 |

2단계를 건너뛰거나(아니요로 답하거나 터미널도 `--yes`도 없을 때) 실패하면 이후 단계는 실행하지 않고 "The upgrade did not finish"로 멈춥니다. 이후 단계는 v3 CLI가 있어야 하기 때문입니다. 원인을 해결하고 다시 실행하세요. 백업이나 `mcctl upgrade` 실패도 같습니다. 실패한 단계가 하나라도 있으면 종료 코드는 1입니다.

v2 CLI에서 드라이런하면 `mcctl upgrade --dry-run` 미리보기는 지금 설치된 v2 CLI의 계획입니다. v3 계획은 업데이트 후에 나옵니다.

5단계는 `ecosystem.config.cjs`를 `node`로 읽어(PM2처럼 파일을 실행합니다) 판단하고, mcctl-api의 `name:` 줄이 한 줄에 `name: 'mcctl-api',`만 있을 때만 수정합니다. 수정 뒤 다시 읽어 결과를 확인하고, 어긋나면 원본으로 되돌리며 재시작하지 않습니다. 심볼릭 링크이거나 앱 객체가 한 줄이면 수정하지 않고 직접 추가할 내용을 안내합니다.

**스크립트가 하지 않는 일**(요약에도 다시 나옵니다):

- **실행 중인 서버 재시작.** 한가한 때 `mcctl stop <server> && mcctl start <server>`로 하세요.
- **cron·타이머·직접 만든 스크립트 교체.** `<root>/scripts/*.sh`를 부르는 곳은 경고만 합니다. [3-1의 대응표](#v300-scripts)로 바꾸세요.
- **롤백.** 요약이 `npm install -g @minecraft-docker/mcctl@<이전 버전> && mcctl console service restart --force`와 파일을 되돌릴 백업 폴더를 알려 줍니다([8단계](#8-롤백)).

테스트용 환경 변수: `MCCTL_UPGRADE_TTY`는 `/dev/tty`를 대신합니다(읽을 수 있는 파일이면 그 내용이 답, 열 수 없는 경로면 "터미널 없음").

## 0. 사전 점검

```bash
# 변수: 올릴 버전 / 플랫폼 루트
export OLD=$(mcctl --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')   # 현재 버전(롤백용)
export NEW=2.29.1
export ROOT=~/minecraft-servers          # docker-compose.yml, .env, .mcctl.json 이 있는 곳

# PM2가 쓰는 Node 버전 확인 후 같은 버전의 셸로 전환 (예: 22)
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env']['version'],p['pm2_env']['node_version']) for p in json.load(sys.stdin)]"
nvm use 22 && node --version

# mcctl 설치본이 여러 개이면 어느 것이 실행되는지 확인
which -a mcctl && mcctl --version
npm view @minecraft-docker/mcctl version      # = $NEW 인지 확인(발행 직후 1~2분 지연 가능)
```

**게이트:** `node --version`이 PM2 Node 메이저와 같고, `npm view` 결과가 `$NEW`여야 합니다.

## 1. 백업

```bash
cd $ROOT
S=pre-$NEW; B=$ROOT/backups-$S
mkdir -p $B                                   # servers/ 밖에 둡니다 (아래 경고 참고)
cp docker-compose.yml $B/docker-compose.yml
cp .env $B/.env
cp .mcctl.json $B/.mcctl.json
cp -r servers/_template $B/_template
mcctl status                                  # 현재 상태 기록
# 월드/서버 설정 백업(설정된 방식으로)
mcctl server-backup <server> -m "Before v$NEW"
```

**게이트:** `$B` 안에 `docker-compose.yml`, `.env`, `.mcctl.json`, `_template`이 모두 존재.

!!! danger "백업을 `servers/` 안에 두지 마세요"
    `mcctl update`는 `servers/` 아래 모든 디렉터리를 서버로 보고 이미지 태그를 점검·변경합니다. `servers/_template.pre-…` 같은 사본이 있으면 서버로 오인되어 내용이 바뀌고, 롤백 시 변조된 값이 복원됩니다.

## 2. 패키지 업데이트

```bash
mcctl update --check          # 업데이트 있으면 exit 1
mcctl update --yes            # CLI + api/console/shared 설치, PM2 재시작
hash -r && mcctl --version    # = $NEW
```

- `Updated (restart manually)`가 보이면 4단계를 수행합니다.
- `mcctl update`가 서버 compose의 이미지 태그를 바꾸면 `⚠ <server>: A → B` 출력을 기록합니다. mc-router auto-scale은 기존 컨테이너를 `docker start`만 하고 다시 만들지 않으므로, 중지된 서버는 컨테이너를 다시 만들기 전까지 옛 이미지로 뜹니다. `mcctl update`를 시작한 CLI가 v3.0.1 이상이면 중지된 서버마다 컨테이너를 다시 만들고 서버별로 `recreated` 또는 `up to date`를 출력합니다(5단계 참고).

**롤백 지점:** `npm install -g @minecraft-docker/mcctl@<이전버전>` 후 `mcctl console service restart --force`.

## 3. 설정 마이그레이션

```bash
mcctl upgrade --dry-run       # 변경 미리보기
```

dry-run에서 확인: 새 `.env` 변수, compose 변경(`router.image`, `router.group_add`), 예상 밖 변경이 없는지. 이상하면 중단하고 보고합니다.

```bash
mcctl upgrade                 # 새 .env 변수는 기본값 수락, compose 적용은 y
mcctl upgrade --non-interactive   # 프롬프트 없이 기본값 적용(자동화용)
```

- `.env`에 새 변수가 추가되고(`DOCKER_GID` 등), `docker-compose.yml.bak-<타임스탬프>`가 생성되며, router가 변경되면 `docker compose up -d router`가 자동 실행됩니다.
- `servers/_template/*`가 덮어써지고 `.mcctl.json`의 `templateVersion`이 갱신됩니다.
- (v2.32.0 이상) `servers/global.env`가 없으면 만들고, 기존 서버의 `- ../../.env`를 `- ../global.env`로 바꿔 플랫폼 시크릿이 서버 컨테이너로 넘어가지 않게 합니다. 컨테이너는 다시 만들 때까지 옛 환경 변수를 유지하므로 5단계에서 서버마다 stop 후 start합니다. [환경 변수](../configuration/environment.ko.md) 참고.
- (v2.33.0 이상) `ecosystem.config.cjs`가 아직 `BETTER_AUTH_SECRET` / `BETTER_AUTH_BASE_URL`을 정의하고 있으면 두 값을 `.env`로 옮기고(시크릿은 그대로라 세션 유지), ecosystem 파일에서 키를 제거하며, 같은 위치에 `ecosystem.config.cjs.bak-<타임스탬프>`를 만듭니다. 4단계의 `mcctl console service restart --console`로 적용됩니다. `--dry-run`은 보여주기만 하고, 두 번째 실행은 아무것도 바꾸지 않습니다(#699).
- `.mcctl.json`에 `installId`가 없으면 한 번 추가합니다 (기존 값은 유지). 웹 콘솔이 익명 사용 통계에 사용하며, 끄려면 `.mcctl.json`에 `"telemetry": false`를 설정합니다 ([사용 통계](../console/web-console.ko.md) 참고).
- **router 이미지가 태그 없는 `itzg/mc-router`이면 `mcctl upgrade`가 image를 올리지 않습니다.** `docker-compose.yml`의 `image:`를 릴리즈 노트가 지정한 버전으로 직접 고정한 뒤 `docker compose config -q && docker compose up -d router`를 실행합니다.

### 3-1. v3.0.0으로 올릴 때: `scripts` 폴더가 없어집니다 (#736) {#v300-scripts}

v3.0.0은 Bash 스크립트를 모두 없앱니다(#715). `mcctl`은 더 이상 `<root>/scripts`를 읽지 않고, 환경 변수 `MCCTL_SCRIPTS`는 무시됩니다.

- `mcctl upgrade`는 `<root>/scripts`의 경로, v3.0.0부터 쓰지 않으며 직접 고친 파일이 있을 수 있다는 경고, 이 대응표 링크를 출력합니다. 터미널에서는 `Remove <path>?`를 묻고 **`y`로 답했을 때만**(기본값 `N`) 삭제합니다. `--non-interactive`이거나 터미널이 없으면(cron) 힌트로 `rm -r <path>`만 출력하고 아무것도 지우지 않습니다. `--dry-run`은 `Would ask before removing <path>.`만 출력합니다. 심볼릭 링크는 링크만 지우고 따라가지 않습니다. 확인을 건너뛰는 옵션은 없습니다. 폴더를 직접 지워도 됩니다. 플랫폼 루트의 다른 파일은 이 폴더에 의존하지 않습니다.
- **지우기 전에 직접 고친 스크립트를 복사해 두세요**(예: `cp -r $ROOT/scripts ~/scripts-backup`). 삭제는 되돌릴 수 없습니다.
- cron, systemd 유닛, 직접 만든 스크립트에서 `<root>/scripts/*.sh`를 바로 부르고 있었다면 폴더를 지우기 전에 바꾸세요. 대응표는 다음과 같습니다.

| 예전 스크립트 (`<root>/scripts/`) | v3.0.0 |
|---|---|
| `mcctl.sh start` / `stop` / `status` / `logs` | `mcctl start` / `mcctl stop` / `mcctl status` / `mcctl logs` |
| `mcctl.sh console` | `mcctl console <server>` (TCP RCON) |
| RCON 명령 (스크립트를 거친 `rcon-cli`) | `mcctl exec <server> <command...>` |
| `create-server.sh` | `mcctl create` |
| `delete-server.sh` | `mcctl delete` |
| `backup.sh push` / `status` / `history` / `restore` | `mcctl backup push` / `status` / `history` / `restore` |
| `lock.sh` | `mcctl world` (`list`, `assign`, `release`, [월드 배정 규칙](../cli/commands.ko.md#world-assignment-rules) 참고) |
| `player.sh lookup` / `uuid` | `mcctl player info <name> [--offline]` |
| `logs.sh` | `mcctl logs` |
| `init.sh` | `mcctl init` |
| `render-map.sh` | CLI 명령 없음. 웹 콘솔의 **Render map**이나 API를 사용합니다 (BlueMap) |
| `migrate-nip-io.sh` | 전용 명령 없음. 호스트 IP가 바뀐 뒤 `mcctl init --reconfigure`를 실행하고 "Update existing servers with new IP hostnames?"에 yes로 답하세요. 모든 서버를 다시 렌더링하며 nip.io 라우터 호스트가 새 `HOST_IPS`를 따릅니다(직접 추가한 호스트는 유지) |
| `lib/common.sh` | 없음. 스크립트 내부 헬퍼 라이브러리였습니다. 이름 규칙은 TypeScript에 있습니다 |

- 서버는 그대로 동작합니다. 서버를 바꾸는 첫 명령이 `servers/<name>/server.yaml`을 만들고 `config.env`와 서버의 `compose.yml`을 다시 씁니다. 자세한 내용은 [server.yaml](../configuration/server-yaml.ko.md)을 보세요.

**확인 기준:** `ls $ROOT/scripts`가 폴더 없음을 보고하고(또는 남기기로 선택했고), `crontab -l`과 `systemctl list-timers`에 그 폴더의 `.sh` 파일이 남아 있지 않습니다.

## 4. API / Console 재시작 (필요 시)

```bash
mcctl console service restart
# 새 빌드가 안 뜨거나 ABI 오류(NODE_MODULE_VERSION)가 나면
mcctl console service restart --force
cd $ROOT && npm rebuild better-sqlite3 && mcctl console service restart --force
```

### 4-1. v2.32.0 이상으로 올릴 때: 콘솔 접근 모드 확인 (#633)

v2.31.0 이하에서 v2.32.0 이상으로 올릴 때 한 번만 합니다. `mcctl console init`을 실행한 호스트에만 해당합니다.

v2.31.0까지는 `mcctl console init`이 선택한 접근 모드를 `AUTH_MODE`에 그대로 썼습니다. mcctl-api는 `internal`, `api-key-ip`, `open`을 인식하지 못하고, `NODE_ENV=production`이면 `api-key`(그 외에는 `disabled`)로 동작합니다. v2.32.0부터는 `mcctl console init`이 mcctl-api가 인식하는 값으로 씁니다. `mcctl update`와 `mcctl upgrade`는 `ecosystem.config.cjs`를 다시 쓰지 않으므로, 기존 설치는 직접 바꾸기 전까지 옛 값이 남습니다.

```bash
grep -nE "AUTH_MODE|AUTH_IP_WHITELIST" $ROOT/ecosystem.config.cjs
```

| 현재 `AUTH_MODE` | 바꿀 값 | 영향 |
|---|---|---|
| `api-key`, `ip-whitelist`, `disabled`, `basic`, `combined` | 할 일 없음 | - |
| `internal` | `ip-whitelist` + `AUTH_IP_WHITELIST: '127.0.0.1,::1,::ffff:127.0.0.1'` | 호스트 자신(Console)만 API를 호출할 수 있음 |
| `api-key-ip` | `combined` (`AUTH_API_KEY`, `AUTH_IP_WHITELIST`는 유지) | IP 화이트리스트가 실제로 적용됨. 목록 밖 클라이언트는 403 |
| `open` | `disabled` | 인증이 실제로 꺼짐. 개발 환경 전용 |

```bash
cd $ROOT
cp ecosystem.config.cjs $B/ecosystem.config.cjs     # 롤백용(8단계)
sed -i \
  -e "s/^\( *\)AUTH_MODE: 'internal',/\1AUTH_MODE: 'ip-whitelist',\n\1AUTH_IP_WHITELIST: '127.0.0.1,::1,::ffff:127.0.0.1',/" \
  -e "s/AUTH_MODE: 'api-key-ip',/AUTH_MODE: 'combined',/" \
  -e "s/AUTH_MODE: 'open',/AUTH_MODE: 'disabled',/" \
  ecosystem.config.cjs
grep -nE "AUTH_MODE|AUTH_IP_WHITELIST" ecosystem.config.cjs
mcctl console service restart --force               # 일반 restart는 옛 env를 그대로 씀
```

`sed`는 다른 모드는 건드리지 않습니다. 파일을 고치는 대신 `mcctl console init --force`를 다시 실행해도 되지만, 이 경우 파일 전체를 다시 쓰고 설정 질문을 모두 다시 묻습니다.

**확인:** `AUTH_MODE`가 `disabled`, `api-key`, `ip-whitelist`, `basic`, `combined` 중 하나이고, API `/health`가 200이며 Console에서 서버 목록이 보임(7-6단계).

### 4-2. mcctl-api가 자동 백업을 마칠 시간 주기 (#734) {#pm2-kill-timeout}

이 릴리스 전에 `mcctl console init`을 실행했고 `BACKUP_AUTO_ON_STOP=true`인 호스트에서 한 번만 합니다.

API나 콘솔에서 정지하면 자동 백업이 백그라운드에서 돌고, mcctl-api는 종료할 때 이 백업을 최대 2분 기다립니다. 그래야 백업이 플러시한 서버의 자동 저장(`save-on`)을 다시 켤 수 있습니다. PM2는 앱에 `kill_timeout`이 없으면 정지를 요청하고 1.6초 뒤에 프로세스를 죽입니다. 이제 `mcctl console init`은 mcctl-api에 `kill_timeout: 130000`을 씁니다. `mcctl update`와 `mcctl upgrade`는 `ecosystem.config.cjs`를 다시 쓰지 않고, 일반 PM2 재시작은 예전 설정을 유지합니다.

```bash
cd $ROOT
grep -n "kill_timeout" ecosystem.config.cjs || echo "없음: 추가하세요"
# mcctl-api 앱의 max_memory_restart 옆에 다음 줄을 추가:
#       kill_timeout: 130000,
mcctl console service restart --force               # 파일에서 앱을 다시 등록
```

파일을 고치는 대신 `mcctl console init --force`를 다시 실행해도 되지만, 이 경우 파일 전체를 다시 쓰고 설정 질문을 모두 다시 묻습니다.

**확인:** `pm2 describe mcctl-api`에 `kill timeout` 130000이 보임(재시작 전에는 `grep kill_timeout ecosystem.config.cjs`로 확인).

## 5. 서버 이미지 반영

중지된 서버는 기동만으로는 새 이미지가 적용되지 않습니다. auto-scale은 기존 컨테이너를 `docker start`만 하므로 옛 이미지로 뜹니다. v3.0.1부터 `mcctl update`가 중지된 서버의 컨테이너를 (기동하지 않고) 다시 만들고 서버별로 `recreated`, `up to date`, 실패 사유를 보고합니다. 업데이트 전체는 `mcctl update`를 시작한 CLI 프로세스에서 실행되므로, 그 CLI가 v3.0.1보다 낮았다면(v3.0.0 → v3.0.1 포함) 이 단계는 실행되지 않았습니다. `mcctl update`를 한 번 더 실행하거나, 플랫폼 디렉터리에서 중지된 서버마다 직접 실행합니다.

```bash
docker compose up --no-start --no-deps mc-<server>
```

실행 중인 서버는 건드리지 않습니다. 실행 중인 서버는 사용자 영향이 없는 시간에 `mcctl stop <server> && mcctl start <server>`로 재기동합니다(월드는 보존).

## 6. 지도(BlueMap) 재렌더 (릴리즈 노트에 지도 변경이 있을 때만)

지도를 만든 월드는 Console의 월드 상세에서 **Render map**을 다시 실행합니다. 렌더러가 매번 지도 설정을 새로 생성하므로 보통 `--force`는 필요 없습니다.

## 7. 업그레이드 후 검증

모든 항목이 통과해야 완료입니다. 실패하면 8단계(롤백)로 갑니다.

### 7-1. 버전

```bash
hash -r
mcctl --version                                   # = $NEW
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env']['version'],p['pm2_env']['status'],p['pm2_env']['node_version'],'restarts=',p['pm2_env']['restart_time']) for p in json.load(sys.stdin)]"
# 기대: mcctl-api / mcctl-console 모두 $NEW, online, PM2 Node와 동일, restarts가 계속 증가하지 않음
mcctl update --check                              # 더 올릴 패키지가 없어야 함(shared 포함)
```

### 7-2. 설정 파일

```bash
cd $ROOT
python3 -c "import json;c=json.load(open('.mcctl.json'));print('templateVersion =',c.get('templateVersion'),'| installId present =','installId' in c)"   # = $NEW 이하의 최신 템플릿 버전
diff <(grep -oE '^[A-Z_]+=' .env | sort) <(grep -oE '^[A-Z_]+=' $B/.env | sort)   # 추가된 변수만 보여야 함
docker compose config -q && echo "compose OK"
```

### 7-3. router

```bash
stat -c %g /var/run/docker.sock                   # 소켓 GID
grep '^DOCKER_GID=' .env                          # 위와 같아야 함
docker inspect mc-router --format '{{.Config.Image}} {{.HostConfig.GroupAdd}}'   # 기대 이미지 태그, GroupAdd에 위 GID
docker logs --tail 30 mc-router                   # "permission denied" 없음, 라우팅 시작 로그
```

### 7-4. API / Console

```bash
curl -s -o /dev/null -w 'console %{http_code}\n' http://localhost:5000      # 200 또는 3xx
curl -s -o /dev/null -w 'api %{http_code}\n'     http://localhost:5001/health   # 200
mcctl console service status                      # 둘 다 online
pm2 logs mcctl-console --lines 30 --nostream      # better-sqlite3 / NODE_MODULE_VERSION 오류 없음
```

### 7-5. 서버 / auto-scale

```bash
mcctl status
# 중지된 서버로 접속(<server>.<HOST_IP>.nip.io:25565) → 서버가 기동되는지
docker logs --tail 30 mc-router | grep -iE "error|denied|scale"
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}'
```

### 7-6. 화면 스모크 테스트

브라우저(강력 새로고침)에서 `http://<host>:5000`: 로그인 → 서버 목록 → 월드 상세(정보/통계 패널) → 지도 패널(기본 뷰가 Overworld인지). 릴리즈 노트에 적힌 변경 화면이 있으면 그 화면도 확인합니다.

### 7-7. 완료 체크리스트

- [ ] `mcctl --version`, PM2 api/console = `$NEW`, online, Node 일치
- [ ] `mcctl update --check`에 남은 업데이트 없음
- [ ] `.mcctl.json` `templateVersion` 갱신, `docker compose config -q` 통과
- [ ] router 이미지 태그/`DOCKER_GID`/GroupAdd 일치, 로그에 오류 없음
- [ ] API `/health` 200, Console 200, PM2 restarts 증가 없음
- [ ] 중지된 서버가 접속으로 기동됨(auto-scale)
- [ ] 화면 스모크 테스트 통과
- [ ] (v2.31.0 이하 → v2.32.0 이상) `ecosystem.config.cjs`의 `AUTH_MODE`가 mcctl-api가 인식하는 값임(4-1단계)
- [ ] 안정 확인 후 `$B`(`backups-pre-$NEW`) 삭제

## 8. 롤백

```bash
cd $ROOT; B=$ROOT/backups-pre-$NEW
cp $B/docker-compose.yml docker-compose.yml
cp $B/.env .env
cp $B/.mcctl.json .mcctl.json
rm -rf servers/_template && cp -r $B/_template servers/_template
docker compose up -d router
[ -f $B/ecosystem.config.cjs ] && cp $B/ecosystem.config.cjs ecosystem.config.cjs   # 4-1단계에서 바꾼 경우
[ -n "$(ls ecosystem.config.cjs.bak-* 2>/dev/null)" ] && echo "3단계에서 BETTER_AUTH_*를 옮겼다면 최신 ecosystem.config.cjs.bak-*를 복원"
# 패키지를 이전 버전 OLD로 (PM2 Node 셸에서)
npm install -g @minecraft-docker/mcctl@$OLD
npm install @minecraft-docker/mcctl-api@$OLD @minecraft-docker/mcctl-console@$OLD @minecraft-docker/shared@$OLD
mcctl console service restart --force
```

!!! note
    mc-router 1.46+는 non-root라서 `group_add`(`DOCKER_GID`)가 필수입니다. 이미지를 옛 버전으로 되돌릴 때를 제외하고 `group_add`는 제거하지 마세요.
