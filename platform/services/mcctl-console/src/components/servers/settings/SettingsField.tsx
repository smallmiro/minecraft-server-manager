'use client';

import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Grid from '@mui/material/Grid';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import type { FieldConfig } from './fieldConfigs';

interface SettingsFieldProps {
  field: FieldConfig;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

export function SettingsField({ field, value, onChange }: SettingsFieldProps) {
  const [showPassword, setShowPassword] = useState(false);

  const gridColumns = field.columns ?? 6;

  const restartBadge = field.restartRequired ? (
    <Chip
      icon={<RestartAltIcon sx={{ fontSize: 14 }} />}
      label="Restart"
      size="small"
      sx={{
        ml: 1,
        height: 20,
        fontSize: 11,
        color: 'warning.main',
        borderColor: 'warning.main',
        '& .MuiChip-icon': { color: 'warning.main' },
      }}
      variant="outlined"
    />
  ) : null;

  const renderField = () => {
    switch (field.type) {
      case 'boolean':
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={value as boolean ?? false}
                    onChange={(e) => onChange(field.key, e.target.checked)}
                  />
                }
                label={field.label}
              />
              {restartBadge}
            </Box>
            {field.helperText && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 4, display: 'block' }}>
                {field.helperText}
              </Typography>
            )}
          </Box>
        );

      case 'select':
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {restartBadge}
            </Box>
            <FormControl fullWidth size="small">
              <InputLabel>{field.label}</InputLabel>
              <Select
                value={(value as string) ?? field.options?.[0]?.value ?? ''}
                label={field.label}
                onChange={(e) => onChange(field.key, e.target.value)}
              >
                {field.options?.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        );

      case 'number':
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {restartBadge}
            </Box>
            <TextField
              fullWidth
              size="small"
              type="number"
              label={field.label}
              value={value ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                onChange(field.key, v === '' ? undefined : parseInt(v, 10));
              }}
              inputProps={{
                min: field.validation?.min,
                max: field.validation?.max,
              }}
              helperText={field.helperText}
              InputProps={
                field.unit
                  ? {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="caption" color="text.secondary">
                            {field.unit}
                          </Typography>
                        </InputAdornment>
                      ),
                    }
                  : undefined
              }
            />
          </Box>
        );

      case 'password':
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {restartBadge}
            </Box>
            <TextField
              fullWidth
              size="small"
              type={showPassword ? 'text' : 'password'}
              label={field.label}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              helperText={field.helperText}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        );

      case 'string':
      default:
        return (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
              {restartBadge}
            </Box>
            <TextField
              fullWidth
              size="small"
              label={field.label}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(field.key, e.target.value)}
              helperText={field.helperText}
            />
          </Box>
        );
    }
  };

  return (
    <Grid item xs={12} sm={gridColumns}>
      {renderField()}
    </Grid>
  );
}
