# feat: mcctl-api 서비스 기본 구조 설정

## 개요

mcctl-api REST API 서비스의 기본 프로젝트 구조를 설정합니다.

## 관련 문서

- [mcctl-api/prd.md](../../../platform/services/mcctl-api/prd.md)
- [mcctl-api/plan.md](../../../platform/services/mcctl-api/plan.md)

## 구현 목록

### 패키지 설정

- [ ] `package.json` 생성
  ```json
  {
    "name": "@minecraft-docker/mcctl-api",
    "version": "0.1.0",
    "type": "module",
    "main": "dist/index.js"
  }
  ```

- [ ] `tsconfig.json` 설정
- [ ] `pnpm-workspace.yaml` 업데이트

### 의존성

```json
{
  "dependencies": {
    "@minecraft-docker/shared": "workspace:*",
    "fastify": "^4.x",
    "@fastify/swagger": "^8.x",
    "@fastify/swagger-ui": "^2.x",
    "@fastify/cors": "^8.x"
  },
  "devDependencies": {
    "vitest": "^1.x",
    "supertest": "^6.x"
  }
}
```

### 기본 파일 구조

```
platform/services/mcctl-api/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # 진입점
│   ├── server.ts       # Fastify 서버 설정
│   ├── config.ts       # 환경 변수 로더
│   └── di/
│       └── container.ts # DI 컨테이너
```

### 구현

- [ ] `src/index.ts` - 서버 시작점
- [ ] `src/server.ts` - Fastify 인스턴스 생성 및 플러그인 등록
- [ ] `src/config.ts` - 환경 변수 파싱
- [ ] `src/di/container.ts` - shared 패키지 연결

## 테스트

- [ ] 빌드 테스트 (`pnpm build`)
- [ ] 서버 시작 테스트
- [ ] 헬스 체크 엔드포인트 테스트

## 완료 기준

- [ ] 빌드 성공
- [ ] `GET /api/health` 응답 확인
- [ ] shared 패키지 import 정상 동작

## Labels

- `phase:8-admin`
- `type:feature`
- `package:mcctl-api`
