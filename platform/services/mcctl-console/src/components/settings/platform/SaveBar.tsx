'use client';

import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

export interface SaveBarProps {
  dirtyCount: number;
  saving: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

/** Sticky bar shown only while there are unsaved changes. */
export function SaveBar({ dirtyCount, saving, onDiscard, onSave }: SaveBarProps) {
  if (dirtyCount === 0) return null;

  return (
    <Paper
      role="region"
      aria-label="Unsaved changes"
      elevation={8}
      sx={{
        position: 'sticky',
        bottom: 16,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: 3,
      }}
    >
      <Typography variant="body2" sx={{ flexGrow: 1 }}>
        {dirtyCount} unsaved {dirtyCount === 1 ? 'change' : 'changes'}
      </Typography>
      <Button onClick={onDiscard} disabled={saving}>
        Discard
      </Button>
      <Button variant="contained" onClick={onSave} disabled={saving}>
        Save Changes
      </Button>
    </Paper>
  );
}
