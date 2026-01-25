# PRD: shared - 공통 패키지

## 상위 문서
- [전체 프로젝트 PRD](../../../prd.md) - Section 9

## 1. 개요

### 1.1 목적
CLI, API, Console 서비스가 공유하는 도메인 로직, 유스케이스, 어댑터를 제공하는 핵심 패키지입니다.

### 1.2 범위
- Domain Layer: Entities, Value Objects
- Application Layer: Use Cases, Ports
- Infrastructure Layer: 공통 Adapters (Shell, Repository)
- 유틸리티 및 타입 정의

### 1.3 비목표
- CLI 전용 어댑터 (ClackPromptAdapter → cli 패키지)
- Web 전용 어댑터 (WebPromptAdapter → mcctl-console)
- API 전용 어댑터 (ApiPromptAdapter → mcctl-api)

## 2. 기술 스택

| 구성요소 | 기술 | 버전 |
|---------|------|------|
| Runtime | Node.js | 18+ |
| Language | TypeScript | 5.x |

## 3. 아키텍처

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
│  │  - IUserRepository (outbound) ← 신규                   │  │
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
│  │  Adapters (공통)                                       │  │
│  │  - ShellAdapter                                        │  │
│  │  - ServerRepository                                    │  │
│  │  - WorldRepository                                     │  │
│  │  - YamlUserRepository ← 신규                           │  │
│  │  - SqliteUserRepository ← 신규                         │  │
│  │  - ApiPromptAdapter ← 신규                             │  │
│  └───────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Docker Utilities                                      │  │
│  │  - getPlatformStatus()                                 │  │
│  │  - getDetailedServerInfoWithPlayers()                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 디렉토리 구조

```
platform/services/shared/
├── prd.md                      # 이 문서
├── plan.md                     # 구현 계획
├── README.md                   # npm 패키지 설명
├── package.json                # @minecraft-docker/shared
├── tsconfig.json
├── src/
│   ├── index.ts                # 메인 export
│   │
│   ├── domain/                 # 도메인 레이어
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
│   ├── application/            # 애플리케이션 레이어
│   │   ├── ports/
│   │   │   ├── inbound/        # Use Case 인터페이스
│   │   │   └── outbound/       # Repository 인터페이스
│   │   │       ├── IPromptPort.ts
│   │   │       ├── IShellPort.ts
│   │   │       ├── IServerRepository.ts
│   │   │       ├── IWorldRepository.ts
│   │   │       └── IUserRepository.ts  ← 신규
│   │   └── use-cases/
│   │       ├── CreateServerUseCase.ts
│   │       ├── DeleteServerUseCase.ts
│   │       └── ...
│   │
│   ├── infrastructure/         # 인프라 레이어
│   │   ├── adapters/
│   │   │   ├── ShellAdapter.ts
│   │   │   ├── ServerRepository.ts
│   │   │   ├── WorldRepository.ts
│   │   │   ├── YamlUserRepository.ts    ← 신규
│   │   │   ├── SqliteUserRepository.ts  ← 신규
│   │   │   └── ApiPromptAdapter.ts      ← 신규
│   │   └── docker/
│   │       └── index.ts
│   │
│   ├── types/                  # 타입 정의
│   └── utils/                  # 유틸리티
└── tests/
```

## 4. 신규 추가 항목 (Admin Service용)

### 4.1 IUserRepository 포트

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

`.mcctl-admin.yml` 파일의 `users` 섹션을 읽고 쓰는 어댑터.

### 4.3 SqliteUserRepository

`mcctl-admin.db` SQLite 데이터베이스를 사용하는 어댑터.

### 4.4 ApiPromptAdapter

API 컨텍스트용 비대화형 `IPromptPort` 구현. 대화형 프롬프트를 호출하면 에러를 발생시킴.

## 5. 의존성

### 5.1 외부 의존성

```json
{
  "dependencies": {
    "yaml": "^2.x",
    "better-sqlite3": "^9.x"
  }
}
```

## 6. Export 구조

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

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|----------|
| 1.0.0 | 2025-01-25 | - | 초기 PRD 작성 |
