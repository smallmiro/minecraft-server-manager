import { describe, it, expect } from 'vitest';
import { ServerName } from '../src/domain/index.js';
import { Server, ServerType, McVersion, Memory, WorldOptions } from '../src/domain/index.js';
import {
  containerNameOf,
  serverHostnameOf,
  workloadNameOf,
} from '../src/infrastructure/adapters/workloadNames.js';

describe('workload naming rules (#665)', () => {
  const name = ServerName.create('myserver');

  it('maps a server to its container and hostname', () => {
    expect(containerNameOf(name)).toBe('mc-myserver');
    expect(containerNameOf('myserver')).toBe('mc-myserver');
    expect(serverHostnameOf(name)).toBe('myserver.local');
  });

  it('takes a ServerName as a server and a string as a container name', () => {
    expect(workloadNameOf(name)).toBe('mc-myserver');
    expect(workloadNameOf('mc-router')).toBe('mc-router');
  });

  it('keeps the deprecated domain getters unchanged', () => {
    expect(name.containerName).toBe('mc-myserver');
    expect(name.hostname).toBe('myserver.local');
    const server = Server.create({
      name,
      type: ServerType.create('PAPER'),
      version: McVersion.create('1.21.1'),
      memory: Memory.default(),
      worldOptions: WorldOptions.default(),
    });
    expect(server.containerName).toBe('mc-myserver');
    expect(server.hostname).toBe('myserver.local');
    expect(ServerName.validate('router')).toBe("Server name 'router' is reserved (conflicts with the mc-router container)");
  });
});
