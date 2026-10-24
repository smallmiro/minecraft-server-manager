import { describe, it, expect } from 'vitest';
import { parseRouterLogLine } from '../src/domain/services/routerLog.js';

// Lines in the exact shape mc-router 1.47.1 prints (logrus TextFormatter, no TTY).
const CONNECT =
  'time="2026-10-24T01:02:03Z" level=info msg="Connecting to backend" backendHostPort="mc-survival:25565" ' +
  'client="192.168.1.5:51234" player=Steve/0f3c1e2a-1111-2222-3333-444455556666 server=survival.local';

describe('parseRouterLogLine', () => {
  it('turns a login connection into hostname -> target with the player name', () => {
    expect(parseRouterLogLine(CONNECT)).toEqual({
      ts: '2026-10-24T01:02:03Z',
      kind: 'connect',
      hostname: 'survival.local',
      target: 'mc-survival:25565',
      player: 'Steve',
      raw: CONNECT,
    });
  });

  it('leaves player out for a server list ping, which has an empty player field', () => {
    const line =
      'time="2026-10-24T01:02:04Z" level=info msg="Connecting to backend" backendHostPort="mc-survival:25565" ' +
      'client="192.168.1.5:51235" player= server=survival.192.168.1.5.nip.io';
    const event = parseRouterLogLine(line);
    expect(event.kind).toBe('connect');
    expect(event.hostname).toBe('survival.192.168.1.5.nip.io');
    expect(event).not.toHaveProperty('player');
  });

  it('marks scale-up and woke-up lines as wake events', () => {
    const scaling =
      'time="2026-10-24T01:05:00Z" level=info msg="Scaling up backend server" ' +
      'scalingTarget="docker{containerId=abc123, name=mc-creative}" serverAddress=creative.local';
    const woke =
      'time="2026-10-24T01:05:20Z" level=info msg="Woke up backend server" ' +
      'backendHostPort="mc-creative:25565" serverAddress=creative.local';
    expect(parseRouterLogLine(scaling)).toMatchObject({ kind: 'wake', hostname: 'creative.local' });
    expect(parseRouterLogLine(woke)).toMatchObject({
      kind: 'wake',
      hostname: 'creative.local',
      target: 'mc-creative:25565',
    });
  });

  it('maps warning and error levels to error events and keeps their hostname', () => {
    const missing =
      'time="2026-10-24T01:06:00Z" level=warning msg="Unable to find registered backend" ' +
      'player= resolvedHost=nope.local serverAddress=nope.local';
    const failed =
      'time="2026-10-24T01:06:01Z" level=error msg="failed to wake up backend" ' +
      'error="container not found" serverAddress=creative.local';
    expect(parseRouterLogLine(missing)).toMatchObject({ kind: 'error', hostname: 'nope.local' });
    expect(parseRouterLogLine(failed)).toMatchObject({ kind: 'error', hostname: 'creative.local' });
  });

  it('passes other info lines through as info', () => {
    const line =
      'time="2026-10-24T01:10:00Z" level=info msg="Scaling down backend server" ' +
      'scalingTarget="docker{containerId=abc123, name=mc-creative}"';
    expect(parseRouterLogLine(line)).toEqual({ ts: '2026-10-24T01:10:00Z', kind: 'info', raw: line });
  });

  it('passes unparseable lines through as info with only the raw text', () => {
    expect(parseRouterLogLine('panic: something odd')).toEqual({ kind: 'info', raw: 'panic: something odd' });
    expect(parseRouterLogLine('')).toEqual({ kind: 'info', raw: '' });
  });

  it('unescapes quoted values', () => {
    const line =
      'time="2026-10-24T01:11:00Z" level=info msg="Connecting to backend" backendHostPort="mc-a:25565" ' +
      'player="Odd \\"Name\\"/uuid" server=a.local';
    expect(parseRouterLogLine(line).player).toBe('Odd "Name"');
  });

  it('strips a trailing carriage return from the raw line', () => {
    expect(parseRouterLogLine(`${CONNECT}\r`).raw).toBe(CONNECT);
  });
});
