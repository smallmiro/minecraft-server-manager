# CLI 명령어 레퍼런스

> **참고**: `mcctl admin` 명령어는 더 이상 사용되지 않습니다. 대신 `mcctl console`을 사용하세요. `admin` 명령어 별칭은 하위 호환성을 위해 계속 작동하지만 향후 버전에서 제거될 예정입니다.

`mcctl console` 하위 명령어에 대한 전체 레퍼런스입니다.

## 개요

`mcctl console` 명령어 그룹은 Management Console 관리 기능을 제공합니다:

```bash
mcctl console <subcommand> [options]
```

## 명령어 요약

| 명령어 | 설명 |
|---------|-------------|
| `mcctl console init` | Management Console 설정 초기화 |
| `mcctl console remove` | Management Console 프로세스와 설정 제거 (콘솔 데이터베이스는 유지) |
| `mcctl console user` | 관리자 콘솔 사용자 관리 |
| `mcctl console api` | API 설정 관리 |
| `mcctl console service` | Management Console 수명주기 관리 |

---

## mcctl console init

Management Console 설정을 초기화하고 첫 번째 관리자 사용자를 생성합니다.

### 사용법

```bash
mcctl console init [options]
```

### 옵션

| 옵션 | 설명 |
|--------|-------------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 |
| `--force` | 재초기화 확인을 건너뛰고, 같은 이메일의 기존 관리자 사용자를 교체 (아래 '재초기화' 참조) |
| `--api-port <port>` | API 서버 포트 (기본값: 5001) |
| `--console-port <port>` | 콘솔 서버 포트 (기본값: 5000) |

### 대화형 흐름

명령어가 안내하는 단계:

1. **설치할 서비스** - `mcctl-api`가 기본으로 선택되어 있으며, 웹 콘솔을 설치하려면 `mcctl-console`도 선택합니다
2. **관리자 이메일** - 웹 콘솔 로그인에 사용합니다 (예: `admin@example.com`)
3. **관리자 이름** - 기본값: `Administrator`
4. **관리자 비밀번호** - 비밀번호 요구사항:
    - 최소 8자
    - 대문자 1개 이상
    - 소문자 1개 이상
    - 숫자 1개 이상
5. **API 접근 모드** - 보안 수준 선택:
    - `internal` - 내부 접근만 허용, 외부 노출 없음 (권장)
    - `api-key` - X-API-Key 헤더 필요
    - `ip-whitelist` - IP 기반 접근 제어
    - `api-key-ip` - API 키와 IP 모두 필요
    - `open` - 인증 없음 (개발 전용)
6. **추가 설정** - 선택한 모드에 따른 추가 설정

관리자 이메일, 이름, 비밀번호는 `mcctl-console`을 선택한 경우에만 묻습니다. 관리자 계정은 `admin` 역할로 생성됩니다.

!!! note "접근 모드"
    `mcctl console init`은 접근 모드를 mcctl-api가 인식하는 값으로 변환해 `AUTH_MODE`에 기록합니다: `internal` → 루프백(127.0.0.1, ::1)만 허용하는 `ip-whitelist`, `api-key-ip` → `combined`, `open` → `disabled`. `api-key`와 `ip-whitelist`는 그대로 기록됩니다.

이 명령어는 포트를 묻지 않습니다. 기본값이 아닌 포트를 사용하려면 `--api-port`와 `--console-port`를 지정하세요 (아래 예제 참조).

### 예제

```bash
# 표준 초기화
mcctl console init

# 강제 재초기화
mcctl console init --force

# 사용자 지정 데이터 디렉토리
mcctl console init --root /opt/minecraft

# 사용자 지정 포트
mcctl console init --api-port 8001 --console-port 8000
```

### 재초기화

콘솔이 이미 초기화되어 있으면 재초기화할지 묻습니다. `--force`는 이 질문을 건너뜁니다. 재초기화하면 다음과 같이 동작합니다.

