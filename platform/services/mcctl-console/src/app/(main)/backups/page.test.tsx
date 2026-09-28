import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/theme';
import BackupsPage from './page';

const navigation = vi.hoisted(() => ({
  push: vi.fn(),
  query: '',
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock('@/components/backups', () => ({
  BackupStatus: () => <div>Backup status component</div>,
  BackupHistory: () => <div>Backup history component</div>,
  BackupScheduleList: () => <div>Backup schedules component</div>,
  ConfigSnapshotTab: () => <div>Config snapshots component</div>,
  BackupPushButton: ({ disabled }: { disabled?: boolean }) => (
    <button type="button" disabled={disabled}>Create backup</button>
  ),
  BackupPageTabs: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: 'world-backups' | 'config-snapshots') => void;
  }) => (
    <div role="tablist" aria-label="Backup categories" data-value={value}>
      <button type="button" role="tab" onClick={() => onChange('world-backups')}>World backups</button>
      <button type="button" role="tab" onClick={() => onChange('config-snapshots')}>Config snapshots</button>
    </div>
  ),
}));

vi.mock('@/hooks/useMcctl', () => ({
  useBackupStatus: vi.fn(),
}));

import { useBackupStatus } from '@/hooks/useMcctl';

function renderPage() {
  return render(
    <ThemeProvider>
      <BackupsPage />
    </ThemeProvider>,
  );
}

describe('BackupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigation.query = '';
    vi.mocked(useBackupStatus).mockReturnValue({
      data: { configured: true },
      isLoading: false,
      error: null,
    } as never);
  });

  it('renders one backup hero with explicit configured status', () => {
    renderPage();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Backups' })).toBeInTheDocument();
    expect(screen.getByTestId('page-hero')).toBeInTheDocument();
    expect(screen.getByText('Configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create backup' })).toBeEnabled();
  });

  it('reports not configured and disables the backup action', () => {
    vi.mocked(useBackupStatus).mockReturnValue({
      data: { configured: false },
      isLoading: false,
      error: null,
    } as never);
    renderPage();

    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create backup' })).toBeDisabled();
  });

  it('preserves existing URL parameters when switching tabs', () => {
    navigation.query = 'filter=recent';
    renderPage();

    fireEvent.click(screen.getByRole('tab', { name: 'Config snapshots' }));
    expect(navigation.push).toHaveBeenCalledWith('/backups?filter=recent&tab=config-snapshots');
  });

  it('renders the URL-selected config snapshot panel', () => {
    navigation.query = 'tab=config-snapshots';
    renderPage();

    const content = screen.getByRole('region', { name: 'Backup content' });
    expect(content).toHaveTextContent('Config snapshots component');
    expect(content).not.toHaveTextContent('Backup status component');
    expect(screen.queryByRole('button', { name: 'Create backup' })).not.toBeInTheDocument();
  });

  it('keeps loading and partial status data safe', () => {
    vi.mocked(useBackupStatus).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);
    renderPage();

    expect(screen.getByText('Checking backup configuration')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create backup' })).toBeDisabled();
    expect(screen.getByRole('region', { name: 'Backup content' })).toBeInTheDocument();
  });

  it('keeps world backup features in one full-width active panel', () => {
    renderPage();

    const content = screen.getByRole('region', { name: 'Backup content' });
    expect(content).toHaveTextContent('Backup status component');
    expect(content).toHaveTextContent('Backup schedules component');
    expect(content).toHaveTextContent('Backup history component');
  });
});
