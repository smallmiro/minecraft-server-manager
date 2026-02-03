import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { darkTheme } from '@/theme/muiTheme';
import { ResourceStatCard } from './ResourceStatCard';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider theme={darkTheme}>{component}</ThemeProvider>);
};

const CpuIcon = () => <svg data-testid="cpu-icon" />;

describe('ResourceStatCard', () => {
  it('renders value and unit', () => {
    renderWithTheme(
      <ResourceStatCard
        value="0.22%"
        unit="/ 100%"
        label="CPU usage"
        icon={<CpuIcon />}
        progress={0.22}
        progressMax={100}
      />
    );

    expect(screen.getByText('0.22%')).toBeInTheDocument();
    expect(screen.getByText('/ 100%')).toBeInTheDocument();
  });

  it('renders label', () => {
    renderWithTheme(
      <ResourceStatCard
        value="39.58%"
        unit="/ 100%"
        label="Memory usage"
        icon={<CpuIcon />}
        progress={39.58}
        progressMax={100}
      />
    );

    expect(screen.getByText('Memory usage')).toBeInTheDocument();
  });

  it('renders icon', () => {
    renderWithTheme(
      <ResourceStatCard
        value="394.52 MB"
        unit="/ 15 GB"
        label="Storage usage"
        icon={<CpuIcon />}
        progress={394.52}
        progressMax={15360}
      />
    );

    expect(screen.getByTestId('cpu-icon')).toBeInTheDocument();
  });

  it('renders progress bar', () => {
    renderWithTheme(
      <ResourceStatCard
        value="50%"
        unit="/ 100%"
        label="Test"
        icon={<CpuIcon />}
        progress={50}
        progressMax={100}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toBeInTheDocument();
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
  });

  it('caps progress at 100%', () => {
    renderWithTheme(
      <ResourceStatCard
        value="150%"
        unit="/ 100%"
        label="Over limit"
        icon={<CpuIcon />}
        progress={150}
        progressMax={100}
      />
    );

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders with custom color', () => {
    renderWithTheme(
      <ResourceStatCard
        value="75%"
        unit="/ 100%"
        label="Custom color"
        icon={<CpuIcon />}
        progress={75}
        progressMax={100}
        color="#ff5733"
      />
    );

    expect(screen.getByTestId('resource-stat-card')).toBeInTheDocument();
  });
});
