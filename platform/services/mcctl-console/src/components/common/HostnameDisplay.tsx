'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Popover from '@mui/material/Popover';
import IconButton from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { parseHostnames, getPrimaryHostname } from '@/utils/hostname';

interface HostnameDisplayProps {
  hostname?: string;
  portSuffix?: number;
  color?: string;
  fontSize?: string | number;
  showCopyButton?: boolean;
}

function CopyButton({ text }: { text: string }) {
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
      {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
    </IconButton>
  );
}

export function HostnameDisplay({
  hostname,
  portSuffix,
  color = 'text.secondary',
  fontSize,
  showCopyButton = false,
}: HostnameDisplayProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const hosts = parseHostnames(hostname);
  const primary = getPrimaryHostname(hostname);

  const formatHost = (h: string) => (portSuffix ? `${h}:${portSuffix}` : h);

  // Use span-based elements to avoid <p> inside <p> nesting issues
  if (hosts.length === 0) {
    return (
      <Box
        component="span"
        sx={{ color, fontSize, display: 'inline' }}
      >
        -
      </Box>
    );
  }

  if (hosts.length === 1) {
    return (
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
        <Box
          component="span"
          sx={{
            color,
            fontSize,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {formatHost(primary)}
        </Box>
        {showCopyButton && <CopyButton text={formatHost(primary)} />}
      </Box>
    );
  }

  // Multiple hostnames: primary + (+N) chip with Popover
  const handleChipClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
      <Box
        component="span"
        sx={{
          color,
          fontSize,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {formatHost(primary)}
      </Box>
      <Chip
        label={`+${hosts.length - 1}`}
        size="small"
        onClick={handleChipClick}
        sx={{
          height: 20,
          fontSize: 11,
          cursor: 'pointer',
          '& .MuiChip-label': { px: 0.75 },
        }}
      />
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 200 }}>
          {hosts.map((h) => (
            <Box
              key={h}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                py: 0.5,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontFamily: '"Roboto Mono", monospace',
                  fontSize: 12,
                }}
              >
                {formatHost(h)}
              </Typography>
              <CopyButton text={formatHost(h)} />
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
