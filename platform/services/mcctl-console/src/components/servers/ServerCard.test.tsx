import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerCard } from './ServerCard';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockServer: ServerSummary = {
  name: 'test-server',
  container: 'mc-test-server',
  status: 'running',
  health: 'healthy',
  hostname: 'test-server.local',
};

describe('ServerCard', () => {
  it('should render server name', () => {
    renderWithTheme(<ServerCard server={mockServer} />);
    expect(screen.getByText('test-server')).toBeInTheDocument();
  });

  it('should render server hostname', () => {
    renderWithTheme(<ServerCard server={mockServer} />);
    expect(screen.getByText('test-server.local')).toBeInTheDocument();
  });

  it('should display running status with green badge', () => {
    renderWithTheme(<ServerCard server={mockServer} />);
    const statusBadge = screen.getByText('running');
    expect(statusBadge).toBeInTheDocument();
  });

  it('should display stopped status with red badge', () => {
    const stoppedServer = { ...mockServer, status: 'stopped' as const };
    renderWithTheme(<ServerCard server={stoppedServer} />);
    const statusBadge = screen.getByText('stopped');
    expect(statusBadge).toBeInTheDocument();
  });

  it('should display healthy status', () => {
    renderWithTheme(<ServerCard server={mockServer} />);
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const onClick = vi.fn();
    renderWithTheme(<ServerCard server={mockServer} onClick={onClick} />);

    const card = screen.getByRole('article');
    fireEvent.click(card);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick).toHaveBeenCalledWith(mockServer.name);
  });

  it('should call onStart when start button is clicked', () => {
    const onStart = vi.fn();
    const stoppedServer = { ...mockServer, status: 'stopped' as const };
    renderWithTheme(<ServerCard server={stoppedServer} onStart={onStart} />);

    const startButton = screen.getByLabelText('Start server');
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith(mockServer.name);
  });

  it('should call onStop when stop button is clicked', () => {
    const onStop = vi.fn();
    renderWithTheme(<ServerCard server={mockServer} onStop={onStop} />);

    const stopButton = screen.getByLabelText('Stop server');
    fireEvent.click(stopButton);

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledWith(mockServer.name);
  });

  it('should show start button when server is stopped', () => {
    const stoppedServer = { ...mockServer, status: 'stopped' as const };
    renderWithTheme(<ServerCard server={stoppedServer} onStart={vi.fn()} />);

    expect(screen.getByLabelText('Start server')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop server')).not.toBeInTheDocument();
  });

  it('should show stop button when server is running', () => {
    renderWithTheme(<ServerCard server={mockServer} onStop={vi.fn()} />);

    expect(screen.getByLabelText('Stop server')).toBeInTheDocument();
    expect(screen.queryByLabelText('Start server')).not.toBeInTheDocument();
  });

  it('should prevent onClick when action button is clicked', () => {
    const onClick = vi.fn();
    const onStop = vi.fn();
    renderWithTheme(<ServerCard server={mockServer} onClick={onClick} onStop={onStop} />);

    const stopButton = screen.getByLabelText('Stop server');
    fireEvent.click(stopButton);

    // onClick should not be called when action button is clicked
    expect(onClick).not.toHaveBeenCalled();
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('should disable action buttons when loading', () => {
    renderWithTheme(
      <ServerCard server={mockServer} onStop={vi.fn()} loading={true} />
    );

    const stopButton = screen.getByLabelText('Stop server');
    expect(stopButton).toBeDisabled();
  });
});
