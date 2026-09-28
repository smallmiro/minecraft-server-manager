import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import ConsolePage from './page';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    use: () => ({ name: 'survival%20server' }),
  };
});

vi.mock('@/hooks/useAppRouter', () => ({
  useAppRouter: () => ({ push }),
}));

vi.mock('@/components/servers/ServerConsole', () => ({
  ServerConsole: ({
    onConnectionStateChange,
  }: {
    onConnectionStateChange?: (state: { isConnected: boolean; retryCount: number }) => void;
  }) => (
    <div data-testid="server-console" role="region" aria-label="Server terminal">
      Terminal content
      <button
        type="button"
        onClick={() => onConnectionStateChange?.({ isConnected: false, retryCount: 3 })}
      >
        Simulate retry
      </button>
    </div>
  ),
}));

function renderPage() {
  return render(
    <ThemeProvider>
      <ConsolePage params={Promise.resolve({ name: 'survival%20server' })} />
    </ThemeProvider>,
  );
}

describe('ConsolePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the decoded server name as the single page heading', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'survival server' })).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('keeps breadcrumbs and the back action reachable', () => {
    renderPage();

    const breadcrumbs = screen.getByRole('navigation', { name: 'breadcrumb' });
    expect(breadcrumbs).toHaveTextContent('Servers');
    expect(breadcrumbs).toHaveTextContent('survival server');
    expect(breadcrumbs).toHaveTextContent('Console');
    fireEvent.click(screen.getByRole('button', { name: 'Back to server' }));
    expect(push).toHaveBeenCalledWith('/servers/survival%20server');
  });

  it('reflects console connection updates in the hero', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Simulate retry' }));

    expect(screen.getByText('Disconnected (Retry 3)')).toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('places the dominant terminal panel after the hero', () => {
    renderPage();

    const hero = screen.getByTestId('page-hero');
    const terminal = screen.getByRole('region', { name: 'Server terminal' });
    expect(hero.compareDocumentPosition(terminal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(terminal).toBe(screen.getByTestId('server-console'));
  });
});
