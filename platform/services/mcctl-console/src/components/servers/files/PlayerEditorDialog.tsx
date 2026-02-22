'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CodeIcon from '@mui/icons-material/Code';
import PeopleIcon from '@mui/icons-material/People';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BlockIcon from '@mui/icons-material/Block';
import { WhitelistManager } from '@/components/players/WhitelistManager';
import { OpManager } from '@/components/players/OpManager';
import { BanManager } from '@/components/players/BanManager';

export type PlayerEditorType = 'whitelist' | 'ops' | 'bans';

interface PlayerEditorViewProps {
  serverName: string;
  editorType: PlayerEditorType;
  filePath: string | null;
  onBack: () => void;
  onSwitchToRaw: (path: string) => void;
}

const editorConfig: Record<PlayerEditorType, { label: string; icon: React.ReactNode }> = {
  whitelist: { label: 'Whitelist Manager', icon: <PeopleIcon sx={{ color: 'primary.main' }} /> },
  ops: { label: 'Operators Manager', icon: <AdminPanelSettingsIcon sx={{ color: 'primary.main' }} /> },
  bans: { label: 'Ban List Manager', icon: <BlockIcon sx={{ color: 'primary.main' }} /> },
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
  onBack,
  onSwitchToRaw,
}: PlayerEditorViewProps) {
  const config = editorConfig[editorType];

  return (
    <Card sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton size="small" onClick={onBack} aria-label="back">
          <ArrowBackIcon />
        </IconButton>
        {config.icon}
        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
          {config.label}
        </Typography>
        {filePath && (
          <Button
            size="small"
            startIcon={<CodeIcon />}
            onClick={() => {
              onBack();
              onSwitchToRaw(filePath);
            }}
          >
            Raw View
          </Button>
        )}
      </Box>

      {/* Content */}
      <CardContent sx={{ flex: 1, overflow: 'auto', p: { xs: 1, sm: 2 }, '&:last-child': { pb: 2 } }}>
        {editorType === 'whitelist' && <WhitelistManager serverName={serverName} />}
        {editorType === 'ops' && <OpManager serverName={serverName} />}
        {editorType === 'bans' && <BanManager serverName={serverName} />}
      </CardContent>
    </Card>
  );
}
