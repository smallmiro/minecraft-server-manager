'use client';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

interface RestartConfirmDialogProps {
  open: boolean;
  changedFields: string[];
  onSaveOnly: () => void;
  onSaveAndRestart: () => void;
  onCancel: () => void;
}

export function RestartConfirmDialog({
  open,
  changedFields,
  onSaveOnly,
  onSaveAndRestart,
  onCancel,
}: RestartConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RestartAltIcon color="warning" />
          <Typography variant="h6" fontWeight={600}>
            Restart Required
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body1" gutterBottom>
          The following changes require a server restart to take effect:
        </Typography>
        <List dense>
          {changedFields.map((field) => (
            <ListItem key={field} sx={{ py: 0 }}>
              <ListItemText
                primary={field}
                primaryTypographyProps={{ variant: 'body2', fontFamily: 'monospace' }}
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={onSaveOnly} variant="outlined">
          Save Only
        </Button>
        <Button onClick={onSaveAndRestart} variant="contained" color="warning">
          Save & Restart
        </Button>
      </DialogActions>
    </Dialog>
  );
}
