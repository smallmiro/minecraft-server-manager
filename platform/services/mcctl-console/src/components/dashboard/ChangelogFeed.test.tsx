import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChangelogFeed } from './ChangelogFeed';
import * as hooks from '@/hooks/useChangelog';

vi.mock('@/hooks/useChangelog');

const data = (installed: string) => ({
  latest: {
    version: '2.34.0',
    date: '2026-10-01',
    items: [
      { type: 'added', message: 'Shiny feature' },
      { type: 'fixed', message: 'Annoying bug' },
      { type: 'changed', message: 'Tweaked thing' },
    ],
  },
  installedVersion: installed,
  fetchedAt: '2026-10-24T00:00:00.000Z',
  stale: false,
});

function mockHook(value: Record<string, unknown>) {
  vi.mocked(hooks.useChangelog).mockReturnValue(value as never);
}

describe('ChangelogFeed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a loading skeleton', () => {
    mockHook({ data: undefined, isLoading: true, error: null });
    render(<ChangelogFeed />);
    expect(screen.getByText('Recent Updates')).toBeInTheDocument();
    expect(screen.queryByText('Unable to load updates')).not.toBeInTheDocument();
  });

  it('renders the error state', () => {
    mockHook({ data: undefined, isLoading: false, error: new Error('x') });
    render(<ChangelogFeed />);
    expect(screen.getByText('Unable to load updates')).toBeInTheDocument();
  });

  it('renders the latest version with grouped items', () => {
    mockHook({ data: data('2.34.0'), isLoading: false, error: null });
    render(<ChangelogFeed />);
    expect(screen.getByText(/2\.34\.0/)).toBeInTheDocument();
    expect(screen.getByText(/2026-10-01/)).toBeInTheDocument();
    expect(screen.getByText(/Shiny feature/)).toBeInTheDocument();
    expect(screen.getByText(/Annoying bug/)).toBeInTheDocument();
    expect(screen.getByText(/Tweaked thing/)).toBeInTheDocument();
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Fixed')).toBeInTheDocument();
    expect(screen.getByText('Changed')).toBeInTheDocument();
  });

  it('shows the Update available chip when the latest version is newer', () => {
    mockHook({ data: data('2.33.0'), isLoading: false, error: null });
    render(<ChangelogFeed />);
    expect(screen.getByText('Update available')).toBeInTheDocument();
  });

  it.each(['2.34.0', '2.35.0'])('hides the chip when installed is %s', (installed) => {
    mockHook({ data: data(installed), isLoading: false, error: null });
    render(<ChangelogFeed />);
    expect(screen.queryByText('Update available')).not.toBeInTheDocument();
  });

  it('links to the GitHub changelog with a safe rel', () => {
    mockHook({ data: data('2.34.0'), isLoading: false, error: null });
    render(<ChangelogFeed />);
    const link = screen.getByRole('link', { name: 'View all' });
    expect(link).toHaveAttribute('href', expect.stringContaining('github.com/smallmiro/minecraft-server-manager'));
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
