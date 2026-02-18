'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Slide from '@mui/material/Slide';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CircularProgress from '@mui/material/CircularProgress';

interface StickyActionBarProps {
  hasChanges: boolean;
  changedCount: number;
  hasRestartChanges: boolean;
  restartFields?: string[];
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function StickyActionBar({
  hasChanges,
  changedCount,
  hasRestartChanges,
  restartFields = [],
  isSaving,
  onSave,
  onDiscard,
}: StickyActionBarProps) {
  return (
    <Slide direction="up" in={hasChanges} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'sticky',
          bottom: 0,
          zIndex: 1100,
          bgcolor: 'background.paper',
          borderTop: 2,
          borderColor: 'primary.main',
          px: { xs: 2, sm: 3 },
          py: 2,
          mx: { xs: -2, sm: -3 },
          mb: { xs: -2, sm: -3 },
          boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {hasRestartChanges && (
            <RestartAltIcon sx={{ color: 'warning.main', fontSize: 20 }} />
          )}
          <Typography variant="body2" fontWeight={600}>
            {changedCount} unsaved change{changedCount !== 1 ? 's' : ''}
          </Typography>
          {hasRestartChanges && (
            <Typography variant="caption" color="warning.main">
              ({restartFields.length > 0 ? restartFields.join(', ') : 'some fields'} require restart)
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="text"
            color="inherit"
            onClick={onDiscard}
            disabled={isSaving}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : `Save Changes (${changedCount})`}
          </Button>
        </Box>
      </Box>
    </Slide>
  );
}
