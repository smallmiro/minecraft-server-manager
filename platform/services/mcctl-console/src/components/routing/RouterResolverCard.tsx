'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CellTowerIcon from '@mui/icons-material/CellTower';
import DnsIcon from '@mui/icons-material/Dns';
import { BentoPanelHeader } from '@/components/bento';
import { CopyButton } from '@/components/common';
import type { AvahiInfo, RouterResolver } from '@/ports/api/IMcctlApiClient';
import type { StatusColor } from './hostnameType';

interface RouterResolverCardProps {
  resolver?: RouterResolver;
  avahi?: AvahiInfo;
  /** Server used in the nip.io example; a generic placeholder is shown when omitted. */
  serverName?: string;
}

function getAvahiColor(status: string): StatusColor {
  if (status === 'running') return 'success';
  if (status.includes('not running')) return 'warning';
  if (status === 'not installed') return 'error';
  return 'default';
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
      {children}
    </Typography>
  );
}

export function RouterResolverCard({ resolver, avahi, serverName }: RouterResolverCardProps) {
  const hostIp = resolver?.hostIp;
  const hostIps = resolver?.hostIps ?? [];
  const nipExample = hostIp ? `${serverName ?? '<server>'}.${hostIp}.nip.io` : undefined;
  const avahiStatus = avahi?.status ?? 'unknown';

  return (
    <>
      <BentoPanelHeader title="Hostname Resolver" icon={<DnsIcon fontSize="small" />} />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Stack spacing={2}>
          <Box>
            <SectionLabel>Host IPs</SectionLabel>
            {hostIps.length > 0 ? (
              <Stack component="ul" aria-label="Host IPs" spacing={0.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {hostIps.map((ip) => (
                  <Stack component="li" key={ip} direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                      {ip}
                    </Typography>
                    {ip === hostIp && <Chip label="Primary" size="small" color="primary" variant="outlined" />}
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No host IPs detected.
              </Typography>
            )}
          </Box>

          <Box>
            <SectionLabel>nip.io address</SectionLabel>
            {nipExample ? (
              <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                  {nipExample}
                </Typography>
                <CopyButton text={nipExample} />
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                HOST_IP not configured. Set HOST_IP in the platform .env to enable nip.io hostnames.
              </Typography>
            )}
          </Box>

          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
              <CellTowerIcon fontSize="small" color="primary" />
              <Typography variant="subtitle2" component="h3">
                mDNS (Avahi)
              </Typography>
              <Chip
                aria-label="Avahi status"
                label={avahiStatus}
                size="small"
                color={getAvahiColor(avahiStatus)}
                sx={{ ml: 'auto' }}
              />
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Avahi mDNS daemon enables <code>.local</code> hostname resolution for Minecraft servers on the local
              network.
            </Typography>
          </Box>
        </Stack>
      </Box>
    </>
  );
}
