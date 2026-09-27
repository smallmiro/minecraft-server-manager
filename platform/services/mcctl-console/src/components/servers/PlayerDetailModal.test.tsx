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

  describe('Position & Status (#528 Phase 3)', () => {
    it('shows "No player data file" when there is no saved data and no live position', () => {
      mockUsePlayerDetail.mockReturnValue({
        data: { ...player, stats: null, data: null },
        isLoading: false,
        isError: false,
      });
      renderWithProviders(
        <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
      );
      expect(screen.getByText(/no player data file/i)).toBeInTheDocument();
    });

    it('shows the last saved position when offline (no livePosition)', () => {
      mockUsePlayerDetail.mockReturnValue({
        data: {
          ...player,
          stats: null,
          data: {
            x: 12.345,
            y: 64.5,
            z: -8.05,
            dimension: 'overworld',
            health: 18,
            food: 15,
            xpLevel: 7,
            gameMode: 'survival',
            inventory: { slotsUsed: 3, items: [{ id: 'minecraft:diamond_sword', count: 1 }] },
          },
        },
        isLoading: false,
        isError: false,
      });
      renderWithProviders(
        <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
      );

      expect(screen.getByText(/last saved position/i)).toBeInTheDocument();
      expect(screen.getByText(/12\.3/)).toBeInTheDocument();
      expect(screen.getByText(/64\.5/)).toBeInTheDocument();
      expect(screen.getByText(/-8\.1|-8\.0/)).toBeInTheDocument();
      expect(screen.getByText(/overworld/i)).toBeInTheDocument();
      expect(screen.getByText('18/20')).toBeInTheDocument();
      expect(screen.getByText('15/20')).toBeInTheDocument();
      expect(screen.getByText('7')).toBeInTheDocument();
      expect(screen.getByText(/survival/i)).toBeInTheDocument();
      expect(screen.getByText(/diamond_sword/)).toBeInTheDocument();
      expect(screen.queryByText(/minecraft:diamond_sword/)).not.toBeInTheDocument();
    });

    it('shows a live indicator and live coordinates when online with a livePosition', () => {
      mockUsePlayerDetail.mockReturnValue({
        data: {
          ...player,
          online: true,
          stats: null,
          data: null,
          livePosition: { x: 100, y: 70, z: -3, dimension: 'nether' },
        },
        isLoading: false,
        isError: false,
      });
      renderWithProviders(
        <PlayerDetailModal serverName="survival" player={{ ...player, online: true }} open={true} onClose={vi.fn()} />
      );

      expect(screen.getByText(/^live position$/i)).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText(/100\.0/)).toBeInTheDocument();
      expect(screen.getByText(/nether/i)).toBeInTheDocument();
    });

    it('renders "—" for health/food/xpLevel when the NBT tag is absent', () => {
      mockUsePlayerDetail.mockReturnValue({
        data: {
          ...player,
          stats: null,
          data: {
            x: 0,
            y: 64,
            z: 0,
            dimension: 'overworld',
            gameMode: 'survival',
            inventory: { slotsUsed: 0, items: [] },
          },
        },
        isLoading: false,
        isError: false,
      });
      renderWithProviders(
        <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
      );

      expect(screen.getAllByText('—/20')).toHaveLength(2); // health, food
      expect(screen.getByText('—')).toBeInTheDocument(); // xpLevel
    });

    it('caps the displayed inventory items at 10', () => {
      const items = Array.from({ length: 15 }, (_, i) => ({ id: `minecraft:item_${i}`, count: 1 }));
      mockUsePlayerDetail.mockReturnValue({
        data: {
          ...player,
          stats: null,
          data: {
            x: 0,
            y: 0,
            z: 0,
            dimension: 'overworld',
            health: 20,
            food: 20,
            xpLevel: 0,
            gameMode: 'survival',
            inventory: { slotsUsed: 15, items },
          },
        },
        isLoading: false,
        isError: false,
      });
      renderWithProviders(
        <PlayerDetailModal serverName="survival" player={player} open={true} onClose={vi.fn()} />
      );

      expect(screen.getByText(/item_9/)).toBeInTheDocument();
      expect(screen.queryByText(/item_10/)).not.toBeInTheDocument();
    });
  });
});
