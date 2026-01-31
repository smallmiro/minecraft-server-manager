import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryProvider } from './QueryProvider';

describe('QueryProvider', () => {
  it('should render children', () => {
    render(
      <QueryProvider>
        <div>Test Child</div>
      </QueryProvider>
    );
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should provide QueryClient to children', () => {
    render(
      <QueryProvider>
        <div data-testid="child">QueryClient Provided</div>
      </QueryProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
