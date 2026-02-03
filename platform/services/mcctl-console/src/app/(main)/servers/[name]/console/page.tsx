/**
 * Server Console Page
 * Real-time log streaming and command execution interface
 */

'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import IconButton from '@mui/material/IconButton';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ServerConsole } from '@/components/servers/ServerConsole';

interface PageProps {
  params: Promise<{ name: string }>;
}

export default function ConsolePage({ params }: PageProps) {
  const router = useRouter();
  const { name } = use(params);
  const serverName = decodeURIComponent(name);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <IconButton
            onClick={() => router.push(`/servers/${name}`)}
            size="small"
            aria-label="Back to server"
          >
            <ArrowBackIcon />
          </IconButton>
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
            <Typography color="text.primary">Console</Typography>
          </Breadcrumbs>
        </Box>
        <Typography variant="h5" component="h1">
          {serverName} Console
        </Typography>
      </Box>

      {/* Console Component */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ServerConsole serverName={serverName} />
      </Box>
    </Box>
  );
}
