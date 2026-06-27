import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';
import type { BlockStatsResult } from '@/ports/api/IMcctlApiClient';

const mocks = vi.hoisted(() => ({
  useWorldStats: vi.fn(),
  useAnalyzeStats: vi.fn(),
}));

vi.mock('@/hooks/useMcctl', () => mocks);

import { WorldStatsPanel } from './WorldStatsPanel';

const renderWithTheme = (c: React.ReactNode) =>
  render(<ThemeProvider theme={darkTheme}>{c}</ThemeProvider>);

const stats: BlockStatsResult = {
  world: 'factory',
  analyzedAt: '2026-06-27T00:00:00.000Z',
  durationMs: 7000,
  dimensions: ['overworld', 'nether'],
  regionsScanned: 12,
  totalBlocks: 40000000,
  blockTypeCount: 233,
  ores: { 'minecraft:diamond_ore': 324, 'minecraft:iron_ore': 56249 },
  topBlocks: [
    { id: 'minecraft:stone', count: 19000000 },
    { id: 'minecraft:deepslate', count: 12000000 },
  ],
};

describe('WorldStatsPanel', () => {
  beforeEach(() => {
    mocks.useWorldStats.mockReset();
    mocks.useAnalyzeStats.mockReset();
    mocks.useAnalyzeStats.mockReturnValue({
      analyze: vi.fn().mockResolvedValue(undefined),
      isAnalyzing: false,
      progress: null,
      error: null,
    });
  });

  it('shows the empty state when no analysis exists (404)', () => {
    mocks.useWorldStats.mockReturnValue({ data: undefined, error: { statusCode: 404 }, refetch: vi.fn() });
    renderWithTheme(<WorldStatsPanel worldName="factory" />);
    expect(screen.getByTestId('world-stats-empty')).toBeInTheDocument();
    expect(screen.getByTestId('world-stats-analyze-button')).toHaveTextContent('Analyze');
  });

  it('renders ore and top-block bars when stats exist', () => {
    mocks.useWorldStats.mockReturnValue({ data: stats, error: null, refetch: vi.fn() });
    renderWithTheme(<WorldStatsPanel worldName="factory" />);
    expect(screen.getByTestId('world-stats-result')).toBeInTheDocument();
    expect(screen.getByTestId('world-stats-ores')).toBeInTheDocument();
    expect(screen.getByTestId('world-stats-top-blocks')).toBeInTheDocument();
    expect(screen.getByText(/iron ore/i)).toBeInTheDocument();
    expect(screen.getByText(/stone/i)).toBeInTheDocument();
    expect(screen.getByTestId('world-stats-analyze-button')).toHaveTextContent('Re-analyze');
  });

  it('shows progress while analyzing', () => {
    mocks.useWorldStats.mockReturnValue({ data: undefined, error: { statusCode: 404 }, refetch: vi.fn() });
    mocks.useAnalyzeStats.mockReturnValue({
      analyze: vi.fn(),
      isAnalyzing: true,
      progress: { dimension: 'overworld', regionsDone: 3, regionsTotal: 12 },
      error: null,
    });
    renderWithTheme(<WorldStatsPanel worldName="factory" />);
    expect(screen.getByTestId('world-stats-progress')).toBeInTheDocument();
    expect(screen.getByText(/overworld: 3\/12 regions/)).toBeInTheDocument();
    expect(screen.getByTestId('world-stats-analyze-button')).toBeDisabled();
  });

  it('surfaces an analysis error', () => {
    mocks.useWorldStats.mockReturnValue({ data: undefined, error: { statusCode: 404 }, refetch: vi.fn() });
    mocks.useAnalyzeStats.mockReturnValue({
      analyze: vi.fn(),
      isAnalyzing: false,
      progress: null,
      error: 'Analysis cancelled',
    });
    renderWithTheme(<WorldStatsPanel worldName="factory" />);
    expect(screen.getByTestId('world-stats-error')).toHaveTextContent('cancelled');
  });

  it('triggers analysis on button click', async () => {
    const analyze = vi.fn().mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.useWorldStats.mockReturnValue({ data: undefined, error: { statusCode: 404 }, refetch });
    mocks.useAnalyzeStats.mockReturnValue({ analyze, isAnalyzing: false, progress: null, error: null });
    renderWithTheme(<WorldStatsPanel worldName="factory" />);
    fireEvent.click(screen.getByTestId('world-stats-analyze-button'));
    await waitFor(() => expect(analyze).toHaveBeenCalledWith('factory'));
  });
});
