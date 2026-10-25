# 감사 로그 웹 콘솔 가이드

웹 콘솔의 **Audit** 페이지는 mcctl-api와 mcctl CLI가 기록한 감사 로그를 보여줍니다. 서버 수명주기, 플레이어 관리, 월드, 백업, 설정, 파일 작업이 기록됩니다. 같은 데이터를 명령줄이나 HTTP로 보려면 [CLI - 감사 로그 명령어](../cli/audit-log.md)와 [API 레퍼런스](../api/endpoints.md)를 참고하세요.

![감사 로그](../images/audit-log.png)

## 감사 로그 접근

- 상단 내비게이션 바의 **Audit**를 클릭하거나, 대시보드 **Recent Activity** 카드의 **View All**을 클릭합니다.
- URL: `http://localhost:5000/audit-logs`

Admin 역할이든 User 역할이든 로그인한 모든 사용자가 감사 로그를 보고 내보낼 수 있습니다. 서버별 권한(Viewer, Operator, Owner)은 감사 로그를 제한하지 않습니다.

## 실시간 업데이트

페이지 헤더에는 실시간(SSE) 연결이 열려 있으면 녹색 점과 함께 **Live**가, 끊겨 있으면 회색 점과 함께 **Disconnected**가 표시됩니다. 페이지는 3초마다 스스로 다시 연결합니다.

목록은 저절로 새로고침되지 않습니다. 새 항목이 도착하면 필터 위에 "N new logs available - Click to refresh" 배너가 나타나며, 이를 클릭하면 새 항목을 불러옵니다. 필터를 바꿔도 목록을 다시 불러옵니다.

## 통계

상단의 카드 4개는 설정된 필터와 관계없이 전체 감사 로그를 요약합니다. 30초마다 새로고침됩니다.

| 카드 | 값 |
|------|----|
| **Total Logs** | 항목 수 |
| **Success Rate** | 상태가 success인 항목의 비율 |
| **Failures** | 실패한 항목 수 |
| **Active Users** | 최근 1,000개 항목에 나타난 서로 다른 수행자(actor) 수 |

## 필터

**Filters** 패널은 접을 수 있고, 활성 필터 수를 표시하며, **Clear All** 버튼이 있습니다. 필터는 바꾸는 즉시 적용되고 페이지 URL에 남으므로, 필터링한 화면을 북마크할 수 있습니다.

| 필터 | 설명 |
|------|------|
| **From** / **To** | 하루 단위 날짜 범위 (UTC) |
| **Action** | 액션 하나: Create, Delete, Start, Stop, Restart, Whitelist Add, Whitelist Remove, Ban, Unban, Op, Deop, Kick, Purge, Platform Settings. 대상 유형을 고르면 서버 또는 플레이어 액션으로 목록이 좁혀집니다 |
| **Target type** | **All**, **Server**, **Player** |
| **Status** | **All**, **Success**, **Failure** |
| **Target Name** | 서버, 월드, 플레이어 등 대상의 정확한 이름 |
| **Actor** | 기록된 그대로의 수행자, 예: `api:console`, `cli:local` |

