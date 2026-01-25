# CLI Architecture

This document describes the architecture of the `@minecraft-docker/mcctl` CLI tool.

## Overview

The CLI is built using **Hexagonal Architecture** (Ports & Adapters pattern) combined with **Clean Architecture** principles. This design ensures:

- **Testability**: Core business logic is isolated and easily testable
- **Flexibility**: External dependencies can be swapped without changing business logic
- **Maintainability**: Clear separation of concerns with well-defined boundaries

## Architecture Diagram

```text
┌─────────────────────────────────────────────────────────────────┐
│                          CLI Layer                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   create    │  │   delete    │  │   world     │   ...        │
│  │   command   │  │   command   │  │   command   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Application Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐ │
│  │  CreateServer   │  │  DeleteServer   │  │ WorldManagement  │ │
│  │    UseCase      │  │    UseCase      │  │    UseCase       │ │
│  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘ │
│           │                    │                    │           │
│    ┌──────┴──────────────────┬─┴────────────────────┴───────┐   │
│    │                         │                              │   │
│    ▼                         ▼                              ▼   │
│  ┌─────────────┐       ┌─────────────┐              ┌──────────┐│
│  │ IPromptPort │       │ IShellPort  │              │IServerRepo││
│  │  (Inbound)  │       │ (Outbound)  │              │(Outbound)││
│  └─────────────┘       └─────────────┘              └──────────┘│
└─────────────────────────────────────────────────────────────────┘
          │                    │                          │
          ▼                    ▼                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Infrastructure Layer                          │
│  ┌─────────────┐       ┌─────────────┐              ┌──────────┐│
│  │ ClackPrompt │       │ShellAdapter │              │DockerRepo││
│  │  Adapter    │       │             │              │          ││
│  └─────────────┘       └─────────────┘              └──────────┘│
│                                                                  │
│         ┌─────────────────────────────────────────────┐         │
│         │            Dependency Container              │         │
│         └─────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Responsibilities

### Domain Layer (`src/domain/`)

Contains the core business entities and value objects that are independent of any framework or external concern.

**Value Objects** (immutable, validated on construction):
- `ServerName`: Validated server name (lowercase, alphanumeric, 3-30 chars)
- `ServerType`: Server type with validation (PAPER, FORGE, FABRIC, etc.)
- `McVersion`: Minecraft version with SemVer support
- `Memory`: JVM memory allocation (e.g., "4G", "2048M")
- `WorldOptions`: World setup configuration

**Entities**:
- `Server`: Minecraft server with status and configuration
- `World`: World with lock management

### Application Layer (`src/application/`)

Contains use cases that orchestrate the business logic and define port interfaces.

**Use Cases**:
- `CreateServerUseCase`: Server creation workflow
- `DeleteServerUseCase`: Server deletion with confirmation
- `WorldManagementUseCase`: World listing, assignment, release
- `BackupUseCase`: Backup push, restore, history

**Ports** (interfaces for dependency inversion):

*Inbound Ports* (driving adapters):
- `IPromptPort`: User interaction abstraction
- `IDocProvider`: Documentation parsing abstraction

*Outbound Ports* (driven adapters):
- `IShellPort`: Shell command execution
- `IServerRepository`: Server data access
- `IWorldRepository`: World data access

### Infrastructure Layer (`src/infrastructure/`)

Contains concrete implementations of ports and framework integrations.

**Adapters**:
- `ClackPromptAdapter`: Implements `IPromptPort` using @clack/prompts
- `ShellAdapter`: Implements `IShellPort` for bash script execution
- `DocsAdapter`: Implements `IDocProvider` for parsing docs/

**Container**:
- `DependencyContainer`: Service locator for dependency injection

## Adding New Commands

### 1. Define the Use Case Interface

```typescript
// src/application/ports/inbound/INewUseCase.ts
export interface NewResult {
  success: boolean;
  data?: SomeData;
  error?: string;
}

