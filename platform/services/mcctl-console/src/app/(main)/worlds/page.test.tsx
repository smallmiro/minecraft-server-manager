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
  useCreateWorldWithZip: vi.fn(),
  useAssignWorld: vi.fn(),
  useReleaseWorld: vi.fn(),
  useDeleteWorld: vi.fn(),
}));

import {
  useWorlds,
  useServers,
  useCreateWorld,
  useCreateWorldWithZip,
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

const setupMocks = (overrides: { worldsLoading?: boolean; worldsError?: Error; worlds?: typeof mockWorlds } = {}) => {
  const worlds = overrides.worlds ?? mockWorlds;
  vi.mocked(useWorlds).mockReturnValue({
    data: overrides.worldsLoading || overrides.worldsError
      ? undefined
      : { worlds, total: worlds.length },
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
  vi.mocked(useCreateWorldWithZip).mockReturnValue(mockMutation() as any);
  vi.mocked(useAssignWorld).mockReturnValue(mockMutation() as any);
  vi.mocked(useReleaseWorld).mockReturnValue(mockMutation() as any);
  vi.mocked(useDeleteWorld).mockReturnValue(mockMutation() as any);
};

describe('WorldsPage', () => {
  it('renders one Bento hero heading with the create action', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Worlds' })).toBeInTheDocument();
    expect(screen.getByTestId('page-hero')).toBeInTheDocument();
    expect(screen.getByText('Manage your Minecraft worlds')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create world/i })).toBeInTheDocument();
  });

  it('derives total, assigned, and free metrics from world locks', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('article', { name: 'Total worlds' })).toHaveTextContent('2');
    expect(screen.getByRole('article', { name: 'Assigned worlds' })).toHaveTextContent('1');
    expect(screen.getByRole('article', { name: 'Free worlds' })).toHaveTextContent('1');
  });

  it('should render Create World button', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('button', { name: /create world/i })).toBeInTheDocument();
  });

  it('renders a matched loading inventory below the persistent hero', () => {
    setupMocks({ worldsLoading: true });
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Worlds' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'World inventory' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(document.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('should render error state', () => {
    setupMocks({ worldsError: new Error('Network error') });
    renderWithProviders(<WorldsPage />);

    expect(screen.getByText(/failed to load worlds/i)).toBeInTheDocument();
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.getByRole('region', { name: 'World inventory' })).toHaveTextContent(
      'World inventory unavailable',
    );
    expect(screen.queryByText('No worlds found')).not.toBeInTheDocument();
  });

  it('should render world list when data is loaded', () => {
    setupMocks();
    renderWithProviders(<WorldsPage />);

    expect(screen.getByText('survival-world')).toBeInTheDocument();
    expect(screen.getByText('creative-world')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'World inventory' })).toBeInTheDocument();
  });

  it('keeps the empty state inside the inventory surface', () => {
    setupMocks({ worlds: [] });
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('region', { name: 'World inventory' })).toHaveTextContent(
      'No worlds found',
    );
  });

  it('contains a long world name inside the inventory surface', () => {
    const longName = `world-${'very-long-unbroken-name-'.repeat(10)}`;
    setupMocks({ worlds: [{ ...mockWorlds[0], name: longName }] });
    renderWithProviders(<WorldsPage />);

    expect(screen.getByRole('region', { name: 'World inventory' })).toHaveTextContent(longName);
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
