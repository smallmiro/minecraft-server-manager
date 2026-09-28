import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme';
import { BentoPanel } from './BentoPanel';

const renderPanel = (interactive = false) =>
  render(
    <ThemeProvider>
      <BentoPanel aria-label="Server status" interactive={interactive}>
        Content
      </BentoPanel>
    </ThemeProvider>,
  );

describe('BentoPanel', () => {
  it('renders a neutral semantic panel by default', () => {
    renderPanel();

    const panel = screen.getByRole('region', { name: 'Server status' });
    expect(panel).toHaveTextContent('Content');
    expect(panel).toHaveAttribute('data-accent', 'neutral');
    expect(panel).toHaveStyle({ minWidth: '0' });
  });

  it('limits hover lift to interactive panels', () => {
    const { rerender } = renderPanel();
    expect(screen.getByRole('region', { name: 'Server status' })).toHaveAttribute(
      'data-interactive',
      'false',
    );

    rerender(
      <ThemeProvider>
        <BentoPanel aria-label="Server status" interactive>
          Content
        </BentoPanel>
      </ThemeProvider>,
    );

    expect(screen.getByRole('region', { name: 'Server status' })).toHaveAttribute(
      'data-interactive',
      'true',
    );
  });
});
