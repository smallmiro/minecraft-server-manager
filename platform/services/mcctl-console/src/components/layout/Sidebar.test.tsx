import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { Sidebar } from './Sidebar';

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

describe('Sidebar', () => {
  it('should render sidebar with navigation items', () => {
    renderWithTheme(<Sidebar open={true} onClose={vi.fn()} />);

    // Both mobile and desktop drawers are rendered
    const dashboardItems = screen.getAllByText('Dashboard');
    const serversItems = screen.getAllByText('Servers');
    const playersItems = screen.getAllByText('Players');
    const settingsItems = screen.getAllByText('Settings');

    expect(dashboardItems.length).toBeGreaterThan(0);
    expect(serversItems.length).toBeGreaterThan(0);
    expect(playersItems.length).toBeGreaterThan(0);
    expect(settingsItems.length).toBeGreaterThan(0);
  });

  it('should render logo/brand', () => {
    renderWithTheme(<Sidebar open={true} onClose={vi.fn()} />);

    // Both mobile and desktop drawers render the logo
    const mcctlElements = screen.getAllByText('MCCTL');
    expect(mcctlElements.length).toBeGreaterThan(0);
  });

  it('should call onClose when close button is clicked on mobile', () => {
    const onClose = vi.fn();
    renderWithTheme(<Sidebar open={true} onClose={onClose} />);

    // Both mobile and desktop drawers have close buttons
    const closeButtons = screen.getAllByLabelText('close sidebar');
    fireEvent.click(closeButtons[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should highlight active navigation item', () => {
    renderWithTheme(<Sidebar open={true} onClose={vi.fn()} />);

    const dashboardItems = screen.getAllByRole('link', { name: /dashboard/i });
    // At least one should have aria-current
    const activeItem = dashboardItems.find(item => item.getAttribute('aria-current') === 'page');
    expect(activeItem).toBeTruthy();
  });

  it('should render navigation links with correct hrefs', () => {
    renderWithTheme(<Sidebar open={true} onClose={vi.fn()} />);

    const dashboardLinks = screen.getAllByRole('link', { name: /dashboard/i });
    const serversLinks = screen.getAllByRole('link', { name: /servers/i });
    const playersLinks = screen.getAllByRole('link', { name: /players/i });
    const settingsLinks = screen.getAllByRole('link', { name: /settings/i });

    expect(dashboardLinks[0]).toHaveAttribute('href', '/');
    expect(serversLinks[0]).toHaveAttribute('href', '/servers');
    expect(playersLinks[0]).toHaveAttribute('href', '/players');
    expect(settingsLinks[0]).toHaveAttribute('href', '/settings');
  });
});
