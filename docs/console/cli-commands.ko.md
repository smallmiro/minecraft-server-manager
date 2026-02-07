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
| `mcctl console remove` | Management Console 완전 제거 |
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
| `--force` | 이미 구성된 경우에도 재초기화 |
| `--api-port <port>` | API 서버 포트 (기본값: 5001) |
| `--console-port <port>` | 콘솔 서버 포트 (기본값: 3000) |

### 대화형 흐름

명령어가 안내하는 단계:

1. **관리자 사용자명** - 기본값: `admin`
2. **관리자 비밀번호** - 비밀번호 요구사항:
   - 최소 8자
   - 대문자 1개 이상
   - 소문자 1개 이상
   - 숫자 1개 이상
3. **비밀번호 확인** - 일치해야 함
4. **API 접근 모드** - 보안 수준 선택:
   - `internal` - 로컬 네트워크만 (권장)
   - `api-key` - X-API-Key 헤더 필요
   - `ip-whitelist` - IP 기반 접근 제어
   - `api-key-ip` - API 키와 IP 모두 필요
   - `open` - 인증 없음 (개발 전용)
5. **사용자 지정 포트** - 선택적 포트 설정
6. **추가 설정** - 선택한 모드에 따른 추가 설정

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

### 출력 파일

| 파일 | 설명 |
|------|-------------|
| `.mcctl-admin.yml` | 메인 Management Console 설정 |
| `users.yaml` | 해시된 비밀번호가 포함된 사용자 인증정보 |
| `ecosystem.config.cjs` | PM2 프로세스 설정 |

---

## mcctl console remove

PM2 프로세스와 설정 파일을 포함한 Management Console를 완전히 제거합니다.

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
| `users.yaml` | 사용자 인증정보 파일 |
| `ecosystem.config.cjs` | PM2 에코시스템 설정 |

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
설정 파일 제거 중...  설정 파일 3개 제거됨

Console Service가 성공적으로 제거되었습니다

  재설치하려면 실행: mcctl console init
```

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

Username            Role        Created
--------------------------------------------------
admin               admin       2025-01-15
operator1           viewer      2025-01-16

Total: 2 user(s)
```

**JSON 출력:**

```bash
mcctl console user list --json
```

```json
[
  {
    "id": "usr_abc123",
    "username": "admin",
    "role": "admin",
    "createdAt": "2025-01-15T10:00:00.000Z"
  },
  {
    "id": "usr_def456",
    "username": "operator1",
    "role": "viewer",
    "createdAt": "2025-01-16T14:30:00.000Z"
  }
]
```

### mcctl console user add

새 사용자 계정을 추가합니다.

```bash
mcctl console user add [username] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--role <role>` | 사용자 역할: `admin` 또는 `viewer` |
| `--password <password>` | 사용자 비밀번호 |

**대화형 모드:**

```bash
mcctl console user add

? Username: operator1
? Role: Viewer - 읽기 전용 접근
? Password: ********
? Confirm password: ********

'operator1' 사용자가 성공적으로 생성되었습니다!
```

**CLI 모드:**

```bash
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

**역할:**

| 역할 | 권한 |
|------|-------------|
| `admin` | 모든 기능에 대한 전체 접근 |
| `viewer` | 읽기 전용 접근 (상태, 로그) |

### mcctl console user remove

사용자 계정을 제거합니다.

```bash
mcctl console user remove [username] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | 확인 프롬프트 건너뛰기 |

**대화형 모드:**

```bash
mcctl console user remove

? 제거할 사용자 선택: operator1 (viewer)
? 'operator1' 사용자를 삭제하시겠습니까? Yes

'operator1' 사용자가 삭제되었습니다.
```

**CLI 모드:**

```bash
mcctl console user remove operator1 --force
```

!!! note "보호"
    마지막 관리자 사용자는 삭제할 수 없습니다. 이는 실수로 잠기는 것을 방지합니다.

