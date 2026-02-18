'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SearchIcon from '@mui/icons-material/Search';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import RefreshIcon from '@mui/icons-material/Refresh';

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateFolder: (name: string) => void;
  onRefresh: () => void;
  disabled?: boolean;
}

export function FileToolbar({ searchQuery, onSearchChange, onCreateFolder, onRefresh, disabled }: FileToolbarProps) {
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      setFolderDialogOpen(false);
    }
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 200, flex: { xs: '1 1 100%', sm: '0 1 auto' } }}
        />
        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          <Button
            size="small"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => setFolderDialogOpen(true)}
            disabled={disabled}
          >
            New Folder
          </Button>
          <Button
            size="small"
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={disabled}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateFolder} variant="contained" disabled={!folderName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
