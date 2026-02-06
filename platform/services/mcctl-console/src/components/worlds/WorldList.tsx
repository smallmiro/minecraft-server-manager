'use client';

import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { WorldCard } from './WorldCard';
import type { World } from '@/ports/api/IMcctlApiClient';

interface WorldListProps {
  worlds: World[];
  onAssign?: (worldName: string) => void;
  onRelease?: (worldName: string) => void;
  onDelete?: (worldName: string) => void;
  onCreate?: () => void;
  loadingWorlds?: string[];
}

type LockFilter = 'all' | 'available' | 'locked';

export function WorldList({
  worlds,
  onAssign,
  onRelease,
  onDelete,
  onCreate,
  loadingWorlds = [],
}: WorldListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [lockFilter, setLockFilter] = useState<LockFilter>('all');

  const filteredWorlds = useMemo(() => {
    return worlds.filter((world) => {
      if (searchQuery && !world.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      if (lockFilter === 'available' && world.isLocked) {
        return false;
      }
      if (lockFilter === 'locked' && !world.isLocked) {
        return false;
      }

      return true;
    });
  }, [worlds, searchQuery, lockFilter]);

  const handleLockFilterChange = (_: React.MouseEvent<HTMLElement>, newFilter: LockFilter) => {
    if (newFilter !== null) {
      setLockFilter(newFilter);
    }
  };

  if (worlds.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          gap: 2,
        }}
      >
        <Typography variant="h6" color="text.secondary">
          No worlds found
        </Typography>
        {onCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
            Create World
          </Button>
        )}
      </Box>
    );
  }

  return (
    <Box>
      {/* Filters and Search */}
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 2,
          mb: 3,
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
        }}
      >
        <ToggleButtonGroup
          value={lockFilter}
          exclusive
          onChange={handleLockFilterChange}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="available">Available</ToggleButton>
          <ToggleButton value="locked">Locked</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Search worlds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: { xs: 1, sm: 0 }, minWidth: { sm: 300 } }}
        />
      </Box>

      {/* World Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filteredWorlds.length} {filteredWorlds.length === 1 ? 'world' : 'worlds'}
      </Typography>

      {/* World Grid */}
      {filteredWorlds.length === 0 ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            gap: 2,
          }}
        >
          <Typography variant="h6" color="text.secondary">
            No worlds found
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredWorlds.map((world) => (
            <Grid item xs={12} sm={6} md={4} key={world.name}>
              <WorldCard
                world={world}
                onAssign={onAssign}
                onRelease={onRelease}
                onDelete={onDelete}
                loading={loadingWorlds.includes(world.name)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
