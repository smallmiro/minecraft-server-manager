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
# 월드 잠금 상태 확인
mcctl world list

# 서버 로그에서 오류 확인
mcctl logs <server-name> | grep -i error
```

**해결책:**

1. **백업에서 복원:**
   ```bash
   mcctl backup restore
   ```

2. **월드 잠금 확인:**
   ```bash
   # 월드가 여러 서버에 할당되지 않았는지 확인
   mcctl world list

   # 필요시 해제 후 재할당
   mcctl world release <world-name>
   mcctl world assign <world-name> <server-name>
   ```

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
