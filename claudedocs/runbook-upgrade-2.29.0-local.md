# 런북: 이 호스트 mcctl 2.28.0 → 2.29.0 업그레이드

작성 기준: 2026-10-10, 왼쪽 아래 pane(`wF:p7`)에서 직접 확인한 값. 이 런북은 **아직 실행하지 않았습니다.**
일반 가이드는 `claudedocs/upgrade-v2.29.0.md` 참고. 이 문서는 **이 호스트의 실제 상태**에 맞춘 실행 순서입니다.

## 0. 확인된 현재 상태 (실측)

| 항목 | 값 |
|------|-----|
| CLI | `mcctl version 2.28.0` (`~/.local/bin/mcctl`) |
| npm 최신 | `2.29.0` (`npm view @minecraft-docker/mcctl version`) |
| 플랫폼 루트 | `~/minecraft-servers` (`.env`, `docker-compose.yml`, `.mcctl.json`) |
| `templateVersion` | `2.26.2` (여러 버전 건너뜀 → upgrade가 .env/템플릿 변경을 더 많이 보여줄 수 있음) |
| PM2 | `mcctl-api` 2.28.0 / `mcctl-console` 2.28.0, 둘 다 online, **Node 22.22.0** |
| 셸 Node | **v26.9.0** ⚠️ (PM2 Node와 다름) |
| 서비스 설치 위치 | `~/minecraft-servers/node_modules/@minecraft-docker/*` (`.services/` 없음, legacy 위치) |
| docker 소켓 | `root:docker`, GID **1001**, 사용자 `smallmiro`는 docker 그룹 |
| `.env`의 `DOCKER_GID` | 없음 → upgrade가 `1001`로 추가할 예정 |
| mc-router | 컨테이너 Up 9일, 이미지 **태그 없는 `itzg/mc-router`**(로컬 `latest`, 약 7개월 전 빌드), `GroupAdd=[]` |
| 로컬에 이미 있는 이미지 | `itzg/mc-router:1.47.1` (3주 전 pull) |
| 마인크래프트 서버 | `mc-factory`, `mc-wild-deity` 모두 Exited (중지 상태) |
| compose 기타 | `playit` 서비스 포함 (패치 대상 아님) |

## 1. 이 호스트에서 반드시 알아야 할 함정 2가지

### 함정 A — router 이미지가 태그 없음 → `mcctl upgrade`가 이미지를 올려주지 않음
`patchRouterCompose`는 `image: itzg/mc-router:<버전>` 형태만 인식합니다(`IMAGE_RE`). 이 호스트는 `image: itzg/mc-router`(태그 없음)라서 **image는 패치되지 않고 `group_add`만 추가**됩니다. 그 상태로 `docker compose up -d router`를 하면 기존 로컬 `latest`(7개월 전)가 그대로 쓰입니다.
→ **조치:** 5단계에서 `image:`를 `itzg/mc-router:1.47.1`로 **수동 수정**합니다.

### 함정 B — 셸 Node(v26)와 PM2 Node(v22) 불일치
`mcctl update`는 `npm install @minecraft-docker/mcctl-console@latest`를 **현재 셸의 Node**로 실행합니다. `better-sqlite3`는 네이티브 모듈이라 v26으로 빌드되면 Node 22 PM2에서 ABI 불일치로 500이 날 수 있습니다(프로젝트 메모리에 기록된 증상).
→ **조치:** 2단계 이후 모든 명령을 `nvm use 22` 셸에서 실행합니다.

## 2. 사전 준비 (백업 + Node 22)

```bash
# 이후 모든 단계는 이 셸에서
nvm use 22 && node --version          # v22.x 확인
cd ~/minecraft-servers

# 백업 (compose는 upgrade가 .bak도 만들지만 .env는 만들지 않음)
cp docker-compose.yml docker-compose.yml.pre-2.29.0
cp .env .env.pre-2.29.0
cp .mcctl.json .mcctl.json.pre-2.29.0
cp -r servers/_template servers/_template.pre-2.29.0   # upgrade가 덮어씀

# (선택) 월드/설정 백업
mcctl server-backup factory -m "Before v2.29.0"
mcctl server-backup wild-deity -m "Before v2.29.0"
```
**게이트:** `node --version`이 v22로 시작하고, 위 `.pre-2.29.0` 파일이 존재해야 다음으로 진행.

