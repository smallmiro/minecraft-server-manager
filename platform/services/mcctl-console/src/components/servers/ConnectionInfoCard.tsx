'use client';

import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import { BentoPanel, BentoPanelHeader } from '@/components/bento';
import { usePlayitStatus } from '@/hooks/usePlayit';
import { CopyButton } from '@/components/common';
import { parseHostnames, sortHostnames, classifyHostname, HOSTNAME_KIND_LABEL } from '@/utils/hostname';

interface ConnectionInfoCardProps {
  serverName: string;
  hostname?: string;
}

function InfoRow({ label, value, copyText }: { label: string; value: string; copyText?: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        py: 1,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography
          variant="mono"
          sx={{
            color: copyText ? 'text.primary' : 'text.secondary',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </Typography>
        {copyText && <CopyButton text={copyText} size={16} />}
      </Box>
    </Box>
  );
}

export function ConnectionInfoCard({ serverName, hostname }: ConnectionInfoCardProps) {
  const { data: playitStatus, isLoading } = usePlayitStatus();

  if (isLoading) {
    return (
      <BentoPanel aria-label="Connection" sx={{ height: '100%' }}>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Skeleton variant="text" width="40%" height={28} sx={{ mb: 1 }} />
          <Skeleton variant="rectangular" height={1} sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width="40%" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
            <Skeleton variant="text" width="30%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </Box>
      </BentoPanel>
    );
  }

  const addresses = sortHostnames(parseHostnames(hostname));
  const showExternalAddress = playitStatus?.enabled && playitStatus.servers.length > 0;

  // Find external domain for this server
  const serverInfo = playitStatus?.servers.find((s) => s.serverName === serverName);
  const externalAddress = serverInfo?.playitDomain || 'Not configured';
  const hasExternalDomain = Boolean(serverInfo?.playitDomain);

  return (
    <BentoPanel aria-label="Connection" sx={{ height: '100%' }}>
      <BentoPanelHeader title="Connection" />
      <Box sx={{ px: 2.5, pb: 2 }}>
        <Typography variant="label" component="div" color="text.secondary" sx={{ py: 0.5 }}>
          Addresses
        </Typography>
        {addresses.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Not configured
          </Typography>
        ) : (
          addresses.map((h) => {
            const text = `${h}:25565`;
            return (
              <Box
                key={h}
                data-testid="connection-address"
                sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5, gap: 1 }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    {HOSTNAME_KIND_LABEL[classifyHostname(h)]}
                  </Typography>
                  <Typography variant="mono" component="div" sx={{ wordBreak: 'break-all' }}>
                    {text}
                  </Typography>
                </Box>
                <CopyButton text={text} size={16} />
              </Box>
            );
          })
        )}

        {showExternalAddress && (
          <InfoRow
            label="External Address"
            value={externalAddress}
            copyText={hasExternalDomain ? externalAddress : undefined}
          />
        )}
      </Box>
    </BentoPanel>
  );
}
