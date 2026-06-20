import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { GNB } from './GNB';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

// Mock auth-client for session management
let mockSession: any = null;
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({
    data: mockSession,
    isPending: false,
  }),
  signOut: vi.fn(),
}));

// Mock UserMenu component
vi.mock('@/components/auth', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

// Collects the emotion CSS rule bodies that apply to the given element by
// matching its `css-*` classes against the injected <style> tags. Used to
// assert on generated styles (e.g. safe-area insets) that jsdom's
// getComputedStyle cannot resolve from class-based stylesheets.
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

describe('GNB', () => {
  beforeEach(() => {
    // Reset session before each test
    mockSession = null;
  });

  it('should render logo/brand', () => {
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={vi.fn()} />);

    // Both AppBar and mobile drawer render the logo
    const logoElements = screen.getAllByText('Minecraft Console');
    expect(logoElements.length).toBeGreaterThan(0);
  });

  it('should render navigation items in desktop view', () => {
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={vi.fn()} />);

    // Desktop navigation renders these items
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Servers').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Players').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Routing').length).toBeGreaterThan(0);
  });

  it('should render mobile menu button', () => {
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={vi.fn()} />);

    expect(screen.getByLabelText('open menu')).toBeInTheDocument();
  });

  it('should call onMenuToggle when mobile menu button is clicked', () => {
    const onMenuToggle = vi.fn();
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={onMenuToggle} />);

    const menuButton = screen.getByLabelText('open menu');
    fireEvent.click(menuButton);

    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('should render UserMenu component', () => {
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={vi.fn()} />);

    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });

  it('should render close button in mobile drawer when open', () => {
    renderWithTheme(<GNB mobileOpen={true} onMenuToggle={vi.fn()} />);

    expect(screen.getByLabelText('close menu')).toBeInTheDocument();
  });

  it('should call onMenuToggle when close button is clicked', () => {
    const onMenuToggle = vi.fn();
    renderWithTheme(<GNB mobileOpen={true} onMenuToggle={onMenuToggle} />);

    const closeButton = screen.getByLabelText('close menu');
    fireEvent.click(closeButton);

    expect(onMenuToggle).toHaveBeenCalledTimes(1);
  });

  it('should not keep the mobile drawer mounted in the DOM when closed', () => {
    // The mobile drawer is a temporary MUI Drawer (Modal + Backdrop). With
    // `keepMounted`, the closed drawer and its full-screen backdrop stay in the
    // DOM; on mobile an interrupted close transition leaves that layer over the
    // page, intercepting taps (#476). The "close menu" button lives only inside
    // the mobile drawer, so its absence proves the closed drawer unmounts.
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={vi.fn()} />);

    expect(screen.queryByLabelText('close menu')).not.toBeInTheDocument();
  });

  it('should offset the AppBar below the device safe-area inset (PWA standalone notch)', () => {
    // In PWA standalone mode the manifest uses viewport-fit=cover, so content
    // extends under the status bar / notch. Without a safe-area top offset the
    // fixed AppBar overlaps the status bar and the hamburger button becomes
    // untappable (#480). The AppBar must reserve env(safe-area-inset-top).
    const { container } = renderWithTheme(
      <GNB mobileOpen={false} onMenuToggle={vi.fn()} />
    );

    const appBar = container.querySelector('.MuiAppBar-root');
    expect(appBar).not.toBeNull();
    expect(emotionStylesFor(appBar as Element)).toContain('env(safe-area-inset-top)');
  });

  it('should render navigation links with correct hrefs', () => {
    renderWithTheme(<GNB mobileOpen={false} onMenuToggle={vi.fn()} />);

    const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i });
    const serversLinks = screen.getAllByRole('link', { name: /servers/i });
    const playersLinks = screen.getAllByRole('link', { name: /players/i });
    const routingLinks = screen.getAllByRole('link', { name: /routing/i });

    expect(dashboardLinks[0]).toHaveAttribute('href', '/dashboard');
    expect(serversLinks[0]).toHaveAttribute('href', '/servers');
    expect(playersLinks[0]).toHaveAttribute('href', '/players');
    expect(routingLinks[0]).toHaveAttribute('href', '/routing');
  });

});
