# feat: IUserRepository 포트 및 어댑터 구현

## 개요

Admin Service에서 사용할 사용자 저장소 추상화를 shared 패키지에 추가합니다.

## 관련 문서

- [plan.md - Phase 8.1](../../../plan.md#phase-8-admin-service-web-관리-콘솔)
- [mcctl-api/prd.md - Section 7](../../../platform/services/mcctl-api/prd.md)

## 구현 목록

### 포트 인터페이스

- [ ] `IUserRepository` 인터페이스 정의
  ```typescript
  export interface User {
    username: string;
    passwordHash: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }

  export interface IUserRepository {
    findByUsername(username: string): Promise<User | null>;
    findAll(): Promise<User[]>;
    create(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;
    update(username: string, data: Partial<User>): Promise<User | null>;
    delete(username: string): Promise<boolean>;
    validatePassword(username: string, password: string): Promise<boolean>;
  }
  ```

### 어댑터 구현

- [ ] `YamlUserRepository` - `.mcctl-admin.yml` 파일 기반
  - 위치: `shared/src/infrastructure/adapters/YamlUserRepository.ts`
  - 파일 잠금으로 동시 접근 처리
  - bcrypt로 비밀번호 해시

- [ ] `SqliteUserRepository` - SQLite DB 기반
  - 위치: `shared/src/infrastructure/adapters/SqliteUserRepository.ts`
  - 테이블: `users`, `sessions`, `audit_logs`
  - better-sqlite3 사용

### ApiPromptAdapter

- [ ] `ApiPromptAdapter` 구현
  - 위치: `shared/src/infrastructure/adapters/ApiPromptAdapter.ts`
  - 비대화형 IPromptPort 구현
  - API 컨텍스트에서 프롬프트 호출 시 에러 throw

## 테스트

- [ ] YamlUserRepository 단위 테스트
- [ ] SqliteUserRepository 단위 테스트
- [ ] 비밀번호 해시/검증 테스트

## 완료 기준

- [ ] 두 어댑터 모두 IUserRepository 인터페이스 구현
- [ ] shared 패키지에서 export
- [ ] 테스트 통과

## Labels

- `phase:8-admin`
- `type:feature`
- `package:shared`
