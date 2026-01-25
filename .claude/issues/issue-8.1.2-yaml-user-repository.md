# Issue: YamlUserRepository Adapter Implementation

## Phase
8.1.2 - Shared Package Extension

## Title
feat(shared): Implement YamlUserRepository adapter

## Description
Implement a YAML file-based user repository adapter using `.mcctl-admin.yml`.

## Prerequisites
- #8.1.1 IUserRepository port definition

## Tasks
- [ ] Create `src/infrastructure/adapters/YamlUserRepository.ts`
- [ ] Implement IUserRepository interface
- [ ] Implement file read/write operations
- [ ] bcrypt password hashing
- [ ] File locking handling
- [ ] Add export to index.ts
- [ ] Write unit tests

## Configuration File Structure

```yaml
# ~/.minecraft-servers/.mcctl-admin.yml
users:
  - username: "admin"
    password_hash: "$2b$10$..."
    role: "admin"
  - username: "operator"
    password_hash: "$2b$10$..."
    role: "operator"
```

## Related Documents
- [shared PRD](../../platform/services/shared/prd.md) - Section 4.2

## Labels
- `phase:8-admin`
- `type:feature`
- `package:shared`
