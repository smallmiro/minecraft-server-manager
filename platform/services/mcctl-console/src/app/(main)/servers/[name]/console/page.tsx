/**
 * Server Console Page
 * Real-time log streaming and command execution interface
 */

'use client';

import { use, useState } from 'react';
import { useAppRouter } from '@/hooks/useAppRouter';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TerminalIcon from '@mui/icons-material/Terminal';
import { ServerConsole } from '@/components/servers/ServerConsole';
import { PageHero } from '@/components/bento';

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function ConsolePage({ params }: PageProps) {
  const router = useAppRouter();
  const { name } = use(params);
  const serverName = decodeURIComponent(name);
  const [connectionState, setConnectionState] = useState({
    isConnected: true,
    retryCount: 0,
  });
  const connectionLabel = connectionState.isConnected
    ? 'Connected'
    : connectionState.retryCount > 0
      ? `Disconnected (Retry ${connectionState.retryCount})`
      : 'Disconnected';

  return (
    <Box sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <PageHero
        compact
        title={serverName}
        eyebrow="Server console"
        description="Live server output and command execution"
        icon={<TerminalIcon />}
        status={(
          <Chip
            label={connectionLabel}
            color={connectionState.isConnected ? 'success' : connectionState.retryCount > 0 ? 'warning' : 'error'}
            size="small"
          />
        )}
        actions={(
          <IconButton
            onClick={() => router.push(`/servers/${name}`)}
            size="small"
            aria-label="Back to server"
            sx={{ border: 1, borderColor: 'divider' }}
          >
            <ArrowBackIcon />
          </IconButton>
        )}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              component="button"
              variant="body1"
              onClick={() => router.push('/servers')}
              sx={{ cursor: 'pointer' }}
              underline="hover"
              color="inherit"
            >
              Servers
            </Link>
            <Link
              component="button"
              variant="body1"
              onClick={() => router.push(`/servers/${name}`)}
              sx={{ cursor: 'pointer' }}
              underline="hover"
              color="inherit"
            >
              {serverName}
            </Link>
            <Box component="span" sx={{ color: 'text.primary' }}>Console</Box>
          </Breadcrumbs>
        </Box>
      </PageHero>

      {/* Console Component */}
      <Box sx={{ flex: 1, minHeight: { xs: 480, md: 'calc(100vh - 300px)' } }}>
        <ServerConsole
          serverName={serverName}
          onConnectionStateChange={setConnectionState}
        />
      </Box>
    </Box>
  );
}
