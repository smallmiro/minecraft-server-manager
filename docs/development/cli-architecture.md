# CLI Architecture

This document describes the architecture of the `@minecraft-docker/mcctl` CLI tool.

## Overview

The CLI is built using **Hexagonal Architecture** (Ports & Adapters pattern) combined with **Clean Architecture** principles. This design ensures:

- **Testability**: Core business logic is isolated and easily testable
- **Flexibility**: External dependencies can be swapped without changing business logic
- **Maintainability**: Clear separation of concerns with well-defined boundaries

## Architecture Diagram

```
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
