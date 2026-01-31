# mcctl-console

Web-based management console for Minecraft server infrastructure.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript 5.x
- **UI Library**: MUI (Material-UI) 5.x
- **Styling**: Tailwind CSS 3.x
- **State Management**: React Query (TanStack) 5.x
- **Testing**: Vitest + React Testing Library + Playwright

## Getting Started

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server on port 5000 |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
| `pnpm type-check` | Run TypeScript type checking |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests with Playwright |

## Architecture

This project follows **Hexagonal Architecture (Ports & Adapters)** pattern.

```
src/
├── app/              # Next.js App Router (Pages)
├── components/       # React UI Components
├── hooks/            # Custom React Hooks
├── services/         # Application Layer (Use Cases)
├── ports/            # Application Layer (Interfaces)
├── adapters/         # Infrastructure Layer (Implementations)
├── lib/              # Utilities and Providers
├── theme/            # MUI Theme Configuration
└── types/            # TypeScript Type Definitions
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MCCTL_API_URL` | mcctl-api internal URL | `http://localhost:5001` |
| `MCCTL_API_KEY` | API Key for authentication | (required) |
| `NEXT_PUBLIC_APP_URL` | App base URL | `http://localhost:5000` |

## Documentation

See [prd.md](./prd.md) for detailed product requirements and [plan.md](./plan.md) for implementation plan.
