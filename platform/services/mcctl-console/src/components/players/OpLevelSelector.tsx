/**
 * OpLevelSelector Component
 * Reusable OP level selection with radio buttons
 */

'use client';

import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

/**
 * Level configuration
 */
const LEVELS = [
  {
    value: 1,
    label: 'Level 1 - Moderator',
    description: 'Bypass spawn protection',
    icon: '🛡️',
  },
  {
    value: 2,
    label: 'Level 2 - Gamemaster',
    description: 'Cheats, command blocks',
    icon: '🎮',
  },
  {
    value: 3,
    label: 'Level 3 - Admin',
    description: 'Player management commands',
    icon: '⚙️',
  },
  {
    value: 4,
    label: 'Level 4 - Owner',
    description: 'Full server control',
    icon: '👑',
  },
] as const;

/**
 * OpLevelSelector Props
 */
export interface OpLevelSelectorProps {
  /**
   * Selected level value (1-4)
   */
  value: 1 | 2 | 3 | 4;

  /**
   * onChange callback with new level
   */
  onChange: (level: 1 | 2 | 3 | 4) => void;

  /**
   * Optional label for the radio group
   */
  label?: string;

  /**
   * Disabled state
   * @default false
   */
  disabled?: boolean;
}

/**
 * OpLevelSelector - Radio group for OP level selection
 */
export function OpLevelSelector({ value, onChange, label, disabled = false }: OpLevelSelectorProps) {
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange(parseInt(event.target.value, 10) as 1 | 2 | 3 | 4);
  };

  return (
    <FormControl component="fieldset" fullWidth disabled={disabled}>
      {label && (
        <FormLabel component="legend" sx={{ mb: 1 }}>
          {label}
        </FormLabel>
      )}
      <RadioGroup value={value} onChange={handleChange}>
        {LEVELS.map((level) => (
          <FormControlLabel
            key={level.value}
            value={level.value}
            control={<Radio />}
            label={
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography component="span">{level.icon}</Typography>
                  <Typography component="span" fontWeight="medium">
                    {level.label}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 4 }}>
                  {level.description}
                </Typography>
              </Box>
            }
            sx={{ alignItems: 'flex-start', py: 1 }}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}
