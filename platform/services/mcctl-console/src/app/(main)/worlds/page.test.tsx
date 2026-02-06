import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import WorldsPage from './page';

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock the hooks
vi.mock('@/hooks/useMcctl', () => ({
  useWorlds: vi.fn(),
  useServers: vi.fn(),
  useCreateWorld: vi.fn(),
  useAssignWorld: vi.fn(),
  useReleaseWorld: vi.fn(),
  useDeleteWorld: vi.fn(),
}));

import {
  useWorlds,
  useServers,
  useCreateWorld,
  useAssignWorld,
  useReleaseWorld,
  useDeleteWorld,
} from '@/hooks/useMcctl';

const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

const renderWithProviders = (component: React.ReactNode) => {
  const queryClient = createTestQueryClient();
  return render(
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </ThemeProvider>
  );
};

const mockMutation = (overrides = {}) => ({
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
  error: null,
  reset: vi.fn(),
  ...overrides,
});

const mockWorlds = [
  {
    name: 'survival-world',
    path: '/worlds/survival-world',
    isLocked: false,
    size: '256 MB',
    lastModified: '2025-01-15T10:30:00Z',
  },
  {
    name: 'creative-world',
    path: '/worlds/creative-world',
    isLocked: true,
    lockedBy: 'paper-server',
    size: '512 MB',
    lastModified: '2025-01-20T14:00:00Z',
  },
];

const setupMocks = (overrides: { worldsLoading?: boolean; worldsError?: Error } = {}) => {
  vi.mocked(useWorlds).mockReturnValue({
    data: overrides.worldsLoading
      ? undefined
      : { worlds: mockWorlds, total: mockWorlds.length },
    isLoading: overrides.worldsLoading ?? false,
    error: overrides.worldsError ?? null,
  } as any);

  vi.mocked(useServers).mockReturnValue({
    data: {
      servers: [
        { name: 'paper-server', status: 'stopped', health: 'none', container: 'mc-paper', hostname: 'paper.local' },
      ],
      total: 1,
    },
    isLoading: false,
    error: null,
  } as any);

  vi.mocked(useCreateWorld).mockReturnValue(mockMutation() as any);
  vi.mocked(useAssignWorld).mockReturnValue(mockMutation() as any);
  vi.mocked(useReleaseWorld).mockReturnValue(mockMutation() as any);
  vi.mocked(useDeleteWorld).mockReturnValue(mockMutation() as any);
};

describe('WorldsPage', () => {
  it('should render page header with title', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getByText('Worlds')).toBeInTheDocument();
    expect(screen.getByText('Manage your Minecraft worlds')).toBeInTheDocument();
  });

  it('should render Create World button', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('button', { name: /create world/i })).toBeInTheDocument();
  });

  it('should render loading state', () => {
    setupMocks({ worldsLoading: true });
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('should render error state', () => {
    setupMocks({ worldsError: new Error('Network error') });
    renderWithProviders(<WorldsPage />);

    expect(screen.getByText(/failed to load worlds/i)).toBeInTheDocument();
  });

  it('should render world list when data is loaded', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getByText('survival-world')).toBeInTheDocument();
    expect(screen.getByText('creative-world')).toBeInTheDocument();
  });

  it('should open create dialog when Create World button is clicked', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    fireEvent.click(screen.getByRole('button', { name: /create world/i }));

    expect(screen.getByText('Create New World')).toBeInTheDocument();
  });

  it('should open delete confirmation when delete is clicked', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    const deleteButtons = screen.getAllByLabelText('Delete world');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('Delete World')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /world name/i })).toBeInTheDocument();
  });

  it('should disable delete button until world name is typed correctly', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    const deleteButtons = screen.getAllByLabelText('Delete world');
    fireEvent.click(deleteButtons[0]);

    const deleteConfirmBtn = screen.getByRole('button', { name: /^delete$/i });
    expect(deleteConfirmBtn).toBeDisabled();

    const input = screen.getByLabelText('World name');
    fireEvent.change(input, { target: { value: 'survival-world' } });

    expect(deleteConfirmBtn).not.toBeDisabled();
  });
});
