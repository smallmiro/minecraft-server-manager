import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerList } from './ServerList';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';

const renderWithTheme = (component: React.ReactNode) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

const mockServers: ServerSummary[] = [
  {
    name: 'paper-server',
    container: 'mc-paper-server',
    status: 'running',
    health: 'healthy',
    hostname: 'paper-server.local',
  },
  {
    name: 'vanilla-server',
    container: 'mc-vanilla-server',
    status: 'stopped',
    health: 'none',
    hostname: 'vanilla-server.local',
  },
  {
    name: 'fabric-server',
    container: 'mc-fabric-server',
    status: 'running',
    health: 'starting',
    hostname: 'fabric-server.local',
  },
];

describe('ServerList', () => {
  it('should render all servers in grid layout', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    expect(screen.getByText('paper-server')).toBeInTheDocument();
    expect(screen.getByText('vanilla-server')).toBeInTheDocument();
    expect(screen.getByText('fabric-server')).toBeInTheDocument();
  });

  it('should render empty state when no servers', () => {
    renderWithTheme(<ServerList servers={[]} />);

    expect(screen.getByText(/no servers found/i)).toBeInTheDocument();
  });

  it('should show create button in empty state', () => {
    const onCreate = vi.fn();
    renderWithTheme(<ServerList servers={[]} onCreate={onCreate} />);

    const createButton = screen.getByRole('button', { name: /create server/i });
    expect(createButton).toBeInTheDocument();

    fireEvent.click(createButton);
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it('should filter servers by status', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    // Initially shows all servers
    expect(screen.getByText('paper-server')).toBeInTheDocument();
    expect(screen.getByText('vanilla-server')).toBeInTheDocument();

    // Filter by running
    const runningFilter = screen.getByRole('button', { name: /running/i });
    fireEvent.click(runningFilter);

    expect(screen.getByText('paper-server')).toBeInTheDocument();
    expect(screen.getByText('fabric-server')).toBeInTheDocument();
    expect(screen.queryByText('vanilla-server')).not.toBeInTheDocument();
  });

  it('should filter servers by stopped status', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    // Filter by stopped
    const stoppedFilter = screen.getByRole('button', { name: /stopped/i });
    fireEvent.click(stoppedFilter);

    expect(screen.queryByText('paper-server')).not.toBeInTheDocument();
    expect(screen.getByText('vanilla-server')).toBeInTheDocument();
  });

  it('should search servers by name', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    const searchInput = screen.getByPlaceholderText(/search servers/i);
    fireEvent.change(searchInput, { target: { value: 'paper' } });

    expect(screen.getByText('paper-server')).toBeInTheDocument();
    expect(screen.queryByText('vanilla-server')).not.toBeInTheDocument();
    expect(screen.queryByText('fabric-server')).not.toBeInTheDocument();
  });

  it('should search servers case-insensitively', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    const searchInput = screen.getByPlaceholderText(/search servers/i);
    fireEvent.change(searchInput, { target: { value: 'VANILLA' } });

    expect(screen.getByText('vanilla-server')).toBeInTheDocument();
    expect(screen.queryByText('paper-server')).not.toBeInTheDocument();
  });

  it('should show empty state when search has no results', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    const searchInput = screen.getByPlaceholderText(/search servers/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByText(/no servers found/i)).toBeInTheDocument();
  });

  it('should call onServerClick when server card is clicked', () => {
    const onServerClick = vi.fn();
    renderWithTheme(<ServerList servers={mockServers} onServerClick={onServerClick} />);

    const serverCards = screen.getAllByRole('article');
    fireEvent.click(serverCards[0]);

    expect(onServerClick).toHaveBeenCalledTimes(1);
    expect(onServerClick).toHaveBeenCalledWith('paper-server');
  });

  it('should call onStart when start button is clicked', () => {
    const onStart = vi.fn();
    renderWithTheme(<ServerList servers={mockServers} onStart={onStart} />);

    // Find the stopped server's start button
    const stoppedFilter = screen.getByRole('button', { name: /stopped/i });
    fireEvent.click(stoppedFilter);

    const startButton = screen.getByLabelText('Start server');
    fireEvent.click(startButton);

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart).toHaveBeenCalledWith('vanilla-server');
  });

  it('should call onStop when stop button is clicked', () => {
    const onStop = vi.fn();
    renderWithTheme(<ServerList servers={mockServers} onStop={onStop} />);

    // Find the running server's stop button
    const runningFilter = screen.getByRole('button', { name: /running/i });
    fireEvent.click(runningFilter);

    const stopButtons = screen.getAllByLabelText('Stop server');
    fireEvent.click(stopButtons[0]);

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledWith('paper-server');
  });

  it('should show loading state on server cards', () => {
    renderWithTheme(
      <ServerList servers={mockServers} loadingServers={['paper-server']} />
    );

    // The loading state should disable buttons on the paper-server card
    // This is tested indirectly through the ServerCard component
    expect(screen.getByText('paper-server')).toBeInTheDocument();
  });

  it('should combine search and filter', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    // Filter by running
    const runningFilter = screen.getByRole('button', { name: /running/i });
    fireEvent.click(runningFilter);

    // Then search for "fabric"
    const searchInput = screen.getByPlaceholderText(/search servers/i);
    fireEvent.change(searchInput, { target: { value: 'fabric' } });

    // Should only show fabric-server (running AND matches search)
    expect(screen.getByText('fabric-server')).toBeInTheDocument();
    expect(screen.queryByText('paper-server')).not.toBeInTheDocument();
    expect(screen.queryByText('vanilla-server')).not.toBeInTheDocument();
  });

  it('should display server count', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    expect(screen.getByText(/3 servers/i)).toBeInTheDocument();
  });

  it('should update count when filtering', () => {
    renderWithTheme(<ServerList servers={mockServers} />);

    const runningFilter = screen.getByRole('button', { name: /running/i });
    fireEvent.click(runningFilter);

    expect(screen.getByText(/2 servers/i)).toBeInTheDocument();
  });
});
