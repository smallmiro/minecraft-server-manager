# Implementation Plan: mcctl CLI

## 상위 문서
- [전체 프로젝트 Plan](../../../plan.md) - Phase 6, 7

## 개요

mcctl CLI 도구의 구현 계획입니다. 현재 구현이 완료된 상태입니다.

## 구현 현황

### Phase 1: 기반 구조 ✅
- [x] `package.json` 생성 (`@minecraft-docker/mcctl`)
- [x] `tsconfig.json` 설정
- [x] CLI 진입점 (`src/index.ts`)
- [x] DI 컨테이너 (`src/di/container.ts`)

### Phase 2: 기본 명령어 ✅
- [x] `mcctl init` - 플랫폼 초기화
- [x] `mcctl status` - 서버 상태
- [x] `mcctl create` - 서버 생성
- [x] `mcctl delete` - 서버 삭제
- [x] `mcctl start/stop` - 서버 시작/중지
- [x] `mcctl logs` - 로그 조회

### Phase 3: 대화형 모드 ✅
- [x] `@clack/prompts` 통합
- [x] `ClackPromptAdapter` 구현
- [x] 대화형 서버 생성
- [x] 대화형 서버 삭제

### Phase 4: 월드 관리 ✅
- [x] `mcctl world list`
- [x] `mcctl world new`
- [x] `mcctl world assign`
- [x] `mcctl world release`

### Phase 5: 플레이어 관리 ✅
- [x] `mcctl player` - 통합 대화형 관리
- [x] `mcctl whitelist`
- [x] `mcctl ban`
- [x] `mcctl op`
- [x] `mcctl kick`
- [x] Mojang API 연동
- [x] 플레이어 캐시 시스템

### Phase 6: 백업 ✅
- [x] `mcctl backup status`
- [x] `mcctl backup push`
- [x] `mcctl backup history`
- [x] `mcctl backup restore`
- [x] `mcctl server-backup`
- [x] `mcctl server-restore`

### Phase 7: 인프라 관리 ✅
- [x] `mcctl up` - 전체 시작
- [x] `mcctl down` - 전체 중지
- [x] `mcctl router start/stop/restart`

## 향후 계획

### Phase 8: Admin 명령어 (예정)
- [ ] `mcctl admin init` - Admin 서비스 초기화
- [ ] `mcctl admin start/stop` - 서비스 관리
- [ ] `mcctl admin user` - 사용자 관리
- [ ] `mcctl admin api` - API 설정

→ 상세 계획: [mcctl-api Plan](../mcctl-api/plan.md), [mcctl-console Plan](../mcctl-console/plan.md)

## Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 계획 작성 |
