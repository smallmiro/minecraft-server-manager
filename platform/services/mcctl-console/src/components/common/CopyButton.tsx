'use client';

import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useCopy } from '@/hooks/useCopy';

interface CopyButtonProps {
  text: string;
  size?: number;
}

const LABEL = { idle: 'Copy to clipboard', copied: 'Copied', failed: 'Copy failed' } as const;
const COLOR = { idle: 'text.secondary', copied: 'success.main', failed: 'error.main' } as const;

export function CopyButton({ text, size = 14 }: CopyButtonProps) {
  const { status, copy } = useCopy();
  const Icon = status === 'copied' ? CheckIcon : status === 'failed' ? ErrorOutlineIcon : ContentCopyIcon;

  return (
    <IconButton
      size="small"
      title={LABEL[status]}
      onClick={(e) => {
        e.stopPropagation();
        void copy(text);
      }}
      sx={{ ml: 0.5, p: 0.25, color: COLOR[status], '&:hover': { bgcolor: 'action.hover' } }}
      aria-label={LABEL[status]}
    >
      <Icon sx={{ fontSize: size }} />
    </IconButton>
  );
}
