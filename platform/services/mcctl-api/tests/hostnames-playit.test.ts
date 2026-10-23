import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Real resolvePlayitDomain, mocked file I/O
vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(),
  getServerPlayitDomain: vi.fn(),
  AuditActionEnum: {},
}));

vi.mock('@minecraft-docker/mod-source-modrinth', () => ({}));

vi.mock('../src/services/audit-log-service.js', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const hostnameService = {
  composeExists: vi.fn(),
  getHostnames: vi.fn(),
  updateCustomHostnames: vi.fn(),
};
vi.mock('../src/services/HostnameService.js', () => ({
  createHostnameService: () => hostnameService,
}));

function hostData(custom: string[]) {
  return {
    serverName: 'factory',
    hostnames: ['factory.local', ...custom],
    systemHostnames: [{ hostname: 'factory.local', type: 'system', description: 'mDNS (Local Network)' }],
    customHostnames: custom,
  };
}

describe('PUT /api/servers/:name/hostnames - playit domain sync', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    const { serverExists } = await import('@minecraft-docker/shared');
    vi.mocked(serverExists).mockReturnValue(true);
    hostnameService.composeExists.mockReturnValue(true);
  });

  async function save(previous: string[], next: string[], current: string | null) {
    const { getServerPlayitDomain } = await import('@minecraft-docker/shared');
    vi.mocked(getServerPlayitDomain).mockReturnValue(current);
    hostnameService.getHostnames.mockReturnValue(hostData(previous));
    hostnameService.updateCustomHostnames.mockResolvedValue(hostData(next));
    return app.inject({
      method: 'PUT',
      url: '/api/servers/factory/hostnames',
      payload: { customHostnames: next },
    });
  }

  it('replaces PLAYIT_DOMAIN when the playit host is swapped for one new host', async () => {
    const res = await save(['old.gl.joinmc.link'], ['new.tun.ply.gg'], 'old.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    // custom hosts and PLAYIT_DOMAIN change together in server.yaml (#675)
    expect(hostnameService.updateCustomHostnames).toHaveBeenCalledWith('factory', ['new.tun.ply.gg'], 'new.tun.ply.gg');
    expect(res.json().playitDomain).toBe('new.tun.ply.gg');
  });

  it('clears PLAYIT_DOMAIN when the playit host is only removed', async () => {
    const res = await save(['old.gl.joinmc.link', 'mc.example.com'], ['mc.example.com'], 'old.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    expect(hostnameService.updateCustomHostnames).toHaveBeenCalledWith('factory', ['mc.example.com'], null);
    expect(res.json().playitDomain).toBeNull();
  });

  it('keeps a PLAYIT_DOMAIN that was never in the label when one host is added', async () => {
    const res = await save([], ['mc.example.com'], 'legacy.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    expect(hostnameService.updateCustomHostnames).toHaveBeenCalledWith('factory', ['mc.example.com'], 'legacy.gl.joinmc.link');
    expect(res.json().playitDomain).toBe('legacy.gl.joinmc.link');
  });

  it('leaves PLAYIT_DOMAIN untouched when the playit host is kept', async () => {
    const res = await save(['old.gl.joinmc.link'], ['old.gl.joinmc.link', 'mc.example.com'], 'old.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    expect(hostnameService.updateCustomHostnames).toHaveBeenCalledWith(
      'factory',
      ['old.gl.joinmc.link', 'mc.example.com'],
      'old.gl.joinmc.link'
    );
    expect(res.json().playitDomain).toBe('old.gl.joinmc.link');
  });

  it.each([
    ['invalid_spec', 400],
    ['locked', 409],
    ['compose_edited', 409],
  ] as const)('maps a refused ServerSpec write (%s) to %i (#675)', async (code, status) => {
    const { getServerPlayitDomain, ServerSpecError } = await import('@minecraft-docker/shared');
    vi.mocked(getServerPlayitDomain).mockReturnValue(null);
    hostnameService.getHostnames.mockReturnValue(hostData([]));
    hostnameService.updateCustomHostnames.mockRejectedValue(new ServerSpecError(code, `spec ${code}`, 'factory'));

    const res = await app.inject({
      method: 'PUT',
      url: '/api/servers/factory/hostnames',
      payload: { customHostnames: ['mc.example.com'] },
    });

    expect(res.statusCode).toBe(status);
    expect(res.json().message).toContain(`spec ${code}`);
  });
});
