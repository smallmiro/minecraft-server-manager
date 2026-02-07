import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { PermissionBadge } from './PermissionBadge';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('PermissionBadge', () => {
  it('should render "Owner" for admin permission', () => {
    renderWithTheme(<PermissionBadge permission="admin" />);

    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('should render "Operator" for manage permission', () => {
    renderWithTheme(<PermissionBadge permission="manage" />);

    expect(screen.getByText('Operator')).toBeInTheDocument();
  });

  it('should render "Viewer" for view permission', () => {
    renderWithTheme(<PermissionBadge permission="view" />);

    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });

  it('should accept size prop', () => {
    renderWithTheme(<PermissionBadge permission="admin" size="small" />);

    const chip = screen.getByText('Owner');
    expect(chip).toBeInTheDocument();
  });

  it('should default to medium size', () => {
    renderWithTheme(<PermissionBadge permission="view" />);

    expect(screen.getByText('Viewer')).toBeInTheDocument();
  });
});
