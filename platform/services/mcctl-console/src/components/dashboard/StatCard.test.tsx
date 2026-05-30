import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { StatCard } from './StatCard';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('StatCard', () => {
  it('should render title and value', () => {
    renderWithTheme(
      <StatCard title="Total Servers" value={5} />
    );

    expect(screen.getByText('Total Servers')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should render icon when provided', () => {
    const TestIcon = () => <div data-testid="test-icon">Icon</div>;
    renderWithTheme(
      <StatCard title="Total Servers" value={5} icon={<TestIcon />} />
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should apply primary color variant', () => {
    const { container } = renderWithTheme(
      <StatCard title="Total Servers" value={5} color="primary" />
    );

    const card = container.querySelector('[data-testid="stat-card"]');
    expect(card).toBeInTheDocument();
  });

  it('should apply success color variant', () => {
    const { container } = renderWithTheme(
      <StatCard title="Online Servers" value={3} color="success" />
    );

    const card = container.querySelector('[data-testid="stat-card"]');
    expect(card).toBeInTheDocument();
  });

  it('should apply info color variant', () => {
    const { container } = renderWithTheme(
      <StatCard title="Total Players" value={12} color="info" />
    );

    const card = container.querySelector('[data-testid="stat-card"]');
    expect(card).toBeInTheDocument();
  });

  it('should apply secondary color variant', () => {
    const { container } = renderWithTheme(
      <StatCard title="Total Worlds" value={8} color="secondary" />
    );

    const card = container.querySelector('[data-testid="stat-card"]');
    expect(card).toBeInTheDocument();
  });

  it('should render zero value', () => {
    renderWithTheme(
      <StatCard title="Total Servers" value={0} />
    );

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render large numbers', () => {
    renderWithTheme(
      <StatCard title="Total Players" value={1234} />
    );

    expect(screen.getByText('1234')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    renderWithTheme(
      <StatCard title="Total Servers" value={5} description="All configured servers" />
    );

    expect(screen.getByText('All configured servers')).toBeInTheDocument();
  });

  it('should render a unit suffix next to the value when provided', () => {
    renderWithTheme(
      <StatCard title="Online Servers" value={3} unit="/ 8" />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/ 8')).toBeInTheDocument();
  });

  it('should render a progress bar when progress is provided', () => {
    renderWithTheme(
      <StatCard title="Online Servers" value={3} progress={40} color="success" />
    );

    const fill = screen.getByTestId('stat-card-progress-fill');
    expect(fill).toBeInTheDocument();
    expect(fill).toHaveStyle({ width: '40%' });
  });

  it('should not render a progress bar when progress is omitted', () => {
    renderWithTheme(
      <StatCard title="Total Players" value={0} />
    );

    expect(screen.queryByTestId('stat-card-progress-fill')).not.toBeInTheDocument();
  });

  it('should clamp progress above 100 to 100%', () => {
    renderWithTheme(
      <StatCard title="Online Servers" value={9} progress={150} />
    );

    expect(screen.getByTestId('stat-card-progress-fill')).toHaveStyle({ width: '100%' });
  });

  it('should clamp negative progress to 0%', () => {
    renderWithTheme(
      <StatCard title="Online Servers" value={0} progress={-20} />
    );

    expect(screen.getByTestId('stat-card-progress-fill')).toHaveStyle({ width: '0%' });
  });
});
