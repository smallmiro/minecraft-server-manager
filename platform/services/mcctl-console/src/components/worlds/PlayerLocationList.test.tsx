import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';
import { PlayerLocationList, mergePlayers } from './PlayerLocationList';
import type { PlayerLocation } from '@/ports/api/IMcctlApiClient';

const offline: PlayerLocation[] = [
  { uuid: 'u1', name: 'Steve', x: -85, y: 82, z: 121, dimension: 'overworld', online: false },
  { uuid: 'u2', name: 'Alex', x: 10, y: 64, z: 20, dimension: 'nether', online: false },
];

const renderWithTheme = (c: React.ReactNode) =>
  render(<ThemeProvider theme={darkTheme}>{c}</ThemeProvider>);

describe('PlayerLocationList', () => {
  it('renders offline players with coordinates', () => {
    renderWithTheme(<PlayerLocationList offline={offline} />);
    expect(screen.getByText('Steve')).toBeInTheDocument();
    expect(screen.getByText('-85, 82, 121')).toBeInTheDocument();
    expect(screen.getAllByText('offline').length).toBe(2);
  });

  it('shows empty message when no players', () => {
    renderWithTheme(<PlayerLocationList offline={[]} />);
    expect(screen.getByTestId('player-list-empty')).toBeInTheDocument();
  });

  it('prefers live entries over offline for the same player', () => {
    const live: PlayerLocation[] = [
      { uuid: 'u1', name: 'Steve', x: 1, y: 2, z: 3, dimension: 'end', online: true },
    ];
    const merged = mergePlayers(offline, live);
    expect(merged.length).toBe(2);
    const steve = merged.find((p) => p.name === 'Steve');
    expect(steve!.online).toBe(true);
    expect(steve!.x).toBe(1);
  });
});
