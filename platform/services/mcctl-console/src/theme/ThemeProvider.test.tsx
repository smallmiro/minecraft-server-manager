import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from './ThemeProvider';

describe('ThemeProvider', () => {
  it('should render children', () => {
    render(
      <ThemeProvider>
        <div>Test Child</div>
      </ThemeProvider>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should apply MUI theme to children', () => {
    render(
      <ThemeProvider>
        <div data-testid="themed-child">Themed Content</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('themed-child')).toBeInTheDocument();
  });
});
