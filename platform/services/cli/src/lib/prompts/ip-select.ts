/**
 * IP address selection prompt component
 * Allows user to select host IP(s) for server hostname routing
 */

import { select, multiselect, text, isCancel } from '@clack/prompts';
import { networkInterfaces } from 'node:os';
import { colors } from '@minecraft-docker/shared';

export interface NetworkInterface {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  cidr: string | null;
}

/**
 * Get all IPv4 addresses from network interfaces
 */
export function getNetworkInterfaces(): NetworkInterface[] {
  const interfaces = networkInterfaces();
  const result: NetworkInterface[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;

    for (const addr of addrs) {
      // Only IPv4 and non-internal addresses
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({
          name,
          address: addr.address,
          family: 'IPv4',
          internal: addr.internal,
          cidr: addr.cidr,
        });
      }
    }
  }

  return result;
}

/**
 * Detect interface type from name and IP range
 */
function detectInterfaceType(iface: NetworkInterface): string {
  const { name, address } = iface;
  const nameLower = name.toLowerCase();

  // VPN detection
  if (nameLower.includes('tailscale') || nameLower.startsWith('tailscale')) {
    return 'Tailscale VPN';
  }
  if (nameLower.includes('zt') || nameLower.startsWith('zt')) {
    return 'ZeroTier VPN';
  }
  if (nameLower.includes('wg') || nameLower.startsWith('wg')) {
    return 'WireGuard VPN';
  }
  if (nameLower.includes('tun') || nameLower.includes('tap')) {
    return 'VPN Tunnel';
  }
  if (nameLower.includes('nebula')) {
    return 'Nebula VPN';
  }

  // IP range detection for VPNs
  if (address.startsWith('100.')) {
    return 'Tailscale VPN';  // Tailscale uses 100.x.x.x
  }
  if (address.startsWith('10.147.') || address.startsWith('10.144.')) {
    return 'ZeroTier VPN';  // ZeroTier common ranges
  }

  // Standard interface types
  if (nameLower.includes('docker') || nameLower.startsWith('br-')) {
    return 'Docker Network';
  }
  if (nameLower.includes('veth')) {
    return 'Container';
  }
  if (nameLower.startsWith('eth') || nameLower.startsWith('en')) {
    return 'Ethernet';
  }
  if (nameLower.startsWith('wl') || nameLower.includes('wifi') || nameLower.includes('wlan')) {
    return 'WiFi';
  }
  if (nameLower.startsWith('virbr')) {
    return 'Virtual Bridge';
  }

  return 'Network';
}

/**
 * Prompt user to select IP addresses for server hostname routing
 * Returns selected IPs as comma-separated string, or null if cancelled
 */
export async function selectHostIPs(): Promise<string | null> {
  const interfaces = getNetworkInterfaces();

  // Filter out Docker/container interfaces by default
  const relevantInterfaces = interfaces.filter(iface => {
    const name = iface.name.toLowerCase();
    return !name.includes('docker') &&
           !name.startsWith('br-') &&
           !name.includes('veth') &&
           !name.startsWith('virbr');
  });

  if (relevantInterfaces.length === 0) {
    // No interfaces found, prompt for manual input
    const manualInput = await text({
      message: 'No network interfaces detected. Enter IP address manually:',
      placeholder: '192.168.1.100',
      validate: (value) => {
        if (!value) return 'IP address is required';
        // Basic IPv4 validation
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(value)) return 'Invalid IPv4 address format';
        return undefined;
      },
    });

    if (isCancel(manualInput)) {
      return null;
    }

    return manualInput as string;
  }

  // Build options for multiselect
  const options = relevantInterfaces.map(iface => {
    const type = detectInterfaceType(iface);
    const isVPN = type.includes('VPN');
    const isMain = type === 'Ethernet' || type === 'WiFi';

    return {
      value: iface.address,
      label: `${iface.address}`,
      hint: `${iface.name} (${type})${isMain ? ' - recommended' : ''}${isVPN ? colors.cyan(' VPN') : ''}`,
    };
  });

  // Add manual input option
  options.push({
    value: '__manual__',
    label: 'Enter manually...',
    hint: 'Type an IP address not listed above',
  });

  console.log('');
  console.log(colors.dim('  Select one or more IPs for server hostname routing.'));
  console.log(colors.dim('  Each IP will generate a nip.io hostname (e.g., server.IP.nip.io)'));
  console.log('');

  const selected = await multiselect({
    message: 'Select host IP address(es):',
    options,
    required: true,
  });

  if (isCancel(selected)) {
    return null;
  }

  const selectedIPs = selected as string[];

  // Handle manual input if selected
  if (selectedIPs.includes('__manual__')) {
    const manualInput = await text({
      message: 'Enter additional IP address:',
      placeholder: '100.64.0.5',
      validate: (value) => {
        if (!value) return 'IP address is required';
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(value)) return 'Invalid IPv4 address format';
        return undefined;
      },
    });

    if (isCancel(manualInput)) {
      return null;
    }

    // Replace __manual__ with actual IP
    const idx = selectedIPs.indexOf('__manual__');
    selectedIPs[idx] = manualInput as string;
  }

  // Remove duplicates and return
  const uniqueIPs = [...new Set(selectedIPs)];
  return uniqueIPs.join(',');
}

/**
 * Prompt for single IP selection (simpler version)
 */
export async function selectSingleIP(): Promise<string | null> {
  const interfaces = getNetworkInterfaces();

  const relevantInterfaces = interfaces.filter(iface => {
    const name = iface.name.toLowerCase();
    return !name.includes('docker') &&
           !name.startsWith('br-') &&
           !name.includes('veth') &&
           !name.startsWith('virbr');
  });

  if (relevantInterfaces.length === 0) {
    const manualInput = await text({
      message: 'Enter host IP address:',
      placeholder: '192.168.1.100',
      validate: (value) => {
        if (!value) return 'IP address is required';
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(value)) return 'Invalid IPv4 address format';
        return undefined;
      },
    });

    if (isCancel(manualInput)) {
      return null;
    }

    return manualInput as string;
  }

  const options = relevantInterfaces.map(iface => {
    const type = detectInterfaceType(iface);
    return {
      value: iface.address,
      label: `${iface.address}`,
      hint: `${iface.name} (${type})`,
    };
  });

  options.push({
    value: '__manual__',
    label: 'Enter manually...',
    hint: 'Type an IP address',
  });

  const selected = await select({
    message: 'Select host IP address:',
    options,
  });

  if (isCancel(selected)) {
    return null;
  }

  if (selected === '__manual__') {
    const manualInput = await text({
      message: 'Enter IP address:',
      placeholder: '192.168.1.100',
      validate: (value) => {
        if (!value) return 'IP address is required';
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (!ipv4Regex.test(value)) return 'Invalid IPv4 address format';
        return undefined;
      },
    });

    if (isCancel(manualInput)) {
      return null;
    }

    return manualInput as string;
  }

  return selected as string;
}
