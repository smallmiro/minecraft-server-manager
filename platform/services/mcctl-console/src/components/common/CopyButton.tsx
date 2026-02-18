'use client';

import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyButtonProps {
  text: string;
  size?: number;
}

export function CopyButton({ text, size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in insecure contexts
    }
  };

  return (
    <IconButton
      size="small"
      onClick={handleCopy}
      sx={{
        ml: 0.5,
        p: 0.25,
        color: copied ? 'success.main' : 'text.secondary',
        '&:hover': { bgcolor: 'action.hover' },
      }}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? <CheckIcon sx={{ fontSize: size }} /> : <ContentCopyIcon sx={{ fontSize: size }} />}
    </IconButton>
  );
}
