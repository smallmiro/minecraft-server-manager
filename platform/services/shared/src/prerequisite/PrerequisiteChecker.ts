import { spawnSync } from 'node:child_process';
import {
  getDockerVersion,
  getDockerComposeVersion,
  getAvahiStatus,
} from '../docker/index.js';

export interface PrerequisiteResult {
  name: string;
  installed: boolean;
  version?: string;
  required: string;
  satisfied: boolean;
  optional: boolean;
  hint?: string;
}

export interface PrerequisiteReport {
  results: PrerequisiteResult[];
  allSatisfied: boolean;
  warnings: PrerequisiteResult[];
}

/**
 * Compare two semver-like version strings.
 * Returns true if actual >= required.
 */
export function satisfiesMinVersion(actual: string, required: string): boolean {
  const parse = (v: string): number[] => v.split('.').map(n => parseInt(n, 10) || 0);
  const a = parse(actual);
  const r = parse(required);
  const len = Math.max(a.length, r.length);

  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const rv = r[i] ?? 0;
    if (av > rv) return true;
    if (av < rv) return false;
  }
  return true; // equal
}

function checkNodeJs(): PrerequisiteResult {
  const version = process.version.replace(/^v/, '');
  const required = '18.0.0';
  return {
    name: 'Node.js',
    installed: true,
    version,
    required: `>= ${required}`,
    satisfied: satisfiesMinVersion(version, required),
    optional: false,
    hint: 'https://nodejs.org/',
  };
}

function checkDockerPrerequisite(): PrerequisiteResult {
  const required = '24.0.0';
  const info = getDockerVersion();
  return {
    name: 'Docker Engine',
    installed: info.installed,
    version: info.version,
    required: `>= ${required}`,
    satisfied: info.installed && !!info.version && satisfiesMinVersion(info.version, required),
    optional: false,
    hint: 'https://docs.docker.com/get-docker/',
  };
}

function checkDockerComposePrerequisite(): PrerequisiteResult {
  const required = '2.20.0';
  const info = getDockerComposeVersion();
  return {
    name: 'Docker Compose',
    installed: info.installed,
    version: info.version,
    required: `>= ${required}`,
    satisfied: info.installed && !!info.version && satisfiesMinVersion(info.version, required),
    optional: false,
    hint: 'https://docs.docker.com/compose/install/',
  };
}

function checkAvahiPrerequisite(): PrerequisiteResult {
  const status = getAvahiStatus();
  const installed = status !== 'not installed';
  return {
    name: 'avahi-daemon',
    installed,
    version: installed ? status : undefined,
    required: '>= any',
    satisfied: installed,
    optional: true,
    hint: 'sudo apt install avahi-daemon',
  };
}

function checkPm2Prerequisite(): PrerequisiteResult {
  const required = '6.0.0';

  const whichResult = spawnSync('which', ['pm2'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (whichResult.status !== 0 || !whichResult.stdout?.trim()) {
    return {
      name: 'PM2',
      installed: false,
      required: `>= ${required}`,
      satisfied: false,
      optional: false,
      hint: 'npm install -g pm2',
    };
  }

  const versionResult = spawnSync('pm2', ['--version'], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const version = versionResult.status === 0 ? versionResult.stdout?.trim() : undefined;

  return {
    name: 'PM2',
    installed: true,
    version,
    required: `>= ${required}`,
    satisfied: !!version && satisfiesMinVersion(version, required),
    optional: false,
    hint: 'npm install -g pm2',
  };
}

function buildReport(results: PrerequisiteResult[]): PrerequisiteReport {
  const allSatisfied = results.filter(r => !r.optional).every(r => r.satisfied);
  const warnings = results.filter(r => r.optional && !r.satisfied);
  return { results, allSatisfied, warnings };
}

/**
 * Check prerequisites for `mcctl init`.
 * Node.js >= 18, Docker >= 24, Docker Compose >= 2.20, avahi (optional).
 */
export function checkPlatformPrerequisites(): PrerequisiteReport {
  return buildReport([
    checkNodeJs(),
    checkDockerPrerequisite(),
    checkDockerComposePrerequisite(),
    checkAvahiPrerequisite(),
  ]);
}

/**
 * Check prerequisites for `mcctl console init`.
 * Node.js >= 18, Docker >= 24, Docker Compose >= 2.20, PM2 >= 6.
 */
export function checkConsolePrerequisites(): PrerequisiteReport {
  return buildReport([
    checkNodeJs(),
    checkDockerPrerequisite(),
    checkDockerComposePrerequisite(),
    checkPm2Prerequisite(),
  ]);
}
