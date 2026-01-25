# PRD: shared - Common Package

## Parent Document
- [Project PRD](../../../prd.md) - Section 9

## 1. Overview

### 1.1 Purpose
Core package providing shared domain logic, use cases, and adapters for CLI, API, and Console services.

### 1.2 Scope
- Domain Layer: Entities, Value Objects
- Application Layer: Use Cases, Ports
- Infrastructure Layer: Common Adapters (Shell, Repository)
- Utilities and type definitions

### 1.3 Non-Goals
- CLI-specific adapters (ClackPromptAdapter → cli package)
- Web-specific adapters (WebPromptAdapter → mcctl-console)
- API-specific adapters (ApiPromptAdapter → mcctl-api)

## 2. Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.x |

## 3. Architecture

### 3.1 Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   APPLICATION LAYER                          │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Use Cases                                             │  │
│  │  - CreateServerUseCase                                 │  │
│  │  - DeleteServerUseCase                                 │  │
│  │  - WorldManagementUseCase                              │  │
│  │  - PlayerLookupUseCase                                 │  │
│  │  - BackupUseCase                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Ports (Interfaces)                                    │  │
│  │  - IPromptPort (inbound)                               │  │
│  │  - IShellPort (outbound)                               │  │
│  │  - IServerRepository (outbound)                        │  │
│  │  - IWorldRepository (outbound)                         │  │
│  │  - IUserRepository (outbound) ← NEW                    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    DOMAIN LAYER                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Entities                                              │  │
│  │  - Server                                              │  │
│  │  - World                                               │  │
│  │  - Lock                                                │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Value Objects                                         │  │
│  │  - ServerName                                          │  │
│  │  - ServerType                                          │  │
│  │  - McVersion                                           │  │
│  │  - Memory                                              │  │
│  │  - WorldOptions                                        │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Adapters (Common)                                     │  │
│  │  - ShellAdapter                                        │  │
│  │  - ServerRepository                                    │  │
│  │  - WorldRepository                                     │  │
│  │  - YamlUserRepository ← NEW                            │  │
│  │  - SqliteUserRepository ← NEW                          │  │
│  │  - ApiPromptAdapter ← NEW                              │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Docker Utilities                                      │  │
│  │  - getPlatformStatus()                                 │  │
│  │  - getDetailedServerInfoWithPlayers()                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Directory Structure

```
platform/services/shared/
├── prd.md                      # This document
├── plan.md                     # Implementation plan
├── README.md                   # npm package description
├── package.json                # @minecraft-docker/shared
├── tsconfig.json
├── src/
│   ├── index.ts                # Main export
│   │
│   ├── domain/                 # Domain layer
│   │   ├── entities/
│   │   │   ├── Server.ts
│   │   │   └── World.ts
│   │   └── value-objects/
│   │       ├── ServerName.ts
│   │       ├── ServerType.ts
│   │       ├── McVersion.ts
│   │       ├── Memory.ts
│   │       └── WorldOptions.ts
│   │
│   ├── application/            # Application layer
│   │   ├── ports/
│   │   │   ├── inbound/        # Use Case interfaces
│   │   │   └── outbound/       # Repository interfaces
│   │   │       ├── IPromptPort.ts
│   │   │       ├── IShellPort.ts
│   │   │       ├── IServerRepository.ts
│   │   │       ├── IWorldRepository.ts
│   │   │       └── IUserRepository.ts  ← NEW
│   │   └── use-cases/
│   │       ├── CreateServerUseCase.ts
│   │       ├── DeleteServerUseCase.ts
│   │       └── ...
│   │
│   ├── infrastructure/         # Infrastructure layer
│   │   ├── adapters/
│   │   │   ├── ShellAdapter.ts
│   │   │   ├── ServerRepository.ts
│   │   │   ├── WorldRepository.ts
│   │   │   ├── YamlUserRepository.ts    ← NEW
│   │   │   ├── SqliteUserRepository.ts  ← NEW
│   │   │   └── ApiPromptAdapter.ts      ← NEW
│   │   └── docker/
│   │       └── index.ts
│   │
│   ├── types/                  # Type definitions
│   └── utils/                  # Utilities
└── tests/
```

## 4. New Additions (For Admin Service)

### 4.1 IUserRepository Port

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

### 4.2 YamlUserRepository

Adapter that reads and writes the `users` section of `.mcctl-admin.yml` file.

### 4.3 SqliteUserRepository

Adapter that uses the `mcctl-admin.db` SQLite database.

### 4.4 ApiPromptAdapter

Non-interactive `IPromptPort` implementation for API context. Throws an error when interactive prompts are called.

## 5. Dependencies

### 5.1 External Dependencies

```json
{
  "dependencies": {
    "yaml": "^2.x",
    "better-sqlite3": "^9.x"
  }
}
```

## 6. Export Structure

```typescript
// index.ts
export * from './domain/entities';
export * from './domain/value-objects';
export * from './application/ports/inbound';
export * from './application/ports/outbound';
export * from './application/use-cases';
export * from './infrastructure/adapters';
export * from './infrastructure/docker';
export * from './types';
export * from './utils';
```

## 7. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-25 | - | Initial PRD |
