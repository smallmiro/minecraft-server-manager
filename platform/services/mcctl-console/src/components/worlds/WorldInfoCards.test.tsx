import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';
import { WorldInfoCards, formatBytes } from './WorldInfoCards';
import type { WorldInfo } from '@/ports/api/IMcctlApiClient';

const info: WorldInfo = {
  name: 'factory',
  level: {
    levelName: 'factory',
    seed: '618742839476293847',
    spawn: { x: 0, y: 64, z: 0 },
    gameMode: 'survival',
    difficulty: 'normal',
    hardcore: false,
    dayTime: 428003,
    dayCount: 17,
    raining: true,
    thundering: false,
    versionName: '1.21.1',
    dataVersion: 3955,
    worldBorder: { size: 59999968, centerX: 0, centerZ: 0 },
    dataPacks: ['vanilla'],
  },
  dimensions: { overworld: true, nether: true, end: true },
  sizeBytes: 1288490188,
  regionCount: 12,
  lastModified: '2026-02-24T22:21:00.000Z',
};

const renderWithTheme = (c: React.ReactNode) =>
  render(<ThemeProvider theme={darkTheme}>{c}</ThemeProvider>);

describe('WorldInfoCards', () => {
  it('renders key world metadata', () => {
    renderWithTheme(<WorldInfoCards info={info} />);
    expect(screen.getByText('618742839476293847')).toBeInTheDocument();
    expect(screen.getByText('0, 64, 0')).toBeInTheDocument();
    expect(screen.getByText('Survival')).toBeInTheDocument();
    expect(screen.getByText('Day 17')).toBeInTheDocument();
    expect(screen.getByText('1.21.1')).toBeInTheDocument();
    expect(screen.getByText('1.2 GB')).toBeInTheDocument();
  });

  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1288490188)).toBe('1.2 GB');
  });
});