- `mcctl-api`와 `mcctl-console` PM2 프로세스를 중지합니다.
- `.mcctl-admin.yml`과 `ecosystem.config.cjs`를 삭제하므로, API 접근 모드를 다시 선택하고, api-key 계열 모드에서는 새 API 키가 생성되며, `--api-port`와 `--console-port`를 지정하지 않으면 포트는 기본값으로 돌아갑니다.
- `data/mcctl.db`는 유지하므로 다른 사용자는 영향을 받지 않습니다.

입력한 관리자 이메일이 `data/mcctl.db`에 이미 있으면 `User '<email>' already exists` 오류와 함께 `mcctl console init --force`를 안내하고 실패합니다. `--force`를 지정하면 해당 사용자를 (세션 포함) 삭제한 뒤 새 이름과 비밀번호로 다시 생성합니다.

### 출력 파일

모든 경로는 데이터 디렉토리(`MCCTL_ROOT`, 기본값 `~/minecraft-servers`) 기준입니다.

| 파일 | 설명 |
|------|-------------|
| `.mcctl-admin.yml` | 메인 Management Console 설정 |
| `data/mcctl.db` | 콘솔 사용자 데이터베이스 (`mcctl-console`을 선택한 경우에만 생성) |
| `ecosystem.config.cjs` | PM2 프로세스 설정 |

---

## mcctl console remove

Management Console의 PM2 프로세스와 설정 파일을 제거합니다. 콘솔 데이터베이스(`data/mcctl.db`)는 의도적으로 유지됩니다.

### 사용법

```bash
mcctl console remove [options]
```

### 옵션

| 옵션 | 설명 |
|--------|-------------|
| `--root <path>` | 사용자 지정 데이터 디렉토리 |
| `--force` | 확인 프롬프트 건너뛰기 |
| `--keep-config` | 나중에 재설치할 수 있도록 설정 파일 유지 |

### 제거되는 항목

| 구성 요소 | 설명 |
|-----------|-------------|
| PM2 프로세스 | mcctl-api, mcctl-console 프로세스가 중지되고 제거됨 |
| `.mcctl-admin.yml` | 메인 설정 파일 |
| `ecosystem.config.cjs` | PM2 에코시스템 설정 |
| `users.yaml` | 레거시 사용자 인증정보 파일 (존재하는 경우에만 삭제) |

`--keep-config`를 지정하면 위 세 파일은 유지되고 PM2 프로세스만 제거됩니다.

### 유지되는 항목

| 구성 요소 | 설명 |
|-----------|-------------|
| `data/mcctl.db` | 콘솔 데이터베이스: 사용자, 세션, 사용자별 서버 권한. 재설치 후에도 계정이 남도록 의도적으로 삭제하지 않습니다 |
| `.services/` | 설치된 `mcctl-api`, `mcctl-console` 패키지 |
| `api-config.json` | `mcctl console api`가 기록한 설정 (있는 경우) |

Minecraft 서버와 월드는 영향을 받지 않습니다.

### 제거 후 재설치

`data/mcctl.db`가 유지되므로, 같은 관리자 이메일로 `mcctl console init`을 다시 실행하면 `User '<email>' already exists` 오류로 실패합니다. 해당 사용자를 교체하려면 `mcctl console init --force`를 사용하거나 다른 이메일을 입력하세요.

완전히 처음부터 시작하려면 데이터베이스를 직접 삭제합니다.

!!! danger "되돌릴 수 없습니다"
    데이터베이스를 삭제하면 모든 콘솔 사용자, 세션, 사용자별 서버 권한이 사라집니다.

```bash
# ~/minecraft-servers를 사용 중인 데이터 디렉토리(MCCTL_ROOT)로 바꾸세요
rm -f ~/minecraft-servers/data/mcctl.db*
```

`*`는 데이터베이스 옆에 있는 SQLite `-wal`, `-shm` 파일도 함께 삭제합니다.

### 예제

```bash
# 대화형 제거 (확인 프롬프트 표시)
mcctl console remove

# 확인 없이 강제 제거
mcctl console remove --force

# 설정 파일 유지
mcctl console remove --keep-config
```

### 출력 예시

