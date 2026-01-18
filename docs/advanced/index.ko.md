# 고급 기능

이 섹션에서는 Docker Minecraft Server 플랫폼의 고급 설정 및 기능을 다룹니다.

## 개요

플랫폼은 프로덕션 배포 및 복잡한 설정을 위한 여러 고급 기능을 제공합니다:

- **네트워킹** - nip.io magic DNS, mDNS, mc-router 설정
- **백업** - 월드 데이터 자동 GitHub 백업
- **월드 관리** - 잠금 기능이 있는 멀티 서버 월드 공유
- **자동 스케일링** - 플레이어 활동에 따른 서버 자동 시작/중지

## 기능 가이드

<div class="grid cards" markdown>

-   :material-network:{ .lg .middle } **네트워킹**

    ---

    nip.io, mDNS, mc-router로 호스트네임 라우팅 설정

    [:octicons-arrow-right-24: 네트워킹 가이드](networking.ko.md)

-   :material-backup-restore:{ .lg .middle } **백업**

    ---

    월드 데이터 자동 GitHub 백업 설정

    [:octicons-arrow-right-24: 백업 가이드](backup.ko.md)

</div>

## 아키텍처 심층 분석

### 플랫폼 구성요소

```text
┌─────────────────────────────────────────────────────────────┐
│                       호스트 머신                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                        │
│  │   mc-router     │ ← 포트 25565 (공개)                     │
│  │   (항상 실행)    │                                        │
│  └────────┬────────┘                                        │
│           │ Docker 라벨 (mc-router.host)                    │
│  ┌────────┼────────────────────────────────────────┐        │
│  │        ▼                                        │        │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │        │
│  │  │ 서버 1   │  │ 서버 2   │  │ 서버 N   │       │        │
│  │  │ (Paper)  │  │ (Forge)  │  │ (Fabric) │       │        │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘       │        │
│  │       │             │             │             │        │
│  │  minecraft-net (Docker 네트워크)                  │        │
│  └─────────────────────────────────────────────────┘        │
│           │             │             │                      │
│  ┌────────▼─────────────▼─────────────▼────────────┐        │
│  │                   볼륨                           │        │
│  │  servers/<name>/data    worlds/    shared/       │        │
│  └──────────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### 요청 흐름

1. **클라이언트가 접속**합니다 `myserver.192.168.1.100.nip.io:25565`
2. **nip.io가 호스트네임을 해석**합니다 → `192.168.1.100`
3. **mc-router가 연결을 수신**합니다 (포트 25565)
4. **mc-router가 호스트네임을 기반으로 라우팅**합니다 → `mc-myserver` 컨테이너
5. **서버가 중지된 경우**, mc-router가 시작합니다 (auto-scale-up)
6. **서버가 연결을 수락**합니다 (시작 후)

### 자동 스케일링 동작

```
플레이어 접속 → mc-router → 서버 중지됨?
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
                  아니오                             예
                    │                               │
                    ▼                               ▼
              서버로 라우팅                      서버 시작
                    │                       (DOCKER_TIMEOUT 대기)
                    │                               │
                    │                               ▼
                    └───────────────┬───────────────┘
                                    ▼
                             플레이어 접속됨
```

### 월드 잠금

월드 잠금은 서버 간 월드 공유 시 데이터 손상을 방지합니다:

```
서버 A                       월드                      서버 B
    │                          │                            │
    │ ─── 월드 할당 ───────────▶│                            │
    │                          │ (A에 잠김)                  │
    │                          │                            │
    │                          │◀─── 할당 시도 ───────────── │
    │                          │     ❌ 거부됨                │
    │                          │                            │
    │ ─── 월드 해제 ───────────▶│                            │
    │                          │ (잠금 해제됨)               │
    │                          │                            │
    │                          │◀─── 월드 할당 ────────────  │
    │                          │ (B에 잠김)                  │
```

## 성능 튜닝

### JVM 최적화

최적의 성능을 위해 Aikar의 플래그를 사용합니다:

```bash
# config.env
USE_AIKAR_FLAGS=true
MEMORY=8G
```

대규모 서버의 경우 G1GC 파라미터를 조정합니다:

```bash
JVM_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:G1NewSizePercent=40"
```

### 네트워크 최적화

많은 플레이어 수의 서버:

```bash
# config.env
NETWORK_COMPRESSION_THRESHOLD=256
VIEW_DISTANCE=8
SIMULATION_DISTANCE=6
```

### 컨테이너 리소스

docker-compose.yml에서 컨테이너 리소스를 제한합니다:

```yaml
services:
  mc-myserver:
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

## 보안 고려사항

### RCON 비밀번호

항상 기본 RCON 비밀번호를 변경하세요:

```bash
# .env
RCON_PASSWORD=매우-안전한-비밀번호-여기에
```

### 화이트리스트

프라이빗 서버에서는 화이트리스트를 활성화합니다:

```bash
# config.env
ENABLE_WHITELIST=true
WHITELIST=Steve,Alex,Player3
```

### 온라인 모드

오프라인이 특별히 필요하지 않다면 온라인 모드를 유지합니다:

```bash
# config.env
ONLINE_MODE=true  # 기본값, Mojang으로 검증
```

## 모니터링

### Docker 통계

```bash
# 리소스 사용량 확인
docker stats mc-myserver

# 모든 Minecraft 컨테이너
docker stats $(docker ps --filter name=mc- -q)
```

### 서버 로그

```bash
# 실시간 로그
mcctl logs myserver -f

# 오류 검색
docker logs mc-myserver 2>&1 | grep -i error
```

### 헬스 체크

mc-router는 mc-router.host 라벨 조회를 통해 상태 정보를 제공합니다.

## 문제 해결

일반적인 문제는 [문제 해결 가이드](../getting-started/quickstart.ko.md#troubleshooting)를 참조하세요.

## 다음 단계

- **[네트워킹 가이드](networking.ko.md)** - 호스트네임 라우팅 설정
- **[백업 가이드](backup.ko.md)** - 자동 백업 설정
