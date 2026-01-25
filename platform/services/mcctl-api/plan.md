# Implementation Plan: mcctl-api

## 상위 문서
- [전체 프로젝트 Plan](../../../plan.md) - Phase 8

## 개요

mcctl-api REST API 서비스의 구현 계획입니다.

## Phase 1: 프로젝트 기반 구조

### 1.1 패키지 설정
- [ ] `package.json` 생성 (`@minecraft-docker/mcctl-api`)
- [ ] `tsconfig.json` 설정
- [ ] 의존성 설치 (fastify, @fastify/swagger)
- [ ] pnpm-workspace.yaml에 패키지 추가

### 1.2 기본 서버 구조
- [ ] `src/index.ts` - 진입점
- [ ] `src/server.ts` - Fastify 서버 설정
- [ ] `src/config.ts` - 환경 변수 로더

### 1.3 DI 컨테이너
- [ ] `src/di/container.ts` - 의존성 주입 컨테이너
- [ ] shared 패키지의 Use Case, Repository 연결

## Phase 2: 인증 플러그인

### 2.1 접근 모드 구현
- [ ] `src/plugins/auth.ts` - 인증 플러그인
- [ ] `internal` 모드 - Docker 네트워크 검증
- [ ] `api-key` 모드 - X-API-Key 헤더 검증
- [ ] `ip-whitelist` 모드 - IP 화이트리스트
- [ ] `api-key-ip` 모드 - 복합 인증
- [ ] `open` 모드 - 인증 없음 (개발용)

### 2.2 에러 핸들링
- [ ] `src/plugins/error-handler.ts` - 통합 에러 핸들러
- [ ] 표준 에러 응답 포맷

## Phase 3: API 라우트 구현

### 3.1 서버 관리 API
- [ ] `src/routes/servers.ts`
- [ ] `GET /api/servers` - 서버 목록
- [ ] `GET /api/servers/:name` - 서버 상세
- [ ] `POST /api/servers` - 서버 생성
- [ ] `DELETE /api/servers/:name` - 서버 삭제
- [ ] `POST /api/servers/:name/start` - 서버 시작
- [ ] `POST /api/servers/:name/stop` - 서버 중지
- [ ] `POST /api/servers/:name/restart` - 서버 재시작
- [ ] `GET /api/servers/:name/logs` - 서버 로그
- [ ] `POST /api/servers/:name/exec` - RCON 명령 실행

### 3.2 월드 관리 API
- [ ] `src/routes/worlds.ts`
- [ ] `GET /api/worlds` - 월드 목록
- [ ] `POST /api/worlds` - 월드 생성
- [ ] `POST /api/worlds/:name/assign` - 월드 할당
- [ ] `POST /api/worlds/:name/release` - 월드 해제

### 3.3 플레이어 관리 API
- [ ] `src/routes/players.ts`
- [ ] 화이트리스트, 밴, OP, 킥 API

### 3.4 백업 API
- [ ] `src/routes/backup.ts`
- [ ] 백업 상태, 푸시, 이력, 복원 API

### 3.5 시스템 API
- [ ] `src/routes/health.ts`
- [ ] 헬스 체크, mc-router 상태 API

## Phase 4: Swagger/OpenAPI

- [ ] `src/plugins/swagger.ts` - Swagger 플러그인
- [ ] 스키마 정의
- [ ] `/docs` 엔드포인트 설정

## Phase 5: Docker 설정

- [ ] `Dockerfile` 작성
- [ ] Multi-stage 빌드
- [ ] GitHub Actions CI/CD

## Phase 6: 테스트

- [ ] 단위 테스트 (vitest)
- [ ] 통합 테스트 (supertest)

## 완료 기준

1. 모든 API 엔드포인트 구현 및 테스트 통과
2. 5가지 접근 모드 정상 동작
3. OpenAPI 문서 자동 생성
4. Docker 이미지 빌드 성공

## Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 계획 작성 |
