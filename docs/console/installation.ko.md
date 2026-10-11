# 설치 가이드

이 가이드에서는 Docker Minecraft 서버를 위한 Management Console 설치 및 구성 방법을 설명합니다.

## 사전 요구 사항

Management Console를 설치하기 전에 다음을 확인하세요:

- [x] **Node.js 18 이상**
  ```bash
  node --version  # v18.0.0 이상이어야 합니다
  ```

- [x] **PM2 6 이상 전역 설치**
  ```bash
  npm install -g pm2
  pm2 --version  # 6.0.0 이상이어야 합니다
  ```

- [x] **Docker Engine 24 이상, Docker Compose 2.20 이상**
  ```bash
  docker --version
  docker compose version
  ```

- [x] **mcctl 설치 및 초기화 완료**
  ```bash
  npm install -g @minecraft-docker/mcctl
  mcctl init
  ```

- [x] **최소 하나의 Minecraft 서버 생성됨**
  ```bash
  mcctl status
  ```

- [x] **포트 사용 가능**
  - 웹 콘솔용 포트 5000
  - API용 포트 5001

## 설치 방법

### 방법 1: CLI 설치 (권장)

mcctl CLI를 사용하는 것이 가장 간단한 Management Console 설치 방법입니다.

#### 1단계: Management Console 초기화

```bash
mcctl console init
```

이 대화형 명령은 다음을 묻습니다:

1. **설치할 서비스** - `mcctl-api`가 기본으로 선택되어 있으며, 웹 콘솔을 설치하려면 `mcctl-console`도 선택합니다
2. **관리자 이메일** - 웹 콘솔 로그인에 사용합니다 (예: `admin@example.com`)
3. **관리자 이름** (기본값: `Administrator`)
4. **관리자 비밀번호** - 필수 조건:
    - 최소 8자 이상
    - 대문자 1개 이상
    - 소문자 1개 이상
    - 숫자 1개 이상
5. **API 접근 모드** - 보안 요구 사항에 따라 선택
6. **추가 구성** - 선택한 모드에 따른 추가 설정

