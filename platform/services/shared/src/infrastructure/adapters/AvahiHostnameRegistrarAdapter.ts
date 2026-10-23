import { execSync, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import type {
  IHostnameRegistrarPort,
  HostnameRegistrarStatus,
  HostnameChangeResult,
} from '../../application/ports/outbound/IHostnameRegistrarPort.js';
import { validateHostname } from '../../domain/server-spec/ServerSpecDocument.js';

export interface AvahiHostnameRegistrarOptions {
  /**
   * sudo password (the CLI's --sudo-password / MCCTL_SUDO_PASSWORD / prompt,
   * the API request's sudoPassword). Given: `sudo -S -p '' -v` reads it on
   * stdin first. Absent: `sudo -n` relies on NOPASSWD or cached credentials.
   */
  sudoPassword?: string;
  /** Default /etc/avahi/hosts (the path the README sudoers lines name). */
  hostsFile?: string;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/** True when an uncommented line lists exactly `hostname` as a host field (#660). */
function registered(content: string, hostname: string): boolean {
  return content.split('\n').some((line) => {
    if (/^\s*#/.test(line)) return false;
    const fields = line.trim().split(/\s+/);
    for (const field of fields.slice(1)) {
      if (field.startsWith('#')) break;
      if (field === hostname) return true;
    }
    return false;
  });
}

/** Run argv (no shell) with optional stdin; resolves the exit code (-1 when it cannot start). */
function run(cmd: string, args: string[], input?: string): Promise<number> {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env['MCCTL_SUDO_PASSWORD']; // the password only ever travels on stdin (#682)
    const child = spawn(cmd, args, { env, stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => resolve(-1));
    child.on('close', (code) => resolve(code ?? -1));
    child.stdin.end(input ?? '');
  });
}

/**
 * avahi-daemon (mDNS) on the host OS, independent of the container runtime (ADR-0001).
 */
export class AvahiHostnameRegistrarAdapter implements IHostnameRegistrarPort {
  private readonly hostsFile: string;

  constructor(private readonly options: AvahiHostnameRegistrarOptions = {}) {
    this.hostsFile = options.hostsFile ?? '/etc/avahi/hosts';
  }

  /**
   * Get avahi-daemon status
   */
  getStatus(): HostnameRegistrarStatus {
    // Try systemctl first
    try {
      execSync('systemctl is-active --quiet avahi-daemon', { stdio: 'pipe' });
      return 'running';
    } catch {
      // Not running via systemctl
    }

    // Try OpenRC
    try {
      execSync('rc-service avahi-daemon status', { stdio: 'pipe' });
      return 'running';
    } catch {
      // Not running via OpenRC
    }

    // Check if installed
    try {
      execSync('which avahi-daemon', { stdio: 'pipe' });
      return 'installed (not running)';
    } catch {
      return 'not installed';
    }
  }

  /**
   * Append `<ip> <hostname>` to the avahi hosts file and restart avahi-daemon,
   * with exactly the commands the README sudoers lines allow:
   * `sudo -n tee -a /etc/avahi/hosts`, `sudo -n systemctl restart avahi-daemon`.
   */
  async register(hostname: string, ip: string): Promise<HostnameChangeResult> {
    const skipped = (reason: string): HostnameChangeResult => ({ status: 'skipped', reason });
    if (!IPV4.test(ip)) {
      return skipped(`'${ip}' is not a valid IPv4 address; set HOST_IP in .env to a single IPv4 address`);
    }
    const hostError = validateHostname(hostname);
    if (hostError) return skipped(`invalid hostname '${hostname}': ${hostError}`);
    if (this.getStatus() === 'not installed') return skipped('avahi-daemon is not installed');

    let current = '';
    try {
      current = await readFile(this.hostsFile, 'utf-8');
    } catch {
      // A missing hosts file is created by tee.
    }
    if (registered(current, hostname)) return { status: 'unchanged' };

    if (this.options.sudoPassword !== undefined) {
      if ((await run('sudo', ['-S', '-p', '', '-v'], `${this.options.sudoPassword}\n`)) !== 0) {
        return skipped('sudo authentication failed; check the sudo password');
      }
    }
    const manual = `echo '${ip} ${hostname}' | sudo tee -a ${this.hostsFile}`;
    if ((await run('sudo', ['-n', 'tee', '-a', this.hostsFile], `${ip} ${hostname}\n`)) !== 0) {
      return skipped(`failed to write ${this.hostsFile} with sudo; pass a sudo password, or add it manually: ${manual}`);
    }
    if ((await run('sudo', ['-n', 'systemctl', 'restart', 'avahi-daemon'])) !== 0) {
      return skipped(`${hostname} was added to ${this.hostsFile} but avahi-daemon could not be restarted`);
    }
    return { status: 'changed' };
  }
}
