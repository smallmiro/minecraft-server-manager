# 감사 로그 관리

감사 로그 시스템은 Minecraft 서버에서 수행되는 모든 중요한 작업을 추적하여 규정 준수, 문제 해결 및 보안 감사를 위한 포괄적인 활동 기록을 제공합니다.

## 개요

감사 로그는 다음 작업에 대해 자동으로 생성됩니다:
- **서버 생명주기**: 생성, 삭제, 시작, 중지, 재시작
- **플레이어 관리**: 화이트리스트 추가/제거, 차단/차단 해제, OP 부여/제거, 강제 퇴장
- **감사 유지보수**: 로그 삭제 작업

로그는 `~/.minecraft-servers/audit.db`의 SQLite 데이터베이스에 저장되며 90일 후 자동 정리됩니다(설정 가능).

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
- `server.create` - 서버 생성
- `server.delete` - 서버 삭제
- `server.start` - 서버 시작
- `server.stop` - 서버 중지
- `server.restart` - 서버 재시작
- `player.whitelist.add` - 플레이어 화이트리스트 추가
- `player.whitelist.remove` - 플레이어 화이트리스트 제거
- `player.ban` - 플레이어 차단
- `player.unban` - 플레이어 차단 해제
- `player.op` - 플레이어 OP 권한 부여
- `player.deop` - 플레이어 OP 권한 제거
- `player.kick` - 플레이어 서버에서 추방
- `audit.purge` - 감사 로그 삭제

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
```
Audit Logs (25 entries):

2026-02-05 14:32:15  server.create              cli:local       server:myserver        success
2026-02-05 14:30:45  player.whitelist.add       web:admin       player:Steve           success
2026-02-05 14:28:10  server.start               api:service     server:survival        failure
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

Total Logs: 1,234
Success: 1,180
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

감사 로그 동작은 `.env` 파일의 환경 변수를 통해 설정합니다:

```bash
# ~/.minecraft-servers/.env

# 오래된 로그 자동 정리
AUDIT_AUTO_CLEANUP=true

# 보관 기간 (일) (기본값: 90)
AUDIT_RETENTION_DAYS=90
```

**AUDIT_AUTO_CLEANUP:**
- `true` (기본값): 시스템 시작 시 `AUDIT_RETENTION_DAYS`보다 오래된 로그 자동 삭제
- `false`: 자동 정리 비활성화 (수동 삭제만 가능)

**AUDIT_RETENTION_DAYS:**
- 자동 정리 전에 감사 로그를 보관할 일수
- 기본값: 90일
- 권장값: 규정 준수 요구사항에 따라 30-180일

## 저장소

**데이터베이스 위치:**
```
~/.minecraft-servers/audit.db
```

**스키마:**
```sql
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL CHECK (status IN ('success', 'failure')),
  error_message TEXT,
  timestamp TEXT NOT NULL
);

CREATE INDEX idx_action ON audit_logs(action);
CREATE INDEX idx_actor ON audit_logs(actor);
CREATE INDEX idx_target_name ON audit_logs(target_name);
CREATE INDEX idx_status ON audit_logs(status);
CREATE INDEX idx_timestamp ON audit_logs(timestamp);
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
  "reason": "Griefing",
  "uuid": "069a79f4-44e9-4726-a5be-fca90e38aaf5"
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
