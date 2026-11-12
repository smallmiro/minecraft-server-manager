/**
 * The IContainerRuntimePort contract (#666) against every runtime we have:
 * the in-memory fake and the Docker adapter. The Docker adapter runs a fake
 * `docker` from PATH that answers from a JSON state file, never the real one.
 */
import { afterAll } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { DockerComposeRuntimeAdapter } from '../src/infrastructure/adapters/DockerComposeRuntimeAdapter.js';
import { CONTRACT_PROJECT, FakeContainerRuntime, runtimeContract } from '../src/testing/index.js';

runtimeContract('FakeContainerRuntime', ({ workloads, failure }) =>
  new FakeContainerRuntime(workloads, { failure, project: CONTRACT_PROJECT })
);

/**
 * Just enough of the docker CLI for DockerComposeRuntimeAdapter: ps, inspect,
 * logs, stop, rm and compose up/restart/stop/rm/ps over the workloads in STATE.
 * Go templates are filled field by field.
 */
const FAKE_DOCKER = (state: string) => `#!${process.execPath}
const fs = require('node:fs');
const STATE = ${JSON.stringify(state)};
const state = JSON.parse(fs.readFileSync(STATE, 'utf8'));
const args = process.argv.slice(2);
if (state.failure === 'hang') {
  setInterval(() => {}, 60000); // never answers; the adapter kills it
  return;
}
const fail = (message) => { process.stderr.write(message + '\\n'); process.exit(1); };
if (state.failure === 'unavailable') fail('Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?');

const save = () => fs.writeFileSync(STATE, JSON.stringify(state));
const find = (name) => state.workloads.find((w) => w.name === name);
const opt = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const target = args[args.length - 1];
const labels = (w) => ({
  'io.mcctl.role': w.role, 'com.docker.compose.project': w.project,
  'com.docker.compose.service': w.service, 'mc-router.host': w.hostname,
});
const statusLine = (w) => {
  if (w.status !== 'running') return w.status === 'created' ? 'Created' : 'Exited (0) 1 minute ago';
  const health = w.health === 'starting' ? 'health: starting' : w.health;
  return health && health !== 'none' ? 'Up 5 minutes (' + health + ')' : 'Up 5 minutes';
};
const render = (format, w) => {
  if (format.includes('.State.Health')) return w.status === 'running' && w.health ? w.health : 'none';
  return format
    .replace(/{{\\.Names}}/g, w.name)
    .replace(/{{\\.Label "([^"]+)"}}/g, (_, key) => labels(w)[key] || '')
    .replace(/{{\\.State\\.Status}}|{{\\.State}}/g, w.status)
    .replace(/{{\\.Status}}/g, statusLine(w));
};
const print = (lines) => { if (lines.length) process.stdout.write(lines.join('\\n') + '\\n'); };
const needWorkload = () => find(target) || fail('Error response from daemon: No such container: ' + target);
const inProject = (w) => w && w.project === process.env.COMPOSE_PROJECT_NAME;

switch (args[0]) {
  case 'ps': {
    const nameFilter = args.find((a) => a.startsWith('name='));
    print(state.workloads
      .filter((w) => !args.includes('status=running') || w.status === 'running')
      .filter((w) => !nameFilter || w.name.includes(nameFilter.slice(5)))
      .map((w) => render(opt('--format'), w)));
    break;
  }
  case 'inspect': {
    const w = find(target) || fail('Error: No such object: ' + target);
    const format = opt('--format') || opt('-f');
    print([format ? render(format, w) : '[{}]']);
    break;
  }
  case 'logs':
    print((needWorkload().logs || []).slice(-Number(opt('--tail'))));
    break;
  case 'stop':
    needWorkload().status = 'exited';
    save();
    break;
  case 'rm':
    needWorkload();
    state.workloads = state.workloads.filter((w) => w.name !== target);
    save();
    break;
  case 'compose': {
    const w = find(target);
    const sub = args[1];
    if (sub === 'ps') print(inProject(w) ? ['NAME', target] : ['NAME']);
    else if (sub === 'up') {
      const status = args.includes('--no-start') ? 'created' : 'running';
      if (w) w.status = status;
      else state.workloads.push({ name: target, status, role: 'server', project: process.env.COMPOSE_PROJECT_NAME, service: target });
    } else if (!inProject(w)) fail('no such service: ' + target);
    else if (sub === 'restart') w.status = 'running';
    else if (sub === 'stop') w.status = 'exited';
    else if (sub === 'rm') state.workloads = state.workloads.filter((x) => x !== w);
    save();
    break;
  }
  default:
    fail('fake docker: unsupported command: ' + args.join(' '));
}
`;

const dir = mkdtempSync(join(tmpdir(), 'mcctl-runtime-contract-'));
const stateFile = join(dir, 'state.json');
writeFileSync(join(dir, 'docker'), FAKE_DOCKER(stateFile));
chmodSync(join(dir, 'docker'), 0o755);
const env = { PATH: `${dir}${delimiter}${process.env['PATH']}`, COMPOSE_PROJECT_NAME: CONTRACT_PROJECT };
// The synchronous queries run docker with the process environment
const savedPath = process.env['PATH'];
process.env['PATH'] = env.PATH;
afterAll(() => {
  process.env['PATH'] = savedPath;
  rmSync(dir, { recursive: true, force: true });
});

runtimeContract('DockerComposeRuntimeAdapter (fake docker on PATH)', (scenario) => {
  writeFileSync(stateFile, JSON.stringify(scenario));
  return new DockerComposeRuntimeAdapter({ root: dir, env: () => env, queryTimeoutMs: 300 });
});