### mcctl console user update

사용자의 역할을 업데이트합니다.

```bash
mcctl console user update [username] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--role <role>` | 새 역할: `admin` 또는 `viewer` |

**예제:**

```bash
# 관리자로 승격
mcctl console user update operator1 --role admin

# 뷰어로 강등
mcctl console user update operator1 --role viewer
```

### mcctl console user reset-password

사용자의 비밀번호를 재설정합니다.

```bash
mcctl console user reset-password [username] [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--password <password>` | 새 비밀번호 (비대화형 사용용) |

**대화형 모드:**

```bash
mcctl console user reset-password operator1

? New password: ********
? Confirm password: ********

'operator1'의 비밀번호가 재설정되었습니다.
```

**CLI 모드:**

```bash
mcctl console user reset-password operator1 --password "NewSecurePass456"
```

---

## mcctl console api

API 설정 및 접근 제어를 관리합니다.

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
  API Key: mctk_abc1...xyz9

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

? API 키를 재생성하시겠습니까? Yes

API 키가 성공적으로 재생성되었습니다.

New API Key: mctk_1234567890abcdef1234567890abcdef

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
| `internal` | 로컬 네트워크만 (가장 안전) |
| `api-key` | X-API-Key 헤더를 통한 외부 접근 |
| `ip-whitelist` | IP 기반 접근 제어 |
| `api-key-ip` | API 키와 IP 모두 필요 |
| `open` | 인증 없음 (개발 전용) |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--force` | 위험한 모드에 대한 확인 건너뛰기 |

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
mcctl console api whitelist <action> [ip] [options]
```

**액션:**

| 액션 | 설명 |
|--------|-------------|
| `list` | 화이트리스트된 IP 목록 |
| `add <ip>` | IP 또는 CIDR 범위 추가 |
| `remove <ip>` | 화이트리스트에서 IP 제거 |

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--json` | JSON 형식으로 출력 (list만) |

**예제:**

```bash
# 화이트리스트 목록
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
| `--api-only` | mcctl-api만 시작 |
| `--console-only` | mcctl-console만 시작 |

**예제:**

```bash
# 모든 서비스 시작
mcctl console service start

# API만 시작
mcctl console service start --api-only

# 콘솔만 시작
mcctl console service start --console-only
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
| `--api-only` | mcctl-api만 중지 |
| `--console-only` | mcctl-console만 중지 |

**예제:**

```bash
# 모든 서비스 중지
mcctl console service stop

# API만 중지
mcctl console service stop --api-only
```

### mcctl console service restart

Management Console 프로세스를 재시작합니다.

```bash
mcctl console service restart [options]
```

**옵션:**

| 옵션 | 설명 |
|--------|-------------|
| `--api-only` | mcctl-api만 재시작 |
| `--console-only` | mcctl-console만 재시작 |

**예제:**

```bash
# 모든 서비스 재시작
mcctl console service restart

# API만 재시작
mcctl console service restart --api-only
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
| `--api-only` | mcctl-api 로그만 표시 |
| `--console-only` | mcctl-console 로그만 표시 |

**예제:**

```bash
# 최근 로그 보기
mcctl console service logs

# 실시간으로 로그 추적
mcctl console service logs -f

# API 로그만 보기
mcctl console service logs --api-only

# 콘솔 로그 추적
mcctl console service logs --console-only -f
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
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

**API 키 모드로 전환:**

```bash
mcctl console api mode api-key
# 표시된 API 키 저장
```

**IP 화이트리스트 설정:**

```bash
mcctl console api mode ip-whitelist
mcctl console api whitelist add 192.168.1.0/24
mcctl console api whitelist add 10.0.0.0/8
mcctl console api whitelist list
```

**서비스 상태 확인:**

```bash
mcctl console service status
mcctl console service logs --api-only
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

**완전 제거:**

```bash
mcctl console remove
```
