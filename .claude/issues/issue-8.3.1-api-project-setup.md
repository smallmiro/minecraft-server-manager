# Issue: mcctl-api 프로젝트 기반 구조

## Phase
8.3.1 - mcctl-api 서비스

## 제목
feat(mcctl-api): Setup project foundation

## 설명
mcctl-api REST API 서비스의 기본 프로젝트 구조를 설정합니다.

## 작업 내용
- [ ] `package.json` 생성 (`@minecraft-docker/mcctl-api`)
- [ ] `tsconfig.json` 설정
- [ ] `src/index.ts` - 진입점
- [ ] `src/server.ts` - Fastify 서버 설정
- [ ] `src/config.ts` - 환경 변수 로더
- [ ] `src/di/container.ts` - DI 컨테이너
- [ ] pnpm-workspace.yaml에 패키지 추가
- [ ] 빌드 테스트

## 의존성

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*",
    "fastify": "^4.x",
    "@fastify/cors": "^8.x"
  }
}
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `MCCTL_ROOT` | 데이터 디렉토리 | `/data` |
| `API_PORT` | 리스닝 포트 | `3001` |
| `API_ACCESS_MODE` | 접근 모드 | `internal` |

## 관련 문서
- [mcctl-api PRD](../../platform/services/mcctl-api/prd.md)
- [mcctl-api Plan](../../platform/services/mcctl-api/plan.md) - Phase 1

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