그 밖에 기록되는 액션(월드, 백업과 백업 스케줄, 설정 스냅샷, 모드, 파일, playit.gg, mc-router)은 **Action** 목록에 없습니다. **Target Name**이나 **Actor**로 찾거나 [`mcctl audit list --action <action>`](../cli/audit-log.md#mcctl-audit-list)을 사용하세요.

웹 콘솔에서 한 플레이어 작업은 서버를 대상으로, 플레이어 이름을 세부 정보로 기록합니다. CLI는 플레이어를 대상으로 기록합니다. 따라서 **Player** 대상 유형에는 CLI에서 한 플레이어 작업만 표시됩니다.

## 로그 테이블

| 컬럼 | 설명 |
|------|------|
| **Timestamp** | "21m ago" 같은 상대 시간. 마우스를 올리면 정확한 시각이 표시됩니다 |
| **Action** | 색상 칩으로 표시되는 액션 레이블 ([액션 색상](#액션-색상) 참조) |
| **Actor** | 웹 콘솔에서 한 작업은 `console`(`api:console`로 기록), Platform Settings 변경과 파일 작업은 사용자 이름(`api:<user>`로 기록), CLI 명령어는 `local` 칩(`cli:local`로 기록) |
| **Target** | 서버, 월드, 플레이어 등 대상의 이름. 서버는 상세 페이지로, 플레이어는 Players 페이지로 연결됩니다 |
| **Status** | **OK**(녹색) 또는 **Error**(빨간색) |

- 세부 정보나 오류 메시지가 있는 행은 앞에 화살표가 있으며, 클릭하면 행 아래에 펼쳐집니다. 실패한 항목은 펼쳐진 상태로 시작합니다.
- 행을 클릭하면 상세 드로어가 열립니다 ([로그 상세](#로그-상세) 참조).
- 페이지당 25, 50(기본값), 100행 중에서 고를 수 있습니다.

서버의 **Activity** 탭은 한 서버에 대해 같은 테이블을 Target 컬럼 없이 보여주며, **Action** 필터, 상태 토글, 이 페이지로 이동하는 **View Full History** 링크가 있습니다 ([웹 콘솔 가이드](web-console.md#activity-탭) 참조).

## 로그 상세

오른쪽 드로어에는 항목의 **ID**, **Timestamp**(초 단위, 시간대 포함), **Action**, **Status**, **Actor**, **Target**(`<type>/<name>`), 실패한 항목의 오류 메시지, 기록된 필드를 담은 **Details** 표가 표시됩니다. 서버 생성 항목의 세부 정보는 `type`, `version`, `memory`, `modpack`, `modpackVersion`, `modLoader`, `excludeFiles`입니다.

**Related Logs**에는 탭이 두 개 있습니다. **Same Target**은 대상이 같은 다른 항목을, **Same Actor**는 수행자가 같은 다른 항목을 최신순으로 최대 10개씩 보여줍니다.

## 내보내기

Filters 패널의 **Export**를 클릭하면 **Export Audit Logs** 다이얼로그가 열립니다:

1. **CSV** 또는 **JSON**을 고릅니다.
2. **Applied Filters**와 **Estimated Rows**를 확인합니다. 내보내기는 현재 설정된 필터를 사용합니다.
3. **Export CSV** 또는 **Export JSON**을 클릭합니다. 파일은 `audit-logs-<timestamp>.csv` 또는 `audit-logs-<timestamp>.json`으로 저장됩니다.

내보내기는 최대 5,000행입니다. 일치하는 항목이 더 많으면 다이얼로그에 안내가 표시되므로, 나머지는 필터를 좁혀 내보내세요.

CSV 예시:

```csv
ID,Timestamp,Action,Actor,Target Type,Target Name,Status,Error Message,Details
7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f,2026-10-24T14:32:15.123Z,server.start,api:console,server,survival,success,"",""
2b8e9f10-1a2b-4c3d-9e4f-5a6b7c8d9e0f,2026-10-24T14:30:45.020Z,player.whitelist.add,cli:local,player,Steve,success,"","{""server"":""survival""}"
```

JSON 파일에는 `exportedAt`, `filters`, `total`, `logs` 배열이 들어 있습니다.

## 액션 색상

| 색상 | 액션 |
|------|------|
| 녹색 | Create, Whitelist Add, Unban |
| 빨간색 | Delete, Ban, Kick |
| 파란색 | Start, Op |
| 황색 | Stop, Whitelist Remove, Deop, Platform Settings |
| 보라색 | Restart |
| 회색 | Purge, 그리고 전용 레이블이 없는 모든 액션 (`world.create`처럼 이름으로 표시) |

## 오래된 로그 삭제

웹 콘솔에는 삭제(purge) 기능이 없습니다. 오래된 항목은 [`mcctl audit purge`](../cli/audit-log.md#mcctl-audit-purge)(`--dry-run`으로 삭제 대상을 미리 확인)나 Admin 역할이 필요한 `DELETE /api/audit-logs`로 삭제합니다. 플랫폼 `.env`에 `AUDIT_AUTO_CLEANUP=true`를 설정하면 `AUDIT_RETENTION_DAYS`(기본값 90)보다 오래된 항목이 자동으로 삭제됩니다.

## 문제 해결

### 로그가 업데이트되지 않음

**증상:**
- 헤더에 **Disconnected**가 표시됨
- 새 작업을 해도 "new logs available" 배너가 나타나지 않음

**해결 방법:**
1. 몇 초 기다립니다. 페이지는 3초마다 다시 연결합니다
2. 페이지를 새로고침합니다 (F5)
3. mcctl-api와 mcctl-console이 실행 중인지 확인합니다: `mcctl console service status`

### 페이지가 느림

**증상:**
- 항목이 많을 때 테이블 로딩이 느림

**해결 방법:**
1. 날짜 범위를 좁힙니다
2. 액션, 대상, 수행자로 필터링합니다
3. 페이지당 행 수를 줄입니다

### 로그 누락

**증상:**
- 예상한 항목이 보이지 않음

**가능한 원인:**
1. 자동 정리로 오래된 항목이 삭제됨 (`AUDIT_AUTO_CLEANUP`, `AUDIT_RETENTION_DAYS`)
2. 수동 삭제(purge)가 실행됨
3. 필터에 가려짐: **Clear All**을 클릭하세요
4. 해당 액션이 **Action** 목록에 없음: **Target Name**이나 **Actor**로 검색하세요
5. 웹 콘솔에서 한 플레이어 작업은 **Player** 대상 유형이 아니라 서버 아래에 기록됨

## 참고

- [CLI - 감사 로그 명령어](../cli/audit-log.md)
- [API 레퍼런스](../api/endpoints.md)
- [감사 로그 변수](../configuration/environment.md#감사-로그-변수)
- [웹 콘솔 가이드](web-console.md)
