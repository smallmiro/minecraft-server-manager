import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import { RouterMetricCard } from './RouterMetricCard';

const routerQuery = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('@/hooks/useMcctl', () => ({
  useRouterStatus: () => routerQuery.current,
}));

const route = (hostname: string) => ({
  hostname,
  target: `mc-${hostname}:25565`,
  serverStatus: 'running',
});

function mockRouter(
  router: Partial<{ status: string; health: string; port: number; routes: unknown[] }>
) {
  routerQuery.current = {
    data: {
      router: {
        name: 'mc-router',
        status: 'running',
        health: 'healthy',
        port: 25565,
        routes: [route('a'), route('b'), route('c')],
        ...router,
      },
    },
    isLoading: false,
    error: null,
  };
}

function renderCard() {
  render(
    <ThemeProvider>
      <RouterMetricCard />
    </ThemeProvider>
  );
  return screen.getByRole('article', { name: 'mc-router' });
}

const accentOf = (card: HTMLElement) => card.getAttribute('data-accent');

describe('RouterMetricCard', () => {
  beforeEach(() => {
    mockRouter({});
  });

  it('shows a loading state', () => {
    routerQuery.current = { data: undefined, isLoading: true, error: null };

    const card = renderCard();

    expect(card).toHaveAttribute('aria-busy', 'true');
    expect(card.querySelectorAll('.MuiSkeleton-root').length).toBeGreaterThan(0);
  });

  it('shows port, status, health and route count with a success accent when healthy', () => {
    const card = renderCard();

    expect(card).toHaveTextContent(':25565');
    expect(card).toHaveTextContent('running');
    expect(card).toHaveTextContent('healthy');
    expect(card).toHaveTextContent('3 routes');
    expect(accentOf(card)).toBe('success');
  });

  it('is still success when running without a health check', () => {
    mockRouter({ health: 'none' });

    const card = renderCard();

    expect(accentOf(card)).toBe('success');
    expect(card).not.toHaveTextContent('none');
  });

  it('uses the singular for one route', () => {
    mockRouter({ routes: [route('a')] });

    expect(renderCard()).toHaveTextContent('1 route');
    expect(screen.queryByText(/1 routes/)).not.toBeInTheDocument();
  });

  it.each([
    ['running', 'starting'],
    ['restarting', 'none'],
    ['created', 'none'],
    ['paused', 'none'],
  ])('uses a warning accent while %s / %s', (status, health) => {
    mockRouter({ status, health });

    expect(accentOf(renderCard())).toBe('warning');
  });

  it.each(['exited', 'dead', 'not_found', 'not_created'])(
    'uses an error accent when the router is %s',
    (status) => {
      mockRouter({ status, health: 'none' });

      expect(accentOf(renderCard())).toBe('error');
    }
  );

  it('uses an error accent when running but unhealthy', () => {
    mockRouter({ health: 'unhealthy' });

    const card = renderCard();

    expect(accentOf(card)).toBe('error');
    expect(card).toHaveTextContent('unhealthy');
  });

  it('uses an error accent and an unavailable message when the query fails', () => {
    routerQuery.current = { data: undefined, isLoading: false, error: new Error('boom') };

    const card = renderCard();

    expect(accentOf(card)).toBe('error');
    expect(card).toHaveTextContent('Router status unavailable');
    expect(card).not.toHaveTextContent(':');
  });

  it('keeps showing the last known status when a background refetch fails', () => {
    mockRouter({});
    routerQuery.current = { ...routerQuery.current, error: new Error('refetch failed') };

    const card = renderCard();

    expect(card).toHaveTextContent(':25565');
    expect(card).not.toHaveTextContent('Router status unavailable');
    expect(accentOf(card)).toBe('success');
  });
});
