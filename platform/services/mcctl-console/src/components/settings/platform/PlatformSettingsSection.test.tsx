import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import { PlatformSettingsSection } from './PlatformSettingsSection';
import * as hooks from '@/hooks/usePlatformSettings';
import type { PlatformSetting, PlatformSettingsResponse } from '@/types/platform-settings';

vi.mock('@/hooks/usePlatformSettings', async () => {
  class PlatformSettingsError extends Error {
    status: number;
    body: unknown;
    constructor(status: number, message: string, body: unknown) {
      super(message);
      this.status = status;
      this.body = body;
    }
  }
  return { usePlatformSettings: vi.fn(), useUpdatePlatformSettings: vi.fn(), PlatformSettingsError };
});

function setting(over: Partial<PlatformSetting>): PlatformSetting {
  return {
    key: 'X',
    label: 'X',
    description: '',
    group: 'Network & Routing',
    type: 'string',
    status: 'supported',
    source: 'platform-env',
    editable: true,
    secret: false,
    restartScope: 'none',
    ...over,
  };
}

const data: PlatformSettingsResponse = {
  revision: 'rev1',
  settings: [
    setting({ key: 'HOST_IP', label: 'Host IP', type: 'ipv4', value: '10.0.0.1', restartScope: 'next-create' }),
    setting({ key: 'RCON_PASSWORD', label: 'RCON Password', group: 'RCON', type: 'secret', secret: true, configured: true, restartScope: 'servers' }),
    setting({ key: 'BACKUP_GITHUB_TOKEN', label: 'GitHub Token', group: 'Backup', type: 'secret', secret: true, configured: false, restartScope: 'api' }),
    setting({ key: 'LOG_LEVEL', label: 'Log Level', group: 'Console & Logging', type: 'enum', choices: ['info', 'debug'], value: 'info', restartScope: 'api', applied: false }),
    setting({ key: 'MINECRAFT_NETWORK', label: 'Network', status: 'readonly', editable: false, value: 'mcnet' }),
    setting({ key: 'MY_VAR', label: 'MY_VAR', group: 'Advanced', status: 'unknown', source: 'unknown', value: 'abc' }),
    setting({ key: 'DEFAULT_MEMORY', label: 'DEFAULT_MEMORY', group: 'Legacy', status: 'legacy', source: 'legacy', value: '4G' }),
    setting({ key: 'BETTER_AUTH_SECRET', label: 'BETTER_AUTH_SECRET', group: 'Legacy', status: 'shadowed', source: 'shadowed', secret: true, type: 'secret', configured: true, differsFromEnv: true }),
  ],
  runtime: [
    { key: 'BETTER_AUTH_BASE_URL', source: 'pm2-ecosystem', value: 'http://localhost:5000' },
    { key: 'BETTER_AUTH_SECRET', source: 'pm2-ecosystem', configured: true },
  ],
};

const mutate = vi.fn();
const refetch = vi.fn();

function renderSection() {
  const onSuccess = vi.fn();
  const onError = vi.fn();
  render(<PlatformSettingsSection onSuccess={onSuccess} onError={onError} />);
  return { onSuccess, onError };
}

