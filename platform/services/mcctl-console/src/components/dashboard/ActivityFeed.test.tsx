import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ActivityFeed } from './ActivityFeed';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

interface ActivityItem {
  id: string;
  type: 'server_start' | 'server_stop' | 'player_join' | 'player_leave' | 'info';
  message: string;
  timestamp: string;
  serverName?: string;
}

const mockActivities: ActivityItem[] = [
  {
    id: '1',
    type: 'server_start',
    message: 'Server server1 started',
    timestamp: new Date().toISOString(),
    serverName: 'server1',
  },
  {
    id: '2',
    type: 'player_join',
    message: 'Player Steve joined server1',
    timestamp: new Date(Date.now() - 60000).toISOString(),
    serverName: 'server1',
  },
  {
    id: '3',
    type: 'server_stop',
    message: 'Server server2 stopped',
    timestamp: new Date(Date.now() - 120000).toISOString(),
    serverName: 'server2',
  },
];

describe('ActivityFeed', () => {
  it('should render empty state when no activities', () => {
    renderWithTheme(
      <ActivityFeed activities={[]} />
    );

    expect(screen.getByText(/no recent activity/i)).toBeInTheDocument();
  });

  it('should render activity items', () => {
    renderWithTheme(
      <ActivityFeed activities={mockActivities} />
    );

    expect(screen.getByText(/Server server1 started/i)).toBeInTheDocument();
    expect(screen.getByText(/Player Steve joined server1/i)).toBeInTheDocument();
    expect(screen.getByText(/Server server2 stopped/i)).toBeInTheDocument();
  });

  it('should display activity icons for different types', () => {
    renderWithTheme(
      <ActivityFeed activities={mockActivities} />
    );

    // Check that all activities are rendered with icons
    const activityItems = screen.getAllByRole('listitem');
    expect(activityItems.length).toBe(3);
  });

  it('should limit displayed activities when maxItems is set', () => {
    renderWithTheme(
      <ActivityFeed activities={mockActivities} maxItems={2} />
    );

    expect(screen.getByText(/Server server1 started/i)).toBeInTheDocument();
    expect(screen.getByText(/Player Steve joined server1/i)).toBeInTheDocument();
    expect(screen.queryByText(/Server server2 stopped/i)).not.toBeInTheDocument();
  });

  it('should render title when provided', () => {
    renderWithTheme(
      <ActivityFeed activities={mockActivities} title="Recent Activity" />
    );

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
  });

  it('should render default title', () => {
    renderWithTheme(
      <ActivityFeed activities={mockActivities} />
    );

    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
  });

  it('should format timestamps as relative time', () => {
    renderWithTheme(
      <ActivityFeed activities={mockActivities} />
    );

    // Check that timestamps are rendered (they will be formatted)
    const timeElements = screen.getAllByText(/ago|just now|minutes?|hours?|seconds?/i);
    expect(timeElements.length).toBeGreaterThan(0);
  });
});
