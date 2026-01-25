# Issue: mcctl-api Server Management API Routes

## Phase
8.3.3 - mcctl-api Service

## Title
feat(mcctl-api): Implement server management API routes

## Description
Implement REST API endpoints for server management.

## Prerequisites
- #8.3.1 mcctl-api project foundation
- #8.3.2 mcctl-api authentication plugin

## Tasks
- [ ] Create `src/routes/servers.ts`
- [ ] `GET /api/servers` - List servers
- [ ] `GET /api/servers/:name` - Server details
- [ ] `POST /api/servers` - Create server
- [ ] `DELETE /api/servers/:name` - Delete server
- [ ] `POST /api/servers/:name/start` - Start server
- [ ] `POST /api/servers/:name/stop` - Stop server
- [ ] `POST /api/servers/:name/restart` - Restart server
- [ ] `GET /api/servers/:name/logs` - Server logs
- [ ] `POST /api/servers/:name/exec` - Execute RCON command
- [ ] Schema definitions (Zod/TypeBox)
- [ ] Unit tests
- [ ] Integration tests

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List servers |
| GET | `/api/servers/:name` | Server details |
| POST | `/api/servers` | Create server |
| DELETE | `/api/servers/:name` | Delete server |
| POST | `/api/servers/:name/start` | Start |
| POST | `/api/servers/:name/stop` | Stop |
| POST | `/api/servers/:name/restart` | Restart |
| GET | `/api/servers/:name/logs` | Logs |
| POST | `/api/servers/:name/exec` | RCON execute |

## Response Example

```json
// GET /api/servers
{
  "success": true,
  "data": [
    {
      "name": "myserver",
      "type": "PAPER",
      "version": "1.21.1",
      "status": "running",
      "players": { "online": 3, "max": 20 },
      "hostname": "myserver.local"
    }
  ]
}
```

## Related Documents
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md) - Section 5.1

## Labels
- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