describe('PlatformSettingsSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hooks.usePlatformSettings).mockReturnValue({ data, isLoading: false, error: null, refetch } as never);
    vi.mocked(hooks.useUpdatePlatformSettings).mockReturnValue({ mutate, isPending: false } as never);
  });

  it('only enables the query for the admin section', () => {
    renderSection();
    expect(hooks.usePlatformSettings).toHaveBeenCalledWith({ enabled: true });
  });

  it('renders generic group cards from metadata', () => {
    renderSection();
    expect(screen.getByRole('region', { name: 'Network & Routing' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'RCON' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Backup' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Console & Logging' })).toBeInTheDocument();
    expect(screen.getByLabelText('Host IP')).toHaveValue('10.0.0.1');
  });

  it('runtime card explains ecosystem keys are read-only until mcctl upgrade', () => {
    renderSection();
    const runtime = screen.getByRole('region', { name: 'Runtime (PM2)' });
    expect(within(runtime).getByText(/mcctl upgrade/)).toBeInTheDocument();
    expect(within(runtime).queryByText(/takes precedence/)).not.toBeInTheDocument();
  });

  it('renders read-only keys and the runtime card as non-editable', () => {
    renderSection();
    expect(screen.getByLabelText('Network')).toBeDisabled();
    const runtime = screen.getByRole('region', { name: 'Runtime (PM2)' });
    expect(within(runtime).getByText('http://localhost:5000')).toBeInTheDocument();
    expect(within(runtime).queryAllByRole('textbox')).toHaveLength(0);
  });

  it('never pre-fills secrets and shows Configured / Not configured', () => {
    renderSection();
    const rcon = screen.getByLabelText('RCON Password');
    expect(rcon).toHaveValue('');
    expect(within(screen.getByRole('region', { name: 'RCON' })).getByText('Configured')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Backup' })).getByText('Not configured')).toBeInTheDocument();
  });

  it('shows the restart-pending chip from applied=false', () => {
    renderSection();
    expect(screen.getByText('Restart pending')).toBeInTheDocument();
  });

  it('has no save bar until something is dirty, then Discard resets', () => {
    renderSection();
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Host IP'), { target: { value: '10.0.0.2' } });
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument();
    expect(screen.getByText('1 unsaved change')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Host IP')).toHaveValue('10.0.0.1');
  });

  it('typing into a secret marks dirty and sends only changed keys', () => {
    renderSection();
    fireEvent.change(screen.getByLabelText('RCON Password'), { target: { value: 'newpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mutate).toHaveBeenCalledWith(
      { revision: 'rev1', set: { RCON_PASSWORD: 'newpass' }, remove: [] },
      expect.any(Object)
    );
  });

  it('opens the restart dialog with scope guidance after save', () => {
    const { onSuccess } = renderSection();
    fireEvent.change(screen.getByLabelText('Host IP'), { target: { value: '10.0.0.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const callbacks = mutate.mock.calls[0][1];
    act(() => callbacks.onSuccess({ revision: 'rev2', changedKeys: ['HOST_IP'], removedKeys: [], restartScopes: ['next-create', 'servers', 'console'] }));

    expect(onSuccess).toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Restart required' });
    expect(within(dialog).getByText(/Restart does not reload \.env/)).toBeInTheDocument();
    expect(within(dialog).getByText(/Existing server hostnames are unchanged/)).toBeInTheDocument();
    expect(within(dialog).getByText('mcctl console service restart --console')).toBeInTheDocument();
  });

  it('maps 400 field errors onto fields', () => {
    const { onError } = renderSection();
    fireEvent.change(screen.getByLabelText('Host IP'), { target: { value: 'nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    const err = new hooks.PlatformSettingsError(400, 'invalid', {
      errors: [{ key: 'HOST_IP', message: 'Invalid IPv4 address' }],
    });
    // act via callback
    act(() => mutate.mock.calls[0][1].onError(err));

    expect(onError).toHaveBeenCalled();
    expect(screen.getAllByText('Invalid IPv4 address').length).toBeGreaterThan(0);
  });

  it('opens the reload dialog on 409 and never overwrites', () => {
    renderSection();
    fireEvent.change(screen.getByLabelText('Host IP'), { target: { value: '10.0.0.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    act(() =>
      mutate.mock.calls[0][1].onError(
        new hooks.PlatformSettingsError(409, 'stale', { currentRevision: 'rev9' })
      )
    );

    const dialog = screen.getByRole('dialog', { name: 'Settings changed elsewhere' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reload' }));
    expect(refetch).toHaveBeenCalled();
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('keeps edits on 409 "Keep editing" and refetches so the next save uses the new revision', () => {
    renderSection();
    fireEvent.change(screen.getByLabelText('Host IP'), { target: { value: '10.0.0.2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    act(() =>
      mutate.mock.calls[0][1].onError(
        new hooks.PlatformSettingsError(409, 'stale', { currentRevision: 'rev9' })
      )
    );

    const dialog = screen.getByRole('dialog', { name: 'Settings changed elsewhere' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));

    expect(refetch).toHaveBeenCalled();
    expect(screen.getByLabelText('Host IP')).toHaveValue('10.0.0.2');
  });

  it('removes a legacy key explicitly', () => {
    renderSection();
    const legacy = screen.getByRole('region', { name: 'Legacy / Unused' });
    expect(within(legacy).getByText('Overridden by ecosystem.config.cjs; not applied')).toBeInTheDocument();
    expect(within(legacy).getByText('differs')).toBeInTheDocument();

    fireEvent.click(within(legacy).getByRole('button', { name: 'Remove DEFAULT_MEMORY' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mutate).toHaveBeenCalledWith(
      { revision: 'rev1', set: {}, remove: ['DEFAULT_MEMORY'] },
      expect.any(Object)
    );
  });

  it('adds, validates and removes advanced keys', () => {
    renderSection();
    const adv = screen.getByRole('region', { name: 'Advanced Environment' });
    expect(within(adv).getByText(/listed in servers\/global\.env/)).toBeInTheDocument();

    fireEvent.change(within(adv).getByLabelText('New key'), { target: { value: '1bad' } });
    fireEvent.click(within(adv).getByRole('button', { name: 'Add' }));
    expect(within(adv).getByText(/Invalid key name/)).toBeInTheDocument();

    fireEvent.change(within(adv).getByLabelText('New key'), { target: { value: 'NEW_KEY' } });
    fireEvent.change(within(adv).getByLabelText('New value'), { target: { value: 'v' } });
    fireEvent.click(within(adv).getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(mutate).toHaveBeenCalledWith(
      { revision: 'rev1', set: { NEW_KEY: 'v' }, remove: [] },
      expect.any(Object)
    );
  });

  it('shows the API error (e.g. platform not initialized)', () => {
    vi.mocked(hooks.usePlatformSettings).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Platform not initialized (run mcctl init)'),
      refetch,
    } as never);
    renderSection();
    expect(screen.getByRole('alert')).toHaveTextContent('Platform not initialized');
  });
});
