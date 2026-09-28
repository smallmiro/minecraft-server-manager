import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuditLogPage from './page';

const navigation = vi.hoisted(() => ({
  query: '',
  replace: vi.fn(),
}));

const hookState = vi.hoisted(() => ({
  logs: {
    data: { logs: [] as any[], total: 0 },
    isLoading: false,
    error: null as Error | null,
    refetch: vi.fn(),
  },
  stats: {
    data: undefined as unknown,
    isLoading: false,
  },
  connected: true,
  sseOptions: undefined as { onMessage: (event: unknown) => void } | undefined,
}));

const captures = vi.hoisted(() => ({
  stats: undefined as any,
  filters: undefined as any,
  table: undefined as any,
  detail: undefined as any,
  auditExport: undefined as any,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: navigation.replace }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock('@/hooks/useAuditLogs', () => ({
  useAuditLogs: () => hookState.logs,
  useAuditLogStats: () => hookState.stats,
}));

vi.mock('@/hooks/useSSE', () => ({
  useSSE: (options: { onMessage: (event: unknown) => void }) => {
    hookState.sseOptions = options;
    return { isConnected: hookState.connected };
  },
}));

vi.mock('@/components/audit-logs', () => ({
  AuditLogStats: (props: any) => {
    captures.stats = props;
    return <div data-testid="audit-stats">Stats</div>;
  },
  AuditLogFilters: (props: any) => {
    captures.filters = props;
    return (
      <div data-testid="audit-filters">
        <button onClick={props.onExport}>Export</button>
        <button onClick={() => props.onFiltersChange({ ...props.filters, status: 'failure' })}>
          Apply failure filter
        </button>
      </div>
    );
  },
  AuditLogTable: (props: any) => {
    captures.table = props;
    return (
      <div data-testid="audit-table">
        {props.isLoading ? 'Loading logs' : props.error ? `Error: ${props.error.message}` : props.logs.length ? 'Log rows' : 'No logs'}
      </div>
    );
  },
  AuditLogDetail: (props: any) => {
    captures.detail = props;
    return <div data-testid="audit-detail" data-open={String(props.open)} />;
  },
  AuditLogExport: (props: any) => {
    captures.auditExport = props;
    return <div data-testid="audit-export" data-open={String(props.open)} />;
  },
}));

const sampleLog = {
  id: 'log-1',
  action: 'server.start' as const,
  actor: 'alex',
  targetType: 'server',
  targetName: 'survival',
  details: null,
  status: 'success' as const,
  errorMessage: null,
  timestamp: '2026-09-28T00:00:00.000Z',
};

const sampleStats = {
  total: 12,
  byAction: { 'server.start': 12 },
  byStatus: { success: 11, failure: 1 },
  byActor: { alex: 12 },
  recentActivity: [sampleLog],
  oldestEntry: sampleLog.timestamp,
  newestEntry: sampleLog.timestamp,
};

describe('AuditLogPage', () => {
  beforeEach(() => {
    navigation.query = '';
    navigation.replace.mockReset();
    hookState.logs = {
      data: { logs: [sampleLog], total: 12 },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    };
    hookState.stats = { data: sampleStats, isLoading: false };
    hookState.connected = true;
    hookState.sseOptions = undefined;
    Object.assign(captures, {
      stats: undefined,
      filters: undefined,
      table: undefined,
      detail: undefined,
      auditExport: undefined,
    });
  });

  it('renders one compact hero and passes current stats through unchanged', () => {
    render(<AuditLogPage />);

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByTestId('page-hero')).toHaveAttribute('data-compact', 'true');
    expect(screen.getByLabelText('Audit stream status')).toHaveTextContent('Live');
    expect(captures.stats.stats).toBe(sampleStats);
    expect(captures.stats.isLoading).toBe(false);
  });

  it('shows Disconnected instead of Live when SSE is not connected', () => {
    hookState.connected = false;
    render(<AuditLogPage />);

    expect(screen.getByLabelText('Audit stream status')).toHaveTextContent('Disconnected');
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('places controls before the full-width results region', () => {
    render(<AuditLogPage />);

    const controls = screen.getByRole('region', { name: 'Audit log controls' });
    const results = screen.getByRole('region', { name: 'Audit log results' });
    expect(controls.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(controls).toContainElement(screen.getByTestId('audit-filters'));
    expect(results).toContainElement(screen.getByTestId('audit-table'));
  });

  it('preserves current query parameters when filters change', async () => {
    navigation.query = 'actor=alex&status=success&limit=25&offset=50&sort=timestamp%3Aasc';
    render(<AuditLogPage />);

    expect(captures.filters.filters).toEqual({
      actor: 'alex',
      status: 'success',
      limit: 25,
      offset: 50,
      sort: 'timestamp:asc',
    });
    expect(navigation.replace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Apply failure filter' }));

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        '/audit-logs?actor=alex&status=failure&limit=25&offset=50&sort=timestamp%3Aasc',
        { scroll: false }
      );
    });
  });

  it('opens the export dialog from the filter action', () => {
    render(<AuditLogPage />);

    expect(screen.getByTestId('audit-export')).toHaveAttribute('data-open', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByTestId('audit-export')).toHaveAttribute('data-open', 'true');
    expect(captures.auditExport.totalCount).toBe(12);
  });

  it('refreshes new SSE logs and clears the notice', () => {
    render(<AuditLogPage />);

    act(() => {
      hookState.sseOptions?.onMessage({ type: 'audit-log', data: { ...sampleLog, id: 'new-log' } });
    });

    const refresh = screen.getByRole('button', { name: '1 new logs, click to refresh' });
    fireEvent.click(refresh);
    expect(hookState.logs.refetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '1 new logs, click to refresh' })).not.toBeInTheDocument();
  });

  it('disables the live pulse for reduced-motion users', () => {
    render(<AuditLogPage />);

    const icon = screen.getByLabelText('Audit stream status').querySelector('svg');
    const generatedClass = Array.from(icon?.classList ?? []).find((name) => name.startsWith('css-'));
    const reducedMotionDisablesIcon = Array.from(document.styleSheets).some((sheet) =>
      Array.from(sheet.cssRules ?? []).some((rule) => {
        if (!(rule instanceof CSSMediaRule) || !rule.conditionText.includes('prefers-reduced-motion')) {
          return false;
        }
        return Array.from(rule.cssRules).some((nestedRule) =>
          nestedRule.cssText.includes(`.${generatedClass}`) && /animation:\s*none/.test(nestedRule.cssText),
        );
      }),
    );

    expect(generatedClass).toBeDefined();
    expect(reducedMotionDisablesIcon).toBe(true);
  });

  it.each([
    ['loading', true, null, [], 'Loading logs'],
    ['empty', false, null, [], 'No logs'],
    ['error', false, new Error('audit unavailable'), [], 'Error: audit unavailable'],
  ])('passes the %s state to the table', (_name, isLoading, error, logs, expected) => {
    hookState.logs = {
      data: { logs, total: 0 },
      isLoading,
      error,
      refetch: vi.fn(),
    };

    render(<AuditLogPage />);

    expect(screen.getByTestId('audit-table')).toHaveTextContent(expected);
    expect(captures.table.isLoading).toBe(isLoading);
    expect(captures.table.error).toBe(error);
  });
});
