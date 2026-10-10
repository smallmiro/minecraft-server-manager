import { describe, it, expect } from 'vitest';
import { patchRouterCompose } from '../../../src/lib/compose-router-patch.js';

const TEMPLATE = `services:
  router:
    # Pinned to v1.47.1 for production stability.
    image: itzg/mc-router:1.47.1
    container_name: mc-router
    environment:
      IN_DOCKER: "true"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    # v1.46+ runs as non-root: join the docker socket's group (auto-set by mcctl init/upgrade)
    group_add:
      - "\${DOCKER_GID:-999}"
    networks:
      - minecraft-net

  playit:
    image: ghcr.io/playit-cloud/playit-agent:0.16
`;

const OLD = `services:
  router:
    # Pinned to v1.43.1 for production stability.
    image: itzg/mc-router:1.43.1 # my pin
    container_name: mc-router
    environment:
      IN_DOCKER: "true"
      AUTO_SCALE_DOWN_AFTER: "10m"
    ports:
      - "25565:25565"
      - "25566:25566"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - minecraft-net

  # my own service
  grafana:
    image: grafana/grafana:11
    networks:
      - minecraft-net
`;

describe('patchRouterCompose', () => {
  it('bumps image tag and inserts group_add before networks, keeping everything else', () => {
    const r = patchRouterCompose(OLD, TEMPLATE);
    expect(r.skipped).toBeUndefined();
    expect(r.changes).toEqual(['router.image 1.43.1 → 1.47.1', 'router.group_add added']);
    expect(r.content).toContain('image: itzg/mc-router:1.47.1 # my pin');
    expect(r.content).toContain('# Pinned to v1.47.1 for production stability.');
    expect(r.content).toContain(
      '    group_add:\n      - "${DOCKER_GID:-999}"\n    networks:\n      - minecraft-net\n\n  # my own service',
    );
    expect(r.content).toContain('AUTO_SCALE_DOWN_AFTER: "10m"');
    expect(r.content).toContain('- "25566:25566"');
    expect(r.content).toContain('grafana/grafana:11');
  });

  it('updates the Pinned comment even when other comment lines sit between it and image', () => {
    const user = OLD.replace('    image: itzg', '    # Check releases: https://example.invalid\n    image: itzg');
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.content).toContain('# Pinned to v1.47.1 for production stability.');
    expect(r.content).not.toContain('v1.43.1');
  });

  it('is a no-op when already up to date, and idempotent', () => {
    const once = patchRouterCompose(OLD, TEMPLATE);
    const twice = patchRouterCompose(once.content, TEMPLATE);
    expect(twice.changes).toEqual([]);
    expect(twice.content).toBe(once.content);
    expect(patchRouterCompose(TEMPLATE, TEMPLATE).changes).toEqual([]);
  });

  it('skips when there is no router service (router key under another service is ignored)', () => {
    const r = patchRouterCompose('services:\n  web:\n    image: nginx\n    labels:\n      router: x\n', TEMPLATE);
    expect(r.skipped).toBe('no-router');
    expect(r.changes).toEqual([]);
  });

  it('keeps a user group_add and only bumps the image', () => {
    const user = OLD.replace('    networks:\n      - minecraft-net\n\n  # my', '    group_add:\n      - "123"\n    networks:\n      - minecraft-net\n\n  # my');
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.changes).toEqual(['router.image 1.43.1 → 1.47.1']);
    expect(r.content).toContain('- "123"');
    expect(r.content).not.toContain('DOCKER_GID');
  });

  it('does not touch a newer user tag, a fork or a non-numeric tag', () => {
    for (const image of ['itzg/mc-router:1.50.0', 'myfork/mc-router:1.43.1', 'itzg/mc-router:latest']) {
      const user = OLD.replace('itzg/mc-router:1.43.1', image);
      const r = patchRouterCompose(user, TEMPLATE);
      expect(r.content).toContain(`image: ${image}`);
      expect(r.changes).toEqual(['router.group_add added']);
    }
  });

  it('handles 4-space indentation', () => {
    const user = OLD.replace(/^( +)/gm, (m) => m + m);
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.changes).toHaveLength(2);
    expect(r.content).toContain('        group_add:\n            - "${DOCKER_GID:-999}"\n        networks:');
  });

  it('appends group_add at block end when router has no networks', () => {
    const user = 'services:\n  router:\n    image: itzg/mc-router:1.47.1\n\n  other:\n    image: x\n';
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.content).toBe(
      'services:\n  router:\n    image: itzg/mc-router:1.47.1\n' +
      '    # v1.46+ runs as non-root: join the docker socket\'s group (auto-set by mcctl init/upgrade)\n' +
      '    group_add:\n      - "${DOCKER_GID:-999}"\n\n  other:\n    image: x\n',
    );
  });

  it('skips a flow-style router it cannot line-patch', () => {
    // flow-style router can not be line-patched safely: parsed result must still be validated
    const user = 'services:\n  router: {image: "itzg/mc-router:1.43.1"}\n';
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.content).toBe(user);
    expect(r.changes).toEqual([]);
    expect(r.skipped).toBe('no-router');
  });

  it('refuses to write when the user YAML does not parse (duplicate keys)', () => {
    const user = OLD.replace('    container_name: mc-router', '    image: itzg/mc-router:1.43.1\n    container_name: mc-router');
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.skipped).toBe('invalid');
    expect(r.content).toBe(user);
  });

  it('takes the group_add indent from the router block, not the image line (registry-prefixed image)', () => {
    const user = OLD.replace(/^( +)/gm, (m) => m + m).replace('itzg/mc-router:1.43.1', 'ghcr.io/itzg/mc-router:1.43.1');
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.changes).toEqual(['router.group_add added']);
    expect(r.content).toContain('ghcr.io/itzg/mc-router:1.43.1');
    expect(r.content).toContain('        group_add:\n            - "${DOCKER_GID:-999}"\n        networks:');
  });

  it('keeps a comment that sits above networks together with networks', () => {
    const user = OLD.replace('    networks:\n      - minecraft-net\n\n  # my', '    # attach to the shared net\n    networks:\n      - minecraft-net\n\n  # my');
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.content).toContain('      - "${DOCKER_GID:-999}"\n    # attach to the shared net\n    networks:');
  });

  it('keeps CRLF line endings on inserted lines', () => {
    const r = patchRouterCompose(OLD.replace(/\n/g, '\r\n'), TEMPLATE);
    expect(r.changes).toHaveLength(2);
    expect(r.content.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('does not add group_add when it comes from a YAML merge key', () => {
    const user = 'x-base: &base\n  group_add:\n    - "1"\n\nservices:\n  router:\n    <<: *base\n    image: itzg/mc-router:1.43.1\n';
    const r = patchRouterCompose(user, TEMPLATE);
    expect(r.changes).toEqual(['router.image 1.43.1 → 1.47.1']);
  });

  it('skips when the template has no router', () => {
    const r = patchRouterCompose(OLD, 'services:\n  x:\n    image: y\n');
    expect(r.skipped).toBe('no-template');
    expect(r.content).toBe(OLD);
  });
});
