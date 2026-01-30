import { existsSync } from 'node:fs';
import * as p from '@clack/prompts';

const AVAHI_HOSTS_FILE = '/etc/avahi/hosts';

/**
 * Check if avahi-daemon is installed and configured
 */
export function isAvahiInstalled(): boolean {
  return existsSync(AVAHI_HOSTS_FILE);
}

/**
 * Check if sudo password is available (from env or provided)
 */
export function hasSudoPassword(sudoPassword?: string): boolean {
  return !!(sudoPassword || process.env.MCCTL_SUDO_PASSWORD);
}

/**
 * Prompt for sudo password if avahi is installed and password not provided
 * Returns the password (from prompt, option, or env) or undefined if not needed
 */
export async function promptSudoPasswordIfNeeded(
  sudoPassword?: string
): Promise<string | undefined> {
  // If password already provided, use it
  if (sudoPassword) {
    return sudoPassword;
  }

  // Check environment variable
  if (process.env.MCCTL_SUDO_PASSWORD) {
    return process.env.MCCTL_SUDO_PASSWORD;
  }

  // Check if avahi is installed
  if (!isAvahiInstalled()) {
    // avahi not installed, sudo not needed
    return undefined;
  }

  // avahi is installed but no password provided - prompt user
  p.log.info('avahi-daemon detected. Sudo password needed for mDNS hostname registration.');

  const password = await p.password({
    message: 'Enter sudo password (or press Enter to skip mDNS):',
    mask: '*',
  });

  if (p.isCancel(password)) {
    // User cancelled - proceed without sudo
    p.log.warn('Skipped. mDNS hostname will not be registered.');
    return undefined;
  }

  const passwordStr = password as string;

  // Empty password means skip
  if (!passwordStr.trim()) {
    p.log.warn('Skipped. mDNS hostname will not be registered.');
    return undefined;
  }

  return passwordStr;
}
