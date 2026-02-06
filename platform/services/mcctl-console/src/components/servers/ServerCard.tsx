'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import DnsIcon from '@mui/icons-material/Dns';
import LinkIcon from '@mui/icons-material/Link';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import type { ServerStatusMap } from '@/hooks/useServersSSE';

interface ServerCardProps {
  server: ServerSummary;
  statusOverride?: ServerStatusMap[string];
  onClick?: (serverName: string) => void;
  onStart?: (serverName: string) => void;
  onStop?: (serverName: string) => void;
  loading?: boolean;
}

const getStatusColor = (status: ServerSummary['status']): 'success' | 'error' | 'default' | 'warning' => {
  switch (status) {
    case 'running':
      return 'success';
    case 'stopped':
    case 'exited':
    case 'not_created':
      return 'error';
    case 'created':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: ServerSummary['status']): string => {
  switch (status) {
    case 'running':
      return 'Running';
    case 'stopped':
    case 'exited':
      return 'Stopped';
    case 'not_created':
      return 'Not Created';
    case 'created':
      return 'Created';
    default:
      return status || 'Unknown';
  }
};

// Get primary hostname (first one, preferring .local)
const getPrimaryHostname = (hostname: string | undefined): string => {
  if (!hostname) return '-';
  const hosts = hostname.split(',').map(h => h.trim());
  const localHost = hosts.find(h => h.endsWith('.local'));
  return localHost || hosts[0] || '-';
};

export function ServerCard({ server, statusOverride, onClick, onStart, onStop, loading = false }: ServerCardProps) {
  // Use SSE status if available, otherwise fall back to server data
  const currentStatus = statusOverride?.status || server.status;

  const handleCardClick = () => {
    if (onClick) {
      onClick(server.name);
    }
  };

  const handleActionClick = (
    e: React.MouseEvent,
    action: (serverName: string) => void
  ) => {
    e.stopPropagation();
    action(server.name);
  };

  const isRunning = currentStatus === 'running';
  const isStopped = currentStatus === 'stopped' || currentStatus === 'exited' || currentStatus === 'not_created';
  const primaryHostname = getPrimaryHostname(server.hostname);
  const allHostnames = server.hostname?.split(',').map(h => h.trim()) || [];

  return (
    <Card
      role="article"
      onClick={handleCardClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        height: 180,
        display: 'flex',
        flexDirection: 'column',
        '&:hover': onClick
          ? {
              transform: 'translateY(-2px)',
              boxShadow: 4,
            }
          : {},
      }}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        {/* Header: Name + Status */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography
            variant="h6"
            component="h3"
            sx={{
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              mr: 1,
            }}
          >
            {server.name}
          </Typography>
          <Chip
            label={getStatusLabel(currentStatus)}
            size="small"
            color={getStatusColor(currentStatus)}
            sx={{
              fontWeight: 500,
              minWidth: 70,
            }}
          />
        </Box>

        {/* Hostname */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Tooltip title={allHostnames.length > 1 ? allHostnames.join('\n') : ''} arrow>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {primaryHostname}
              {allHostnames.length > 1 && ` (+${allHostnames.length - 1})`}
            </Typography>
          </Tooltip>
        </Box>

        {/* Container */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DnsIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {server.container}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        {isStopped && onStart && (
          <IconButton
            aria-label="Start server"
            color="success"
            onClick={(e) => handleActionClick(e, onStart)}
            disabled={loading}
            size="small"
          >
            <PlayArrowIcon />
          </IconButton>
        )}
        {isRunning && onStop && (
          <IconButton
            aria-label="Stop server"
            color="error"
            onClick={(e) => handleActionClick(e, onStop)}
            disabled={loading}
            size="small"
          >
            <StopIcon />
          </IconButton>
        )}
        {!isStopped && !isRunning && (
          <Box sx={{ height: 34 }} />
        )}
      </CardActions>
    </Card>
  );
}
