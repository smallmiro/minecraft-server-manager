'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';

interface ServerCardProps {
  server: ServerSummary;
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
      return 'error';
    case 'created':
      return 'warning';
    default:
      return 'default';
  }
};

const getHealthColor = (health: ServerSummary['health']): 'success' | 'error' | 'warning' | 'default' => {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'unhealthy':
      return 'error';
    case 'starting':
      return 'warning';
    default:
      return 'default';
  }
};

export function ServerCard({ server, onClick, onStart, onStop, loading = false }: ServerCardProps) {
  const handleCardClick = () => {
    if (onClick) {
      onClick(server.name);
    }
  };

  const handleActionClick = (
    e: React.MouseEvent,
    action: (serverName: string) => void
  ) => {
    e.stopPropagation(); // Prevent card onClick from firing
    action(server.name);
  };

  const isRunning = server.status === 'running';
  const isStopped = server.status === 'stopped' || server.status === 'exited';

  return (
    <Card
      role="article"
      onClick={handleCardClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        '&:hover': onClick
          ? {
              transform: 'translateY(-4px)',
              boxShadow: 4,
            }
          : {},
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            {server.name}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Chip
              label={server.status}
              size="small"
              color={getStatusColor(server.status)}
              sx={{ textTransform: 'capitalize' }}
            />
            <Chip
              label={server.health}
              size="small"
              color={getHealthColor(server.health)}
              sx={{ textTransform: 'capitalize' }}
            />
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {server.hostname}
        </Typography>

        <Typography variant="caption" color="text.secondary">
          Container: {server.container}
        </Typography>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
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
      </CardActions>
    </Card>
  );
}
