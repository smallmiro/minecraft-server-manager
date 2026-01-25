# Implementation Plan: shared Package

## Parent Document
- [Project Plan](../../../plan.md) - Phase 7

## Overview

Implementation plan for the shared package. Most features are already implemented, with extensions needed for the Admin Service.

## Implementation Status

### Phase 1: Foundation ✅
- [x] Create `package.json` (`@minecraft-docker/shared`)
- [x] Configure `tsconfig.json`
- [x] Main export (`src/index.ts`)

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

## New Plans (For Admin Service)

### Phase 5: User Repository (Planned)
- [ ] Define `IUserRepository` port
- [ ] Implement `YamlUserRepository` adapter
- [ ] Implement `SqliteUserRepository` adapter
- [ ] Unit tests

### Phase 6: API Prompt Adapter (Planned)
- [ ] Implement `ApiPromptAdapter`
- [ ] Non-interactive mode error handling
- [ ] Unit tests

## Completion Criteria

1. All Use Cases reusable by both CLI and API
2. Behavior changes possible via adapter swap (DI)
3. Unit test coverage 80% or higher

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial plan |
