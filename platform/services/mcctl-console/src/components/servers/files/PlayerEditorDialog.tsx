'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Slide from '@mui/material/Slide';
import CloseIcon from '@mui/icons-material/Close';
import CodeIcon from '@mui/icons-material/Code';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BlockIcon from '@mui/icons-material/Block';
import type { TransitionProps } from '@mui/material/transitions';
import { forwardRef } from 'react';
import { WhitelistManager } from '@/components/players/WhitelistManager';
import { OpManager } from '@/components/players/OpManager';
import { BanManager } from '@/components/players/BanManager';

const SlideTransition = forwardRef(function SlideTransition(
  props: TransitionProps & { children: React.ReactElement },
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export type PlayerEditorType = 'whitelist' | 'ops' | 'bans';

interface PlayerEditorDialogProps {
  serverName: string;
  editorType: PlayerEditorType | null;
  filePath: string | null;
  onClose: () => void;
  onSwitchToRaw: (path: string) => void;
}

const editorConfig: Record<PlayerEditorType, { label: string; icon: React.ReactNode }> = {
  whitelist: { label: 'Whitelist Manager', icon: <PeopleIcon sx={{ mx: 1 }} /> },
  ops: { label: 'Operators Manager', icon: <AdminPanelSettingsIcon sx={{ mx: 1 }} /> },
  bans: { label: 'Ban List Manager', icon: <BlockIcon sx={{ mx: 1 }} /> },
};

export function getPlayerEditorType(fileName: string): PlayerEditorType | null {
  switch (fileName) {
    case 'whitelist.json':
      return 'whitelist';
    case 'ops.json':
      return 'ops';
    case 'banned-players.json':
      return 'bans';
    default:
      return null;
  }
}

export function PlayerEditorDialog({
  serverName,
  editorType,
  filePath,
  onClose,
  onSwitchToRaw,
}: PlayerEditorDialogProps) {
  const isOpen = editorType !== null;
  const config = editorType ? editorConfig[editorType] : null;

  return (
    <Dialog
      fullScreen
      open={isOpen}
      onClose={onClose}
      TransitionComponent={SlideTransition}
    >
      <AppBar sx={{ position: 'relative' }} color="default" elevation={1}>
        <Toolbar variant="dense">
          <IconButton edge="start" color="inherit" onClick={onClose} aria-label="close">
            <CloseIcon />
          </IconButton>
          {config?.icon}
          <Typography sx={{ flex: 1 }} variant="subtitle1" noWrap>
            {config?.label}
          </Typography>
          {filePath && (
            <Button
              size="small"
              startIcon={<CodeIcon />}
              onClick={() => {
                onClose();
                onSwitchToRaw(filePath);
              }}
            >
              Raw View
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 } }}>
        {editorType === 'whitelist' && <WhitelistManager serverName={serverName} />}
        {editorType === 'ops' && <OpManager serverName={serverName} />}
        {editorType === 'bans' && <BanManager serverName={serverName} />}
      </Box>
    </Dialog>
  );
}
