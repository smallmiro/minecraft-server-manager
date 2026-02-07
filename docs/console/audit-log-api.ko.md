# 감사 로그 API 참조

감사 로그 API는 mcctl-api 서비스를 통해 감사 로그를 조회, 분석 및 관리하기 위한 REST 엔드포인트를 제공합니다.

## Base URL

```
http://localhost:5001/api
```

## 인증

모든 엔드포인트는 인증이 필요합니다. 자세한 내용은 [API 인증](./api-reference.ko.md#authentication)을 참조하세요.

지원되는 방식:
- API 키 (`X-API-Key` 헤더)
- 세션 쿠키 (NextAuth.js)
- Basic Auth
- mTLS
- 비활성화 (개발 전용)

## 엔드포인트

### GET /audit-logs

선택적 필터링 및 페이지네이션을 통해 감사 로그를 조회합니다.

**요청:**
```http
GET /api/audit-logs?limit=50&action=server.create&status=success
Authorization: Bearer <api-key>
```

**쿼리 파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `limit` | number | 반환할 최대 로그 수 (기본값: 50, 최대: 1000) |
| `offset` | number | 페이지네이션을 위해 건너뛸 로그 수 (기본값: 0) |
| `action` | string | 액션 타입으로 필터링 (아래 액션 타입 참조) |
| `actor` | string | 액터로 필터링 (예: `cli:local`, `web:admin`) |
| `targetName` | string | 대상 서버/플레이어 이름으로 필터링 |
| `targetType` | string | 대상 타입으로 필터링 (`server`, `player`, `audit`) |
| `status` | string | 상태로 필터링 (`success` 또는 `failure`) |
| `from` | ISO 8601 | 시간 범위 필터 시작 날짜 |
| `to` | ISO 8601 | 시간 범위 필터 종료 날짜 |

**응답:**
```json
{
  "logs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "server.create",
      "actor": "cli:local",
      "targetType": "server",
      "targetName": "myserver",
      "details": {
        "type": "PAPER",
        "version": "1.21.1",
        "memory": "4G"
      },
      "status": "success",
      "errorMessage": null,
      "timestamp": "2026-02-05T14:32:15.123Z"
    }
  ],
  "total": 1,
  "limit": 50,
  "offset": 0
}
```

**상태 코드:**
- `200 OK` - 성공
- `400 Bad Request` - 잘못된 쿼리 파라미터
- `401 Unauthorized` - 인증 누락 또는 무효
- `500 Internal Server Error` - 서버 오류

---

### GET /audit-logs/stats

감사 로그의 통계 개요를 가져옵니다.

**요청:**
```http
GET /api/audit-logs/stats
Authorization: Bearer <api-key>
```

**쿼리 파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `from` | ISO 8601 | 시간 범위 필터 시작 날짜 (선택사항) |
| `to` | ISO 8601 | 시간 범위 필터 종료 날짜 (선택사항) |

**응답:**
```json
{
  "totalLogs": 1234,
  "successCount": 1180,
  "failureCount": 54,
  "byAction": {
    "server.start": 456,
    "server.stop": 432,
    "player.whitelist.add": 123,
    "server.create": 89,
    "player.ban": 45
  },
  "byActor": {
    "cli:local": 678,
    "web:admin": 456,
    "api:service": 100
  },
  "byStatus": {
    "success": 1180,
    "failure": 54
  }
}
```

**상태 코드:**
- `200 OK` - 성공
- `401 Unauthorized` - 인증 누락 또는 무효
- `500 Internal Server Error` - 서버 오류

---

### GET /audit-logs/:id

특정 감사 로그 항목의 세부 정보를 가져옵니다.

**요청:**
```http
GET /api/audit-logs/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <api-key>
```

**응답:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "action": "server.create",
  "actor": "cli:local",
  "targetType": "server",
  "targetName": "myserver",
  "details": {
    "type": "PAPER",
    "version": "1.21.1",
    "memory": "4G",
    "worldOptions": {
      "type": "new",
      "seed": null
    }
  },
  "status": "success",
  "errorMessage": null,
  "timestamp": "2026-02-05T14:32:15.123Z"
}
```

**상태 코드:**
- `200 OK` - 성공
- `404 Not Found` - 로그 항목을 찾을 수 없음
- `401 Unauthorized` - 인증 누락 또는 무효
- `500 Internal Server Error` - 서버 오류

---

### DELETE /audit-logs/purge

기준에 따라 오래된 감사 로그를 삭제합니다.

**요청:**
```http
DELETE /api/audit-logs/purge?before=2025-11-07T00:00:00.000Z
Authorization: Bearer <api-key>
```

**쿼리 파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `before` | ISO 8601 | 이 날짜 이전의 로그 삭제 (필수) |
| `dryRun` | boolean | 실제로 삭제하지 않고 미리보기 (기본값: false) |

**응답:**
```json
{
  "deletedCount": 234,
  "before": "2025-11-07T00:00:00.000Z",
  "dryRun": false
}
```

**상태 코드:**
- `200 OK` - 성공
- `400 Bad Request` - `before` 파라미터 누락 또는 무효
- `401 Unauthorized` - 인증 누락 또는 무효
- `500 Internal Server Error` - 서버 오류

---

### GET /audit-logs/stream

실시간 감사 로그 업데이트를 위한 Server-Sent Events (SSE) 스트림.

**요청:**
```http
GET /api/audit-logs/stream
Authorization: Bearer <api-key>
Accept: text/event-stream
```

**쿼리 파라미터:**
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `action` | string | 액션 타입으로 필터링 (선택사항) |
| `targetName` | string | 대상 이름으로 필터링 (선택사항) |

**응답 스트림:**
```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: audit-log
data: {"id":"550e8400...","action":"server.start","actor":"web:admin",...}

