import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ServerDetail } from './ServerDetail';
import type { ServerDetail as ServerDetailType } from '@/ports/api/IMcctlApiClient';

let tabParam: string | null = null;

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: (key: string) => (key === 'tab' ? tabParam : null) }),
}));

vi.mock('@/hooks/useServerLogs', () => ({
  useServerLogs: () => ({ logs: [], isConnected: true, clearLogs: vi.fn(), reconnect: vi.fn(), retryCount: 0 }),
}));

// The Bento server detail (#770) streams players over SSE on the Overview tab.
vi.mock('@/hooks/useServerPlayers', () => ({
  useServerPlayers: () => ({ roster: [], online: 0, max: 0, running: true, isConnected: true, reconnect: vi.fn(), retryCount: 0 }),
}));

vi.mock('@/hooks/usePlayit', () => ({
  usePlayitStatus: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('./ServerOptionsTab', () => ({
  ServerOptionsTab: () => <div>Options Tab Content</div>,
}));

const server = {
  name: 'test-server',
  container: 'mc-test-server',
  status: 'running',
  health: 'healthy',
  hostname: 'test-server.local',
  type: 'PAPER',
  version: '1.21.1',
} as ServerDetailType;

const renderDetail = () =>
  render(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <ServerDetail server={server} />
      </QueryClientProvider>
    </ThemeProvider>
  );

describe('ServerDetail initial tab from ?tab= (#768)', () => {
  beforeEach(() => {
    tabParam = null;
  });

  it('opens the Options tab when ?tab=Options', () => {
    tabParam = 'Options';
    renderDetail();
    expect(screen.getByText('Options Tab Content')).toBeInTheDocument();
  });

  it('falls back to Overview for an unknown tab', () => {
    tabParam = 'Nope';
    renderDetail();
    expect(screen.queryByText('Options Tab Content')).not.toBeInTheDocument();
  });

  it('defaults to Overview without a tab param', () => {
    renderDetail();
    expect(screen.queryByText('Options Tab Content')).not.toBeInTheDocument();
  });
});
