'use client';

import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import FolderIcon from '@mui/icons-material/Folder';
import type { FileEntry } from '@/ports/api/IMcctlApiClient';
import { FileListItem } from './FileListItem';

interface FileListProps {
  files: FileEntry[];
  currentPath: string;
  onNavigate: (path: string) => void;
  onFileAction: (action: string, file: FileEntry) => void;
  searchQuery: string;
}

export function FileList({ files, currentPath, onNavigate, onFileAction, searchQuery }: FileListProps) {
  const filteredFiles = searchQuery
    ? files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : files;

  if (filteredFiles.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 6 }}>
        <FolderIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
        <Typography variant="body1" color="text.secondary">
          {searchQuery ? 'No matching files found' : 'This directory is empty'}
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 100, display: { xs: 'none', sm: 'table-cell' } }}>Size</TableCell>
            <TableCell sx={{ fontWeight: 600, width: 160, display: { xs: 'none', md: 'table-cell' } }}>Modified</TableCell>
            <TableCell sx={{ width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {filteredFiles.map((file) => (
            <FileListItem
              key={file.name}
              file={file}
              currentPath={currentPath}
              onNavigate={onNavigate}
              onAction={(action) => onFileAction(action, file)}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
