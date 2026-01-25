# Implementation Plan: mcctl-console

## 상위 문서
- [전체 프로젝트 Plan](../../../plan.md) - Phase 8

## 개요

mcctl-console 관리 콘솔 서비스의 구현 계획입니다.

## Phase 1: 프로젝트 기반 구조

### 1.1 패키지 설정
- [ ] `package.json` 생성 (`@minecraft-docker/mcctl-console`)
- [ ] `tsconfig.json` 설정
- [ ] `next.config.js` 설정
- [ ] `tailwind.config.js` 설정

### 1.2 기본 레이아웃
- [ ] `src/app/layout.tsx` - 루트 레이아웃
- [ ] `src/components/layout/Sidebar.tsx` - 사이드바
- [ ] `src/components/layout/Header.tsx` - 헤더

### 1.3 UI 컴포넌트
- [ ] shadcn/ui 설정
- [ ] 기본 컴포넌트 추가

## Phase 2: 인증 시스템

- [ ] NextAuth 설정
- [ ] 로그인 페이지
- [ ] 세션 관리

## Phase 3: BFF 프록시

- [ ] API 프록시 라우트
- [ ] API 클라이언트
- [ ] React Query 설정

## Phase 4: 대시보드

- [ ] 대시보드 페이지
- [ ] 통계 위젯
- [ ] 서버 개요

## Phase 5: 서버 관리

- [ ] 서버 목록
- [ ] 서버 상세
- [ ] RCON 콘솔

## Phase 6: 월드/플레이어/백업 관리

- [ ] 월드 관리 페이지
- [ ] 플레이어 관리 페이지
- [ ] 백업 관리 페이지

## Phase 7: Docker 설정

- [ ] Dockerfile 작성
- [ ] CI/CD 설정

## Phase 8: 테스트

- [ ] 컴포넌트 테스트
- [ ] E2E 테스트

## 완료 기준

1. 모든 페이지 구현 및 정상 동작
2. NextAuth 인증 정상 동작
3. BFF 프록시 통한 API 호출 성공
4. 반응형 디자인 (모바일 지원)
5. Docker 이미지 빌드 성공

## Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 계획 작성 |