event: audit-log
data: {"id":"660e9500...","action":"player.whitelist.add","actor":"cli:local",...}

event: ping
data: {"timestamp":"2026-02-05T14:35:00.000Z"}
```

**이벤트 타입:**
- `audit-log` - 필터와 일치하는 새 감사 로그 항목
- `ping` - 30초마다 킵얼라이브 핑
- `error` - 스트림에서 오류 발생

**클라이언트 예제 (JavaScript):**
```javascript
const eventSource = new EventSource('/api/audit-logs/stream', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

eventSource.addEventListener('audit-log', (event) => {
  const log = JSON.parse(event.data);
  console.log('새 감사 로그:', log);
});

eventSource.addEventListener('error', (error) => {
  console.error('스트림 오류:', error);
  eventSource.close();
});
```

**상태 코드:**
- `200 OK` - 스트림 설정됨
- `401 Unauthorized` - 인증 누락 또는 무효
- `500 Internal Server Error` - 서버 오류

---

## 데이터 타입

### 액션 타입

```typescript
type AuditAction =
  | 'server.create'
  | 'server.delete'
  | 'server.start'
  | 'server.stop'
  | 'server.restart'
  | 'player.whitelist.add'
  | 'player.whitelist.remove'
  | 'player.ban'
  | 'player.unban'
  | 'player.op'
  | 'player.deop'
  | 'player.kick'
  | 'audit.purge';
```

### Actor 형식

Actor는 `<source>:<identifier>` 패턴을 따릅니다:

| Source | 예제 | 설명 |
|--------|------|------|
| `cli` | `cli:local` | 로컬에서 실행된 CLI 명령 |
| `web` | `web:admin` | 웹 콘솔 사용자 작업 |
| `api` | `api:service` | API 클라이언트 또는 서비스 |
| `system` | `system:auto-cleanup` | 시스템 자동화 작업 |

### AuditLog 스키마

```typescript
interface AuditLog {
  id: string;              // UUID
  action: AuditAction;     // 액션 타입 열거형
  actor: string;           // 작업을 수행한 주체
  targetType: string;      // 대상 타입 (server, player, audit)
  targetName: string;      // 대상 엔티티 이름
  details: Record<string, unknown> | null;  // 추가 컨텍스트 (JSON)
  status: 'success' | 'failure';
  errorMessage: string | null;
  timestamp: string;       // ISO 8601 날짜시간
}
```

### Details 필드 예제

**서버 생성:**
```json
{
  "type": "PAPER",
  "version": "1.21.1",
  "memory": "4G",
  "worldOptions": {
    "type": "new",
    "seed": null
  }
}
```

**플레이어 차단:**
```json
{
  "reason": "스폰 지역 그리핑",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "duration": null
}
```

**서버 시작 실패:**
```json
{
  "port": 25565,
  "error": "포트가 이미 사용 중입니다"
}
```

## 오류 응답

모든 오류 응답은 이 형식을 따릅니다:

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "잘못된 액션 필터: invalid-action",
    "details": {
      "parameter": "action",
      "validValues": ["server.create", "server.delete", ...]
    }
  }
}
```

**일반 오류 코드:**
- `INVALID_PARAMETER` - 잘못된 쿼리 파라미터 값
- `UNAUTHORIZED` - 인증 누락 또는 무효
- `NOT_FOUND` - 리소스를 찾을 수 없음
- `INTERNAL_ERROR` - 서버 오류

## 속도 제한

API 속도 제한 (API 키당):
- 분당 100 요청
- 시간당 1000 요청
- SSE 스트림은 속도 제한에 포함되지 않음

## 모범 사례

### 페이지네이션

대규모 결과 세트의 경우 페이지네이션을 사용하세요:

```http
GET /api/audit-logs?limit=100&offset=0    # 첫 페이지
GET /api/audit-logs?limit=100&offset=100  # 두 번째 페이지
GET /api/audit-logs?limit=100&offset=200  # 세 번째 페이지
```

### 날짜 범위 쿼리

더 나은 성능을 위해 항상 날짜 범위를 지정하세요:

```http
GET /api/audit-logs?from=2026-02-01T00:00:00Z&to=2026-02-05T23:59:59Z
```

### 실시간 모니터링

폴링 대신 실시간 대시보드 업데이트를 위해 SSE 스트림을 사용하세요:

```javascript
// 좋음: SSE 스트림
const stream = new EventSource('/api/audit-logs/stream');

// 나쁨: 폴링 (리소스 낭비)
setInterval(() => fetch('/api/audit-logs'), 5000);
```

## 참고

- [CLI - 감사 로그 명령어](../cli/audit-log.ko.md)
- [Web Console - 감사 로그 UI](./audit-log-ui.ko.md)
- [API 인증](./api-reference.ko.md#authentication)
