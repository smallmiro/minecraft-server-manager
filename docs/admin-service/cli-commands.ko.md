# CLI 명령어 레퍼런스

> **참고**: `mcctl admin` 명령어는 지원 중단(deprecated)되었습니다. 대신 `mcctl console`을 사용하세요. `admin` 명령어 별칭은 하위 호환성을 위해 계속 작동하지만 향후 버전에서 제거될 예정입니다.

모든 `mcctl console` 하위 명령어에 대한 완전한 레퍼런스입니다.

## 개요

`mcctl console` 명령어 그룹은 Admin Service 관리 기능을 제공합니다:

```bash
mcctl console <subcommand> [options]
```

## 명령어 요약

| 명령어 | 설명 |
|--------|------|
| `mcctl console init` | Admin Service 설정 초기화 |
| `mcctl console user` | 관리 콘솔 사용자 관리 |
| `mcctl console api` | API 설정 관리 |
| `mcctl console service` | Admin Service 수명 주기 관리 |

---

## mcctl console init

Admin Service 설정을 초기화하고 첫 번째 관리자 사용자를 생성합니다.

### 사용법

```bash
mcctl console init [options]
```

### 옵션

| 옵션 | 설명 |
|------|------|
| `--root <path>` | 사용자 정의 데이터 디렉토리 |
| `--force` | 이미 구성된 경우에도 재초기화 |

### 대화형 흐름

명령어가 다음을 안내합니다:

1. **관리자 사용자명** - 기본값: `admin`
2. **관리자 비밀번호** - 비밀번호 요구 사항:
   - 최소 8자 이상
   - 대문자 1개 이상
   - 소문자 1개 이상
   - 숫자 1개 이상
3. **비밀번호 확인** - 일치해야 함
4. **API 접근 모드** - 보안 수준 선택:
   - `internal` - Docker 네트워크 전용 (권장)
   - `api-key` - X-API-Key 헤더 필요
   - `ip-whitelist` - IP 기반 접근 제어
   - `api-key-ip` - API 키와 IP 모두 필요
   - `open` - 인증 없음 (개발 환경 전용)
5. **추가 구성** - 선택한 모드에 따른 추가 설정

### 예제

```bash
# 표준 초기화
mcctl console init

# 강제 재초기화
mcctl console init --force

# 사용자 정의 데이터 디렉토리
mcctl console init --root /opt/minecraft
```

### 출력 파일

| 파일 | 설명 |
|------|------|
| `admin.yaml` | Admin Service 주요 설정 |
| `users.yaml` | 해시된 비밀번호가 포함된 사용자 자격 증명 |
| `api-config.json` | API 접근 설정 |

---

## mcctl console user

관리 콘솔 사용자를 관리합니다.

### 하위 명령어

| 하위 명령어 | 설명 |
|------------|------|
| `list` | 모든 사용자 조회 |
| `add` | 새 사용자 추가 |
| `remove` | 사용자 삭제 |
| `update` | 사용자 역할 변경 |
| `reset-password` | 사용자 비밀번호 재설정 |

### mcctl console user list

등록된 모든 사용자를 조회합니다.

```bash
mcctl console user list [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
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
|------|------|
| `--role <role>` | 사용자 역할: `admin` 또는 `viewer` |
| `--password <password>` | 사용자 비밀번호 |

**대화형 모드:**

```bash
mcctl console user add

? Username: operator1
? Role: Viewer - Read-only access
? Password: ********
? Confirm password: ********

