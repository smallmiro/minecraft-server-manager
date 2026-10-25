# 감사 로그 관리

감사 로그는 Minecraft 서버에서 수행된 작업을 기록하여 문제 해결과 보안 감사를 위한 활동 기록을 제공합니다.

## 개요

CLI와 mcctl-api(웹 콘솔도 제공)가 감사 로그를 기록합니다. 예를 들어 다음 작업이 기록됩니다:

- **서버**: 생성, 삭제, 시작, 중지, 재시작, 설정 및 호스트명 변경
- **플레이어**: 화이트리스트, 차단/차단 해제, OP 부여/제거와 OP 레벨, 강제 퇴장
- **월드, 모드 등**: 월드 변경과 지도 렌더링, 모드, playit.gg, 라우터 재시작, 플랫폼 설정, 파일 브라우저 작업, 백업 및 설정 스냅샷 일정
- **감사 유지보수**: 로그 삭제 작업

로그는 SQLite 데이터베이스 `<root>/data/audit.db`(기본값 `~/minecraft-servers/data/audit.db`)에 저장됩니다. 오래된 항목은 `mcctl audit purge`를 실행하거나 [자동 정리](#설정)를 켰을 때만 삭제됩니다.

## 명령어

### `mcctl audit list`

선택적 필터링을 통해 감사 로그 목록을 표시합니다.

**문법:**
```bash
mcctl audit list [옵션]
```

**옵션:**

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--limit <숫자>` | number | 표시할 최대 로그 수 (기본값: 50) |
| `--action <액션>` | string | 액션 타입으로 필터링 |
| `--actor <액터>` | string | 작업을 수행한 주체로 필터링 |
| `--target <이름>` | string | 대상 서버/플레이어 이름으로 필터링 |
| `--status <상태>` | success\|failure | 작업 상태로 필터링 |
| `--from <날짜>` | ISO date | 시작 날짜 (예: 2026-01-01) |
| `--to <날짜>` | ISO date | 종료 날짜 |

**액션 타입:**

`--action`에는 `server.create`나 `player.whitelist.add`처럼 전체 이름을 씁니다:

| 접두사 | 액션 |
|--------|------|
| `server.` | `create`, `delete`, `start`, `stop`, `restart`, `config`, `hostname` |
| `player.` | `whitelist.add`, `whitelist.remove`, `whitelist.toggle`, `ban`, `unban`, `op`, `op.level`, `deop`, `kick` |
| `world.` | `create`, `delete`, `assign`, `release`, `map.render` |
| `mod.` | `add`, `remove` |
| `playit.` | `start`, `stop` |
| `router.` | `restart` |
| `platform.` | `settings.update` |
| `file.` | `read`, `write`, `delete`, `mkdir`, `rename`, `upload`, `download` |
| `backup.schedule.` | `create`, `update`, `delete`, `enable`, `disable`, `run` |
| `config.snapshot.` | `create`, `delete`, `restore` |
| `config.snapshot.schedule.` | `create`, `update`, `delete`, `enable`, `disable` |
| `audit.` | `purge` |

**예제:**

```bash
# 최근 50개 로그 표시 (기본값)
mcctl audit list

# 최근 100개 로그 표시
mcctl audit list --limit 100

# 서버 생성 이벤트만 표시
mcctl audit list --action server.create

# 특정 사용자의 모든 작업 표시
mcctl audit list --actor cli:local

# 실패한 작업만 표시
mcctl audit list --status failure

# 특정 서버에 대한 로그 표시
mcctl audit list --target myserver

# 날짜 범위 조회
mcctl audit list --from 2026-01-01 --to 2026-01-31

# 여러 필터 조합
mcctl audit list --action server.start --status failure --limit 20
```

**출력 형식:**

항목은 최신순으로 표시되며, 시각은 시스템 로캘 형식을 따릅니다.

```
Audit Logs (25 entries):

2/5/2026, 2:32:15 PM server.create             cli:local       server:myserver      success
2/5/2026, 2:30:45 PM player.whitelist.add      web:admin       player:Steve         success
2/5/2026, 2:28:10 PM server.start              api:service     server:survival      failure
```

---

### `mcctl audit stats`

감사 로그의 통계 개요를 표시합니다.

**문법:**
```bash
mcctl audit stats
```

**출력:**
```
Audit Log Statistics:

Total Logs: 1234
Success: 1180
Failure: 54


By Action:

  server.start                   456
  server.stop                    432
  player.whitelist.add           123
  server.create                   89
  player.ban                      45
  ...


By Actor:

  cli:local            678
  web:admin            456
  api:service          100
```

**사용 사례:**
- 가장 빈번한 작업 모니터링
- 가장 많은 활동을 하는 사용자 식별
- 실패율 추적
- 규정 준수 보고를 위한 감사

---

### `mcctl audit purge`

데이터베이스 공간을 확보하기 위해 오래된 감사 로그를 삭제합니다.

**문법:**
```bash
mcctl audit purge [옵션]
```

**옵션:**

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--days <숫자>` | number | N일보다 오래된 로그 삭제 (기본값: 90) |
| `--before <날짜>` | ISO date | 특정 날짜 이전의 로그 삭제 |
| `--dry-run` | boolean | 실제로 삭제하지 않고 미리보기 |
| `--force` | boolean | 확인 프롬프트 건너뛰기 |

**예제:**

```bash
# 90일보다 오래된 로그 삭제 (확인 포함)
mcctl audit purge

# 30일보다 오래된 로그 삭제
mcctl audit purge --days 30

# 특정 날짜 이전의 로그 삭제
mcctl audit purge --before 2026-01-01

# 삭제될 항목 미리보기
mcctl audit purge --days 60 --dry-run

# 확인 없이 강제 삭제
mcctl audit purge --days 180 --force
```

**출력:**
```
[DRY RUN] Would delete 234 audit logs older than 2025-11-07T00:00:00.000Z

# 실제 삭제 시:
✓ Deleted 234 audit logs
```

**참고**: 삭제 작업 자체도 감사 로그에 기록됩니다.

---

## 설정

자동 정리는 두 환경 변수로 설정합니다:

```bash
# ~/minecraft-servers/.env

# 오래된 로그 자동 삭제 (기본값: 꺼짐)
AUDIT_AUTO_CLEANUP=true

# 보관 기간 (일) (기본값: 90)
AUDIT_RETENTION_DAYS=90
```

**AUDIT_AUTO_CLEANUP:**
- `true`: 새 항목을 기록하는 동안 `AUDIT_RETENTION_DAYS`보다 오래된 항목을 삭제합니다(새 항목 100개마다, 또는 마지막 정리 후 24시간이 지났을 때)
- 설정하지 않거나 다른 값(기본값): 자동 정리 없음. `mcctl audit purge`를 사용합니다

mcctl-api는 두 변수를 `<root>/.env`에서 읽으므로 자동 정리는 mcctl-api에서 실행됩니다. CLI는 셸 환경 변수에서만 읽습니다.

**AUDIT_RETENTION_DAYS:**
- 자동 정리 전에 감사 로그를 보관할 일수
- 기본값: 90일
- 권장값: 규정 준수 요구사항에 따라 30-180일

## 저장소

**데이터베이스 위치:**
```
~/minecraft-servers/data/audit.db
```

**스키마:**
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL CHECK(status IN ('success', 'failure')),
  error_message TEXT,
  timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
```

**Details 필드:**
JSON으로 인코딩된 추가 컨텍스트. 예제:

```json
// 서버 생성
{
  "type": "PAPER",
  "version": "1.21.1",
  "memory": "4G"
}

// 플레이어 차단
{
  "server": "survival",
  "reason": "Griefing"
}

// 감사 삭제
{
  "deletedCount": 234,
  "cutoffDate": "2025-11-07T00:00:00.000Z"
}
```

## 모범 사례

### 보관 정책

| 환경 | 권장 보관 기간 | 이유 |
|------|----------------|------|
| 개발 | 30일 | 빈번한 테스트, 덜 중요함 |
| 스테이징 | 60일 | 프로덕션 전 검증 |
| 프로덕션 | 90-180일 | 규정 준수, 문제 해결 |
| 규정 준수 필수 | 365일 이상 | 규제 요구사항 |

### 정기 검토

```bash
# 주간 실패 검토
mcctl audit list --status failure --limit 100

# 월간 통계 보고서
mcctl audit stats > monthly-audit-$(date +%Y-%m).txt

# 분기별 정리
mcctl audit purge --days 180 --dry-run
```

### 문제 해결

**최근 서버 실패 확인:**
```bash
mcctl audit list --action server.start --status failure --limit 10
```

**서버를 삭제한 사람 확인:**
```bash
mcctl audit list --action server.delete --target myserver
```

**플레이어 관리 활동 추적:**
```bash
mcctl audit list --action player.ban
mcctl audit list --action player.whitelist.add --actor web:admin
```

## 참고

- [Management Console - 감사 로그 API](../console/audit-log-api.ko.md)
- [Web Console - 감사 로그 UI](../console/audit-log-ui.ko.md)
- [문제 해결](../troubleshooting/index.ko.md)
