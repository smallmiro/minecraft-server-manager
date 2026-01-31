import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { Header } from './Header';

// Mock UserMenu component
vi.mock('@/components/auth', () => ({
  UserMenu: () => <div data-testid="user-menu">UserMenu</div>,
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('Header', () => {
  it('should render header with title', () => {
    renderWithTheme(
      <Header title="Dashboard" onMenuClick={vi.fn()} />
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('should render menu button for mobile', () => {
    renderWithTheme(
      <Header title="Dashboard" onMenuClick={vi.fn()} />
    );

    expect(screen.getByLabelText('open sidebar')).toBeInTheDocument();
  });

  it('should call onMenuClick when menu button is clicked', () => {
    const onMenuClick = vi.fn();
    renderWithTheme(
      <Header title="Dashboard" onMenuClick={onMenuClick} />
    );

    const menuButton = screen.getByLabelText('open sidebar');
    fireEvent.click(menuButton);

    expect(onMenuClick).toHaveBeenCalledTimes(1);
  });

  it('should render UserMenu component', () => {
    renderWithTheme(
      <Header title="Dashboard" onMenuClick={vi.fn()} />
    );

    expect(screen.getByTestId('user-menu')).toBeInTheDocument();
  });
});
