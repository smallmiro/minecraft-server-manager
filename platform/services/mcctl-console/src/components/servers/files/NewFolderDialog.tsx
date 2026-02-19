'use client';

import { useState, useMemo, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';

const INVALID_CHARS = /[/\\]/;
const TRAVERSAL_PATTERN = /\.\./;

function validateFolderName(name: string): string | null {
  if (!name.trim()) return 'Folder name cannot be empty';
  if (INVALID_CHARS.test(name)) return 'Name cannot contain / or \\';
  if (TRAVERSAL_PATTERN.test(name)) return 'Name cannot contain ".."';
  if (name.startsWith('.')) return 'Name cannot start with "."';
  return null;
}

interface NewFolderDialogProps {
  open: boolean;
  existingNames: string[];
  isPending: boolean;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export function NewFolderDialog({ open, existingNames, isPending, onConfirm, onClose }: NewFolderDialogProps) {
  const [folderName, setFolderName] = useState('');

  const validationError = useMemo(() => validateFolderName(folderName), [folderName]);

  const isDuplicate = useMemo(
    () => existingNames.some((n) => n.toLowerCase() === folderName.trim().toLowerCase()),
    [folderName, existingNames],
  );

  const canConfirm = !validationError && !isDuplicate && !!folderName.trim();

  const handleConfirm = useCallback(() => {
    if (canConfirm) {
      onConfirm(folderName.trim());
      setFolderName('');
    }
  }, [canConfirm, folderName, onConfirm]);

  const handleClose = useCallback(() => {
    setFolderName('');
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Create New Folder</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Folder name"
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          error={(!!validationError && folderName.length > 0) || isDuplicate}
          helperText={
            (folderName.length > 0 && validationError) ||
            (isDuplicate ? `"${folderName.trim()}" already exists` : undefined)
          }
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={isPending || !canConfirm}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
