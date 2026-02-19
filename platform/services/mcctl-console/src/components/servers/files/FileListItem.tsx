'use client';

import { useState } from 'react';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DescriptionIcon from '@mui/icons-material/Description';
import InventoryIcon from '@mui/icons-material/Inventory';
import ArticleIcon from '@mui/icons-material/Article';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import EditIcon from '@mui/icons-material/Edit';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import type { FileEntry } from '@/ports/api/IMcctlApiClient';

interface FileListItemProps {
  file: FileEntry;
  currentPath: string;
  onNavigate: (path: string) => void;
  onAction: (action: string) => void;
}

function getFileIcon(file: FileEntry) {
  if (file.type === 'directory') {
    return <FolderIcon sx={{ color: '#FFB74D' }} />;
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (['yml', 'yaml', 'json', 'properties', 'toml', 'cfg', 'conf', 'ini', 'txt', 'md'].includes(ext)) {
    return <DescriptionIcon sx={{ color: '#42A5F5' }} />;
  }
  if (ext === 'jar') {
    return <InventoryIcon sx={{ color: '#AB47BC' }} />;
  }
  if (ext === 'log') {
    return <ArticleIcon sx={{ color: '#78909C' }} />;
  }
  if (['dat', 'dat_old', 'mca', 'nbt', 'lock'].includes(ext)) {
    return <AttachFileIcon sx={{ color: '#8D6E63' }} />;
  }

  return <InsertDriveFileIcon sx={{ color: '#90A4AE' }} />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isTextFile(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['yml', 'yaml', 'json', 'properties', 'toml', 'cfg', 'conf', 'ini', 'txt', 'md', 'log', 'xml', 'sh', 'bat', 'csv'].includes(ext);
}

export function FileListItem({ file, currentPath, onNavigate, onAction }: FileListItemProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  const handleClick = () => {
    if (file.type === 'directory') {
      const newPath = currentPath === '/' ? `/${file.name}` : `${currentPath}/${file.name}`;
      onNavigate(newPath);
    } else if (isTextFile(file.name)) {
      onAction('open');
    }
  };

  return (
    <>
      <TableRow
        hover
        sx={{ cursor: file.type === 'directory' || isTextFile(file.name) ? 'pointer' : 'default' }}
        onClick={handleClick}
      >
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {getFileIcon(file)}
            <Typography
              variant="body2"
              sx={{
                fontWeight: file.type === 'directory' ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {file.name}
            </Typography>
          </Box>
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
          <Typography variant="body2" color="text.secondary">
            {file.type === 'directory' ? '-' : formatFileSize(file.size)}
          </Typography>
        </TableCell>
        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
          <Typography variant="body2" color="text.secondary">
            {formatDate(file.modifiedAt)}
          </Typography>
        </TableCell>
        <TableCell>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setAnchorEl(e.currentTarget);
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>

      <Menu anchorEl={anchorEl} open={menuOpen} onClose={() => setAnchorEl(null)}>
        {file.type === 'directory' && (
          <MenuItem onClick={() => { setAnchorEl(null); handleClick(); }}>
            <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Open</ListItemText>
          </MenuItem>
        )}
        {file.type === 'file' && isTextFile(file.name) && (
          <MenuItem onClick={() => { setAnchorEl(null); onAction('open'); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Edit</ListItemText>
          </MenuItem>
        )}
        {file.type === 'file' && (
          <MenuItem onClick={() => { setAnchorEl(null); onAction('download'); }}>
            <ListItemIcon><DownloadIcon fontSize="small" /></ListItemIcon>
            <ListItemText>Download</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { setAnchorEl(null); onAction('rename'); }}>
          <ListItemIcon><DriveFileRenameOutlineIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setAnchorEl(null); onAction('delete'); }} sx={{ color: 'error.main' }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
