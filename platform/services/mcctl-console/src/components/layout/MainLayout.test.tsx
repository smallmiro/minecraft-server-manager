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

// Mock UserMenu component
vi.mock('@/components/auth', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

// Collects the emotion CSS rule bodies that apply to the given element by
// matching its `css-*` classes against the injected <style> tags.
const emotionStylesFor = (el: Element): string => {
  const styleText = Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  return Array.from(el.classList)
    .filter((c) => c.startsWith('css-'))
    .map((c) => {
      const re = new RegExp(`\\.${c}\\s*\\{([^}]*)\\}`, 'g');
      let match: RegExpExecArray | null;
      let body = '';
      while ((match = re.exec(styleText)) !== null) {
        body += match[1];
      }
      return body;
    })
    .join('\n');
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

  it('should render GNB with logo', () => {
    renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    // Both AppBar and mobile drawer render the logo
    const logoElements = screen.getAllByText('Minecraft Console');
    expect(logoElements.length).toBeGreaterThan(0);
  });

  it('should render GNB with mobile menu button', () => {
    renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    expect(screen.getByLabelText('open menu')).toBeInTheDocument();
  });

  it('should render Footer', () => {
    renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.getByText('Documentation')).toBeInTheDocument();
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

  it('should pad the main content below the safe-area inset so it is not clipped by the AppBar', () => {
    // The AppBar grows by env(safe-area-inset-top) in PWA standalone mode, so
    // the main content's top padding must add the same inset to avoid being
    // hidden under the AppBar (#480).
    const { container } = renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    const main = container.querySelector('main');
    expect(main).not.toBeNull();
    expect(emotionStylesFor(main as Element)).toContain('env(safe-area-inset-top)');
  });

  it('should render navigation links in GNB', () => {
    renderWithTheme(
      <MainLayout>
        <div>Content</div>
      </MainLayout>
    );

    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Servers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Players').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Routing').length).toBeGreaterThan(0);
  });
});
