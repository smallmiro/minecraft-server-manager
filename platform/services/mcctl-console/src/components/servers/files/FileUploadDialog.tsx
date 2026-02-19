'use client';

import { useState, useRef, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import Alert from '@mui/material/Alert';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

interface FileUploadDialogProps {
  open: boolean;
  isPending: boolean;
  onUpload: (files: File[]) => void;
  onClose: () => void;
}

export function FileUploadDialog({ open, isPending, onUpload, onClose }: FileUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const oversizedFiles = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    setSelectedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      const unique = arr.filter((f) => !names.has(f.name));
      return [...prev, ...unique];
    });
  }, []);

  const removeFile = useCallback((name: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const handleUpload = useCallback(() => {
    if (selectedFiles.length > 0 && oversizedFiles.length === 0) {
      onUpload(selectedFiles);
    }
  }, [selectedFiles, oversizedFiles, onUpload]);

  const handleClose = useCallback(() => {
    if (!isPending) {
      setSelectedFiles([]);
      onClose();
    }
  }, [isPending, onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Upload Files</DialogTitle>
      <DialogContent>
        {/* Drop zone */}
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: dragActive ? 'action.hover' : 'transparent',
            transition: 'all 0.2s',
            '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
          }}
        >
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            Drag &amp; drop files here, or click to browse
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Max {formatFileSize(MAX_FILE_SIZE)} per file
          </Typography>
        </Box>

        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              addFiles(e.target.files);
              e.target.value = '';
            }
          }}
        />

        {/* Selected files */}
        {selectedFiles.length > 0 && (
          <List dense sx={{ mt: 2 }}>
            {selectedFiles.map((file) => (
              <ListItem
                key={file.name}
                secondaryAction={
                  <IconButton edge="end" size="small" onClick={() => removeFile(file.name)} disabled={isPending}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemIcon><InsertDriveFileIcon /></ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={formatFileSize(file.size)}
                  primaryTypographyProps={{
                    noWrap: true,
                    color: file.size > MAX_FILE_SIZE ? 'error' : 'text.primary',
                  }}
                />
              </ListItem>
            ))}
          </List>
        )}

        {oversizedFiles.length > 0 && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {oversizedFiles.length === 1
              ? `"${oversizedFiles[0].name}" exceeds the ${formatFileSize(MAX_FILE_SIZE)} limit`
              : `${oversizedFiles.length} files exceed the ${formatFileSize(MAX_FILE_SIZE)} limit`}
          </Alert>
        )}

        {isPending && <LinearProgress sx={{ mt: 2 }} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isPending}>Cancel</Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          startIcon={<CloudUploadIcon />}
          disabled={isPending || selectedFiles.length === 0 || oversizedFiles.length > 0}
        >
          Upload {selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