관리자 이메일, 이름, 비밀번호는 `mcctl-console`을 선택한 경우에만 묻습니다. 포트는 묻지 않으므로 변경하려면 [방법 2](#방법-2-사용자-지정-포트-구성)를 참조하세요.

예시 세션:

```
$ mcctl console init

Initialize Console Service

  Node.js: v20.10.0
  PM2: 6.0.14

? Select services to install: mcctl-api, mcctl-console

  Selected services:
    ✓ mcctl-api
    ✓ mcctl-console

? Admin email? admin@example.com
? Admin name? Administrator
? Admin password? ********
? API access mode? internal - Local network only (default, most secure)

Creating admin user...  done
Generating PM2 ecosystem config...  done
Saving configuration...  done

Console Service initialized!

  Configuration:
    Config file: /home/user/minecraft-servers/.mcctl-admin.yml
    Console DB:  /home/user/minecraft-servers/data/mcctl.db
    PM2 config:  /home/user/minecraft-servers/ecosystem.config.cjs
    Access mode: internal

  Endpoints:
    API:     http://localhost:5001
    Console: http://localhost:5000

  Next steps:
    1. Start the service: mcctl console service start
    2. Access the console in your browser
```

#### 2단계: 서비스 시작

```bash
mcctl console service start
```

서비스가 시작될 때까지 기다립니다:

```
Starting console services via PM2...
  Started mcctl-api
  Started mcctl-console
Console services started successfully

  Console Service Status (PM2)

  mcctl-api
    Status: online
    PID: 12345
    CPU: 0%
    Memory: 50.2 MB
    Uptime: 5s
    Restarts: 0

  mcctl-console
    Status: online
    PID: 12346
    URL: http://localhost:5000
    CPU: 0%
    Memory: 80.5 MB
    Uptime: 3s
    Restarts: 0

  All services healthy
```

### 방법 2: 사용자 지정 포트 구성

포트 충돌이 있는 환경에서는 초기화 시 사용자 지정 포트를 지정하세요:

```bash
mcctl console init --api-port 8001 --console-port 8000
```

`mcctl console init`은 포트를 대화형으로 묻지 않으며, `--api-port`와 `--console-port` 플래그가 포트를 지정하는 유일한 방법입니다. 기본값은 API `5001`, 콘솔 `5000`입니다.

## 구성

### 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MCCTL_ROOT` | 데이터 디렉토리 경로 | `~/minecraft-servers` |
| `PORT` | API 서버 포트 | `5001` |
| `HOSTNAME` | 콘솔 서버 호스트 이름 | `0.0.0.0` |
| `MCCTL_API_URL` | 내부 API URL | `http://localhost:5001` |
| `NODE_ENV` | 실행 환경 모드 | `production` |
| `LOG_LEVEL` | mcctl-api 로그 레벨: `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent` | `NODE_ENV=production`이면 `info`, 그 외에는 `debug` |
| `WORLD_UPLOAD_MAX_SIZE` | 월드 ZIP 업로드 최대 크기 (바이트, `POST /api/worlds/upload`) | `1073741824` (1 GB) |

### PM2 에코시스템 구성

`mcctl console init` 명령은 데이터 디렉토리에 `ecosystem.config.cjs`를 생성합니다 (`<root>/ecosystem.config.cjs`, `<root>`는 `MCCTL_ROOT`이며 기본값은 `~/minecraft-servers`). 서비스 패키지는 `<root>/.services/` 아래에 설치되며, 이 파일은 절대 경로로 해당 패키지를 가리킵니다. 아래 값은 `<root>` = `/home/user/minecraft-servers`인 경우의 예시입니다:

```javascript
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'mcctl-api',
      script: '/home/user/minecraft-servers/.services/node_modules/@minecraft-docker/mcctl-api/dist/index.js',
      cwd: '/home/user/minecraft-servers',
      env: {
        NODE_ENV: 'production',
        PORT: 5001,
        HOST: '0.0.0.0',
        MCCTL_ROOT: '/home/user/minecraft-servers',
        AUTH_MODE: 'internal', // 예시 아래의 참고 사항 확인
        // 해당 접근 모드에서는 AUTH_API_KEY, AUTH_IP_WHITELIST가 추가됩니다
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    },
    {
      name: 'mcctl-console',
      script: '/home/user/minecraft-servers/.services/node_modules/@minecraft-docker/mcctl-console/.next/standalone/platform/services/mcctl-console/server.js',
      cwd: '/home/user/minecraft-servers',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOSTNAME: '0.0.0.0',
        MCCTL_API_URL: 'http://localhost:5001',
        MCCTL_ROOT: '/home/user/minecraft-servers',
        BETTER_AUTH_SECRET: '<생성된 시크릿>',
        BETTER_AUTH_BASE_URL: 'http://localhost:5000',
        // api-key 계열 접근 모드에서는 MCCTL_API_KEY가 추가됩니다
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '500M',
    },
  ],
};
```

!!! note "`AUTH_MODE` 값"
    `mcctl console init`은 접근 모드를 mcctl-api가 인식하는 값으로 변환해 `AUTH_MODE`에 기록합니다: `internal` → 루프백(127.0.0.1, ::1)만 허용하는 `ip-whitelist`, `api-key-ip` → `combined`, `open` → `disabled`. `api-key`와 `ip-whitelist`는 그대로 기록됩니다.

파일에는 `mcctl console init`에서 선택한 서비스만 포함됩니다. `.services/` 디렉토리가 도입되기 이전에 설치한 환경은 패키지가 `<root>/node_modules/`에 있으며, 패키지가 그 위치에서 발견되면 `mcctl console init`은 계속 해당 위치를 사용합니다.

### 접근 모드

`mcctl console init`은 설정 중에 접근 모드를 묻습니다. 모드, API 키, IP 화이트리스트는 `ecosystem.config.cjs`의 `env` 블록(`AUTH_MODE`, `AUTH_API_KEY`, `AUTH_IP_WHITELIST`)에 기록되며, 실행 중인 mcctl-api가 읽는 값이 바로 이것입니다. `mcctl console api` 명령어는 아직 이 값을 바꾸지 않으므로([CLI 명령어](cli-commands.ko.md#mcctl-console-api)의 경고 참조,), 모드를 바꾸거나 API 키 또는 IP 화이트리스트를 변경하려면 현재는 `mcctl console init --force`로 다시 초기화해야 합니다.

#### internal (프로덕션 권장)

내부 접근만 허용, 외부 노출 없음. 가정/로컬 배포에서 가장 안전한 옵션입니다.

```bash
mcctl console init
# API 접근 모드를 묻는 프롬프트에서 "internal" 선택
```

#### api-key

모든 API 요청에 `X-API-Key` 헤더가 필요합니다.

```bash
mcctl console init
# 프롬프트에서 "api-key" 선택
# API 키가 생성되어 표시됩니다
```

초기화 후 API 키가 표시됩니다. 안전하게 저장하세요.

새 API 키가 필요하면 `mcctl console init --force`로 다시 초기화하세요. `mcctl console api key regenerate`는 현재 실행 중인 API가 사용하는 키를 바꾸지 않습니다.

#### ip-whitelist

지정된 IP 주소나 CIDR 범위에서만 접근을 허용합니다.

```bash
mcctl console init
# 프롬프트에서 "ip-whitelist" 선택
# 허용할 IP를 입력합니다 (쉼표로 구분)
```

허용 IP를 바꾸려면 `mcctl console init --force`로 다시 초기화하고 새 목록을 입력하세요. `mcctl console api whitelist`는 현재 실행 중인 API가 사용하는 화이트리스트를 바꾸지 않습니다.

#### api-key-ip

유효한 API 키와 화이트리스트에 등록된 클라이언트 IP를 모두 요구하려는 모드입니다.


#### open (개발 환경 전용)

!!! danger "보안 위험"
    이 모드는 모든 인증을 비활성화하려는 모드입니다. 프로덕션에서는 절대 사용하지 마세요!


### 사용자 관리

#### 사용자 추가

```bash
# 대화형 모드
mcctl console user add

# CLI 모드
mcctl console user add operator@example.com --role user --password "SecurePass123"
```

#### 사용자 목록 조회

```bash
mcctl console user list
```

출력:

```
Users:

Email                         Name                Role        Created
---------------------------------------------------------------------------
admin@example.com             Administrator       admin       2025-01-15
operator@example.com          operator            user        2025-01-16

Total: 2 user(s)
```

#### 사용자 역할 변경

```bash
mcctl console user update operator@example.com --role admin
```

#### 비밀번호 재설정

```bash
# 대화형
mcctl console user reset-password operator@example.com

# CLI
mcctl console user reset-password operator@example.com --password "NewSecurePass456"
```

#### 사용자 삭제

```bash
mcctl console user remove operator@example.com
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

1. **Node.js 버전 확인:**
   ```bash
   node --version  # v18.0.0 이상이어야 합니다
   ```

2. **PM2 설치 확인:**
   ```bash
   pm2 --version
   ```

3. **포트 충돌 확인:**
   ```bash
   netstat -tlnp | grep -E "5000|5001"
   # macOS의 경우
   lsof -i :5000
   lsof -i :5001
   ```

4. **서비스 로그 확인:**
   ```bash
   mcctl console service logs -f
   ```

5. **PM2 프로세스 목록 확인:**
   ```bash
   pm2 list
   pm2 logs mcctl-api
   pm2 logs mcctl-console
   ```

### 로그인 불가

1. **사용자 존재 확인:**
   ```bash
   mcctl console user list
   ```

2. **비밀번호 재설정:**
   ```bash
   mcctl console user reset-password admin@example.com
   ```

3. **설정 파일 확인** (데이터 디렉토리에 있으며 기본값은 `~/minecraft-servers`입니다):
   ```bash
   cat ~/minecraft-servers/.mcctl-admin.yml
   ```

### API에서 401 Unauthorized 반환

1. **접근 모드 확인** (실행 중인 API는 `ecosystem.config.cjs`에서 읽으며, `mcctl console api status`는 대신 `api-config.json`을 보여줍니다):
   ```bash
   grep AUTH_MODE ~/minecraft-servers/ecosystem.config.cjs
   ```

2. **API 키 확인 (api-key 모드 사용 시):**
   - 요청에 `X-API-Key` 헤더가 포함되어 있는지 확인
   - 사용 중인 키는 `ecosystem.config.cjs`의 `AUTH_API_KEY`입니다. 새 키가 필요하면 `mcctl console init --force`로 다시 초기화하세요

3. **IP 화이트리스트 확인 (ip-whitelist 모드 사용 시):**
   ```bash
   grep AUTH_IP_WHITELIST ~/minecraft-servers/ecosystem.config.cjs
   ```

### PM2 프로세스가 계속 재시작됨

1. **로그에서 오류 확인:**
   ```bash
   pm2 logs mcctl-api --lines 100
   pm2 logs mcctl-console --lines 100
   ```

2. **서비스 패키지 설치 여부 확인** (패키지는 데이터 디렉토리의 `.services/` 디렉토리에 설치됩니다):
   ```bash
   cd ~/minecraft-servers/.services
   npm ls @minecraft-docker/mcctl-api @minecraft-docker/mcctl-console
   ```
   `.services/` 디렉토리가 없는 설치는 패키지가 `~/minecraft-servers/node_modules`에 있으므로, 대신 `~/minecraft-servers`에서 `npm ls`를 실행하세요.

3. **서비스 재시작:**
   ```bash
   mcctl console service restart
   ```

## 부팅 시 자동 시작

시스템 부팅 시 서비스가 자동으로 시작되도록 PM2를 구성합니다:

```bash
# 시작 스크립트 생성
pm2 startup

# 표시된 명령을 실행하라는 안내를 따릅니다
# 예시:
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME

# 현재 프로세스 목록 저장
pm2 save
```

이제 시스템이 부팅될 때 서비스가 자동으로 시작됩니다.

## 업그레이드

### mcctl 및 서비스 업데이트

```bash
mcctl update
```

`mcctl update`는 mcctl CLI와 `<root>/.services/`에 설치된 서비스(`mcctl-api`, `mcctl-console`, `shared` 라이브러리)를 한 번에 업데이트합니다. 업데이트된 PM2 서비스는 자동으로 재시작됩니다. 출력에 서비스별로 `Updated (restart manually)`가 표시되면 `mcctl console service restart`를 실행하세요. `.services/` 디렉토리가 없는 설치는 패키지가 `<root>/node_modules`에 있으며, `mcctl update`는 그 위치의 패키지를 업데이트합니다. 서비스 패키지가 하나 이상 설치되어 있으면 이 명령은 Minecraft 서버의 이미지 태그를 맞추고 Docker 이미지를 pull하기도 합니다. `--check`, `--cli-only`를 지정하거나 설치된 서비스 패키지가 없으면 건너뜁니다.

| 옵션 | 설명 |
|--------|-------------|
| `--check` | 업데이트 여부만 확인하고 설치하지 않음 |
| `--cli-only` | CLI만 업데이트하고 서비스는 그대로 둠 |
| `--yes` | 확인 프롬프트 건너뛰기 |

`npm update -g @minecraft-docker/mcctl`은 CLI 패키지만 업데이트하며 `.services/`의 서비스는 건드리지 않습니다. 모든 옵션은 [mcctl update 레퍼런스](../cli/commands.ko.md#mcctl-update)를 참조하세요.

### 주요 업데이트 후 재초기화

호환성을 깨는 변경 사항이 있는 경우 콘솔을 재초기화하세요:

```bash
# 재초기화: 서비스를 중지하고 콘솔 설정을 삭제합니다
mcctl console init --force

# 서비스 시작
mcctl console service start
```

`--force`는 기존 설정을 보존하지 않습니다. PM2 서비스를 중지하고 `.mcctl-admin.yml`과 `ecosystem.config.cjs`를 삭제하므로, API 접근 모드를 다시 선택해야 하고, `--api-port`와 `--console-port`를 지정하지 않으면 포트는 기본값으로 돌아가며, api-key 계열 모드에서는 새 API 키가 생성됩니다. 콘솔 데이터베이스 `data/mcctl.db`는 유지되므로 다른 사용자는 그대로입니다. 기존 관리자의 이메일을 입력하면 해당 사용자는 (세션 포함) 삭제된 뒤 지금 입력한 비밀번호로 다시 생성됩니다. 다른 이메일을 입력하면 기존 관리자는 그대로 남고 새 관리자가 추가됩니다.

## 제거

Management Console를 제거하려면:

```bash
# 콘솔 서비스 제거 (대화형)
mcctl console remove

# 또는 확인 없이 강제 제거
mcctl console remove --force

# 나중에 재설치할 수 있도록 설정 파일 유지
mcctl console remove --keep-config
```

다음 작업이 수행됩니다:

- PM2 프로세스 중지 및 제거 (mcctl-api, mcctl-console)
- 설정 파일 삭제 (`.mcctl-admin.yml`, 그리고 존재하는 경우 레거시 `users.yaml`)
- PM2 에코시스템 설정 삭제 (`ecosystem.config.cjs`)

!!! warning "데이터 보존"
    Management Console를 제거해도 Minecraft 서버나 월드 데이터에는 영향이 없습니다.

!!! note "콘솔 데이터베이스는 유지됩니다"
    `data/mcctl.db`(콘솔 사용자, 세션, 사용자별 서버 권한)와 `.services/`의 패키지는 삭제되지 않습니다. 재설치 후에도 계정이 남도록 의도한 동작입니다. 같은 관리자 이메일로 `mcctl console init`을 다시 실행하려면 `--force`가 필요하며, 없으면 `User '<email>' already exists` 오류로 실패합니다.

완전히 처음부터 시작하려면 데이터베이스도 함께 삭제하세요:

!!! danger "되돌릴 수 없습니다"
    데이터베이스를 삭제하면 모든 콘솔 사용자, 세션, 사용자별 서버 권한이 사라집니다.

```bash
rm -f ~/minecraft-servers/data/mcctl.db*
```

삭제되는 항목과 유지되는 항목의 전체 목록은 [`mcctl console remove`](cli-commands.ko.md#mcctl-console-remove)를 참조하세요.

### PM2 정리 (선택 사항)

PM2 구성을 완전히 제거하려면:

```bash
# 저장된 프로세스 목록 제거
pm2 unstartup

# PM2 데몬 종료
pm2 kill
```
