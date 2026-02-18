'use client';

import { useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useServerFiles, useDeleteFile, useCreateDirectory, useRenameFile } from '@/hooks/use-server-files';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileToolbar } from './FileToolbar';
import { FileList } from './FileList';
import type { FileEntry } from '@/ports/api/IMcctlApiClient';

interface ServerFilesTabProps {
  serverName: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export function ServerFilesTab({ serverName }: ServerFilesTabProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [searchQuery, setSearchQuery] = useState('');
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'info' });

  // Delete confirmation dialog
  const [deleteTarget, setDeleteTarget] = useState<FileEntry | null>(null);

  // Rename dialog
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [newName, setNewName] = useState('');

  const { data, isLoading, error, refetch } = useServerFiles(serverName, currentPath);
  const deleteFile = useDeleteFile(serverName);
  const createDirectory = useCreateDirectory(serverName);
  const renameFile = useRenameFile(serverName);

  const showSnackbar = useCallback((message: string, severity: SnackbarState['severity'] = 'success') => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const handleNavigate = useCallback((path: string) => {
    setCurrentPath(path);
    setSearchQuery('');
  }, []);

  const handleCreateFolder = useCallback((name: string) => {
    const folderPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    createDirectory.mutate({ path: folderPath }, {
      onSuccess: () => showSnackbar(`Folder "${name}" created`),
      onError: (err) => showSnackbar(err.message, 'error'),
    });
  }, [currentPath, createDirectory, showSnackbar]);

  const handleFileAction = useCallback((action: string, file: FileEntry) => {
    const filePath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;

    switch (action) {
      case 'delete':
        setDeleteTarget(file);
        break;
      case 'rename':
        setRenameTarget(file);
        setNewName(file.name);
        break;
      case 'open':
        // Will be implemented in Phase 2 (Text Editor)
        showSnackbar('File editor will be available in the next update', 'info');
        break;
    }
  }, [currentPath, showSnackbar]);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    const filePath = currentPath === '/' ? `/${deleteTarget.name}` : `${currentPath}/${deleteTarget.name}`;

    deleteFile.mutate({ path: filePath }, {
      onSuccess: () => {
        showSnackbar(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      },
      onError: (err) => {
        showSnackbar(err.message, 'error');
        setDeleteTarget(null);
      },
    });
  }, [deleteTarget, currentPath, deleteFile, showSnackbar]);

  const handleConfirmRename = useCallback(() => {
    if (!renameTarget || !newName.trim()) return;
    const oldPath = currentPath === '/' ? `/${renameTarget.name}` : `${currentPath}/${renameTarget.name}`;
    const renamePath = currentPath === '/' ? `/${newName.trim()}` : `${currentPath}/${newName.trim()}`;

    renameFile.mutate({ oldPath, newPath: renamePath }, {
      onSuccess: () => {
        showSnackbar(`Renamed to "${newName.trim()}"`);
        setRenameTarget(null);
      },
      onError: (err) => {
        showSnackbar(err.message, 'error');
        setRenameTarget(null);
      },
    });
  }, [renameTarget, newName, currentPath, renameFile, showSnackbar]);

  if (isLoading) {
    return (
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Skeleton variant="text" width={300} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ mb: 0.5 }} />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ borderRadius: 3 }}>
        Failed to load files: {error.message}
      </Alert>
    );
  }

  return (
    <>
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <FileBreadcrumb path={currentPath} onNavigate={handleNavigate} />
          <FileToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onCreateFolder={handleCreateFolder}
            onRefresh={() => refetch()}
            disabled={createDirectory.isPending}
          />
          <FileList
            files={data?.files || []}
            currentPath={currentPath}
            onNavigate={handleNavigate}
            onFileAction={handleFileAction}
            searchQuery={searchQuery}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete {deleteTarget?.type === 'directory' ? 'Folder' : 'File'}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
            {deleteTarget?.type === 'directory' && ' This will delete all contents inside.'}
            {' '}This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={deleteFile.isPending}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="New name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameTarget(null)}>Cancel</Button>
          <Button
            onClick={handleConfirmRename}
            variant="contained"
            disabled={!newName.trim() || newName === renameTarget?.name || renameFile.isPending}
          >
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}
