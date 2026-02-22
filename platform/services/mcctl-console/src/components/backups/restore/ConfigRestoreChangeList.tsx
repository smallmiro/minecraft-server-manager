'use client';

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import type { FileDiff, FileDiffStatus } from '@/ports/api/IMcctlApiClient';

interface StatusIconProps {
  status: FileDiffStatus;
}

function StatusIcon({ status }: StatusIconProps) {
  switch (status) {
    case 'added':
      return <AddCircleOutlineIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'modified':
      return <EditOutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />;
    case 'deleted':
      return <RemoveCircleOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />;
  }
}

function getChangeDescription(change: FileDiff): string {
  switch (change.status) {
    case 'added':
      return 'will be added';
    case 'modified':
      return 'will be modified';
    case 'deleted':
      return 'will be deleted';
  }
}

interface ConfigRestoreChangeListProps {
  changes: FileDiff[];
}

/**
 * List of changes that will be applied during a snapshot restore
 */
export function ConfigRestoreChangeList({ changes }: ConfigRestoreChangeListProps) {
  if (changes.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        No configuration changes will be applied.
      </Typography>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        maxHeight: 200,
        overflow: 'auto',
        bgcolor: 'background.default',
      }}
    >
      <List dense disablePadding>
        {changes.map((change) => (
          <ListItem key={change.path} sx={{ py: 0.5 }}>
            <ListItemIcon sx={{ minWidth: 32 }}>
              <StatusIcon status={change.status} />
            </ListItemIcon>
            <ListItemText
              primary={
                <Typography
                  variant="body2"
                  component="span"
                  sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                >
                  {change.path}
                </Typography>
              }
              secondary={getChangeDescription(change)}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
