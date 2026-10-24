import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { RecentActivityFeed } from './RecentActivityFeed';

const recent = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuditLogs', () => ({ useRecentActivity: () => recent.current }));

const entry = (overrides: Record<string, unknown>) => ({
  id: 'x',
  timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
  action: 'server.start',
  actor: 'api:admin',
  targetType: 'server',
  targetName: 'survival',
  status: 'success',
  details: null,
  errorMessage: null,
  ...overrides,
});

function renderFeed(logs: unknown[]) {
  recent.current = { data: { logs }, isLoading: false, error: null };
  return render(
    <ThemeProvider>
      <RecentActivityFeed />
    </ThemeProvider>
  );
}

describe('RecentActivityFeed', () => {
  beforeEach(() => {
    recent.current = {};
  });

  it('renders a category-coloured dot per entry', () => {
    renderFeed([
      entry({ id: '1', action: 'server.start' }),
      entry({ id: '2', action: 'backup.push', targetName: 'backup' }),
      entry({ id: '3', action: 'platform.settings.update', targetName: 'settings' }),
      entry({ id: '4', action: 'server.stop', status: 'failure' }),
      entry({ id: '5', action: 'player.ban', targetName: 'steve' }),
    ]);

    const colors = screen.getAllByTestId('activity-dot').map((dot) => dot.getAttribute('data-color'));
    expect(colors).toEqual([
      'success.main',
      'info.main',
      'secondary.main',
      'error.main',
      'text.disabled',
    ]);
  });

  it('shows action and target on the first row and actor with relative time on the second', () => {
    renderFeed([entry({ id: '1' })]);

    const row = screen.getByTestId('activity-dot').closest('li')!;
    expect(within(row).getByText('survival')).toBeInTheDocument();
    expect(within(row).getByText('Start')).toBeInTheDocument();
    expect(within(row).getByText('admin · 5m ago')).toBeInTheDocument();
  });

  it('still shows the failure chip for failed entries', () => {
    renderFeed([entry({ id: '1', status: 'failure' })]);

    expect(screen.getByText('Error')).toBeInTheDocument();
  });

  it('shows the empty state', () => {
    renderFeed([]);

    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });
});
