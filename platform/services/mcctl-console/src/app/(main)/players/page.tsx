/**
 * Player Management Page
 * Comprehensive player management interface
 */

'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Skeleton from '@mui/material/Skeleton';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import PeopleIcon from '@mui/icons-material/People';
import { PlayerList, WhitelistManager, OpManager, BanManager } from '@/components/players';
import { useServers } from '@/hooks/useMcctl';
import { BentoGrid, BentoMetricCard, BentoPanel, PageHero } from '@/components/bento';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2.5 }}>{children}</Box>}
    </div>
  );
}

export default function PlayersPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedServer, setSelectedServer] = useState<string>('');
  const { data: serversData, isLoading: serversLoading, error: serversError } = useServers();
  const servers = serversData?.servers;
  const serversUnavailable = !serversLoading && !serversData;
  const availableServers = servers?.length ?? 0;
  const runningServers = servers?.filter((server) => server.status === 'running').length ?? 0;

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
      <PageHero
        compact
        title="Player Management"
        description="Manage players, whitelist, operators, and bans across your servers"
        eyebrow="Access control"
        icon={<PeopleIcon />}
        sx={{ mb: 2.5 }}
      >
        <BentoGrid>
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 3', md: 'span 6' } }}>
            <BentoMetricCard
              title="Available servers"
              value={serversLoading ? <Skeleton width={56} /> : serversUnavailable ? 'Unavailable' : availableServers}
              icon={<PeopleIcon />}
              accent="info"
            />
          </Box>
          <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 3', md: 'span 6' } }}>
            <BentoMetricCard
              title="Running servers"
              value={serversLoading ? <Skeleton width={56} /> : serversUnavailable ? 'Unavailable' : runningServers}
              accent="success"
              description="Ready for live player actions"
            />
          </Box>
        </BentoGrid>
      </PageHero>

      <BentoPanel
        role="region"
        aria-label="Player manager"
        sx={{ p: { xs: 2, sm: 3 }, minHeight: 460 }}
      >
        {serversError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load servers: {serversError.message}
          </Alert>
        )}
        {/* Server Selector */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <FormControl sx={{ minWidth: { xs: '100%', sm: 240 } }}>
            <InputLabel id="server-select-label">Server</InputLabel>
            <Select
              labelId="server-select-label"
              value={selectedServer}
              label="Server"
              onChange={(e) => setSelectedServer(e.target.value)}
              disabled={serversLoading || serversUnavailable}
            >
              {servers?.map((server) => (
                <MenuItem key={server.name} value={server.name}>
                  {server.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {(serversLoading || (!serversUnavailable && availableServers === 0)) && (
            <Typography variant="body2" color="text.secondary">
              {serversLoading ? 'Loading servers...' : 'No servers available'}
            </Typography>
          )}
        </Box>

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="Player management tabs"
            variant="scrollable"
            allowScrollButtonsMobile
          >
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
          <BentoGrid>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 8' }, minWidth: 0 }}>
              <WhitelistManager serverName={selectedServer} />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 4' }, minWidth: 0 }}>
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
            </Box>
          </BentoGrid>
        )}
      </TabPanel>

      {/* Operators Tab */}
      <TabPanel value={activeTab} index={2}>
        {selectedServer && (
          <BentoGrid>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 8' }, minWidth: 0 }}>
              <OpManager serverName={selectedServer} />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 4' }, minWidth: 0 }}>
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
            </Box>
          </BentoGrid>
        )}
      </TabPanel>

      {/* Ban List Tab */}
      <TabPanel value={activeTab} index={3}>
        {selectedServer && (
          <BentoGrid>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 8' }, minWidth: 0 }}>
              <BanManager serverName={selectedServer} />
            </Box>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 4' }, minWidth: 0 }}>
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
            </Box>
          </BentoGrid>
        )}
      </TabPanel>
      </BentoPanel>
    </>
  );
}
