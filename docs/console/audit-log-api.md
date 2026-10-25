# Audit Log API Reference

The audit log routes are now documented in the REST API reference: [Audit logs](../api/endpoints.md#audit-logs).

| Former section | New location |
|----------------|--------------|
| Authentication | [Authentication](../api/index.md#authentication) |
| GET /audit-logs | [GET /api/audit-logs](../api/endpoints.md#get-apiaudit-logs) |
| GET /audit-logs/stats | [GET /api/audit-logs/stats](../api/endpoints.md#get-apiaudit-logsstats) |
| GET /audit-logs/:id | [GET /api/audit-logs/:id](../api/endpoints.md#get-apiaudit-logsid) |
| DELETE /audit-logs/purge | [DELETE /api/audit-logs](../api/endpoints.md#delete-apiaudit-logs) (JSON body, needs `X-Role: admin`) |
| GET /audit-logs/stream | [GET /api/audit-logs/stream](../api/endpoints.md#get-apiaudit-logsstream) |
| Data Types | [Audit log entries](../api/endpoints.md#audit-log-entries) |
| Error Responses | [Errors](../api/index.md#errors) |

See also [CLI - Audit Log Commands](../cli/audit-log.md) and [Web Console - Audit Log UI](./audit-log-ui.md).
