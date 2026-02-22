'use client';

import { useCallback } from 'react';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import type { FileDiff, FileDiffStatus } from '@/ports/api/IMcctlApiClient';

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
}

function getStatusConfig(status: FileDiffStatus): StatusConfig {
  switch (status) {
    case 'added':
      return {
        icon: <AddCircleOutlineIcon fontSize="small" />,
        color: 'success.main',
        label: 'Added',
      };
    case 'modified':
      return {
        icon: <EditOutlinedIcon fontSize="small" />,
        color: 'warning.main',
        label: 'Modified',
      };
    case 'deleted':
      return {
        icon: <RemoveCircleOutlineIcon fontSize="small" />,
        color: 'error.main',
        label: 'Deleted',
      };
  }
}

function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function getFilePath(path: string): string {
  const parts = path.split('/');
  if (parts.length <= 1) return '';
  return parts.slice(0, -1).join('/');
}

interface ConfigDiffFileTreeProps {
  changes: FileDiff[];
  selectedFile?: string;
  onSelectFile: (path: string) => void;
}

/**
 * Left panel file tree showing changed files with status icons
 */
export function ConfigDiffFileTree({
  changes,
  selectedFile,
  onSelectFile,
}: ConfigDiffFileTreeProps) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, path: string, index: number) => {
      if (event.key === 'ArrowUp' && index > 0) {
        event.preventDefault();
        onSelectFile(changes[index - 1].path);
      } else if (event.key === 'ArrowDown' && index < changes.length - 1) {
        event.preventDefault();
        onSelectFile(changes[index + 1].path);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelectFile(path);
      }
    },
    [changes, onSelectFile]
  );

  if (changes.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No changes
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        overflow: 'auto',
        borderRight: 1,
        borderColor: 'divider',
      }}
      role="tree"
      aria-label="Changed files"
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          px: 2,
          py: 1,
          color: 'text.secondary',
          fontWeight: 'medium',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        Changed Files ({changes.length})
      </Typography>

      <List dense disablePadding role="group">
        {changes.map((change, index) => {
          const statusConfig = getStatusConfig(change.status);
          const fileName = getFileName(change.path);
          const filePath = getFilePath(change.path);
          const isSelected = selectedFile === change.path;

          return (
            <Tooltip
              key={change.path}
              title={`${statusConfig.label}: ${change.path}`}
              placement="right"
            >
              <ListItemButton
                selected={isSelected}
                onClick={() => onSelectFile(change.path)}
                onKeyDown={(e) => handleKeyDown(e, change.path, index)}
                role="treeitem"
                aria-selected={isSelected}
                aria-label={`${change.path} - ${statusConfig.label}`}
                sx={{
                  py: 0.75,
                  '&.Mui-selected': {
                    bgcolor: 'action.selected',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 32,
                    color: statusConfig.color,
                  }}
                >
                  {statusConfig.icon}
                </ListItemIcon>
                <ListItemText
                  primary={fileName}
                  secondary={filePath || undefined}
                  primaryTypographyProps={{
                    variant: 'body2',
                    sx: {
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  }}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    sx: {
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                  }}
                />
              </ListItemButton>
            </Tooltip>
          );
        })}
      </List>
    </Box>
  );
}