User 'operator1' created successfully!
```

**CLI 모드:**

```bash
mcctl console user add operator1 --role viewer --password "SecurePass123"
```

**역할:**

| 역할 | 권한 |
|------|------|
| `admin` | 모든 기능에 대한 전체 접근 권한 |
| `viewer` | 읽기 전용 접근 (상태, 로그) |

### mcctl console user remove

사용자 계정을 삭제합니다.

```bash
mcctl console user remove [username] [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--force` | 확인 프롬프트 건너뛰기 |

**대화형 모드:**

```bash
mcctl console user remove

? Select user to remove: operator1 (viewer)
? Are you sure you want to delete user 'operator1'? Yes

User 'operator1' deleted successfully.
```

**CLI 모드:**

```bash
mcctl console user remove operator1 --force
```

!!! note "보호 기능"
    마지막 관리자 사용자는 삭제할 수 없습니다. 이는 실수로 인한 계정 잠금을 방지합니다.

### mcctl console user update

사용자의 역할을 변경합니다.

```bash
mcctl console user update [username] [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
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
|------|------|
| `--password <password>` | 새 비밀번호 (비대화형 사용) |

**대화형 모드:**

```bash
mcctl console user reset-password operator1

? New password: ********
? Confirm password: ********

Password for 'operator1' has been reset.
```

**CLI 모드:**

```bash
mcctl console user reset-password operator1 --password "NewSecurePass456"
```

---

## mcctl console api

API 설정과 접근 제어를 관리합니다.

### 하위 명령어

| 하위 명령어 | 설명 |
|------------|------|
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
|------|------|
| `--json` | JSON 형식으로 출력 |

**출력 예시:**

```
API Configuration

  Access Mode: api-key
  Port: 3001
  API Key: mctk_abc1...xyz9

  IP Whitelist: (empty)

  Mode: External access with X-API-Key header
```

### mcctl console api key regenerate

새 API 키를 생성합니다. 모든 기존 클라이언트를 업데이트해야 합니다.

```bash
mcctl console api key regenerate [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--force` | 확인 프롬프트 건너뛰기 |

**예제:**

```bash
mcctl console api key regenerate

? Are you sure you want to regenerate the API key? Yes

API key regenerated successfully.

New API Key: mctk_1234567890abcdef1234567890abcdef

Please update all clients with the new API key.
```

### mcctl console api mode

API 접근 모드를 변경합니다.

```bash
mcctl console api mode [mode] [options]
```

**모드:**

| 모드 | 설명 |
|------|------|
| `internal` | Docker 네트워크 전용 (가장 안전) |
| `api-key` | X-API-Key 헤더로 외부 접근 |
| `ip-whitelist` | IP 기반 접근 제어 |
| `api-key-ip` | API 키와 IP 모두 필요 |
| `open` | 인증 없음 (개발 환경 전용) |

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--force` | 위험한 모드에 대한 확인 건너뛰기 |

**예제:**

```bash
# 대화형 선택
mcctl console api mode

# 직접 모드 변경
mcctl console api mode api-key

# open 모드 강제 적용 (개발 환경 전용!)
mcctl console api mode open --force
```

### mcctl console api whitelist

ip-whitelist 및 api-key-ip 모드를 위한 IP 화이트리스트를 관리합니다.

```bash
mcctl console api whitelist <action> [ip] [options]
```

**액션:**

| 액션 | 설명 |
|------|------|
| `list` | 화이트리스트된 IP 조회 |
| `add <ip>` | IP 또는 CIDR 범위 추가 |
| `remove <ip>` | 화이트리스트에서 IP 제거 |

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--json` | JSON 형식으로 출력 (list 전용) |

**예제:**

```bash
# 화이트리스트 조회
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

Admin Service 컨테이너 수명 주기를 관리합니다.

### 하위 명령어

| 하위 명령어 | 설명 |
|------------|------|
| `start` | Admin Service 컨테이너 시작 |
| `stop` | Admin Service 컨테이너 중지 |
| `restart` | Admin Service 컨테이너 재시작 |
| `status` | 컨테이너 상태 표시 |
| `logs` | 컨테이너 로그 조회 |

### mcctl console service start

Admin Service 컨테이너(API 및 Console)를 시작합니다.

```bash
mcctl console service start [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
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

### mcctl console service stop

Admin Service 컨테이너를 중지합니다.

```bash
mcctl console service stop
```

### mcctl console service restart

Admin Service 컨테이너를 재시작합니다.

```bash
mcctl console service restart [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--api-only` | mcctl-api만 재시작 |
| `--console-only` | mcctl-console만 재시작 |

### mcctl console service status

Admin Service 컨테이너 상태를 표시합니다.

```bash
mcctl console service status [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `--json` | JSON 형식으로 출력 |

**출력 예시:**

```
  Admin Service Status

  mcctl-api
    Status: running
    Port: 3001
    Health: healthy
    Uptime: 2h 15m

  mcctl-console
    Status: running
    Port: 3000
    URL: http://localhost:3000
    Health: healthy
    Uptime: 2h 15m

  All services healthy
```

**JSON 출력:**

```json
{
  "api": {
    "name": "api",
    "container": "mcctl-api",
    "status": "running",
    "health": "healthy",
    "port": 3001,
    "uptime": "2h 15m"
  },
  "console": {
    "name": "console",
    "container": "mcctl-console",
    "status": "running",
    "health": "healthy",
    "port": 3000,
    "uptime": "2h 15m",
    "url": "http://localhost:3000"
  },
  "healthy": true
}
```

### mcctl console service logs

Admin Service 컨테이너 로그를 조회합니다.

```bash
mcctl console service logs [options]
```

**옵션:**

| 옵션 | 설명 |
|------|------|
| `-f, --follow` | 로그 출력 팔로우 (스트림) |
| `--api-only` | mcctl-api 로그만 표시 |
| `--console-only` | mcctl-console 로그만 표시 |

**예제:**

```bash
# 최근 로그 조회
mcctl console service logs

# 실시간 로그 팔로우
mcctl console service logs -f

# API 로그만 조회
mcctl console service logs --api-only

# 콘솔 로그 팔로우
mcctl console service logs --console-only -f
```

로그 팔로우를 중지하려면 `Ctrl+C`를 누르세요.

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
# 표시된 API 키를 저장하세요
```

**IP 화이트리스트 구성:**

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
