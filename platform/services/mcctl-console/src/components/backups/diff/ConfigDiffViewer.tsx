'use client';

import { useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import type { FileDiff, FileDiffStatus } from '@/ports/api/IMcctlApiClient';
import type { DiffViewMode } from './ConfigDiffViewToggle';

// Dynamic import to avoid SSR issues with react-diff-viewer-continued
const ReactDiffViewer = dynamic(() => import('react-diff-viewer-continued'), { ssr: false });

interface ConfigDiffViewerProps {
  changes: FileDiff[];
  selectedFile?: string;
  viewMode: DiffViewMode;
}

function getStatusIcon(status: FileDiffStatus) {
  switch (status) {
    case 'added':
      return <AddCircleOutlineIcon fontSize="small" sx={{ color: 'success.main' }} />;
    case 'modified':
      return <EditOutlinedIcon fontSize="small" sx={{ color: 'warning.main' }} />;
    case 'deleted':
      return <RemoveCircleOutlineIcon fontSize="small" sx={{ color: 'error.main' }} />;
  }
}

function getStatusLabel(status: FileDiffStatus): string {
  switch (status) {
    case 'added':
      return 'added';
    case 'modified':
      return 'modified';
    case 'deleted':
      return 'deleted';
  }
}

function getStatusColor(status: FileDiffStatus): 'success' | 'warning' | 'error' {
  switch (status) {
    case 'added':
      return 'success';
    case 'modified':
      return 'warning';
    case 'deleted':
      return 'error';
  }
}

interface FileDiffSectionProps {
  change: FileDiff;
  viewMode: DiffViewMode;
  fileRef: (el: HTMLDivElement | null) => void;
}

function FileDiffSection({ change, viewMode, fileRef }: FileDiffSectionProps) {
  const oldValue = change.status === 'added' ? '' : (change.oldContent ?? '');
  const newValue = change.status === 'deleted' ? '' : (change.newContent ?? '');

  return (
    <Box
      ref={fileRef}
      sx={{ mb: 3 }}
      data-file-path={change.path}
      id={`diff-file-${change.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          bgcolor: 'background.default',
          borderTop: 1,
          borderBottom: 1,
          borderColor: 'divider',
          position: 'sticky',
          top: 0,
          zIndex: 1,
        }}
      >
        {getStatusIcon(change.status)}
        <Typography
          variant="body2"
          sx={{ fontFamily: 'monospace', fontWeight: 'bold', flex: 1 }}
        >
          {change.path}
        </Typography>
        <Chip
          label={getStatusLabel(change.status)}
          size="small"
          color={getStatusColor(change.status)}
          variant="outlined"
        />
      </Box>

      <Box sx={{ fontSize: '0.8rem', overflow: 'auto' }}>
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={viewMode === 'split'}
          useDarkTheme
          hideLineNumbers={false}
          showDiffOnly
          styles={{
            variables: {
              dark: {
                diffViewerBackground: '#1a1a1a',
                addedBackground: '#1a3a1a',
                addedColor: '#4caf50',
                removedBackground: '#3a1a1a',
                removedColor: '#f44336',
                wordAddedBackground: '#2d5a2d',
                wordRemovedBackground: '#5a2d2d',
                emptyLineBackground: '#1a1a1a',
                gutterBackground: '#111',
                gutterColor: '#555',
                codeFoldBackground: '#111',
                codeFoldGutterBackground: '#111',
              },
            },
          }}
        />
      </Box>
    </Box>
  );
}

/**
 * Right panel diff content renderer
 * Renders diff for all changed files with syntax highlighting
 */
export function ConfigDiffViewer({ changes, selectedFile, viewMode }: ConfigDiffViewerProps) {
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll to selected file
  useEffect(() => {
    if (selectedFile && fileRefs.current.has(selectedFile)) {
      const el = fileRefs.current.get(selectedFile);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedFile]);

  if (changes.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 4,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No differences between these snapshots
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        height: '100%',
        overflow: 'auto',
        '& table': { width: '100%' },
      }}
    >
      {changes.map((change, index) => (
        <Box key={change.path}>
          <FileDiffSection
            change={change}
            viewMode={viewMode}
            fileRef={(el) => {
              if (el) {
                fileRefs.current.set(change.path, el);
              } else {
                fileRefs.current.delete(change.path);
              }
            }}
          />
          {index < changes.length - 1 && <Divider />}
        </Box>
      ))}
    </Box>
  );
}
