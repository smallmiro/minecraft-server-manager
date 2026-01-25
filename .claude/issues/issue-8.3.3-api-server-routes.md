# Issue: mcctl-api 서버 관리 API 라우트

## Phase
8.3.3 - mcctl-api 서비스

## 제목
feat(mcctl-api): Implement server management API routes

## 설명
서버 관리를 위한 REST API 엔드포인트를 구현합니다.

## 선행 작업
- #8.3.1 mcctl-api 프로젝트 기반 구조
- #8.3.2 mcctl-api 인증 플러그인

## 작업 내용
- [ ] `src/routes/servers.ts` 생성
- [ ] `GET /api/servers` - 서버 목록
- [ ] `GET /api/servers/:name` - 서버 상세
- [ ] `POST /api/servers` - 서버 생성
- [ ] `DELETE /api/servers/:name` - 서버 삭제
- [ ] `POST /api/servers/:name/start` - 서버 시작
- [ ] `POST /api/servers/:name/stop` - 서버 중지
- [ ] `POST /api/servers/:name/restart` - 서버 재시작
- [ ] `GET /api/servers/:name/logs` - 서버 로그
- [ ] `POST /api/servers/:name/exec` - RCON 명령 실행
- [ ] 스키마 정의 (Zod/TypeBox)
- [ ] 단위 테스트
- [ ] 통합 테스트

## API 엔드포인트

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/servers` | 서버 목록 |
| GET | `/api/servers/:name` | 서버 상세 |
| POST | `/api/servers` | 서버 생성 |
| DELETE | `/api/servers/:name` | 서버 삭제 |
| POST | `/api/servers/:name/start` | 시작 |
| POST | `/api/servers/:name/stop` | 중지 |
| POST | `/api/servers/:name/restart` | 재시작 |
| GET | `/api/servers/:name/logs` | 로그 |
| POST | `/api/servers/:name/exec` | RCON 실행 |

## 응답 예시

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

## 관련 문서
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md) - Section 5.1

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
