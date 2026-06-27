import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';

const mocks = vi.hoisted(() => ({
  useMapStatus: vi.fn(),
  useRenderMap: vi.fn(),
}));

vi.mock('@/hooks/useMcctl', () => mocks);

import { WorldMapPanel } from './WorldMapPanel';

const renderWithTheme = (c: React.ReactNode) =>
  render(<ThemeProvider theme={darkTheme}>{c}</ThemeProvider>);

describe('WorldMapPanel', () => {
  beforeEach(() => {
    mocks.useMapStatus.mockReset();
    mocks.useRenderMap.mockReset();
    mocks.useRenderMap.mockReturnValue({
      render: vi.fn().mockResolvedValue(undefined),
      isRendering: false,
      progress: null,
      result: null,
      error: null,
    });
  });

  it('shows the empty state when no map is rendered', () => {
    mocks.useMapStatus.mockReturnValue({ data: { rendered: false, maps: [] }, refetch: vi.fn() });
    renderWithTheme(<WorldMapPanel worldName="factory" />);
    expect(screen.getByTestId('world-map-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('world-map-iframe')).toBeNull();
    expect(screen.getByTestId('world-map-render-button')).toHaveTextContent('Render map');
  });

  it('embeds the BlueMap iframe pointing at the API webroot when rendered', () => {
    mocks.useMapStatus.mockReturnValue({
      data: { rendered: true, maps: ['overworld'] },
      refetch: vi.fn(),
    });
    renderWithTheme(<WorldMapPanel worldName="factory" />);
    const iframe = screen.getByTestId('world-map-iframe');
    expect(iframe).toBeInTheDocument();
    expect(iframe.getAttribute('src')).toBe('/api/worlds/factory/map/web/index.html');
    expect(screen.getByTestId('world-map-render-button')).toHaveTextContent('Re-render');
  });

  it('shows a progress bar with percent while rendering', () => {
    mocks.useMapStatus.mockReturnValue({ data: { rendered: false, maps: [] }, refetch: vi.fn() });
    mocks.useRenderMap.mockReturnValue({
      render: vi.fn(),
      isRendering: true,
      progress: { map: 'overworld', percent: 42.5 },
      result: null,
      error: null,
    });
    renderWithTheme(<WorldMapPanel worldName="factory" />);
    expect(screen.getByTestId('world-map-progress')).toBeInTheDocument();
    expect(screen.getByText(/overworld: 42.5%/)).toBeInTheDocument();
    expect(screen.getByTestId('world-map-render-button')).toBeDisabled();
  });

  it('surfaces a render error', () => {
    mocks.useMapStatus.mockReturnValue({ data: { rendered: false, maps: [] }, refetch: vi.fn() });
    mocks.useRenderMap.mockReturnValue({
      render: vi.fn(),
      isRendering: false,
      progress: null,
      result: null,
      error: 'Map render failed: boom',
    });
    renderWithTheme(<WorldMapPanel worldName="factory" />);
    expect(screen.getByTestId('world-map-error')).toHaveTextContent('boom');
  });

  it('triggers a render when the button is clicked', async () => {
    const render = vi.fn().mockResolvedValue(undefined);
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.useMapStatus.mockReturnValue({ data: { rendered: false, maps: [] }, refetch });
    mocks.useRenderMap.mockReturnValue({
      render,
      isRendering: false,
      progress: null,
      result: null,
      error: null,
    });
    renderWithTheme(<WorldMapPanel worldName="factory" />);
    fireEvent.click(screen.getByTestId('world-map-render-button'));
    await waitFor(() => expect(render).toHaveBeenCalledWith('factory'));
  });
});
