# Issue: mcctl-console NextAuth 인증 시스템

## Phase
8.4.2 - mcctl-console 서비스

## 제목
feat(mcctl-console): Implement NextAuth.js authentication

## 설명
NextAuth.js를 사용하여 Credentials Provider 기반 인증 시스템을 구현합니다.

## 선행 작업
- #8.4.1 mcctl-console 프로젝트 기반 구조
- #8.3.1 mcctl-api 프로젝트 기반 구조

## 작업 내용
- [ ] `src/auth/auth.ts` - NextAuth 설정
- [ ] `src/auth/auth.config.ts` - 설정 분리
- [ ] `src/app/login/page.tsx` - 로그인 페이지
- [ ] Credentials Provider 구현 (mcctl-api 통해 인증)
- [ ] 세션 관리
- [ ] 역할별 권한 체크 미들웨어
- [ ] 테스트

## 역할별 권한

| 역할 | 서버 | 월드 | 플레이어 | 백업 |
|------|------|------|---------|------|
| admin | 모든 권한 | 모든 권한 | 모든 권한 | 모든 권한 |
| operator | 조회/시작/중지 | 조회 | 모든 권한 | 조회 |
| viewer | 조회만 | 조회만 | 조회만 | 조회만 |

## 환경 변수

| 변수 | 설명 |
|------|------|
| `NEXTAUTH_SECRET` | 암호화 키 (필수) |
| `NEXTAUTH_URL` | 외부 접근 URL |
| `INTERNAL_API_URL` | mcctl-api 내부 URL |

## 관련 문서
- [mcctl-console PRD](../../platform/services/mcctl-console/prd.md) - Section 5

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:mcctl-console`
