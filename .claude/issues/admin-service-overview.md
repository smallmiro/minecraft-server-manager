# Admin Service 구현 이슈 개요

이 디렉토리에는 Admin Service (mcctl-api + mcctl-console) 구현을 위한 GitHub Issue 템플릿이 포함되어 있습니다.

## 이슈 목록

### Phase 8.1: Shared 패키지 확장
- [issue-shared-user-repository.md](issue-shared-user-repository.md) - IUserRepository 및 어댑터 구현

### Phase 8.2: CLI 명령어
- [issue-cli-admin-init.md](issue-cli-admin-init.md) - mcctl admin init 명령어
- [issue-cli-admin-user.md](issue-cli-admin-user.md) - mcctl admin user 명령어
- [issue-cli-admin-api.md](issue-cli-admin-api.md) - mcctl admin api 명령어
- [issue-cli-admin-service.md](issue-cli-admin-service.md) - mcctl admin service 명령어

### Phase 8.3: mcctl-api 서비스
- [issue-mcctl-api-setup.md](issue-mcctl-api-setup.md) - mcctl-api 기본 구조
- [issue-mcctl-api-auth.md](issue-mcctl-api-auth.md) - 인증 플러그인
- [issue-mcctl-api-routes.md](issue-mcctl-api-routes.md) - REST API 라우트

### Phase 8.4: mcctl-console 서비스
- [issue-mcctl-console-setup.md](issue-mcctl-console-setup.md) - mcctl-console 기본 구조
- [issue-mcctl-console-auth.md](issue-mcctl-console-auth.md) - NextAuth 인증
- [issue-mcctl-console-pages.md](issue-mcctl-console-pages.md) - 관리 페이지

## 사용 방법

1. 각 Issue 템플릿 파일을 읽고 GitHub Issue로 생성
2. Issue 생성 후 해당 파일 삭제
3. 모든 Issue 생성 완료 시 이 디렉토리 삭제 가능

## 관련 문서

- [prd.md - Section 10](../../../prd.md#10-admin-service-web-관리-콘솔)
- [plan.md - Phase 8](../../../plan.md#phase-8-admin-service-web-관리-콘솔)
- [mcctl-api/prd.md](../../../platform/services/mcctl-api/prd.md)
- [mcctl-api/plan.md](../../../platform/services/mcctl-api/plan.md)
- [mcctl-console/prd.md](../../../platform/services/mcctl-console/prd.md)
- [mcctl-console/plan.md](../../../platform/services/mcctl-console/plan.md)
