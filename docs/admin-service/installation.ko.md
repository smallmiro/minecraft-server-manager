# 설치 가이드

이 가이드에서는 Docker Minecraft 서버를 위한 Admin Service 설치 및 구성 방법을 설명합니다.

## 사전 요구 사항

Admin Service를 설치하기 전에 다음을 확인하세요:

- [x] **mcctl 설치 및 초기화 완료**
  ```bash
  npm install -g @minecraft-docker/mcctl
  mcctl init
  ```

- [x] **Docker 실행 중**
  ```bash
  docker --version
  docker compose version
  ```

- [x] **최소 하나의 Minecraft 서버 생성됨**
  ```bash
  mcctl status
  ```

- [x] **포트 사용 가능**
  - 웹 콘솔용 포트 5000
  - API용 포트 5001 (내부)

## 설치 방법

### 방법 1: CLI 설치 (권장)

mcctl CLI를 사용하는 것이 가장 간단한 Admin Service 설치 방법입니다.

#### 1단계: Admin Service 초기화

```bash
mcctl console init
```

이 대화형 명령은 다음을 묻습니다:

1. **관리자 사용자명** (기본값: `admin`)
2. **관리자 비밀번호** - 필수 조건:
   - 최소 8자 이상
   - 대문자 1개 이상
   - 소문자 1개 이상
   - 숫자 1개 이상
3. **API 접근 모드** - 보안 요구 사항에 따라 선택
4. **추가 구성** - 선택한 모드에 따른 추가 설정

예시 세션:

```
$ mcctl console init

Initialize Admin Service

? Admin username? admin
? Admin password? ********
? Confirm password? ********
? API access mode? internal - Docker network only (default, most secure)

Creating admin user...  done
Saving configuration...  done

Admin Service initialized!

  Configuration:
    Config file: /home/user/minecraft-servers/admin.yaml
    Users file:  /home/user/minecraft-servers/users.yaml
    Access mode: internal

  Endpoints:
    Console: http://localhost:5000
    API:     http://localhost:5001

  Next steps:
    1. Start the admin service: mcctl console service start
    2. Access the console in your browser
```

#### 2단계: 서비스 시작

```bash
mcctl console service start
```

서비스가 시작되고 정상 상태가 될 때까지 기다립니다:

```
Starting admin services...
[+] Running 2/2
 ✔ Container mcctl-api      Healthy
 ✔ Container mcctl-console  Started

Admin services started successfully

  Admin Service Status

  mcctl-api
    Status: running
    Port: 5001
    Health: healthy
    Uptime: 5s

  mcctl-console
    Status: running
    Port: 5000
    URL: http://localhost:5000
    Health: healthy
    Uptime: 3s

  All services healthy
```

### 방법 2: Docker Compose (수동)

수동 Docker 구성을 선호하는 고급 사용자를 위한 방법입니다.

#### 1단계: docker-compose.admin.yml 파일 확인

파일이 `~/minecraft-servers/docker-compose.admin.yml`에 있어야 합니다. 없다면 템플릿에서 복사합니다:

```bash
cp templates/docker-compose.admin.yml ~/minecraft-servers/
```

#### 2단계: 환경 구성

`~/minecraft-servers/.env` 파일을 생성하거나 편집합니다:

```bash
# Admin Service 설정
MCCTL_ROOT=~/minecraft-servers
MCCTL_JWT_SECRET=your-secure-jwt-secret-here
MCCTL_JWT_EXPIRY=24h
NEXTAUTH_SECRET=your-secure-nextauth-secret-here
NEXTAUTH_URL=http://localhost:5000

# API 설정
API_ACCESS_MODE=internal
API_KEY=

# 선택 사항: 사용자 정의 포트
# MCCTL_API_PORT=5001
# MCCTL_CONSOLE_PORT=5000
```

#### 3단계: 관리자 사용자 생성

```bash
mcctl console user add admin --role admin --password "YourSecurePassword123"
```

#### 4단계: Docker Compose로 시작

```bash
cd ~/minecraft-servers
docker compose -f docker-compose.admin.yml up -d
```

## 구성

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MCCTL_ROOT` | 데이터 디렉토리 경로 | `~/minecraft-servers` |
| `MCCTL_JWT_SECRET` | JWT 서명 비밀키 | `change-me-in-production` |
| `MCCTL_JWT_EXPIRY` | JWT 토큰 만료 시간 | `24h` |
| `NEXTAUTH_SECRET` | NextAuth.js 비밀키 | `change-me-in-production` |
| `NEXTAUTH_URL` | 콘솔 URL | `http://localhost:5000` |
| `API_ACCESS_MODE` | API 인증 모드 | `internal` |
| `API_KEY` | API 키 (api-key 모드 사용 시) | - |
| `LOG_LEVEL` | 로깅 레벨 | `info` |
| `MCCTL_API_PORT` | API 서버 포트 | `5001` |
| `MCCTL_CONSOLE_PORT` | 콘솔 포트 | `5000` |

### 접근 모드

#### internal (프로덕션 권장)

