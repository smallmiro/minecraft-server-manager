# 업그레이드 런북 (릴리즈 공통)

새 릴리즈가 나올 때마다 **같은 순서**로 전체 시스템(CLI, API, Console, 플랫폼 설정, router, 서버, 지도)을 올리는 절차입니다. 버전에 상관없이 `NEW` 변수만 바꿔서 사용합니다. 릴리즈별 특이사항은 해당 릴리즈의 [CHANGELOG](https://github.com/smallmiro/minecraft-server-manager/blob/main/CHANGELOG.md)와 릴리즈 노트를 먼저 읽으세요.

!!! warning "먼저 알아둘 것"
    - `mcctl update`는 패키지(CLI/API/Console/shared)만 올립니다. **`mcctl upgrade`(.env, `servers/_template`, 루트 compose의 router)는 자동 실행되지 않으므로 반드시 별도로 실행**합니다.
    - 모든 명령은 **PM2가 사용하는 Node 버전의 셸**에서 실행합니다(아래 0단계). 셸 Node와 PM2 Node가 다르면 `better-sqlite3` ABI 불일치로 Console이 500을 반환할 수 있습니다.

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
- `mcctl update`가 서버 compose의 이미지 태그를 바꾸면 `⚠ <server>: A → B` 출력을 기록합니다. 중지된 서버는 다음 기동 때 반영됩니다.

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
- `.mcctl.json`에 `installId`가 없으면 한 번 추가합니다 (기존 값은 유지). 웹 콘솔이 익명 사용 통계에 사용하며, 끄려면 `.mcctl.json`에 `"telemetry": false`를 설정합니다 ([사용 통계](../console/web-console.ko.md) 참고).
- **router 이미지가 태그 없는 `itzg/mc-router`이면 `mcctl upgrade`가 image를 올리지 않습니다.** `docker-compose.yml`의 `image:`를 릴리즈 노트가 지정한 버전으로 직접 고정한 뒤 `docker compose config -q && docker compose up -d router`를 실행합니다.

## 4. API / Console 재시작 (필요 시)

```bash
mcctl console service restart
# 새 빌드가 안 뜨거나 ABI 오류(NODE_MODULE_VERSION)가 나면
mcctl console service restart --force
cd $ROOT && npm rebuild better-sqlite3 && mcctl console service restart --force
```

## 5. 서버 이미지 반영

중지된 서버는 다음 기동 때 새 이미지가 적용됩니다. 실행 중인 서버는 사용자 영향이 없는 시간에 `mcctl stop <server> && mcctl start <server>`로 재기동합니다(월드는 보존).

## 6. 지도(BlueMap) 재렌더 (릴리즈 노트에 지도 변경이 있을 때만)

지도를 만든 월드는 Console의 월드 상세에서 **Render map**을 다시 실행합니다. 렌더 스크립트(`render-map.sh`)가 매번 설정을 새로 생성하므로 보통 `--force`는 필요 없습니다.

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
- [ ] 안정 확인 후 `$B`(`backups-pre-$NEW`) 삭제

## 8. 롤백

```bash
cd $ROOT; B=$ROOT/backups-pre-$NEW
cp $B/docker-compose.yml docker-compose.yml
cp $B/.env .env
cp $B/.mcctl.json .mcctl.json
rm -rf servers/_template && cp -r $B/_template servers/_template
docker compose up -d router
# 패키지를 이전 버전 OLD로 (PM2 Node 셸에서)
npm install -g @minecraft-docker/mcctl@$OLD
npm install @minecraft-docker/mcctl-api@$OLD @minecraft-docker/mcctl-console@$OLD @minecraft-docker/shared@$OLD
mcctl console service restart --force
```

!!! note
    mc-router 1.46+는 non-root라서 `group_add`(`DOCKER_GID`)가 필수입니다. 이미지를 옛 버전으로 되돌릴 때를 제외하고 `group_add`는 제거하지 마세요.
