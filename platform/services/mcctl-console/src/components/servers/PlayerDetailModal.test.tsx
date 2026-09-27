import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { PlayerDetailModal } from './PlayerDetailModal';
import type { PlayerSummary } from '@/ports/api/IMcctlApiClient';

const mockUsePlayerDetail = vi.fn();
vi.mock('@/hooks/useMcctl', () => ({
  usePlayerDetail: (...args: unknown[]) => mockUsePlayerDetail(...args),
}));

const renderWithProviders = (component: React.ReactNode) =>
  render(<ThemeProvider>{component}</ThemeProvider>);

const player: PlayerSummary = {
  uuid: 'uuid-abc',
  name: 'Steve',
  online: false,
  lastSeen: '2024-01-01T00:00:00Z',
  isOp: true,
  isBanned: false,
  isWhitelisted: true,
};

describe('PlayerDetailModal (#528 Phase 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when closed', () => {
    mockUsePlayerDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={player} open={false} onClose={vi.fn()} />
    );
    expect(screen.queryByText('Steve')).not.toBeInTheDocument();
  });

  it('shows the header with name, uuid and badges', () => {
    mockUsePlayerDetail.mockReturnValue({ data: { ...player, stats: null }, isLoading: false, isError: false });
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
    );

    expect(screen.getByText('Steve')).toBeInTheDocument();
    expect(screen.getByText('uuid-abc')).toBeInTheDocument();
    expect(screen.getByText('OP')).toBeInTheDocument();
    expect(screen.getByText('Whitelisted')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    mockUsePlayerDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an error state', () => {
    mockUsePlayerDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('shows a "no statistics" message when stats is null', () => {
    mockUsePlayerDetail.mockReturnValue({ data: { ...player, stats: null }, isLoading: false, isError: false });
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
    );
    expect(screen.getByText(/no statistics recorded yet/i)).toBeInTheDocument();
  });

  it('renders human-readable statistics when available', () => {
    mockUsePlayerDetail.mockReturnValue({
      data: {
        ...player,
        stats: {
          playTimeSeconds: 5400,
          deaths: 3,
          mobKills: 40,
          playerKills: 1,
          distanceMeters: 12500,
          blocksMined: 500,
          itemsCrafted: 20,
          advancementsCompleted: 15,
        },
      },
      isLoading: false,
      isError: false,
    });
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
    );

    expect(screen.getByText('1h 30m')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('12.5 km')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('disables detail fetching when the player has no cached uuid', () => {
    mockUsePlayerDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    const onlineUncached: PlayerSummary = { ...player, uuid: '' };
    renderWithProviders(
      <PlayerDetailModal serverName="survival" player={onlineUncached} open={true} onClose={vi.fn()} />
    );

    expect(mockUsePlayerDetail).toHaveBeenCalledWith('survival', '', { enabled: false });
  });
});
