'use client';

import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import type { PropertySchema } from './serverPropertiesSchema';

interface PropertyFieldProps {
  schema: PropertySchema;
  value: string;
  onChange: (key: string, value: string) => void;
  isChanged: boolean;
}

const modifiedChip = <Chip label="modified" size="small" color="warning" variant="outlined" />;

export function PropertyField({ schema, value, onChange, isChanged }: PropertyFieldProps) {
  const fieldSx = isChanged
    ? { '& .MuiInputBase-root': { bgcolor: 'action.selected' } }
    : undefined;

  const endAdornment = isChanged ? (
    <InputAdornment position="end">{modifiedChip}</InputAdornment>
  ) : undefined;

  switch (schema.type) {
    case 'boolean':
      return (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={value === 'true'}
                  onChange={(e) => onChange(schema.key, e.target.checked ? 'true' : 'false')}
                  size="small"
                />
              }
              label={schema.label}
              sx={{ mr: 0 }}
            />
            {isChanged && modifiedChip}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ ml: '48px', display: 'block', mt: -0.5 }}>
            {schema.description}
          </Typography>
        </Box>
      );

    case 'enum':
      return (
        <TextField
          select
          fullWidth
          size="small"
          label={schema.label}
          helperText={schema.description}
          value={value}
          onChange={(e) => onChange(schema.key, e.target.value)}
          InputProps={{
            endAdornment,
          }}
          sx={fieldSx}
        >
          {schema.options?.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </TextField>
      );

    case 'number':
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          label={schema.label}
          helperText={schema.description}
          value={value}
          onChange={(e) => onChange(schema.key, e.target.value)}
          inputProps={{
            min: schema.min,
            max: schema.max,
          }}
          InputProps={{
            endAdornment,
          }}
          sx={fieldSx}
        />
      );

    case 'readonly':
      return (
        <TextField
          fullWidth
          size="small"
          label={schema.label}
          helperText={schema.description}
          value={value}
          disabled
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Chip label="readonly" size="small" variant="outlined" />
              </InputAdornment>
            ),
          }}
        />
      );

    case 'string':
    default:
      return (
        <TextField
          fullWidth
          size="small"
          label={schema.label}
          helperText={schema.description}
          value={value}
          onChange={(e) => onChange(schema.key, e.target.value)}
          InputProps={{
            endAdornment,
          }}
          sx={fieldSx}
        />
      );
  }
}
