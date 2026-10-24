import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { ServerSwitcher } from './ServerSwitcher';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@/hooks/useAppRouter', () => ({
  useAppRouter: () => ({ push }),
}));

vi.mock('@/hooks/useMcctl', () => ({
  useServers: vi.fn(),
}));

import { useServers } from '@/hooks/useMcctl';

const servers = [
  { name: 'alpha', container: 'mc-alpha', status: 'running', health: 'healthy', hostname: '' },
  { name: 'beta world', container: 'mc-beta', status: 'stopped', health: 'none', hostname: '' },
];

function renderSwitcher() {
  return render(
    <ThemeProvider>
      <ServerSwitcher currentServer="alpha" />
    </ThemeProvider>,
  );
}

describe('ServerSwitcher', () => {
  beforeEach(() => {
    push.mockClear();
    vi.mocked(useServers).mockReturnValue({
      data: { servers, total: 2 },
      isLoading: false,
    } as never);
  });

  it('lists servers with status and marks the current one', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Switch server' }));

    const current = screen.getByRole('menuitem', { name: /alpha/ });
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(current).toHaveTextContent('Running');
    expect(screen.getByRole('menuitem', { name: /beta world/ })).toHaveTextContent('Stopped');
  });

  it('navigates to the chosen server', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Switch server' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /beta world/ }));

    expect(push).toHaveBeenCalledWith('/servers/beta%20world');
  });

  it('does not navigate when choosing the current server', () => {
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Switch server' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /alpha/ }));

    expect(push).not.toHaveBeenCalled();
  });

  it('works from the keyboard', () => {
    renderSwitcher();

    const trigger = screen.getByRole('button', { name: 'Switch server' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });

    const menu = screen.getByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' });

    expect(push).toHaveBeenCalledWith('/servers/beta%20world');
  });

  it('shows a loading item while the list loads', () => {
    vi.mocked(useServers).mockReturnValue({ data: undefined, isLoading: true } as never);
    renderSwitcher();

    fireEvent.click(screen.getByRole('button', { name: 'Switch server' }));

    expect(screen.getByRole('menuitem', { name: /loading servers/i })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
