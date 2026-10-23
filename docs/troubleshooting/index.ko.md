# 문제 해결

mcctl과 Minecraft Docker Server 플랫폼 사용 시 발생하는 일반적인 문제와 해결 방법을 다룹니다.

## 빠른 진단

특정 문제를 살펴보기 전에 다음 명령어로 정보를 수집하세요:

```bash
# 전체 상태 확인
mcctl status --detail

# mc-router 상태 확인
mcctl status router

# 특정 서버 로그 확인
mcctl logs <server-name> -n 100

# RCON 연결 테스트
mcctl console <server-name>
```

---

## 일반적인 문제

### 서버가 시작되지 않음

**증상:** 서버 컨테이너가 즉시 종료되거나 시작에 실패합니다.

**진단:**

```bash
mcctl logs <server-name> -n 100
```

**일반적인 원인:**

| 원인 | 로그 메시지 | 해결책 |
|------|-------------|--------|
| 잘못된 Java 버전 | `UnsupportedClassVersionError` | 이미지 태그 변경 (java8, java17, java21) |
| 메모리 부족 | `OutOfMemoryError` | config.env에서 `MEMORY` 증가 |
| EULA 미동의 | `EULA must be accepted` | .env에서 `EULA=TRUE` 설정 |
| 포트 충돌 | `Address already in use` | 해당 포트를 사용하는 다른 서비스 확인 |
| 월드 손상 | `java.io.IOException` | 백업에서 복원 |

**Java 버전 가이드:**

| Minecraft 버전 | 필요한 Java |
|----------------|-------------|
| 1.21+ | Java 21 |
| 1.18 - 1.20.4 | Java 17 또는 21 |
| Forge 1.16.5 이하 | Java 8 |

### 서버에 연결할 수 없음

**증상:** Minecraft 클라이언트에서 "서버에 연결할 수 없습니다" 또는 "연결이 거부되었습니다" 표시.

**진단:**

```bash
# mc-router 실행 확인
mcctl status router

# 서버 실행 확인
mcctl status <server-name>

# RCON 연결 테스트
mcctl console <server-name>
```

**일반적인 원인:**

| 원인 | 해결책 |
|------|--------|
| mc-router 미실행 | `mcctl router start` |
| 서버 미실행 | `mcctl start <server-name>` |
| 잘못된 호스트네임 | 올바른 형식 사용: `<server>.<ip>.nip.io:25565` |
| 방화벽 차단 | 포트 25565 개방 |
| DNS 해석 실패 | IP 주소 직접 사용 또는 nip.io 확인 |

### 느린 성능

**증상:** 서버 렉, 높은 TPS, 느린 청크 로딩.

**진단:**

```bash
mcctl status <server-name> --detail
```

**해결책:**

```bash
# Aikar의 JVM 플래그 활성화
mcctl config <server-name> USE_AIKAR_FLAGS true

# 시야 거리 줄이기
mcctl config <server-name> VIEW_DISTANCE 8

# 시뮬레이션 거리 줄이기
mcctl config <server-name> SIMULATION_DISTANCE 6

# 서버 재시작
mcctl stop <server-name> && mcctl start <server-name>
```

### 월드 손상

**증상:** 누락된 청크, 손상된 블록, 로드 시 서버 충돌.

**진단:**

```bash
# 각 월드를 사용하는 서버 확인
mcctl world list

# 서버 로그에서 오류 확인
mcctl logs <server-name> | grep -i error
```

**해결책:**

1. **백업에서 복원:**
   ```bash
   mcctl backup restore
   ```

2. **월드 할당 확인:**
   ```bash
   # 월드가 여러 서버에 할당되지 않았는지 확인
   mcctl world list

   # 월드를 다른 서버로 옮기기 (두 서버 모두 중지)
   mcctl world release <world-name>
   mcctl world assign <world-name> <server-name>
   ```

### 월드 할당이 거부됨

**증상:** `mcctl world assign`, `mcctl world release`, `mcctl world new --server`, `mcctl create --world`, `mcctl config <server> LEVEL <world>`, `mcctl world delete`, 또는 같은 동작의 웹 콘솔·API 요청이 거부됩니다(API: `409 Conflict`).

**원인:** 월드는 `servers/<name>/config.env`의 `LEVEL`로 서버에 할당되며(잠금 파일은 없습니다), 한 월드는 한 서버만 사용할 수 있습니다. 다음 경우에 요청이 거부됩니다:

- 다른 서버가 이미 그 월드를 사용 중이거나(월드와 `<world>_nether` / `<world>_the_end` 폴더는 하나의 월드로 봅니다), 삭제하려는 월드를 서버가 사용 중인 경우(`--force`로도 우회할 수 없음)
- 서버가 running, paused, restarting, created 상태인 경우(서버를 대신 중지하지 않습니다)
- 어떤 서버의 `config.env`를 읽을 수 없거나 `LEVEL`을 안전하게 해석할 수 없는 경우(경로 구분자, `.`/`..`, 따옴표, 제어 문자, 작은따옴표 밖의 `${VAR}`, 지원하지 않는 `--universe` 위치). 고칠 때까지 모든 할당 변경과 월드 삭제·초기화가 거부됩니다

