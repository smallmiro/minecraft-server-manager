import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme';
import { BentoMetricCard } from './BentoMetricCard';

const renderMetric = (progress?: number) =>
  render(
    <ThemeProvider>
      <BentoMetricCard
        title="Online servers"
        value={3}
        unit="/ 5"
        description="Across the cluster"
        progress={progress}
      />
    </ThemeProvider>,
  );

describe('BentoMetricCard', () => {
  it('clamps progress to zero and one hundred', () => {
    const { rerender } = renderMetric(-10);
    expect(screen.getByTestId('bento-metric-progress-fill')).toHaveStyle({ width: '0%' });

    rerender(
      <ThemeProvider>
        <BentoMetricCard title="Online servers" value={6} progress={140} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('bento-metric-progress-fill')).toHaveStyle({ width: '100%' });
  });

  it('omits progress when no real ratio is supplied', () => {
    renderMetric();

    expect(screen.getByText('Online servers')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('/ 5')).toBeInTheDocument();
    expect(screen.getByText('Across the cluster')).toBeInTheDocument();
    expect(screen.queryByTestId('bento-metric-progress-fill')).not.toBeInTheDocument();
  });
});
