'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface EditorStatusBarProps {
  language: string;
  fileSize: number;
  line: number;
  col: number;
  dirty: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function EditorStatusBar({ language, fileSize, line, col, dirty }: EditorStatusBarProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        px: 2,
        py: 0.5,
        bgcolor: 'grey.100',
        borderTop: 1,
        borderColor: 'divider',
        fontSize: '0.75rem',
        color: 'text.secondary',
        flexWrap: 'wrap',
        minHeight: 28,
      }}
    >
      <Typography variant="caption" sx={{ fontWeight: 500 }}>
        {language}
      </Typography>
      <Typography variant="caption">{formatFileSize(fileSize)}</Typography>
      <Typography variant="caption">UTF-8</Typography>
      <Typography variant="caption">
        Ln {line}, Col {col}
      </Typography>
      <Box sx={{ flex: 1 }} />
      {dirty && (
        <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 600 }}>
          Modified
        </Typography>
      )}
    </Box>
  );
}
