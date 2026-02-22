'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import { usePlayitStatus } from '@/hooks/usePlayit';
import { CopyButton, HostnameDisplay } from '@/components/common';

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
          variant="body2"
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
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
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
        </CardContent>
      </Card>
    );
  }

  const showExternalAddress = playitStatus?.enabled && playitStatus.servers.length > 0;

  // Find external domain for this server
  const serverInfo = playitStatus?.servers.find((s) => s.serverName === serverName);
  const externalAddress = serverInfo?.playitDomain || 'Not configured';
  const hasExternalDomain = Boolean(serverInfo?.playitDomain);

  return (
    <Card sx={{ borderRadius: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom fontWeight={600}>
          Connection
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1,
            gap: 1,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
            LAN Address
          </Typography>
          {hostname ? (
            <Box sx={{ minWidth: 0 }}>
              <HostnameDisplay hostname={hostname} portSuffix={25565} color="text.primary" showCopyButton />
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Not configured
            </Typography>
          )}
        </Box>

        {showExternalAddress && (
          <InfoRow
            label="External Address"
            value={externalAddress}
            copyText={hasExternalDomain ? externalAddress : undefined}
          />
        )}
      </CardContent>
    </Card>
  );
}
