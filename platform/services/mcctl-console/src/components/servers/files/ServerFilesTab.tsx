'use client';

import { useState, useCallback, useMemo } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Snackbar from '@mui/material/Snackbar';
import { useServerFiles, useDeleteFile, useCreateDirectory, useRenameFile } from '@/hooks/use-server-files';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileToolbar } from './FileToolbar';
import { FileList } from './FileList';
import { TextEditor } from './TextEditor';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { RenameDialog } from './RenameDialog';
import { PlayerEditorDialog, getPlayerEditorType } from './PlayerEditorDialog';
import type { PlayerEditorType } from './PlayerEditorDialog';
import { ServerPropertiesDialog, isServerPropertiesFile } from './ServerPropertiesDialog';
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

  // Text editor
  const [editorFilePath, setEditorFilePath] = useState<string | null>(null);

  // Player editor (Smart Routing)
  const [playerEditorType, setPlayerEditorType] = useState<PlayerEditorType | null>(null);
  const [playerEditorPath, setPlayerEditorPath] = useState<string | null>(null);

  // Server properties editor
  const [propertiesEditorOpen, setPropertiesEditorOpen] = useState(false);
  const [propertiesFilePath, setPropertiesFilePath] = useState<string | null>(null);

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
    switch (action) {
      case 'delete':
        setDeleteTarget(file);
        break;
      case 'rename':
        setRenameTarget(file);
        break;
      case 'open': {
        const path = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
        if (currentPath === '/' && isServerPropertiesFile(file.name)) {
          setPropertiesFilePath(path);
          setPropertiesEditorOpen(true);
        } else {
          const specialEditor = currentPath === '/' ? getPlayerEditorType(file.name) : null;
          if (specialEditor) {
            setPlayerEditorType(specialEditor);
            setPlayerEditorPath(path);
          } else {
            setEditorFilePath(path);
          }
        }
        break;
      }
    }
  }, [currentPath]);

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

  const handleConfirmRename = useCallback((newName: string) => {
    if (!renameTarget) return;
    const oldPath = currentPath === '/' ? `/${renameTarget.name}` : `${currentPath}/${renameTarget.name}`;
    const renamePath = currentPath === '/' ? `/${newName}` : `${currentPath}/${newName}`;

    renameFile.mutate({ oldPath, newPath: renamePath }, {
      onSuccess: () => {
        showSnackbar(`Renamed to "${newName}"`);
        setRenameTarget(null);
      },
      onError: (err) => {
        showSnackbar(err.message, 'error');
        setRenameTarget(null);
      },
    });
  }, [renameTarget, currentPath, renameFile, showSnackbar]);

  const existingNames = useMemo(
    () => (data?.files || []).map((f) => f.name),
    [data?.files],
  );

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
            existingNames={existingNames}
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

      {/* Delete Confirmation Dialog (with type-to-confirm for dangerous files) */}
      <DeleteConfirmDialog
        target={deleteTarget}
        isPending={deleteFile.isPending}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Rename Dialog (with extension change warning + validation) */}
      <RenameDialog
        target={renameTarget}
        existingNames={existingNames}
        isPending={renameFile.isPending}
        onConfirm={handleConfirmRename}
        onClose={() => setRenameTarget(null)}
      />

      {/* Text Editor */}
      <TextEditor
        serverName={serverName}
        filePath={editorFilePath}
        onClose={() => setEditorFilePath(null)}
      />

      {/* Server Properties Editor */}
      <ServerPropertiesDialog
        serverName={serverName}
        open={propertiesEditorOpen}
        filePath={propertiesFilePath}
        onClose={() => {
          setPropertiesEditorOpen(false);
          setPropertiesFilePath(null);
        }}
      />

      {/* Player Editor (Smart Routing) */}
      <PlayerEditorDialog
        serverName={serverName}
        editorType={playerEditorType}
        filePath={playerEditorPath}
        onClose={() => {
          setPlayerEditorType(null);
          setPlayerEditorPath(null);
        }}
        onSwitchToRaw={(path) => {
          setPlayerEditorType(null);
          setPlayerEditorPath(null);
          setEditorFilePath(path);
        }}
      />

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