```
  제거될 항목:
    - PM2 프로세스 (mcctl-api, mcctl-console)
    - 설정 파일 (.mcctl-admin.yml, users.yaml)
    - PM2 에코시스템 설정 (ecosystem.config.cjs)

? Console Service를 제거하시겠습니까? Yes

PM2 프로세스 중지 및 제거 중...  중지 및 제거됨: mcctl-api, mcctl-console
설정 파일 제거 중...  설정 파일 2개 제거됨

Console Service가 성공적으로 제거되었습니다

  재설치하려면 실행: mcctl console init
```

확인 프롬프트에는 여전히 `users.yaml`이 표시되지만 이 파일은 존재하는 경우에만 삭제되므로, 현재 설치에서는 2개 파일(`.mcctl-admin.yml`, `ecosystem.config.cjs`)이 제거됩니다.

---

## mcctl console user

관리자 콘솔 사용자를 관리합니다.

### 하위 명령어

| 하위 명령어 | 설명 |
|------------|-------------|
| `list` | 모든 사용자 목록 |
| `add` | 새 사용자 추가 |
| `remove` | 사용자 제거 |
| `update` | 사용자 역할 업데이트 |
| `reset-password` | 사용자 비밀번호 재설정 |

### mcctl console user list

등록된 모든 사용자 목록을 표시합니다.

```bash
mcctl console user list [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**출력 예시:**

```
Users:

Email                         Name                Role        Created
---------------------------------------------------------------------------
operator@example.com          Operator            user        2025-01-16
admin@example.com             Administrator       admin       2025-01-15

