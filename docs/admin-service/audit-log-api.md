# Audit Log API Reference

The Audit Log API provides REST endpoints for querying, analyzing, and managing audit logs through the mcctl-api service.

## Base URL

```
http://localhost:5001/api
```

## Authentication

All endpoints require authentication. See [API Authentication](./api-reference.md#authentication) for details.

Supported modes:
- API Key (`X-API-Key` header)
- Session Cookie (NextAuth.js)
- Basic Auth
- mTLS
- Disabled (development only)

## Endpoints

### GET /audit-logs

Retrieve audit logs with optional filtering and pagination.

**Request:**
```http
GET /api/audit-logs?limit=50&action=server.create&status=success
Authorization: Bearer <api-key>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Maximum number of logs to return (default: 50, max: 1000) |
| `offset` | number | Number of logs to skip for pagination (default: 0) |
| `action` | string | Filter by action type (see Action Types below) |
| `actor` | string | Filter by actor (e.g., `cli:local`, `web:admin`) |
| `targetName` | string | Filter by target server/player name |
| `targetType` | string | Filter by target type (`server`, `player`, `audit`) |
| `status` | string | Filter by status (`success` or `failure`) |
| `from` | ISO 8601 | Start date for time range filter |
| `to` | ISO 8601 | End date for time range filter |

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Invalid query parameters
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Server error

---

### GET /audit-logs/stats

Get statistical overview of audit logs.

**Request:**
```http
GET /api/audit-logs/stats
Authorization: Bearer <api-key>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `from` | ISO 8601 | Start date for time range filter (optional) |
| `to` | ISO 8601 | End date for time range filter (optional) |

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Server error

---

### GET /audit-logs/:id

Get details of a specific audit log entry.

**Request:**
```http
GET /api/audit-logs/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <api-key>
```

**Response:**
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

**Status Codes:**
- `200 OK` - Success
- `404 Not Found` - Log entry not found
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Server error

---

### DELETE /audit-logs/purge

Delete old audit logs based on criteria.

**Request:**
```http
DELETE /api/audit-logs/purge?before=2025-11-07T00:00:00.000Z
Authorization: Bearer <api-key>
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `before` | ISO 8601 | Delete logs before this date (required) |
| `dryRun` | boolean | Preview deletion without actually deleting (default: false) |

**Response:**
```json
{
  "deletedCount": 234,
  "before": "2025-11-07T00:00:00.000Z",
  "dryRun": false
}
```

**Status Codes:**
- `200 OK` - Success
- `400 Bad Request` - Missing or invalid `before` parameter
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Server error

---

### GET /audit-logs/stream

Server-Sent Events (SSE) stream for real-time audit log updates.

**Request:**
```http
GET /api/audit-logs/stream
Authorization: Bearer <api-key>
Accept: text/event-stream
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `action` | string | Filter by action type (optional) |
| `targetName` | string | Filter by target name (optional) |

**Response Stream:**
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

**Event Types:**
- `audit-log` - New audit log entry matching filters
- `ping` - Keepalive ping every 30 seconds
- `error` - Error occurred in stream

**Client Example (JavaScript):**
```javascript
const eventSource = new EventSource('/api/audit-logs/stream', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

eventSource.addEventListener('audit-log', (event) => {
  const log = JSON.parse(event.data);
  console.log('New audit log:', log);
});

eventSource.addEventListener('error', (error) => {
  console.error('Stream error:', error);
  eventSource.close();
});
```

**Status Codes:**
- `200 OK` - Stream established
- `401 Unauthorized` - Missing or invalid authentication
- `500 Internal Server Error` - Server error

---

## Data Types

### Action Types

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

### Actor Format

Actors follow the pattern `<source>:<identifier>`:

| Source | Example | Description |
|--------|---------|-------------|
| `cli` | `cli:local` | CLI command executed locally |
| `web` | `web:admin` | Web console user action |
| `api` | `api:service` | API client or service |
| `system` | `system:auto-cleanup` | System automated task |

### AuditLog Schema

```typescript
interface AuditLog {
  id: string;              // UUID
  action: AuditAction;     // Action type enum
  actor: string;           // Who performed the action
  targetType: string;      // Type of target (server, player, audit)
  targetName: string;      // Name of target entity
  details: Record<string, unknown> | null;  // Additional context (JSON)
  status: 'success' | 'failure';
  errorMessage: string | null;
  timestamp: string;       // ISO 8601 datetime
}
```

### Details Field Examples

**Server Creation:**
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

**Player Ban:**
```json
{
  "reason": "Griefing spawn area",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5",
  "duration": null
}
```

**Server Start Failure:**
```json
{
  "port": 25565,
  "error": "Port already in use"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "Invalid action filter: invalid-action",
    "details": {
      "parameter": "action",
      "validValues": ["server.create", "server.delete", ...]
    }
  }
}
```

**Common Error Codes:**
- `INVALID_PARAMETER` - Invalid query parameter value
- `UNAUTHORIZED` - Missing or invalid authentication
- `NOT_FOUND` - Resource not found
- `INTERNAL_ERROR` - Server error

## Rate Limiting

API rate limits (per API key):
- 100 requests per minute
- 1000 requests per hour
- SSE streams do not count towards rate limit

## Best Practices

### Pagination

For large result sets, use pagination:

```http
GET /api/audit-logs?limit=100&offset=0    # First page
GET /api/audit-logs?limit=100&offset=100  # Second page
GET /api/audit-logs?limit=100&offset=200  # Third page
```

### Date Range Queries

Always specify date ranges for better performance:

```http
GET /api/audit-logs?from=2026-02-01T00:00:00Z&to=2026-02-05T23:59:59Z
```

### Real-time Monitoring

Use SSE stream for real-time dashboard updates instead of polling:

```javascript
// Good: SSE stream
const stream = new EventSource('/api/audit-logs/stream');

// Bad: Polling (wastes resources)
setInterval(() => fetch('/api/audit-logs'), 5000);
```

## See Also

- [CLI - Audit Log Commands](../cli/audit-log.md)
- [Web Console - Audit Log UI](./audit-log-ui.md)
- [API Authentication](./api-reference.md#authentication)
