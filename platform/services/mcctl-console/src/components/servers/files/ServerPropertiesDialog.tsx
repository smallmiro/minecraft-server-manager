'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Box from '@mui/material/Box';
import Slide from '@mui/material/Slide';
import CloseIcon from '@mui/icons-material/Close';
import TuneIcon from '@mui/icons-material/Tune';
import CodeIcon from '@mui/icons-material/Code';
import ListAltIcon from '@mui/icons-material/ListAlt';
import type { TransitionProps } from '@mui/material/transitions';
import { forwardRef } from 'react';
import { ServerPropertiesEditor } from './ServerPropertiesEditor';
import { TextEditor } from './TextEditor';

const SlideTransition = forwardRef(function SlideTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

type ViewMode = 'form' | 'raw';

interface ServerPropertiesDialogProps {
  serverName: string;
  open: boolean;
  filePath: string | null;
  onClose: () => void;
}

export function ServerPropertiesDialog({
  serverName,
  open,
  filePath,
  onClose,
}: ServerPropertiesDialogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('form');

  // When dialog closes, reset view mode
  const handleClose = () => {
    onClose();
    setViewMode('form');
  };

  if (viewMode === 'raw' && filePath) {
    return (
      <TextEditor
        serverName={serverName}
        filePath={filePath}
        onClose={handleClose}
      />
    );
  }

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={handleClose}
      TransitionComponent={SlideTransition}
    >
      <AppBar sx={{ position: 'relative' }} color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" onClick={handleClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          <TuneIcon sx={{ mx: 1, color: 'primary.main' }} />
          <Typography sx={{ flex: 1 }} variant="subtitle1" noWrap>
            server.properties
          </Typography>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, v) => v && setViewMode(v)}
            size="small"
          >
            <ToggleButton value="form">
              <ListAltIcon fontSize="small" sx={{ mr: 0.5 }} />
              Form
            </ToggleButton>
            <ToggleButton value="raw">
              <CodeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Raw
            </ToggleButton>
          </ToggleButtonGroup>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <ServerPropertiesEditor serverName={serverName} />
      </Box>
    </Dialog>
  );
}

export function isServerPropertiesFile(fileName: string): boolean {
  return fileName === 'server.properties';
}
