import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme';
import { BentoPanelHeader, type BentoPanelHeaderProps } from './BentoPanelHeader';

const renderHeader = (props: Partial<BentoPanelHeaderProps> = {}) =>
  render(
    <ThemeProvider>
      <BentoPanelHeader title="Servers" {...props} />
    </ThemeProvider>,
  );

describe('BentoPanelHeader', () => {
  it('renders the title as an h2 heading by default', () => {
    renderHeader();

    expect(screen.getByRole('heading', { level: 2, name: 'Servers' })).toBeInTheDocument();
  });

  it('supports a custom heading level', () => {
    renderHeader({ component: 'h3' });

    expect(screen.getByRole('heading', { level: 3, name: 'Servers' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
  });

  it('renders subtitle, icon and action when provided', () => {
    renderHeader({
      subtitle: 'Running containers',
      icon: <span data-testid="header-icon" />,
      action: <button type="button">View All</button>,
    });

    expect(screen.getByText('Running containers')).toBeInTheDocument();
    expect(screen.getByTestId('header-icon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View All' })).toBeInTheDocument();
  });

  it('omits optional slots when not provided', () => {
    renderHeader();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('header-icon')).not.toBeInTheDocument();
  });

  it('keeps a zero subtitle inside the subtitle slot', () => {
    renderHeader({ subtitle: 0 });

    expect(screen.getByText('0').tagName).toBe('P');
  });
});