export interface INewUseCase {
  execute(): Promise<NewResult>;           // Interactive mode
  executeWithArgs(args: Args): Promise<NewResult>;  // CLI mode
}
```

### 2. Implement the Use Case

```typescript
// src/application/use-cases/NewUseCase.ts
export class NewUseCase implements INewUseCase {
  constructor(
    private readonly prompt: IPromptPort,
    private readonly shell: IShellPort,
    private readonly repo: ISomeRepository
  ) {}

  async execute(): Promise<NewResult> {
    this.prompt.intro('New Command');

    try {
      // Interactive prompts
      const value = await this.prompt.text({
        message: 'Enter value:',
        placeholder: 'default',
      });

      if (this.prompt.isCancel(value)) {
        this.prompt.outro('Cancelled');
        return { success: false, error: 'Cancelled' };
      }

      // Execute with collected values
      return await this.executeWithArgs({ value });
    } catch (error) {
      if (this.prompt.isCancel(error)) {
        this.prompt.outro('Cancelled');
        return { success: false, error: 'Cancelled' };
      }
      throw error;
    }
  }

  async executeWithArgs(args: Args): Promise<NewResult> {
    const spinner = this.prompt.spinner();
    spinner.start('Processing...');

    const result = await this.shell.someOperation(args.value);

    if (!result.success) {
      spinner.stop('Failed');
      return { success: false, error: result.stderr };
    }

    spinner.stop('Done');
    return { success: true, data: result.data };
  }
}
```

### 3. Create the Command Entry Point

```typescript
// src/commands/new.ts
import { container } from '../infrastructure/container.js';
import { NewUseCase } from '../application/use-cases/NewUseCase.js';

export interface NewCommandOptions {
  root?: string;
  value?: string;
}

export async function newCommand(options: NewCommandOptions): Promise<number> {
  container.initialize(options.root);

  const useCase = new NewUseCase(
    container.resolve('prompt'),
    container.resolve('shell'),
    container.resolve('someRepo')
  );

  try {
    let result;
    if (options.value) {
      // CLI mode - use provided arguments
      result = await useCase.executeWithArgs({ value: options.value });
    } else {
      // Interactive mode - prompt user
      result = await useCase.execute();
    }

    return result.success ? 0 : 1;
  } catch (error) {
    console.error('Error:', error);
    return 1;
  }
}
```

### 4. Register in CLI

```typescript
// src/index.ts
import { newCommand } from './commands/new.js';

program
  .command('new')
  .description('Description of new command')
  .option('--value <value>', 'Value to use')
  .action(async (options) => {
    const exitCode = await newCommand(options);
    process.exit(exitCode);
  });
```

## Adding New Prompts

### Domain-Specific Prompts

Add new prompt methods to `IPromptPort`:

```typescript
// src/application/ports/outbound/IPromptPort.ts
export interface IPromptPort {
  // ... existing methods ...

  promptNewValue(): Promise<NewValueType>;
}
```

Implement in `ClackPromptAdapter`:

```typescript
// src/infrastructure/adapters/ClackPromptAdapter.ts
async promptNewValue(): Promise<NewValueType> {
  const value = await text({
    message: 'Enter new value:',
    placeholder: 'example',
    validate: (input) => {
      if (!input) return 'Value is required';
      if (!isValid(input)) return 'Invalid format';
    },
  });

  if (isCancel(value)) {
    this.handleCancel();
  }

  return NewValueType.create(value);
}
```

## Testing

### Unit Tests

Test value objects and entities in isolation:

```typescript
// tests/unit/domain/value-objects/NewValue.test.ts
describe('NewValue', () => {
  it('should create valid value', () => {
    const value = NewValue.create('valid');
    assert.strictEqual(value.value, 'valid');
  });

  it('should throw on invalid value', () => {
    assert.throws(() => NewValue.create('invalid!'));
  });
});
```

### Integration Tests

Test use cases with mock adapters:

```typescript
// tests/integration/NewUseCase.test.ts
describe('NewUseCase Integration', () => {
  let promptAdapter: MockPromptAdapter;
  let shellAdapter: MockShellAdapter;
  let useCase: NewUseCase;

  beforeEach(() => {
    promptAdapter = new MockPromptAdapter({ text: 'test-value' });
    shellAdapter = new MockShellAdapter({
      someOperationResult: { success: true, stdout: 'OK' },
    });
    useCase = new NewUseCase(promptAdapter, shellAdapter, mockRepo);
  });

  it('should execute with prompted values', async () => {
    const result = await useCase.execute();

    assert.strictEqual(result.success, true);
    assert.ok(shellAdapter.wasCommandCalled('someOperation'));
  });
});
```

## Best Practices

### 1. Keep Use Cases Pure

Use cases should only depend on port interfaces, never on concrete implementations:

```typescript
// Good
constructor(private readonly prompt: IPromptPort) {}

