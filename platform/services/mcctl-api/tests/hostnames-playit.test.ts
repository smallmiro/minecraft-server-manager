import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

// Real resolvePlayitDomain, mocked file I/O
vi.mock('@minecraft-docker/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@minecraft-docker/shared')>()),
  serverExists: vi.fn(),
  getServerPlayitDomain: vi.fn(),
  setServerPlayitDomain: vi.fn(),
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
    hostnameService.updateCustomHostnames.mockReturnValue(hostData(next));
    return app.inject({
      method: 'PUT',
      url: '/api/servers/factory/hostnames',
      payload: { customHostnames: next },
    });
  }

  it('replaces PLAYIT_DOMAIN when the playit host is swapped for one new host', async () => {
    const { setServerPlayitDomain } = await import('@minecraft-docker/shared');

    const res = await save(['old.gl.joinmc.link'], ['new.tun.ply.gg'], 'old.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(setServerPlayitDomain)).toHaveBeenCalledWith('factory', 'new.tun.ply.gg', expect.any(String));
    expect(res.json().playitDomain).toBe('new.tun.ply.gg');
  });

  it('clears PLAYIT_DOMAIN when the playit host is only removed', async () => {
    const { setServerPlayitDomain } = await import('@minecraft-docker/shared');

    const res = await save(['old.gl.joinmc.link', 'mc.example.com'], ['mc.example.com'], 'old.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(setServerPlayitDomain)).toHaveBeenCalledWith('factory', null, expect.any(String));
    expect(res.json().playitDomain).toBeNull();
  });

  it('leaves PLAYIT_DOMAIN untouched when the playit host is kept', async () => {
    const { setServerPlayitDomain } = await import('@minecraft-docker/shared');

    const res = await save(['old.gl.joinmc.link'], ['old.gl.joinmc.link', 'mc.example.com'], 'old.gl.joinmc.link');

    expect(res.statusCode).toBe(200);
    expect(vi.mocked(setServerPlayitDomain)).not.toHaveBeenCalled();
    expect(res.json().playitDomain).toBe('old.gl.joinmc.link');
  });
});
