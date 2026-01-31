import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { MainLayout } from './MainLayout';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('MainLayout', () => {
  it('should render children content', () => {
    renderWithTheme(
      <MainLayout>
        <div>Test Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should render sidebar', () => {
    renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    // Both mobile and desktop drawers render the logo
    const mcctlElements = screen.getAllByText('MCCTL');
    expect(mcctlElements.length).toBeGreaterThan(0);
  });

  it('should render header', () => {
    renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    expect(screen.getByLabelText('open sidebar')).toBeInTheDocument();
  });

  it('should apply correct layout structure', () => {
    renderWithTheme(
      <MainLayout>
        <div data-testid="main-content">Content</div>
      </MainLayout>
    );

    const mainContent = screen.getByTestId('main-content');
    expect(mainContent).toBeInTheDocument();
  });
});
