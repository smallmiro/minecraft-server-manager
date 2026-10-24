import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import type { PlayerSummary } from '@/ports/api/IMcctlApiClient';
import { OverviewPlayerList } from './OverviewPlayerList';

const playersState = vi.hoisted(() => ({ roster: [] as PlayerSummary[] }));

vi.mock('@/hooks/useServerPlayers', () => ({
  useServerPlayers: () => ({
    roster: playersState.roster,
    online: 0,
    max: 0,
    running: true,
    isConnected: true,
    reconnect: vi.fn(),
    retryCount: 0,
  }),
}));

vi.mock('./PlayerDetailModal', () => ({
  PlayerDetailModal: ({ open, player }: { open: boolean; player: PlayerSummary | null }) =>
    open ? <div role="dialog">Detail for {player?.name}</div> : null,
}));

const steve: PlayerSummary = {
  uuid: 'uuid-steve',
  name: 'Steve',
  online: true,
  lastSeen: null,
  isOp: true,
  isBanned: false,
  isWhitelisted: true,
};

function renderList(players?: { online: number; max: number; players: string[] }) {
  return render(
    <ThemeProvider>
      <OverviewPlayerList serverName="alpha" players={players} />
    </ThemeProvider>,
  );
}

describe('OverviewPlayerList', () => {
  beforeEach(() => {
    playersState.roster = [];
  });

  it('renders online players as rows with the online count', () => {
    renderList({ online: 2, max: 20, players: ['Steve', 'Alex'] });

    expect(screen.getByText('2 / 20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Steve/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Alex/ })).toBeInTheDocument();
  });

  it('adds roster badges such as OP when the roster knows the player', () => {
    playersState.roster = [steve, { ...steve, uuid: 'uuid-off', name: 'Offline', online: false }];
    renderList({ online: 1, max: 20, players: ['Steve'] });

    const row = screen.getByRole('button', { name: /Steve/ });
    expect(row).toHaveTextContent('OP');
    expect(screen.queryByText('Offline')).not.toBeInTheDocument();
  });

  it('opens the player detail modal from a row', () => {
    playersState.roster = [steve];
    renderList({ online: 1, max: 20, players: ['Steve'] });

    fireEvent.click(screen.getByRole('button', { name: /Steve/ }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Detail for Steve');
  });

  it('opens the modal for a player the roster has not cached yet', () => {
    renderList({ online: 1, max: 20, players: ['Alex'] });

    fireEvent.click(screen.getByRole('button', { name: /Alex/ }));

    expect(screen.getByRole('dialog')).toHaveTextContent('Detail for Alex');
  });

  it('shows an empty state when nobody is online', () => {
    renderList({ online: 0, max: 20, players: [] });

    expect(screen.getByText('No players online')).toBeInTheDocument();
  });

  it('shows an empty state when player data is unavailable', () => {
    renderList(undefined);

    expect(screen.getByText('No players online')).toBeInTheDocument();
    expect(screen.queryByText(/\/ 20/)).not.toBeInTheDocument();
  });
});
