# @minecraft-docker/shared

Shared utilities and types for the Minecraft Docker platform.

## Installation

```bash
npm install @minecraft-docker/shared
```

## Usage

This package provides shared components for the [@minecraft-docker/mcctl](https://www.npmjs.com/package/@minecraft-docker/mcctl) CLI tool.

### Domain Layer

```typescript
import { ServerName, ServerType, McVersion, Memory } from '@minecraft-docker/shared/domain';

const name = ServerName.create('myserver');
const type = ServerType.create('PAPER');
const version = McVersion.create('1.21.1');
const memory = Memory.create('4G');
```

### Application Layer

```typescript
import { ICreateServerUseCase, IServerRepository } from '@minecraft-docker/shared/application';
```

### Infrastructure Layer

```typescript
import { ShellAdapter, ServerRepository } from '@minecraft-docker/shared/infrastructure';
```

## Architecture

This package follows **Hexagonal Architecture** (Clean Architecture):

```
┌─────────────────────────────────────┐
│  Application Layer                   │
│  - Use Cases (ports/inbound)         │
│  - Ports (ports/outbound)            │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│  Domain Layer                        │
│  - Entities (Server, World)          │
│  - Value Objects (ServerName, etc.)  │
└──────────────────┬──────────────────┘
                   │
┌──────────────────▼──────────────────┐
│  Infrastructure Layer                │
│  - Adapters (Shell, Repository)      │
└─────────────────────────────────────┘
```

## Documentation

- [Full Documentation](https://smallmiro.github.io/minecraft-server-manager/)
- [GitHub Repository](https://github.com/smallmiro/minecraft-server-manager)

## License

Apache-2.0
