import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';
import type { WorldInfo, PlayerLocation } from '@/ports/api/IMcctlApiClient';

const mocks = vi.hoisted(() => ({
  useWorldInfo: vi.fn(),
  useWorldPlayers: vi.fn(),
  useLivePlayers: vi.fn(),
  useMapStatus: vi.fn(),
  useRenderMap: vi.fn(),
  useWriteMapMarkers: vi.fn(),
  useWorldStats: vi.fn(),
  useAnalyzeStats: vi.fn(),
}));

vi.mock('@/hooks/useMcctl', () => mocks);

import { WorldInfoPanel } from './WorldInfoPanel';

const info: WorldInfo = {
  name: 'factory',
  level: {
    levelName: 'factory',
    seed: '12345',
    spawn: { x: 0, y: 64, z: 0 },
    gameMode: 'survival',
    difficulty: 'normal',
    hardcore: false,
    dayTime: 0,
    dayCount: 5,
    raining: false,
    thundering: false,
    versionName: '1.21.1',
    dataVersion: 3955,
    worldBorder: { size: 60000000, centerX: 0, centerZ: 0 },
    dataPacks: ['vanilla'],
  },
  dimensions: { overworld: true, nether: true, end: false },
  sizeBytes: 1024,
  regionCount: 3,
  lastModified: null,
};

const offline: PlayerLocation[] = [
  { uuid: 'u1', name: 'Steve', x: 1, y: 2, z: 3, dimension: 'overworld', online: false },
];

const renderWithTheme = (c: React.ReactNode) =>
  render(<ThemeProvider theme={darkTheme}>{c}</ThemeProvider>);

describe('WorldInfoPanel', () => {
  beforeEach(() => {
    mocks.useWorldInfo.mockReset();
    mocks.useWorldPlayers.mockReset();
    mocks.useLivePlayers.mockReset();
    mocks.useMapStatus.mockReset();
    mocks.useRenderMap.mockReset();
    mocks.useWriteMapMarkers.mockReset();
    mocks.useWorldPlayers.mockReturnValue({ data: { players: offline } });
    mocks.useLivePlayers.mockReturnValue({ data: { players: [] } });
    mocks.useMapStatus.mockReturnValue({ data: { rendered: false, maps: [] }, refetch: vi.fn() });
    mocks.useRenderMap.mockReturnValue({
      render: vi.fn(),
      isRendering: false,
      progress: null,
      result: null,
      error: null,
    });
    mocks.useWriteMapMarkers.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    mocks.useWorldStats.mockReturnValue({ data: undefined, error: { statusCode: 404 }, refetch: vi.fn() });
    mocks.useAnalyzeStats.mockReturnValue({
      analyze: vi.fn(),
      isAnalyzing: false,
      progress: null,
      error: null,
    });
  });

  it('shows a skeleton while loading', () => {
    mocks.useWorldInfo.mockReturnValue({ isLoading: true });
    renderWithTheme(<WorldInfoPanel worldName="factory" />);
    expect(screen.getByTestId('world-info-loading')).toBeInTheDocument();
  });

  it('shows an error alert on failure', () => {
    mocks.useWorldInfo.mockReturnValue({ isError: true, error: new Error('boom') });
    renderWithTheme(<WorldInfoPanel worldName="factory" />);
    expect(screen.getByTestId('world-info-error')).toBeInTheDocument();
  });

  it('renders panel with cards and players', () => {
    mocks.useWorldInfo.mockReturnValue({ data: { info } });
    renderWithTheme(<WorldInfoPanel worldName="factory" />);
    expect(screen.getByTestId('world-info-panel')).toBeInTheDocument();
    expect(screen.getByTestId('world-info-cards')).toBeInTheDocument();
    expect(screen.getByText('Steve')).toBeInTheDocument();
  });

  it('shows offline note when server is stopped (no live players)', () => {
    mocks.useWorldInfo.mockReturnValue({ data: { info } });
    renderWithTheme(<WorldInfoPanel worldName="factory" serverName="survival" />);
    expect(screen.getByTestId('world-info-offline-note')).toBeInTheDocument();
  });
});