**진단:**

```bash
# 월드별 "assigned: <servers>"와, 중복 및 읽을 수 없는 설정에 대한 경고 표시
mcctl world list

# 각 서버가 쓰는 월드 확인
grep -E '^(LEVEL|WORLD_NAME)=' servers/*/config.env
```

**해결:**

1. 서버를 중지합니다(`mcctl stop <server-name>`).
2. 다른 서버가 쓰는 월드를 비우려면, 그 서버를 중지한 뒤 `mcctl world release <world-name>`을 실행합니다. 그 서버는 자신의 기본 월드 `<server>`로 돌아갑니다.
3. `config.env`를 읽을 수 없다고 보고되면 `LEVEL` 줄을 `LEVEL=<name>` 형태로 고친 뒤 명령을 다시 실행합니다.

!!! note "이전 설치의 중복 할당"
    이전 버전에서는 두 서버가 같은 월드를 쓸 수 있었습니다. 이런 경우는 고치지 않고 알려 줍니다. `mcctl world list`가 경고와 함께 `assigned: a, b`로 표시하고, `GET /api/worlds`는 `assignmentWarnings`에 담아 반환하며, 웹 콘솔은 경고 알림을 보여 줍니다. 한 서버만 남기고 나머지 서버에는 다른 월드를 할당하세요.

!!! tip "남아 있는 `worlds/.locks`"
    `mcctl`은 더 이상 `worlds/.locks`를 읽거나 쓰거나 만들지 않습니다. 기존 디렉토리는 무해하며 `rm -rf worlds/.locks`로 지워도 안전합니다.

### 모드/플러그인이 로드되지 않음

**증상:** 서버가 시작되지만 모드나 플러그인이 나타나지 않습니다.

**진단:**

```bash
mcctl logs <server-name> | grep -i "mod\|plugin"
```

**일반적인 원인:**

| 원인 | 해결책 |
|------|--------|
| 잘못된 서버 타입 | 모드는 FORGE/FABRIC, 플러그인은 PAPER 사용 |
| 버전 불일치 | 모드 버전을 Minecraft 버전과 일치 |
| 누락된 의존성 | 필요한 의존성 모드 설치 |
| 파일 권한 | shared/ 디렉토리의 파일 소유권 확인 |

### sudo 비밀번호가 /etc/avahi/hosts에 기록됨 (2.32.0 이전)

**해당 대상:** 2.32.0 이전 mcctl로 서버를 만들면서 `MCCTL_SUDO_PASSWORD`, `--sudo-password`, 또는 웹 콘솔의 sudo 비밀번호 입력란으로 sudo 비밀번호를 넘긴 경우.

그 시점에 sudo가 비밀번호를 물을 필요가 없었다면(직전 `sudo` 인증이 캐시돼 있었거나 sudoers에 `NOPASSWD`가 설정된 경우) 비밀번호 줄이 평문으로 `/etc/avahi/hosts`에 추가됐습니다. 이 파일은 호스트의 모든 사용자가 읽을 수 있습니다. 2.32.0에서 수정됐지만 이미 기록된 파일은 자동으로 고치지 않습니다.

**점검:** 주석, 빈 줄, `<IPv4> <이름>.local` 한 개짜리 항목이 아닌 줄을 출력합니다.

```bash
grep -nvE '^[[:space:]]*(#|$)|^[0-9.]+[[:space:]]+[^[:space:]]+\.local[[:space:]]*$' /etc/avahi/hosts
```

아무것도 출력되지 않으면 정상입니다. 출력된 각 줄 앞에는 줄 번호가 붙습니다. 비밀번호인 줄, 또는 `192.168.1.10,100.64.0.5 myserver.local`처럼 IP가 여러 개인 항목은 고쳐야 합니다.

**조치:**

1. 문제 줄을 줄 번호로 삭제하고(`<N>`을 바꿔 입력) avahi를 재시작합니다.

    ```bash
    sudo sed -i '<N>d' /etc/avahi/hosts
    sudo systemctl restart avahi-daemon
    ```

2. 비밀번호 줄이 있었다면 `passwd`로 해당 계정의 비밀번호를 바꿉니다.
3. IP가 여러 개인 항목은 `.env`의 `HOST_IP`를 IPv4 주소 하나로 설정하고(여러 IP는 `HOST_IPS` 사용) 항목을 다시 추가합니다: `echo '192.168.1.10 myserver.local' | sudo tee -a /etc/avahi/hosts`.

---

## 도움 받기

여기서 문제를 찾을 수 없다면:

1. **서버 로그 확인:** `mcctl logs <server-name> -n 200`
2. **Docker 로그 확인:** `docker logs mc-<server-name>`
3. **AI 어시스턴트에게 질문:** [AI 어시스턴트](https://notebooklm.google.com/notebook/e91b656e-0d95-45b4-a961-fb1610b13962)
4. **GitHub 이슈 등록:** [GitHub Issues](https://github.com/smallmiro/minecraft-server-manager/issues)

문제 보고 시 다음 정보를 포함해 주세요:

- mcctl 버전 (`mcctl --version`)
- Docker 버전 (`docker --version`)
- 운영 체제
- 관련 로그 출력
- 재현 단계
