# Implementation Plan: shared 패키지

## 상위 문서
- [전체 프로젝트 Plan](../../../plan.md) - Phase 7

## 개요

shared 패키지의 구현 계획입니다. 현재 대부분 구현이 완료된 상태이며, Admin Service를 위한 확장이 필요합니다.

## 구현 현황

### Phase 1: 기반 구조 ✅
- [x] `package.json` 생성 (`@minecraft-docker/shared`)
- [x] `tsconfig.json` 설정
- [x] 메인 export (`src/index.ts`)

### Phase 2: Domain Layer ✅
- [x] Value Objects
  - [x] `ServerName`
  - [x] `ServerType`
  - [x] `McVersion`
  - [x] `Memory`
  - [x] `WorldOptions`
- [x] Entities
  - [x] `Server`
  - [x] `World`

### Phase 3: Application Layer ✅
- [x] Outbound Ports
  - [x] `IPromptPort`
  - [x] `IShellPort`
  - [x] `IServerRepository`
  - [x] `IWorldRepository`
- [x] Use Cases
  - [x] `CreateServerUseCase`
  - [x] `DeleteServerUseCase`
  - [x] `ServerStatusUseCase`
  - [x] `WorldManagementUseCase`
  - [x] `PlayerLookupUseCase`
  - [x] `BackupUseCase`

### Phase 4: Infrastructure Layer ✅
- [x] Adapters
  - [x] `ShellAdapter`
  - [x] `ServerRepository`
  - [x] `WorldRepository`
- [x] Docker Utilities
  - [x] `getPlatformStatus()`
  - [x] `getDetailedServerInfoWithPlayers()`

## 신규 계획 (Admin Service용)

### Phase 5: User Repository (예정)
- [ ] `IUserRepository` 포트 정의
- [ ] `YamlUserRepository` 어댑터 구현
- [ ] `SqliteUserRepository` 어댑터 구현
- [ ] 단위 테스트

### Phase 6: API Prompt Adapter (예정)
- [ ] `ApiPromptAdapter` 구현
- [ ] 비대화형 모드 에러 처리
- [ ] 단위 테스트

## 완료 기준

1. 모든 Use Case가 CLI와 API에서 재사용 가능
2. 어댑터 교체로 동작 변경 가능 (DI)
3. 단위 테스트 커버리지 80% 이상

## Revision History

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 계획 작성 |
