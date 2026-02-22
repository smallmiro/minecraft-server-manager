'use client';

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SettingsBackupRestoreIcon from '@mui/icons-material/SettingsBackupRestore';

export type BackupTabValue = 'world-backups' | 'config-snapshots';

interface BackupPageTabsProps {
  value: BackupTabValue;
  onChange: (value: BackupTabValue) => void;
}

/**
 * BackupPageTabs - Segment tab component for switching between World Backups and Config Snapshots.
 * Reusable tab control that preserves the selected tab in URL query parameters.
 */
export function BackupPageTabs({ value, onChange }: BackupPageTabsProps) {
  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
      <Tabs
        value={value}
        onChange={(_, newValue: BackupTabValue) => onChange(newValue)}
        aria-label="Backup management tabs"
      >
        <Tab
          value="world-backups"
          label="World Backups"
          icon={<CloudUploadIcon />}
          iconPosition="start"
          sx={{ textTransform: 'none', fontWeight: 'medium' }}
        />
        <Tab
          value="config-snapshots"
          label="Config Snapshots"
          icon={<SettingsBackupRestoreIcon />}
          iconPosition="start"
          sx={{ textTransform: 'none', fontWeight: 'medium' }}
        />
      </Tabs>
    </Box>
  );
}
