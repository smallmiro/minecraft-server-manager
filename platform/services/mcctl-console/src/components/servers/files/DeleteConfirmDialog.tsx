'use client';

import { useState, useEffect, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import type { FileEntry } from '@/ports/api/IMcctlApiClient';

/**
 * Files/directories that require type-to-confirm before deletion.
 * These are critical server files where accidental deletion could be catastrophic.
 */
const DANGEROUS_NAMES = new Set([
  'world',
  'world_nether',
  'world_the_end',
  'server.jar',
  'server.properties',
  'plugins',
  'mods',
]);

function isDangerous(name: string): boolean {
  return DANGEROUS_NAMES.has(name.toLowerCase());
}

interface DeleteConfirmDialogProps {
  target: FileEntry | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmDialog({ target, isPending, onConfirm, onClose }: DeleteConfirmDialogProps) {
  const [confirmInput, setConfirmInput] = useState('');
  const dangerous = target ? isDangerous(target.name) : false;
  const isDirectory = target?.type === 'directory';
  const canConfirm = dangerous ? confirmInput === target?.name : true;

  useEffect(() => {
    if (!target) {
      setConfirmInput('');
    }
  }, [target]);

  const handleConfirm = useCallback(() => {
    if (canConfirm) {
      onConfirm();
    }
  }, [canConfirm, onConfirm]);

  return (
    <Dialog open={!!target} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete {isDirectory ? 'Folder' : 'File'}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Are you sure you want to delete <strong>{target?.name}</strong>?
          {isDirectory && ' This will delete all contents inside.'}
          {' '}This action cannot be undone.
        </DialogContentText>

        {dangerous && (
          <>
            <Alert severity="warning" sx={{ mt: 2 }}>
              <strong>{target?.name}</strong> is a critical server {isDirectory ? 'folder' : 'file'}.
              Deleting it may break your server.
            </Alert>
            <TextField
              autoFocus
              fullWidth
              label={`Type "${target?.name}" to confirm`}
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              placeholder={target?.name}
              sx={{ mt: 2 }}
              error={confirmInput.length > 0 && confirmInput !== target?.name}
            />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          color="error"
          variant="contained"
          disabled={isPending || !canConfirm}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
