'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import type { FileEntry } from '@/ports/api/IMcctlApiClient';

const INVALID_CHARS = /[/\\]/;
const TRAVERSAL_PATTERN = /\.\./;

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name cannot be empty';
  if (INVALID_CHARS.test(name)) return 'Name cannot contain / or \\';
  if (TRAVERSAL_PATTERN.test(name)) return 'Name cannot contain ".."';
  if (name.startsWith('.')) return 'Name cannot start with "."';
  return null;
}

interface RenameDialogProps {
  target: FileEntry | null;
  existingNames: string[];
  isPending: boolean;
  onConfirm: (newName: string) => void;
  onClose: () => void;
}

export function RenameDialog({ target, existingNames, isPending, onConfirm, onClose }: RenameDialogProps) {
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (target) {
      setNewName(target.name);
    }
  }, [target]);

  const validationError = useMemo(() => validateName(newName), [newName]);

  const isDuplicate = useMemo(
    () => newName.trim() !== target?.name && existingNames.some((n) => n.toLowerCase() === newName.trim().toLowerCase()),
    [newName, target?.name, existingNames],
  );

  const extensionChanged = useMemo(() => {
    if (!target || target.type === 'directory') return false;
    return getExtension(target.name) !== getExtension(newName);
  }, [target, newName]);

  const isUnchanged = newName.trim() === target?.name;

  const canConfirm = !validationError && !isDuplicate && !isUnchanged && !!newName.trim();

  const handleConfirm = useCallback(() => {
    if (canConfirm) {
      onConfirm(newName.trim());
    }
  }, [canConfirm, newName, onConfirm]);

  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rename</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="New name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          error={!!validationError || isDuplicate}
          helperText={
            validationError || (isDuplicate ? `"${newName.trim()}" already exists` : undefined)
          }
          sx={{ mt: 1 }}
        />

        {extensionChanged && !validationError && !isDuplicate && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Changing the file extension may make the file unusable.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={isPending || !canConfirm}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
}
