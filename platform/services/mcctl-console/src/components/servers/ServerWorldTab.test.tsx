import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';

// WorldInfoPanel pulls in data hooks; stub it to a marker for this unit test.
vi.mock('../worlds/WorldInfoPanel', () => ({
  WorldInfoPanel: ({ worldName }: { worldName: string }) => (
    <div data-testid="world-info-panel-stub">{worldName}</div>
  ),
}));

import { ServerWorldTab } from './ServerWorldTab';

const renderWithTheme = (c: React.ReactNode) =>
  render(<ThemeProvider theme={darkTheme}>{c}</ThemeProvider>);

describe('ServerWorldTab', () => {
  it('shows a no-world notice when no world is assigned', () => {
    renderWithTheme(<ServerWorldTab serverName="survival" />);
    expect(screen.getByTestId('server-world-none')).toBeInTheDocument();
    expect(screen.queryByTestId('world-info-panel-stub')).toBeNull();
  });

  it('renders the world panel for the assigned world (not the server name)', () => {
    renderWithTheme(<ServerWorldTab serverName="survival" worldName="my-world" />);
    const panel = screen.getByTestId('world-info-panel-stub');
    expect(panel).toHaveTextContent('my-world');
  });
});
