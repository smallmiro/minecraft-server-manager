'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { BentoPanel } from '@/components/bento';
import type { PlatformSetting } from '@/types/platform-settings';
import { SettingField } from './SettingField';

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface AdvancedEnvCardProps {
  /** Unknown keys already in .env */
  settings: PlatformSetting[];
  /** Every key already known (any status), to reject duplicates */
  existingKeys: Set<string>;
  drafts: Record<string, string>;
  errors: Record<string, string>;
  removed: Set<string>;
  onChange: (key: string, value: string) => void;
  onToggleRemove: (key: string) => void;
}

function addedRow(key: string): PlatformSetting {
  return {
    key,
    label: key,
    description: 'New key (unsaved)',
    group: 'Advanced',
    type: 'string',
    status: 'unknown',
    source: 'unknown',
    editable: true,
    secret: false,
    restartScope: 'servers',
  };
}

export function AdvancedEnvCard({
  settings,
  existingKeys,
  drafts,
  errors,
  removed,
  onChange,
  onToggleRemove,
}: AdvancedEnvCardProps) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Added-but-unsaved keys are drafts whose key is not in the API response.
  const addedKeys = Object.keys(drafts).filter((k) => !existingKeys.has(k));
  const rows = [...settings, ...addedKeys.map(addedRow)];

  const handleAdd = () => {
    const key = newKey.trim();
    if (!KEY_RE.test(key)) {
      setAddError('Invalid key name. Use letters, digits and underscores, not starting with a digit.');
      return;
    }
    if (existingKeys.has(key) || key in drafts) {
      setAddError(`${key} already exists.`);
      return;
    }
    onChange(key, newValue);
    setNewKey('');
    setNewValue('');
    setAddError(null);
  };

  return (
    <BentoPanel
      role="region"
      aria-label="Advanced Environment"
      sx={{ p: 2.5, gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' } }}
    >
      <Typography variant="h6" component="h2">
        Advanced Environment
      </Typography>
      <Alert severity="warning" sx={{ my: 2 }}>
        Not recognized by mcctl. Loaded by mcctl-api at startup; Minecraft servers receive a key only
        if its name is listed in servers/global.env.
      </Alert>

      <Stack spacing={2}>
        {rows.map((s) => {
          const isRemoved = removed.has(s.key);
          return (
            <Box key={s.key} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', opacity: isRemoved ? 0.55 : 1 }}>
              <Box sx={{ flexGrow: 1 }}>
                <SettingField
                  setting={isRemoved ? { ...s, editable: false } : s}
                  draft={drafts[s.key]}
                  error={errors[s.key]}
                  onChange={onChange}
                />
              </Box>
              <Button
                size="small"
                color={isRemoved ? 'inherit' : 'warning'}
                aria-label={`${isRemoved ? 'Keep' : 'Remove'} ${s.key}`}
                onClick={() => onToggleRemove(s.key)}
                sx={{ mt: 0.5 }}
              >
                {isRemoved ? 'Undo' : 'Remove'}
              </Button>
            </Box>
          );
        })}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="New key"
            value={newKey}
            error={!!addError}
            helperText={addError ?? undefined}
            onChange={(e) => setNewKey(e.target.value)}
            sx={{ minWidth: 200 }}
          />
          <TextField
            size="small"
            label="New value"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            sx={{ flexGrow: 1, minWidth: 200 }}
          />
          <Button variant="outlined" onClick={handleAdd} sx={{ mt: 0.25 }}>
            Add
          </Button>
        </Box>
      </Stack>
    </BentoPanel>
  );
}
