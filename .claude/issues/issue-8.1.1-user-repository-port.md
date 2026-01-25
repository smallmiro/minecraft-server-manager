# Issue: IUserRepository Port Definition

## Phase
8.1.1 - Shared Package Extension

## Title
feat(shared): Add IUserRepository port interface

## Description
Define the `IUserRepository` port interface for Admin Service user management.

## Tasks
- [ ] Create `src/application/ports/outbound/IUserRepository.ts`
- [ ] Define User interface
- [ ] Define IUserRepository interface
- [ ] Add export to index.ts
- [ ] Write unit tests

## Interface Definition

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

## Related Documents
- [shared PRD](../../platform/services/shared/prd.md) - Section 4.1

## Labels
- `phase:8-admin`
- `type:feature`
- `package:shared`
