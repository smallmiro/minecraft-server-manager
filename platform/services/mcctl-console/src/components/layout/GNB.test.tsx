import { describe, it, expect, vi } from 'vitest';
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

// Mock UserMenu component
vi.mock('@/components/auth', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('GNB', () => {
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
