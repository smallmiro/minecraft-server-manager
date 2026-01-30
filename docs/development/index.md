# Development Guide

This guide covers development setup, project structure, and contribution guidelines for the minecraft-docker project.

## Prerequisites

Before contributing, ensure you have the following installed:

- **Node.js** >= 18.0.0
- **pnpm** >= 8.0.0
- **Docker Engine** 20.10+
- **Docker Compose** v2.0+
- **Git** for version control

## Quick Setup

```bash
# Clone the repository
git clone https://github.com/smallmiro/minecraft-server-manager.git
cd minecraft-server-manager

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Link CLI globally for development
cd platform/services/cli
pnpm link --global

# Verify installation
mcctl --version
```

## Project Structure

This project uses a **pnpm monorepo** with multiple packages.

### Monorepo Packages

| Package | Name | Description |
|---------|------|-------------|
| `platform/services/shared` | `@minecraft-docker/shared` | Shared types, domain models, and utilities |
| `platform/services/mod-source-modrinth` | `@minecraft-docker/mod-source-modrinth` | Modrinth mod source adapter |
| `platform/services/cli` | `@minecraft-docker/mcctl` | CLI tool (main user-facing package) |
| `platform/services/mcctl-api` | `@minecraft-docker/mcctl-api` | REST API service |
| `platform/services/mcctl-console` | `@minecraft-docker/mcctl-console` | Web console UI |

### Build Order

pnpm automatically builds packages in dependency order:

```text
1. @minecraft-docker/shared        (no dependencies)
2. @minecraft-docker/mod-source-modrinth  (depends on shared)
3. @minecraft-docker/mcctl         (depends on shared, mod-source-modrinth)
4. @minecraft-docker/mcctl-api     (depends on shared)
5. @minecraft-docker/mcctl-console (depends on shared)
```

### Directory Layout

```text
minecraft/
|-- package.json              # Root workspace
|-- pnpm-workspace.yaml       # pnpm workspace config
|-- tsconfig.base.json        # Shared TypeScript config
|
|-- platform/
|   |-- docker-compose.yml    # Main orchestration
|   |-- .env                  # Environment config
|   |
|   |-- services/
|   |   |-- shared/           # @minecraft-docker/shared
|   |   |-- mod-source-modrinth/  # @minecraft-docker/mod-source-modrinth
|   |   |-- cli/              # @minecraft-docker/mcctl
|   |   |-- mcctl-api/        # REST API
|   |   +-- mcctl-console/    # Web UI
|   |
|   +-- scripts/              # Bash management scripts
|
|-- docs/                     # MkDocs documentation
|-- e2e/                      # End-to-end tests
+-- templates/                # npm package templates
```

## Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all packages (respects dependency order) |
| `pnpm clean` | Clean all build outputs |
| `pnpm test` | Run all tests |
| `pnpm test:e2e` | Run E2E tests |

### Package Level

Navigate to any package directory and run:

| Command | Description |
|---------|-------------|
| `pnpm build` | Build this package |
| `pnpm dev` | Watch mode (rebuild on changes) |
| `pnpm test` | Run package tests |
| `pnpm clean` | Clean build output |

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout develop
git pull origin develop
git checkout -b feature/123-my-feature
```

### 2. Make Changes

Follow the TDD (Test-Driven Development) workflow:

1. **Red**: Write a failing test
2. **Green**: Write minimal code to pass
3. **Refactor**: Clean up while keeping tests green

### 3. Build and Test

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Run E2E tests (requires Docker)
pnpm test:e2e
```

### 4. Commit Changes

Use conventional commit messages:

```bash
git commit -m "feat(cli): add new mod command (#123)"
git commit -m "fix(api): correct auth token validation"
git commit -m "docs: update installation guide"
```

### 5. Create Pull Request

```bash
git push origin feature/123-my-feature
```

Then create a PR to `develop` branch on GitHub.

## Architecture Overview

The project follows **Hexagonal Architecture** (Ports & Adapters) with **Clean Architecture** principles:

```text
+-------------------+
|    CLI Layer      |  Commands, argument parsing
+--------+----------+
         |
+--------v----------+
| Application Layer |  Use cases, business logic
+--------+----------+
         |
+--------v----------+
|   Domain Layer    |  Entities, value objects
+--------+----------+
         |
+--------v----------+
| Infrastructure    |  Adapters, external services
+-------------------+
```

### Key Concepts

- **Value Objects**: Immutable, validated on construction (e.g., `ServerName.create("myserver")`)
- **Use Cases**: Business logic with interactive and CLI modes
- **Ports**: Interfaces for external dependencies
- **Adapters**: Concrete implementations

See [CLI Architecture](cli-architecture.md) for detailed documentation.

## Related Documentation

- [CLI Architecture](cli-architecture.md) - Detailed architecture of the CLI
- [Agent Collaboration](agent-collaboration.md) - Multi-agent development workflow
- [CLI Commands](../cli/commands.md) - Complete CLI reference

## Troubleshooting

### Build Errors

If you encounter build errors:

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Link Issues

If `mcctl` command is not found after linking:

```bash
# Check npm global bin path
npm config get prefix

# Add to PATH if needed
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Docker Issues

Ensure Docker is running and your user has permissions:

```bash
# Check Docker status
docker --version
docker compose version

# Add user to docker group (if permission denied)
sudo usermod -aG docker $USER
newgrp docker
```