Total: 2 user(s)
```

**JSON 출력:**

```bash
mcctl console user list --json
```

```json
[
  {
    "id": "0f9e8d7c6b5a49382716f5e4d3c2b1a0",
    "name": "Operator",
    "email": "operator@example.com",
    "role": "user",
    "emailVerified": true,
    "banned": false,
    "createdAt": "2025-01-16T14:30:00.000Z",
    "updatedAt": "2025-01-16T14:30:00.000Z"
  },
  {
    "id": "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    "name": "Administrator",
    "email": "admin@example.com",
    "role": "admin",
    "emailVerified": true,
    "banned": false,
    "createdAt": "2025-01-15T10:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
]
```

### mcctl console user add

새 사용자 계정을 추가합니다. 사용자는 이메일 주소로 식별합니다.

```bash
mcctl console user add [email] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--role <role>` | 사용자 역할: `admin` 또는 `user` |
| `--password <password>` | 사용자 비밀번호 |

**대화형 모드:**

```bash
mcctl console user add

? Email: operator@example.com
? Name: Operator
? Role: User - 표준 접근
? Password: ********
? Confirm password: ********

'operator@example.com' 사용자가 성공적으로 생성되었습니다!
```

대화형 비밀번호 입력은 최소 8자 이상이어야 합니다.

**CLI 모드:**

```bash
mcctl console user add operator@example.com --role user --password "SecurePass123"
```

```json
{"success":true,"email":"operator@example.com"}
```

CLI 모드는 `[email]`, `--role`, `--password`를 모두 지정한 경우에만 적용되며, 하나라도 빠지면 대화형 프롬프트가 표시됩니다. 사용자 이름은 이메일의 `@` 앞부분으로 설정되고, `--password`로 지정한 비밀번호는 8자 최소 길이 검사를 거치지 않습니다.

**역할:**

| 역할 | 권한 |
|------|-------------|
| `admin` | 모든 기능에 대한 전체 접근 |
| `user` | 표준 접근, 계정에 부여된 서버로 제한됨 |

### mcctl console user remove

사용자 계정을 제거합니다.

```bash
mcctl console user remove [email] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | 확인 프롬프트 건너뛰기 |

**대화형 모드:**

```bash
mcctl console user remove

? 제거할 사용자 선택: operator@example.com (user)
? 'operator@example.com' 사용자를 삭제하시겠습니까? Yes

'operator@example.com' 사용자가 삭제되었습니다.
```

**CLI 모드:**

```bash
mcctl console user remove operator@example.com --force
```

!!! note "보호"
    마지막 관리자 사용자는 삭제할 수 없습니다. 이는 실수로 잠기는 것을 방지합니다.

### mcctl console user update

사용자의 역할을 업데이트합니다.

```bash
mcctl console user update [email] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--role <role>` | 새 역할: `admin` 또는 `user` |

**예제:**

```bash
# 관리자로 승격
mcctl console user update operator@example.com --role admin

# 일반 사용자로 강등
mcctl console user update operator@example.com --role user
```

### mcctl console user reset-password

사용자의 비밀번호를 재설정합니다.

```bash
mcctl console user reset-password [email] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--password <password>` | 새 비밀번호 (비대화형 사용용) |

**대화형 모드:**

```bash
mcctl console user reset-password operator@example.com

? New password: ********
? Confirm password: ********

'operator@example.com'의 비밀번호가 재설정되었습니다.
```

**CLI 모드:**

```bash
mcctl console user reset-password operator@example.com --password "NewSecurePass456"
```

---

## mcctl console api

API 설정 및 접근 제어를 관리합니다.

이 명령어들은 데이터 디렉토리(`MCCTL_ROOT`, 기본값 `~/minecraft-servers`)의 `api-config.json`을 읽고 씁니다. 이 파일은 `mcctl console init`이 생성하는 `.mcctl-admin.yml`과는 별개의 파일입니다. 명령어가 변경 사항을 저장하기 전까지는 기본값(모드 `internal`, 포트 `5001`, 빈 IP 화이트리스트)이 사용됩니다.

!!! warning "변경 사항이 실행 중인 mcctl-api에 반영되지 않습니다"
    이 명령어들은 `api-config.json`만 변경합니다. 실행 중인 `mcctl-api`는 접근 모드, API 키, IP 화이트리스트를 `ecosystem.config.cjs`의 `env` 블록(`AUTH_MODE`, `AUTH_API_KEY`, `AUTH_IP_WHITELIST`)에서 읽는데, 이 명령어들은 해당 파일을 건드리지 않습니다. 따라서 여기서 바꾼 값은 `mcctl console service restart`를 실행해도 API에 영향을 주지 않으며, `mcctl console api status`도 실행 중인 API가 사용하는 값이 아니라 `api-config.json`의 내용을 보여줍니다.

    실제로 적용되는 모드와 키는 `mcctl console init` 때 정한 값입니다. 현재는 `mcctl console init --force`로 다시 초기화해야 바꿀 수 있습니다.

### 하위 명령어

| 하위 명령어 | 설명 |
|------------|-------------|
| `status` | API 설정 표시 |
| `key regenerate` | API 키 재생성 |
| `mode` | 접근 모드 변경 |
| `whitelist` | IP 화이트리스트 관리 |

### mcctl console api status

현재 API 설정을 표시합니다.

```bash
mcctl console api status [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**출력 예시:**

```
API Configuration

  Access Mode: api-key
  Port: 5001
  API Key: mctk_a1b...9f3c

  IP Whitelist: (비어있음)

  Mode: X-API-Key 헤더를 통한 외부 접근
```

### mcctl console api key regenerate

새 API 키를 생성합니다. 기존의 모든 클라이언트를 업데이트해야 합니다.

```bash
mcctl console api key regenerate [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | 확인 프롬프트 건너뛰기 |

**예제:**

```bash
mcctl console api key regenerate

? API 키를 재생성하시겠습니까? 기존의 모든 클라이언트를 업데이트해야 합니다. Yes

API 키가 성공적으로 재생성되었습니다.

New API Key: mctk_0f1e2d3c4b5a69788796a5b4c3d2e1f00f1e2d3c4b5a69788796a5b4c3d2e1f0

새 API 키로 모든 클라이언트를 업데이트하세요.
```

### mcctl console api mode

API 접근 모드를 변경합니다.

```bash
mcctl console api mode [mode] [options]
```

**모드:**

| 모드 | 설명 |
|------|-------------|
| `internal` | 내부 접근만 허용, 외부 노출 없음 (가장 안전) |
| `api-key` | X-API-Key 헤더를 통한 외부 접근 |
| `ip-whitelist` | IP 기반 접근 제어 |
| `api-key-ip` | API 키와 IP 모두 필요 |
| `open` | 인증 없음 (개발 전용) |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | `open` 모드로 전환할 때 표시되는 확인 건너뛰기 |

성공하면 `Access mode changed to: <mode>`를 출력합니다.

**예제:**

```bash
# 대화형 선택
mcctl console api mode

# 직접 모드 변경
mcctl console api mode api-key

# open 모드 강제 (개발 전용!)
mcctl console api mode open --force
```

### mcctl console api whitelist

ip-whitelist 및 api-key-ip 모드용 IP 화이트리스트를 관리합니다.

```bash
mcctl console api whitelist [action] [ip] [options]
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `list` | 화이트리스트된 IP 목록 (`[action]`을 생략하면 기본값) |
| `add <ip>` | IP 또는 CIDR 범위 추가 (IPv4만 지원, `<ip>`를 생략하면 값을 입력받음) |
| `remove <ip>` | 화이트리스트에서 IP 제거 (`<ip>`를 생략하면 목록에서 선택) |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 (list만) |

**예제:**

```bash
# 화이트리스트 목록 (액션 없이 "whitelist"만 실행해도 동일)
mcctl console api whitelist list

# 단일 IP 추가
mcctl console api whitelist add 192.168.1.100

# CIDR 범위 추가
mcctl console api whitelist add 10.0.0.0/8

# IP 제거
mcctl console api whitelist remove 192.168.1.100
```

---

## mcctl console service

PM2를 통해 Management Console 수명주기를 관리합니다.

### 하위 명령어

| 하위 명령어 | 설명 |
|------------|-------------|
| `start` | PM2를 통해 Management Console 시작 |
| `stop` | Management Console 중지 |
| `restart` | Management Console 재시작 |
| `status` | 서비스 상태 표시 |
| `logs` | 서비스 로그 보기 |

### mcctl console service start

PM2를 통해 Management Console 프로세스 (API와 Console)를 시작합니다.

```bash
mcctl console service start [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--api` | mcctl-api만 시작 |
| `--console` | mcctl-console 시작. 콘솔은 API에 의존하므로 mcctl-api도 함께 시작됨 |

`--api`나 `--console`을 지정하지 않으면, 두 서비스가 모두 설치된 경우 "API only"와 "API + Console" 중 무엇을 시작할지 묻습니다.

**예제:**

```bash
# 서비스 시작 (두 서비스가 모두 설치된 경우 어느 것을 시작할지 묻습니다)
mcctl console service start

# API만 시작
mcctl console service start --api

# 콘솔 시작 (API 함께 시작)
mcctl console service start --console
```

**출력 예시:**

```
PM2를 통해 콘솔 서비스 시작 중...
  Started mcctl-api
  Started mcctl-console
콘솔 서비스가 성공적으로 시작되었습니다

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

  모든 서비스 정상
```

### mcctl console service stop

Management Console 프로세스를 중지합니다.

```bash
mcctl console service stop [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--api` | mcctl-api 중지. 콘솔은 API 없이 실행될 수 없으므로 mcctl-console도 함께 중지됨 |
| `--console` | mcctl-console만 중지 |
| `--force` | PM2 프로세스를 삭제하고 PM2 데몬을 종료 (mcctl 서비스뿐 아니라 PM2가 관리하는 모든 프로세스가 중지됨) |

`--api`나 `--console`을 지정하지 않으면, 두 서비스가 모두 설치된 경우 "All services"와 "Console only" 중 무엇을 중지할지 묻습니다.

**예제:**

```bash
# 서비스 중지 (두 서비스가 모두 설치된 경우 어느 것을 중지할지 묻습니다)
mcctl console service stop

# 콘솔만 중지
mcctl console service stop --console

# API 중지 (콘솔도 함께 중지됨)
mcctl console service stop --api
```

### mcctl console service restart

Management Console 프로세스를 재시작합니다.

```bash
mcctl console service restart [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--api` | mcctl-api만 재시작 |
| `--console` | mcctl-console 재시작. 콘솔은 API에 의존하므로 mcctl-api도 함께 재시작됨 |
| `--force` | mcctl PM2 프로세스를 삭제하고 PM2 데몬을 종료한 뒤, 선택한 mcctl 서비스를 다시 시작하고 PM2 프로세스 목록을 저장 (`pm2 save`). PM2가 관리하던 나머지(다른 앱, 선택하지 않은 mcctl 서비스)는 데몬과 함께 중지되고 다시 시작되지 않으며 저장된 목록에서도 빠짐 |

`--api`나 `--console`을 지정하지 않으면, 두 서비스가 모두 설치된 경우 "API only"와 "API + Console" 중 무엇을 재시작할지 묻습니다.

**예제:**

```bash
# 서비스 재시작 (두 서비스가 모두 설치된 경우 어느 것을 재시작할지 묻습니다)
mcctl console service restart

# API만 재시작
mcctl console service restart --api
```

### mcctl console service status

PM2를 통해 Management Console 상태를 표시합니다.

```bash
mcctl console service status [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 |

**출력 예시:**

```
  Console Service Status (PM2)

  mcctl-api
    Status: online
    PID: 12345
    CPU: 2%
    Memory: 52.1 MB
    Uptime: 2h 15m
    Restarts: 0

  mcctl-console
    Status: online
    PID: 12346
    URL: http://localhost:5000
    CPU: 1%
    Memory: 85.3 MB
    Uptime: 2h 15m
    Restarts: 0

  모든 서비스 정상
```

**JSON 출력:**

```json
{
  "api": {
    "name": "mcctl-api",
    "status": "online",
    "pid": 12345,
    "cpu": 2,
    "memory": "52.1 MB",
    "uptime": "2h 15m",
    "restarts": 0
  },
  "console": {
    "name": "mcctl-console",
    "status": "online",
    "pid": 12346,
    "cpu": 1,
    "memory": "85.3 MB",
    "uptime": "2h 15m",
    "restarts": 0,
    "url": "http://localhost:5000"
  },
  "healthy": true
}
```

### mcctl console service logs

PM2를 통해 Management Console 로그를 확인합니다.

```bash
mcctl console service logs [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `-f, --follow` | 로그 출력 추적 (스트리밍) |
| `--api` | mcctl-api 로그만 표시 |
| `--console` | mcctl-console 로그 표시 (mcctl-api 로그도 함께 표시됨) |

CLI 도움말은 `--console`을 "Target console service only"로 설명하지만, `logs`의 현재 동작은 mcctl-api도 포함합니다 (`start`, `restart`와 같은 선택 방식).

**예제:**

```bash
# 최근 로그 보기
mcctl console service logs

# 실시간으로 로그 추적
mcctl console service logs -f

# API 로그만 보기
mcctl console service logs --api

# 콘솔 로그 추적 (API 로그 포함)
mcctl console service logs --console -f
```

로그 추적을 중지하려면 `Ctrl+C`를 누르세요.

---

## 빠른 참조

### 일반적인 워크플로우

**초기 설정:**

```bash
mcctl console init
mcctl console service start
```

**운영자 사용자 추가:**

```bash
mcctl console user add operator@example.com --role user --password "SecurePass123"
```

**API 키 모드로 전환:**

```bash
# API 접근 모드를 물을 때 "api-key" 선택
mcctl console init --force
# 마지막에 출력되는 API 키를 저장 (한 번만 표시됩니다)
mcctl console service start
```

`mcctl console api mode`와 `mcctl console api key regenerate`는 `api-config.json`만 변경하므로 실행 중인 API를 전환하지 못합니다 ([mcctl console api](#mcctl-console-api) 절의 경고 참조).

**IP 화이트리스트 설정:**

```bash
# "ip-whitelist"를 선택하고 허용할 IP를 쉼표로 구분해 입력
mcctl console init --force
mcctl console service start
```

`mcctl console api whitelist`도 현재는 `api-config.json`만 수정합니다.

**서비스 상태 확인:**

```bash
mcctl console service status
mcctl console service logs --api
```

**설정 변경 후 재시작:**

```bash
mcctl console service restart
```

**부팅 시 자동 시작:**

```bash
pm2 startup
pm2 save
```

**제거 (`data/mcctl.db`는 유지):**

```bash
mcctl console remove
```