// Bad
constructor(private readonly clack: ClackPromptAdapter) {}
```

### 2. Handle Cancellation Gracefully

Always wrap interactive code in try-catch and check for cancellation:

```typescript
try {
  const value = await this.prompt.text({ message: 'Enter:' });
  if (this.prompt.isCancel(value)) {
    return { success: false, error: 'Cancelled' };
  }
  // ... continue
} catch (error) {
  if (this.prompt.isCancel(error)) {
    return { success: false, error: 'Cancelled' };
  }
  throw error;
}
```

### 3. Use Value Objects for Validation

Validate at construction time, not at use time:

```typescript
// Good - validation at construction
const name = ServerName.create(input); // throws if invalid

// Bad - deferred validation
const name = input;
if (!isValidServerName(name)) throw new Error(); // easy to forget
```

### 4. Separate Interactive and CLI Modes

Every use case should support both modes:
- `execute()`: Interactive mode with prompts
- `executeWithArgs()` or `executeWithConfig()`: CLI mode with arguments

This allows the same business logic to be used from both interactive CLI and scripts.

## Mod Source Factory Pattern

The mod management system uses the **Factory Pattern** with auto-registration for pluggable mod source adapters.

### Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│  Application Layer (shared)                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    IModSourcePort                            ││
│  │  - search(query, options): Promise<ModSearchResult>          ││
│  │  - getProject(slugOrId): Promise<ModProject | null>          ││
│  │  - getVersions(slugOrId, options): Promise<ModVersion[]>     ││
│  │  - isAvailable(): Promise<boolean>                           ││
│  │  - getEnvKey(): string                                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  Infrastructure Layer (shared)                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  ModSourceFactory                            ││
│  │  - register(adapter): void                                   ││
│  │  - get(source): IModSourcePort                               ││
│  │  - getSupportedSources(): string[]                           ││
│  │  - getDefaultSource(): string                                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────┐ ┌─────────────────┐
│ mod-source-modrinth │ │   Future    │ │     Future      │
│ ┌─────────────────┐ │ │ CurseForge  │ │     Spiget      │
│ │ModrinthAdapter  │ │ │   Adapter   │ │    Adapter      │
│ └─────────────────┘ │ └─────────────┘ └─────────────────┘
└─────────────────────┘
```

### Domain Models (shared/src/domain/mod/)

```typescript
// ModProject - Represents a mod/plugin project
interface ModProject {
  id: string;
  slug: string;
  name: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl?: string;
  categories: string[];
  serverSide: 'required' | 'optional' | 'unsupported';
  clientSide: 'required' | 'optional' | 'unsupported';
  sourceUrl?: string;
}

// ModSearchResult - Paginated search results
interface ModSearchResult {
  hits: ModProject[];
  offset: number;
  limit: number;
  totalHits: number;
}

// ModVersion - Specific version of a mod
interface ModVersion {
  id: string;
  projectId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  files: ModFile[];
  dependencies: ModDependency[];
}
```

### IModSourcePort Interface

The port interface that all mod source adapters must implement:

```typescript
// shared/src/application/ports/outbound/IModSourcePort.ts
export interface IModSourcePort {
  readonly sourceName: string;     // e.g., 'modrinth'
  readonly displayName: string;    // e.g., 'Modrinth'

  search(query: string, options?: ModSearchOptions): Promise<ModSearchResult>;
  getProject(slugOrId: string): Promise<ModProject | null>;
  getVersions(slugOrId: string, options?: ModVersionOptions): Promise<ModVersion[]>;
  isAvailable(): Promise<boolean>;
  getEnvKey(): string;             // e.g., 'MODRINTH_PROJECTS'
  formatForEnv(project: ModProject): string;
}
```

