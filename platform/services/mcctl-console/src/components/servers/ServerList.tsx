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
import { ServerCard } from './ServerCard';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import type { ServerStatusMap } from '@/hooks/useServersSSE';

interface ServerListProps {
  servers: ServerSummary[];
  statusMap?: ServerStatusMap;
  onServerClick?: (serverName: string) => void;
  onStart?: (serverName: string) => void;
  onStop?: (serverName: string) => void;
  onCreate?: () => void;
  loadingServers?: string[];
}

type StatusFilter = 'all' | 'running' | 'stopped';

export function ServerList({
  servers,
  statusMap = {},
  onServerClick,
  onStart,
  onStop,
  onCreate,
  loadingServers = [],
}: ServerListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredServers = useMemo(() => {
    return servers.filter((server) => {
      // Filter by search query
      if (searchQuery && !server.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Get real-time status from SSE if available
      const sseStatus = statusMap[server.name];
      const currentStatus = sseStatus?.status || server.status;

      // Filter by status
      if (statusFilter === 'running' && currentStatus !== 'running') {
        return false;
      }
      if (statusFilter === 'stopped' && currentStatus !== 'stopped' && currentStatus !== 'exited' && currentStatus !== 'not_created') {
        return false;
      }

      return true;
    });
  }, [servers, statusMap, searchQuery, statusFilter]);

  const handleStatusFilterChange = (_: React.MouseEvent<HTMLElement>, newFilter: StatusFilter) => {
    if (newFilter !== null) {
      setStatusFilter(newFilter);
    }
  };

  if (servers.length === 0) {
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
          No servers found
        </Typography>
        {onCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
            Create Server
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
          value={statusFilter}
          exclusive
          onChange={handleStatusFilterChange}
          size="small"
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="running">Running</ToggleButton>
          <ToggleButton value="stopped">Stopped</ToggleButton>
        </ToggleButtonGroup>

        <TextField
          size="small"
          placeholder="Search servers..."
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

      {/* Server Count */}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {filteredServers.length} {filteredServers.length === 1 ? 'server' : 'servers'}
      </Typography>

      {/* Server Grid */}
      {filteredServers.length === 0 ? (
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
            No servers found
          </Typography>
        </Box>
      ) : (
        <Grid container spacing={2}>
          {filteredServers.map((server) => (
            <Grid item xs={12} sm={6} md={4} key={server.name}>
              <ServerCard
                server={server}
                statusOverride={statusMap[server.name]}
                onClick={onServerClick}
                onStart={onStart}
                onStop={onStop}
                loading={loadingServers.includes(server.name)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
