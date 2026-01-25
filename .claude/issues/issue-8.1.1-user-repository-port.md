# Issue: IUserRepository 포트 정의

## Phase
8.1.1 - Shared 패키지 확장

## 제목
feat(shared): Add IUserRepository port interface

## 설명
Admin Service 사용자 관리를 위한 `IUserRepository` 포트 인터페이스를 정의합니다.

## 작업 내용
- [ ] `src/application/ports/outbound/IUserRepository.ts` 생성
- [ ] User 인터페이스 정의
- [ ] IUserRepository 인터페이스 정의
- [ ] index.ts에 export 추가
- [ ] 단위 테스트 작성

## 인터페이스 정의

```typescript
export interface User {
  username: string;
  passwordHash: string;
  role: 'admin' | 'operator' | 'viewer';
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

## 관련 문서
- [shared PRD](../../platform/services/shared/prd.md) - Section 4.1

## 라벨
- `phase:8-admin`
- `type:feature`
- `package:shared`
