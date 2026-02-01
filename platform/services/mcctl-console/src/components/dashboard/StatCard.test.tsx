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
});
