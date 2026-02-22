'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import ViewStreamIcon from '@mui/icons-material/ViewStream';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';

export type DiffViewMode = 'unified' | 'split';

interface ConfigDiffViewToggleProps {
  value: DiffViewMode;
  onChange: (mode: DiffViewMode) => void;
}

/**
 * Toggle button group to switch between unified and side-by-side diff views
 */
export function ConfigDiffViewToggle({ value, onChange }: ConfigDiffViewToggleProps) {
  const handleChange = (_event: React.MouseEvent<HTMLElement>, newMode: DiffViewMode | null) => {
    // Prevent deselection - at least one mode must be active
    if (newMode !== null) {
      onChange(newMode);
    }
  };

  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      onChange={handleChange}
      aria-label="Diff view mode"
      size="small"
    >
      <Tooltip title="Unified diff view">
        <ToggleButton value="unified" aria-label="Unified view">
          <ViewStreamIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Side-by-side diff view">
        <ToggleButton value="split" aria-label="Split view">
          <ViewColumnIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
    </ToggleButtonGroup>
  );
}
