import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/theme';
import { BentoGrid } from './BentoGrid';

describe('BentoGrid', () => {
  it('uses responsive grid tracks without reordering children', () => {
    render(
      <ThemeProvider>
        <BentoGrid aria-label="Operations">
          <div>First</div>
          <div>Second</div>
        </BentoGrid>
      </ThemeProvider>,
    );

    const grid = screen.getByRole('region', { name: 'Operations' });
    const first = screen.getByText('First');
    const second = screen.getByText('Second');

    expect(grid).toHaveStyle({ display: 'grid' });
    expect(grid).toHaveStyle({ minWidth: '0' });
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
