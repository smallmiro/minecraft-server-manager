'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import DeleteIcon from '@mui/icons-material/Delete';
import StorageIcon from '@mui/icons-material/Storage';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { World } from '@/ports/api/IMcctlApiClient';

interface WorldCardProps {
  world: World;
  onAssign?: (worldName: string) => void;
  onRelease?: (worldName: string) => void;
  onDelete?: (worldName: string) => void;
  loading?: boolean;
}

export function WorldCard({ world, onAssign, onRelease, onDelete, loading = false }: WorldCardProps) {
  const handleActionClick = (
    e: React.MouseEvent,
    action: (worldName: string) => void
  ) => {
    e.stopPropagation();
    action(world.name);
  };

  const formatDate = (dateStr?: string): string => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card
      role="article"
      sx={{
        transition: 'all 0.2s',
        height: { xs: 'auto', sm: 200 },
        minHeight: { xs: 160, sm: 200 },
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: 4,
        },
      }}
    >
      <CardContent sx={{ flex: 1, pb: 1 }}>
        {/* Header: Name + Lock Status */}
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
            {world.name}
          </Typography>
          <Chip
            label={world.isLocked ? 'Locked' : 'Available'}
            size="small"
            color={world.isLocked ? 'warning' : 'success'}
            sx={{ fontWeight: 500, minWidth: 80 }}
          />
        </Box>

        {/* Size */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <StorageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {world.size || 'Unknown size'}
          </Typography>
        </Box>

        {/* Locked By */}
        {world.isLocked && world.lockedBy && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <LinkIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Tooltip title={`Assigned to ${world.lockedBy}`} arrow>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {world.lockedBy}
              </Typography>
            </Tooltip>
          </Box>
        )}

        {/* Last Modified */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography variant="body2" color="text.secondary">
            {formatDate(world.lastModified)}
          </Typography>
        </Box>
      </CardContent>

      <CardActions sx={{ justifyContent: 'flex-end', px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        {!world.isLocked && onAssign && (
          <Tooltip title="Assign to server" arrow>
            <IconButton
              aria-label="Assign world"
              color="primary"
              onClick={(e) => handleActionClick(e, onAssign)}
              disabled={loading}
              size="small"
            >
              <LinkIcon />
            </IconButton>
          </Tooltip>
        )}
        {world.isLocked && onRelease && (
          <Tooltip title="Release from server" arrow>
            <IconButton
              aria-label="Release world"
              color="warning"
              onClick={(e) => handleActionClick(e, onRelease)}
              disabled={loading}
              size="small"
            >
              <LinkOffIcon />
            </IconButton>
          </Tooltip>
        )}
        {onDelete && (
          <Tooltip title="Delete world" arrow>
            <IconButton
              aria-label="Delete world"
              color="error"
              onClick={(e) => handleActionClick(e, onDelete)}
              disabled={loading}
              size="small"
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </CardActions>
    </Card>
  );
}