### ModSourceFactory

The factory manages adapter registration and retrieval:

```typescript
// shared/src/infrastructure/factories/ModSourceFactory.ts
import { ModSourceFactory } from '@minecraft-docker/shared';

// Register an adapter (done automatically on import)
ModSourceFactory.register(new ModrinthAdapter());

// Get an adapter by name
const source = ModSourceFactory.get('modrinth');
const results = await source.search('sodium');

// List available sources
const sources = ModSourceFactory.getSupportedSources(); // ['modrinth']

// Get default source
const defaultSource = ModSourceFactory.getDefaultSource(); // 'modrinth'
```

### Implementing a Mod Source Adapter

Each mod source is a separate npm package following Hexagonal Architecture:

```text
mod-source-modrinth/
├── src/
│   ├── index.ts                 # Exports and auto-registration
│   ├── ModrinthAdapter.ts       # IModSourcePort implementation
│   ├── types.ts                 # Modrinth-specific API types
│   └── infrastructure/
│       ├── api/
│       │   └── ModrinthApiClient.ts  # HTTP client for Modrinth API
│       └── mappers/
│           └── ModrinthMapper.ts     # Maps API responses to domain models
├── package.json
└── tsconfig.json
```

Example adapter implementation:

```typescript
// mod-source-modrinth/src/ModrinthAdapter.ts
import type { IModSourcePort, ModProject, ModSearchResult } from '@minecraft-docker/shared';
import { ModrinthApiClient } from './infrastructure/api/ModrinthApiClient.js';
import { ModrinthMapper } from './infrastructure/mappers/ModrinthMapper.js';

export class ModrinthAdapter implements IModSourcePort {
  readonly sourceName = 'modrinth';
  readonly displayName = 'Modrinth';

  private readonly api = new ModrinthApiClient();
  private readonly mapper = new ModrinthMapper();

  async search(query: string, options?: ModSearchOptions): Promise<ModSearchResult> {
    const response = await this.api.search(query, options);
    return this.mapper.toSearchResult(response);
  }

  async getProject(slugOrId: string): Promise<ModProject | null> {
    const response = await this.api.getProject(slugOrId);
    return response ? this.mapper.toProject(response) : null;
  }

  getEnvKey(): string {
    return 'MODRINTH_PROJECTS';
  }

  formatForEnv(project: ModProject): string {
    return project.slug;
  }
}
```

Auto-registration on import:

```typescript
// mod-source-modrinth/src/index.ts
import { ModSourceFactory } from '@minecraft-docker/shared';
import { ModrinthAdapter } from './ModrinthAdapter.js';

// Auto-register when module is imported
ModSourceFactory.register(new ModrinthAdapter());

export { ModrinthAdapter };
```

### Using in CLI Commands

```typescript
// cli/src/commands/mod.ts
import { ModSourceFactory } from '@minecraft-docker/shared';
import '@minecraft-docker/mod-source-modrinth'; // Triggers auto-registration

export async function searchMods(query: string, source = 'modrinth') {
  const adapter = ModSourceFactory.get(source);
  const results = await adapter.search(query);

  for (const mod of results.hits) {
    console.log(`${mod.slug} (${mod.downloads} downloads)`);
  }
}
```

### Adding New Mod Sources

To add a new mod source (e.g., CurseForge):

1. Create a new package: `mod-source-curseforge/`
2. Implement `IModSourcePort` interface
3. Add API client and mappers in `infrastructure/`
4. Auto-register in `index.ts`
5. Add as dependency to CLI package

The Factory Pattern ensures:
- **Extensibility**: New sources can be added without modifying core code
- **Loose Coupling**: CLI doesn't depend on specific implementations
- **Testability**: Adapters can be mocked for testing
- **Clean Architecture**: Domain models are source-agnostic