Docker 네트워크 내부에서만 접근을 허용합니다. API가 호스트에 노출되지 않습니다.

```bash
mcctl console api mode internal
```

#### api-key

모든 API 요청에 `X-API-Key` 헤더가 필요합니다.

```bash
mcctl console api mode api-key
```

이 모드를 설정하면 API 키가 표시됩니다. 안전하게 저장하세요.

API 키를 재생성하려면:

```bash
mcctl console api key regenerate
```

#### ip-whitelist

지정된 IP 주소나 CIDR 범위에서만 접근을 허용합니다.

```bash
mcctl console api mode ip-whitelist
mcctl console api whitelist add 192.168.1.100
mcctl console api whitelist add 10.0.0.0/8
```

#### api-key-ip (최고 보안)

유효한 API 키와 화이트리스트에 등록된 클라이언트 IP가 모두 필요합니다.

```bash
mcctl console api mode api-key-ip
mcctl console api whitelist add 192.168.1.0/24
```

#### open (개발 환경 전용)

!!! danger "보안 위험"
    이 모드는 모든 인증을 비활성화합니다. 프로덕션에서는 절대 사용하지 마세요!

```bash
mcctl console api mode open --force
```

### 사용자 관리

#### 사용자 추가

```bash
# 대화형 모드
mcctl console user add

# CLI 모드
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

#### 사용자 목록 조회

```bash
mcctl console user list
```

출력:

```
Users:

Username            Role        Created
--------------------------------------------------
admin               admin       2025-01-15
operator1           viewer      2025-01-16

Total: 2 user(s)
```

#### 사용자 역할 변경

```bash
mcctl console user update operator1 --role admin
```

#### 비밀번호 재설정

```bash
# 대화형
mcctl console user reset-password operator1

# CLI
mcctl console user reset-password operator1 --password "NewSecurePass456"
```

#### 사용자 삭제

```bash
mcctl console user remove operator1
```

!!! note "마지막 관리자 보호"
    마지막 관리자 사용자는 삭제할 수 없습니다. 이는 실수로 인한 계정 잠금을 방지합니다.

## 검증

### 서비스 상태 확인

```bash
mcctl console service status
```

### API 상태 확인

```bash
curl http://localhost:5001/health
```

예상 응답:

```json
{"status":"healthy"}
```

### 웹 콘솔 접속

1. 브라우저에서 `http://localhost:5000` 열기
2. 관리자 자격 증명으로 로그인
3. 서버 목록이 표시되는지 확인

## 문제 해결

### 서비스가 시작되지 않음

1. **Docker 실행 확인:**
   ```bash
   docker ps
   ```

2. **포트 충돌 확인:**
   ```bash
   netstat -tlnp | grep -E "5000|5001"
   ```

3. **서비스 로그 확인:**
   ```bash
   mcctl console service logs -f
   ```

### 로그인 불가

1. **사용자 존재 확인:**
   ```bash
   mcctl console user list
   ```

2. **비밀번호 재설정:**
   ```bash
   mcctl console user reset-password admin
   ```

3. **NextAuth 구성 확인:**
   `.env`에 `NEXTAUTH_SECRET`이 설정되어 있는지 확인

### API에서 401 Unauthorized 반환

1. **접근 모드 확인:**
   ```bash
   mcctl console api status
   ```

2. **API 키 확인 (api-key 모드 사용 시):**
   - 요청에 `X-API-Key` 헤더가 포함되어 있는지 확인
   - 필요시 키 재생성: `mcctl console api key regenerate`

3. **IP 화이트리스트 확인 (ip-whitelist 모드 사용 시):**
   ```bash
   mcctl console api whitelist list
   ```

### 컨테이너 헬스 체크 실패

1. **컨테이너 로그 확인:**
   ```bash
   docker logs mcctl-api
   docker logs mcctl-console
   ```

2. **서비스 재시작:**
   ```bash
   mcctl console service restart
   ```

## 업그레이드

### 최신 버전으로 업데이트

```bash
# 서비스 중지
mcctl console service stop

# 최신 이미지 가져오기
docker pull minecraft-docker/mcctl-api:latest
docker pull minecraft-docker/mcctl-console:latest

# 서비스 시작
mcctl console service start
```

### 소스에서 재빌드

```bash
# 서비스 중지
mcctl console service stop

# 프로젝트 루트로 이동
cd ~/minecraft

# 새 이미지 빌드
pnpm build
docker compose -f platform/docker-compose.admin.yml build

# 서비스 시작
mcctl console service start
```

## 제거

Admin Service를 완전히 제거하려면:

```bash
# 컨테이너 중지 및 제거
mcctl console service stop
docker compose -f ~/minecraft-servers/docker-compose.admin.yml down -v

# 구성 파일 제거 (선택 사항)
rm ~/minecraft-servers/admin.yaml
rm ~/minecraft-servers/users.yaml
rm ~/minecraft-servers/api-config.json
```

!!! warning "데이터 보존"
    Admin Service를 제거해도 Minecraft 서버나 월드 데이터에는 영향이 없습니다.
