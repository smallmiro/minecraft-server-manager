'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import RefreshIcon from '@mui/icons-material/Refresh';
import { NewFolderDialog } from './NewFolderDialog';

interface FileToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateFolder: (name: string) => void;
  onRefresh: () => void;
  existingNames: string[];
  disabled?: boolean;
}

export function FileToolbar({ searchQuery, onSearchChange, onCreateFolder, onRefresh, existingNames, disabled }: FileToolbarProps) {
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

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

      <NewFolderDialog
        open={folderDialogOpen}
        existingNames={existingNames}
        isPending={!!disabled}
        onConfirm={(name) => {
          onCreateFolder(name);
          setFolderDialogOpen(false);
        }}
        onClose={() => setFolderDialogOpen(false)}
      />
    </>
  );
}
