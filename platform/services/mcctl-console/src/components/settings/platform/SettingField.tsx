'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import type { PlatformSetting } from '@/types/platform-settings';

export interface SettingFieldProps {
  setting: PlatformSetting;
  /** Unsaved value typed by the admin. `undefined` means untouched. */
  draft?: string;
  error?: string;
  onChange: (key: string, value: string) => void;
}

/**
 * One renderer for every setting type, driven purely by API metadata.
 * Secrets are never pre-filled: only Configured / Not configured is shown.
 */
export function SettingField({ setting, draft, error, onChange }: SettingFieldProps) {
  const { key, label, type, secret, editable, choices } = setting;
  const value = draft ?? setting.value ?? '';
  const disabled = !editable;

  const helper = error ?? (setting.description || undefined);
  const common = {
    id: `setting-${key}`,
    label,
    disabled,
    error: !!error,
    helperText: helper,
    fullWidth: true,
    size: 'small' as const,
  };

  let control;
  if (secret) {
    control = (
      <TextField
        {...common}
        type="password"
        autoComplete="new-password"
        value={draft ?? ''}
        placeholder="Enter a new value to replace"
        onChange={(e) => onChange(key, e.target.value)}
      />
    );
  } else if (type === 'boolean') {
    control = (
      <FormControlLabel
        control={
          <Switch
            checked={value === 'true'}
            disabled={disabled}
            onChange={(e) => onChange(key, e.target.checked ? 'true' : 'false')}
          />
        }
        label={label}
      />
    );
  } else if (type === 'enum') {
    control = (
      <TextField {...common} select value={value} onChange={(e) => onChange(key, e.target.value)}>
        {(choices ?? []).map((choice) => (
          <MenuItem key={choice} value={choice}>
            {choice}
          </MenuItem>
        ))}
      </TextField>
    );
  } else {
    control = (
      <TextField
        {...common}
        value={value}
        inputProps={type === 'integer' || type === 'port' ? { inputMode: 'numeric' } : undefined}
        placeholder={type === 'ipv4-list' ? '10.0.0.1,10.0.0.2' : undefined}
        onChange={(e) => onChange(key, e.target.value)}
      />
    );
  }

  return (
    <Box>
      {control}
      {type === 'boolean' && helper && (
        <Box component="p" sx={{ m: 0, mt: 0.25, fontSize: 12, color: error ? 'error.main' : 'text.secondary' }}>
          {helper}
        </Box>
      )}
      <Stack direction="row" spacing={0.75} sx={{ mt: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
        {secret && (
          <Chip
            size="small"
            variant="outlined"
            color={setting.configured ? 'success' : 'default'}
            label={setting.configured ? 'Configured' : 'Not configured'}
          />
        )}
        {setting.restartScope !== 'none' && (
          <Chip size="small" variant="outlined" label={`Applies: ${setting.restartScope}`} />
        )}
        {setting.applied === false && <Chip size="small" color="warning" label="Restart pending" />}
        {!editable && <Chip size="small" variant="outlined" label="Read-only" />}
      </Stack>
    </Box>
  );
}
