import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerAccessDialog } from './ServerAccessDialog';

// Mock hooks
const mockGrantMutate = vi.fn();
const mockGrantReset = vi.fn();

vi.mock('@/hooks/useUserServers', () => ({
  useSearchUsers: vi.fn(() => ({
    data: { users: [] },
    isLoading: false,
  })),
  useGrantAccess: vi.fn(() => ({
    mutate: mockGrantMutate,
    isPending: false,
    isError: false,
    error: null,
    reset: mockGrantReset,
  })),
}));

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ServerAccessDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    serverId: 'test-server',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render dialog when open', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    expect(screen.getByText('Add User Access')).toBeInTheDocument();
  });

  it('should not render dialog when closed', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} open={false} />);

    expect(screen.queryByText('Add User Access')).not.toBeInTheDocument();
  });

  it('should render user search input', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    expect(screen.getByLabelText(/search user/i)).toBeInTheDocument();
  });

  it('should render permission radio buttons', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    expect(screen.getByText('Permission Level')).toBeInTheDocument();
    expect(screen.getByText('Viewer')).toBeInTheDocument();
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
  });

  it('should have Viewer selected by default', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    const viewerRadio = screen.getByDisplayValue('view');
    expect(viewerRadio).toBeChecked();
  });

  it('should render Cancel and Add User buttons', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add user/i })).toBeInTheDocument();
  });

  it('should disable Add User button when no user selected', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    const addButton = screen.getByRole('button', { name: /add user/i });
    expect(addButton).toBeDisabled();
  });

  it('should call onClose when Cancel is clicked', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show permission descriptions', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    expect(screen.getByText(/Can view server status and logs/)).toBeInTheDocument();
    expect(screen.getByText(/Can start, stop, and configure/)).toBeInTheDocument();
    expect(screen.getByText(/Full control including managing/)).toBeInTheDocument();
  });

  it('should allow changing permission selection', () => {
    renderWithTheme(<ServerAccessDialog {...defaultProps} />);

    const adminRadio = screen.getByDisplayValue('admin');
    fireEvent.click(adminRadio);

    expect(adminRadio).toBeChecked();
  });
});
