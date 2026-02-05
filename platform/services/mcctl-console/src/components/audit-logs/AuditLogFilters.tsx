'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { AuditLogQueryParams, AuditAction } from '@/types/audit-log';
import { ALL_AUDIT_ACTIONS, AUDIT_ACTION_LABELS, SERVER_ACTIONS, PLAYER_ACTIONS } from '@/types/audit-log';

export interface AuditLogFiltersProps {
  filters: AuditLogQueryParams;
  onFiltersChange: (filters: AuditLogQueryParams) => void;
  onExport?: () => void;
}

/**
 * Count active filters (non-empty filter values)
 */
function countActiveFilters(filters: AuditLogQueryParams): number {
  let count = 0;
  if (filters.action) count++;
  if (filters.actor) count++;
  if (filters.targetType) count++;
  if (filters.targetName) count++;
  if (filters.status) count++;
  if (filters.from) count++;
  if (filters.to) count++;
  return count;
}

/**
 * Get available actions based on target type
 */
function getAvailableActions(targetType?: string): AuditAction[] {
  if (targetType === 'server') return SERVER_ACTIONS;
  if (targetType === 'player') return PLAYER_ACTIONS;
  return ALL_AUDIT_ACTIONS;
}

/**
 * Audit log filter bar component
 * Collapsible with active filter count badge
 */
export function AuditLogFilters({ filters, onFiltersChange, onExport }: AuditLogFiltersProps) {
  const [expanded, setExpanded] = useState(true);
  const activeCount = countActiveFilters(filters);
  const availableActions = getAvailableActions(filters.targetType);

  const handleChange = (key: keyof AuditLogQueryParams, value: string | undefined) => {
    const newFilters = { ...filters };
    if (value === '' || value === undefined) {
      delete newFilters[key];
    } else {
      (newFilters as Record<string, unknown>)[key] = value;
    }

    // Auto-correct: clear action if it doesn't match the new targetType
    if (key === 'targetType' && newFilters.action) {
      const newAvailable = getAvailableActions(value);
      if (!newAvailable.includes(newFilters.action as AuditAction)) {
        delete newFilters.action;
      }
    }

    // Reset pagination on filter change
    newFilters.offset = 0;

    onFiltersChange(newFilters);
  };

  const handleClearAll = () => {
    onFiltersChange({
      limit: filters.limit,
      sort: filters.sort,
    });
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Filter header with toggle */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: expanded ? 2 : 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={() => setExpanded(!expanded)}
            size="small"
            aria-label={expanded ? 'Collapse filters' : 'Expand filters'}
          >
            <FilterListIcon />
            {expanded ? <ExpandLessIcon sx={{ fontSize: 14 }} /> : <ExpandMoreIcon sx={{ fontSize: 14 }} />}
          </IconButton>
          <Typography variant="subtitle2" color="text.secondary">
            Filters
          </Typography>
          {activeCount > 0 && (
            <Chip
              label={activeCount}
              size="small"
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {activeCount > 0 && (
            <Button
              size="small"
              startIcon={<ClearAllIcon />}
              onClick={handleClearAll}
              color="inherit"
            >
              Clear All
            </Button>
          )}
          {onExport && (
            <Button
              size="small"
              variant="outlined"
              onClick={onExport}
            >
              Export
            </Button>
          )}
        </Box>
      </Box>

      {/* Collapsible filter bar */}
      <Collapse in={expanded}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Date Range */}
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              type="date"
              label="From"
              size="small"
              value={filters.from ? filters.from.split('T')[0] : ''}
              onChange={(e) => {
                const value = e.target.value;
                handleChange('from', value ? `${value}T00:00:00Z` : undefined);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <Typography variant="body2" color="text.secondary">~</Typography>
            <TextField
              type="date"
              label="To"
              size="small"
              value={filters.to ? filters.to.split('T')[0] : ''}
              onChange={(e) => {
                const value = e.target.value;
                handleChange('to', value ? `${value}T23:59:59Z` : undefined);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
          </Box>

          {/* Action */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Action</InputLabel>
            <Select
              value={filters.action || ''}
              label="Action"
              onChange={(e) => handleChange('action', e.target.value || undefined)}
            >
              <MenuItem value="">All Actions</MenuItem>
              {availableActions.map((action) => (
                <MenuItem key={action} value={action}>
                  {AUDIT_ACTION_LABELS[action] || action}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Target Type */}
          <Box>
            <ToggleButtonGroup
              value={filters.targetType || ''}
              exclusive
              onChange={(_, value) => handleChange('targetType', value || undefined)}
              size="small"
            >
              <ToggleButton value="" aria-label="All targets">All</ToggleButton>
              <ToggleButton value="server" aria-label="Server targets">Server</ToggleButton>
              <ToggleButton value="player" aria-label="Player targets">Player</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Status */}
          <Box>
            <ToggleButtonGroup
              value={filters.status || ''}
              exclusive
              onChange={(_, value) => handleChange('status', value || undefined)}
              size="small"
            >
              <ToggleButton value="" aria-label="All statuses">All</ToggleButton>
              <ToggleButton value="success" aria-label="Success only">Success</ToggleButton>
              <ToggleButton value="failure" aria-label="Failure only">Failure</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Target Name Search */}
          <TextField
            label="Target Name"
            placeholder="Search..."
            size="small"
            value={filters.targetName || ''}
            onChange={(e) => handleChange('targetName', e.target.value || undefined)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 0.5, fontSize: 18 }} />,
            }}
            sx={{ minWidth: 160 }}
          />

          {/* Actor */}
          <TextField
            label="Actor"
            placeholder="e.g., api:admin"
            size="small"
            value={filters.actor || ''}
            onChange={(e) => handleChange('actor', e.target.value || undefined)}
            sx={{ minWidth: 140 }}
          />
        </Box>
      </Collapse>
    </Box>
  );
}
