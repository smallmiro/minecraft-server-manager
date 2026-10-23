import { execSync } from 'node:child_process';
import type {
  IHostnameRegistrarPort,
  HostnameRegistrarStatus,
} from '../../application/ports/outbound/IHostnameRegistrarPort.js';

/**
 * avahi-daemon (mDNS) on the host OS, independent of the container runtime (ADR-0001).
 */
export class AvahiHostnameRegistrarAdapter implements IHostnameRegistrarPort {
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
}