## 3. 패키지 업데이트

```bash
mcctl update --check        # 2.28.0 → 2.29.0 확인 (업데이트 있으면 exit 1)
mcctl update --yes          # CLI + mcctl-api/console/shared 설치, PM2 재시작, 서버 이미지 태그 정렬 + docker pull
```
확인:
```bash
mcctl --version                                              # 2.29.0
pm2 jlist | python3 -c "import sys,json;[print(p['name'],p['pm2_env']['version'],p['pm2_env']['status'],p['pm2_env']['node_version']) for p in json.load(sys.stdin)]"
# 기대: mcctl-api / mcctl-console 2.29.0 online 22.x
```
- 출력에 `Updated (restart manually)`가 보이면 8단계(PM2 수동 재시작) 수행.
- `mcctl update`는 서버(`factory`, `wild-deity`)의 `docker-compose.yml` 이미지 태그를 VERSION 기준으로 바꿀 수 있습니다. 두 서버는 중지 상태이므로 다음 기동 때 반영됩니다. `⚠ <server>: A → B` 출력 내용을 기록해 두세요.
- **`mcctl update`는 `mcctl upgrade`를 실행하지 않습니다.** 4단계를 별도로 수행.

**롤백 지점:** 실패하면 `npm install -g @minecraft-docker/mcctl@2.28.0` 후 `mcctl console service restart`.

## 4. 설정 마이그레이션

```bash
mcctl upgrade --dry-run     # 변경 미리보기만
```
dry-run에서 확인할 것:
- `.env`: 새 변수 목록(`templateVersion 2.26.2` 기준이라 `DOCKER_GID` 외에도 나올 수 있음)
- `docker-compose.yml: router.group_add added` 한 줄이 diff에 있는지. **`router.image`는 나오지 않는 것이 정상**(함정 A).
- 예상 밖 변경(다른 서비스 수정 등)이 보이면 중단하고 보고.

문제 없으면:
```bash
mcctl upgrade               # 대화형: 새 .env 변수는 기본값(Enter) 수락, compose 적용은 y
```
기대 결과:
- `.env`에 `DOCKER_GID=1001` 추가 (`DOCKER_GID set from docker socket.`)
- `docker-compose.yml.bak-<타임스탬프>` 생성, router에 아래 블록 추가 후 **자동으로 `docker compose up -d router` 실행**
  ```yaml
      group_add:
        - "${DOCKER_GID:-999}"
  ```
- `servers/_template/{docker-compose.yml,config.env}` 덮어쓰기, `.mcctl.json`의 `templateVersion` = 2.29.0

> ⚠️ 이 단계의 자동 `up -d router`는 **태그 없는 이미지 그대로** router를 재생성합니다(옛 `latest` + `group_add`). 곧바로 5단계에서 이미지 태그를 고정하므로 일시적 상태입니다. 서비스 영향 시간을 줄이려면 5단계를 이어서 바로 수행하세요.

## 5. router 이미지를 1.47.1로 고정 (수동, 함정 A 대응)

```bash
cd ~/minecraft-servers
sed -i 's|^\(\s*image:\s*\)itzg/mc-router\s*$|\1itzg/mc-router:1.47.1|' docker-compose.yml
grep -n -B1 -A1 'mc-router:1.47.1\|group_add' docker-compose.yml
docker compose config -q && echo "compose OK"
docker compose up -d router
```
**게이트:** `grep`에 `image: itzg/mc-router:1.47.1`과 `group_add`가 모두 보이고 `compose OK`가 출력되어야 함.

## 6. router 검증

```bash
stat -c %g /var/run/docker.sock                  # 1001
grep '^DOCKER_GID=' .env                         # DOCKER_GID=1001 (위와 동일해야 함)
docker inspect mc-router --format '{{.Config.Image}} {{.HostConfig.GroupAdd}}'
#  기대: itzg/mc-router:1.47.1 [1001]
docker logs --tail 30 mc-router
#  기대: "Monitoring Docker for Minecraft containers", "Listening for Minecraft client connections"
#  금지: docker.sock permission denied
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Status}}' | grep mc-router
```

