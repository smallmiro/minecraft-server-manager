'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { usePlayitStatus } from '@/hooks/usePlayit';

interface ConnectionInfoCardProps {
  serverName: string;
  hostname?: string;
}

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <IconButton
      size="small"
      onClick={handleCopy}
      sx={{
        ml: 1,
        color: copied ? 'success.main' : 'text.secondary',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
    </IconButton>
  );
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
            fontFamily: copyText ? 'monospace' : 'inherit',
            color: copyText ? 'text.primary' : 'text.secondary',
          }}
        >
          {value}
        </Typography>
        {copyText && <CopyButton text={copyText} />}
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

  const lanAddress = hostname ? `${hostname}:25565` : 'Not configured';
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

        <InfoRow
          label="LAN Address"
          value={lanAddress}
          copyText={hostname ? lanAddress : undefined}
        />

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
