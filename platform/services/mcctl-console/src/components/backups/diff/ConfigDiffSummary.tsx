'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ConfigSnapshotDiffSummary } from '@/ports/api/IMcctlApiClient';

interface ConfigDiffSummaryProps {
  summary: ConfigSnapshotDiffSummary;
}

/**
 * Summary bar showing change counts for a config snapshot diff
 */
export function ConfigDiffSummary({ summary }: ConfigDiffSummaryProps) {
  const { added, modified, deleted } = summary;
  const totalChanges = added + modified + deleted;

  if (totalChanges === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          No differences found between snapshots
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexWrap: 'wrap',
      }}
      role="status"
      aria-label={`Summary: ${added} added, ${modified} modified, ${deleted} deleted`}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'medium' }}>
        Summary:
      </Typography>

      {modified > 0 && (
        <Chip
          icon={<EditIcon sx={{ fontSize: '0.875rem' }} />}
          label={`${modified} modified`}
          size="small"
          sx={{
            bgcolor: 'warning.dark',
            color: 'warning.contrastText',
            '& .MuiChip-icon': { color: 'warning.contrastText' },
          }}
        />
      )}

      {added > 0 && (
        <Chip
          icon={<AddIcon sx={{ fontSize: '0.875rem' }} />}
          label={`${added} added`}
          size="small"
          sx={{
            bgcolor: 'success.dark',
            color: 'success.contrastText',
            '& .MuiChip-icon': { color: 'success.contrastText' },
          }}
        />
      )}

      {deleted > 0 && (
        <Chip
          icon={<DeleteIcon sx={{ fontSize: '0.875rem' }} />}
          label={`${deleted} deleted`}
          size="small"
          sx={{
            bgcolor: 'error.dark',
            color: 'error.contrastText',
            '& .MuiChip-icon': { color: 'error.contrastText' },
          }}
        />
      )}
    </Box>
  );
}