auto-scale 기능 확인(서버가 모두 Exited 상태이므로 접속으로 기동 확인 가능):
```bash
mcctl status
# 마인크래프트 클라이언트에서 <server>.<HOST_IP>.nip.io:25565 접속 → 서버가 기동되는지
docker logs --tail 30 mc-router | grep -i -E "error|denied|scale"
```
- 접속 시 서버가 기동되면 정상. 기동되지 않고 `permission denied`가 보이면 → 롤백(10단계) 또는 `.env`/GroupAdd 재확인.
- 테스트 후 서버를 다시 내리고 싶으면 `mcctl stop <server>`(auto-scale-down은 10분 후 자동).

## 7. console / API 검증

```bash
mcctl console service status        # api(:5001), console(:5000) online, restarts 증가 없음
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5000     # 200/3xx
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:5001/health 2>/dev/null
```
- 브라우저 `http://<host>:5000` → 월드 상세 → 통계 패널의 Ore & Block Stats 새 시각화 확인(강력 새로고침).
- 500이 나오면 `pm2 logs mcctl-console --lines 50`에서 `better-sqlite3`/`NODE_MODULE_VERSION` 오류 확인 → 8단계.

## 8. (필요 시) PM2 수동 재시작

```bash
nvm use 22
mcctl console service restart
# 그래도 새 빌드가 안 뜨거나 ABI 오류가 나면 (force: PM2 데몬 kill 후 새로 시작)
mcctl console service restart --force
# better-sqlite3 ABI 오류가 지속되면 Node 22로 재설치
cd ~/minecraft-servers && npm rebuild better-sqlite3
mcctl console service restart --force
```

## 9. 지도(BlueMap) 기본 뷰 (#564)

이미 렌더링한 월드는 map conf가 옛 상태입니다. console의 지도 렌더링으로 다시 렌더링하면 overworld가 기본으로 열립니다(`render-map.sh`가 매 렌더링마다 conf를 새로 생성, `sorting` 기록). `maps/` 디렉터리에 기존 지도가 있는 월드만 대상이며, 전체 재렌더링(`--force`)이 필요한지는 실행 후 눈으로 확인.

## 10. 롤백

```bash
cd ~/minecraft-servers
# (a) compose 복원 후 router 재생성
cp docker-compose.yml.pre-2.29.0 docker-compose.yml
cp .env.pre-2.29.0 .env
docker compose up -d router
# (b) 템플릿/설정 복원
rm -rf servers/_template && cp -r servers/_template.pre-2.29.0 servers/_template
cp .mcctl.json.pre-2.29.0 .mcctl.json
# (c) 패키지 2.28.0으로 (Node 22 셸에서)
npm install -g @minecraft-docker/mcctl@2.28.0
npm install @minecraft-docker/mcctl-api@2.28.0 @minecraft-docker/mcctl-console@2.28.0 @minecraft-docker/shared@2.28.0
mcctl console service restart --force
```
- (a)는 router를 태그 없는 옛 `latest`로 되돌립니다. 1.47.1을 유지하고 싶다면 compose의 `group_add`만 남기고 image는 1.47.1 그대로 두세요(1.46+는 non-root라 `group_add` 필수).

## 11. 완료 기준 체크리스트

- [ ] `mcctl --version` = 2.29.0
- [ ] PM2: mcctl-api, mcctl-console 모두 2.29.0, online, Node 22
- [ ] `.env`: `DOCKER_GID=1001` (= `stat -c %g /var/run/docker.sock`)
- [ ] compose: `image: itzg/mc-router:1.47.1` + `group_add: - "${DOCKER_GID:-999}"`
- [ ] `docker inspect mc-router` → 1.47.1, GroupAdd `[1001]`, 로그에 permission denied 없음
- [ ] 클라이언트 접속으로 중지된 서버 auto-scale 기동 확인
- [ ] console UI 로그인/월드 통계 패널 정상
- [ ] `.mcctl.json` `templateVersion` = 2.29.0
- [ ] 백업(`*.pre-2.29.0`, `servers/_template.pre-2.29.0`)은 안정 확인 후 삭제
