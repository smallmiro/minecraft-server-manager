'use client';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { BentoPanel } from '@/components/bento';
import type { PlatformSetting } from '@/types/platform-settings';
import { SettingField } from './SettingField';

export interface SettingsGroupCardProps {
  title: string;
  settings: PlatformSetting[];
  drafts: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export function SettingsGroupCard({ title, settings, drafts, errors, onChange }: SettingsGroupCardProps) {
  return (
    <BentoPanel
      role="region"
      aria-label={title}
      sx={{ p: 2.5, gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 6' } }}
    >
      <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
        {title}
      </Typography>
      <Stack spacing={2}>
        {settings.map((setting) => (
          <SettingField
            key={setting.key}
            setting={setting}
            draft={drafts[setting.key]}
            error={errors[setting.key]}
            onChange={onChange}
          />
        ))}
      </Stack>
    </BentoPanel>
  );
}
