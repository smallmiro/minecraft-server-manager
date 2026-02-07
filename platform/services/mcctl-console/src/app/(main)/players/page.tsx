/**
 * Player Management Page
 * Comprehensive player management interface
 */

'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import { alpha } from '@mui/material/styles';
import PeopleIcon from '@mui/icons-material/People';
import { PlayerList, WhitelistManager, OpManager, BanManager } from '@/components/players';
import { useServers } from '@/hooks/useMcctl';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function PlayersPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const { data: serversData, isLoading: serversLoading } = useServers();
  const servers = serversData?.servers;

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Set default server when servers load
  useEffect(() => {
    if (!selectedServer && servers && servers.length > 0) {
      setSelectedServer(servers[0].name);
    }
  }, [servers, selectedServer]);

  return (
    <>
      {/* Page Header */}
      <Paper
        elevation={0}
        sx={{
          mb: 4,
          p: 3,
          background: (theme) =>
            `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.2)}`,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: 'info.main',
              color: 'info.contrastText',
            }}
          >
            <PeopleIcon sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold">
              Player Management
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage players, whitelist, operators, and bans across your servers
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Server Selector */}
      <Box sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel id="server-select-label">Server</InputLabel>
          <Select
            labelId="server-select-label"
            value={selectedServer}
            label="Server"
            onChange={(e) => setSelectedServer(e.target.value)}
            disabled={serversLoading}
          >
            {servers?.map((server) => (
              <MenuItem key={server.name} value={server.name}>
                {server.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="Player management tabs">
          <Tab label="Online Players" />
          <Tab label="Whitelist" disabled={!selectedServer} />
          <Tab label="Operators" disabled={!selectedServer} />
          <Tab label="Ban List" disabled={!selectedServer} />
        </Tabs>
      </Box>

      {/* Online Players Tab */}
      <TabPanel value={activeTab} index={0}>
        <PlayerList />
      </TabPanel>

      {/* Whitelist Tab */}
      <TabPanel value={activeTab} index={1}>
        {selectedServer && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <WhitelistManager serverName={selectedServer} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  About Whitelist
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  The whitelist controls which players can join your server. When enabled,
                  only players on the whitelist can connect. Add players by their Minecraft
                  username.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Operators Tab */}
      <TabPanel value={activeTab} index={2}>
        {selectedServer && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <OpManager serverName={selectedServer} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  About Operators
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Operators (OPs) have elevated permissions on the server. They can use
                  commands like /give, /gamemode, /tp, and more. OP levels range from 1-4,
                  with 4 being the highest.
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Level 1: Can bypass spawn protection
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Level 2: Can use /clear, /gamemode, etc.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Level 3: Can use /ban, /kick, /op, etc.
                  </Typography>
                  <Typography variant="caption" color="text.secondary" component="div">
                    Level 4: Can use /stop, full access
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      {/* Ban List Tab */}
      <TabPanel value={activeTab} index={3}>
        {selectedServer && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={8}>
              <BanManager serverName={selectedServer} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  About Bans
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Banned players cannot connect to your server. You can ban players by
                  username and provide an optional reason. Bans can be removed (pardoned)
                  at any time.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        )}
      </TabPanel>
    </>
  );
}
