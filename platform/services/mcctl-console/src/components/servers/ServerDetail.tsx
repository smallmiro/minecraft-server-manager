'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import type { ServerDetail as ServerDetailType } from '@/ports/api/IMcctlApiClient';

interface ServerDetailProps {
  server: ServerDetailType;
}

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

const getStatusColor = (
  status: ServerDetailType['status']
): 'success' | 'error' | 'default' | 'warning' => {
  switch (status) {
    case 'running':
      return 'success';
    case 'stopped':
    case 'exited':
      return 'error';
    case 'created':
      return 'warning';
    default:
      return 'default';
  }
};

const getHealthColor = (
  health: ServerDetailType['health']
): 'success' | 'error' | 'warning' | 'default' => {
  switch (health) {
    case 'healthy':
      return 'success';
    case 'unhealthy':
      return 'error';
    case 'starting':
      return 'warning';
    default:
      return 'default';
  }
};

function InfoRow({ label, value }: { label: string; value?: string | React.ReactNode }) {
  if (!value) return null;

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {value}
      </Typography>
    </Box>
  );
}

export function ServerDetail({ server }: ServerDetailProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box>
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Overview" />
        <Tab label="Console" />
        <Tab label="Config" />
        <Tab label="Players" />
        <Tab label="Logs" />
        <Tab label="Backups" />
      </Tabs>

      {/* Overview Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          {/* Server Information */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Server Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <InfoRow label="Name" value={server.name} />
                <InfoRow label="Container" value={server.container} />
                <InfoRow label="Hostname" value={server.hostname} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip
                      label={server.status}
                      size="small"
                      color={getStatusColor(server.status)}
                    />
                    <Chip
                      label={server.health}
                      size="small"
                      color={getHealthColor(server.health)}
                    />
                  </Box>
                </Box>

                {server.type && <InfoRow label="Type" value={server.type} />}
                {server.version && <InfoRow label="Version" value={server.version} />}
                {server.memory && <InfoRow label="Memory" value={server.memory} />}
                {server.uptime && <InfoRow label="Uptime" value={server.uptime} />}
              </CardContent>
            </Card>
          </Grid>

          {/* Players */}
          {server.players && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Players
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <InfoRow
                    label="Online"
                    value={`${server.players.online} / ${server.players.max}`}
                  />

                  {server.players.list && server.players.list.length > 0 && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                        Online Players
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {server.players.list.map((player) => (
                          <Chip key={player} label={player} size="small" />
                        ))}
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Resource Stats */}
          {server.stats && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Resources
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <InfoRow label="CPU" value={server.stats.cpu} />
                  <InfoRow label="Memory" value={server.stats.memory} />
                  <InfoRow label="Memory %" value={server.stats.memoryPercent} />
                  <InfoRow label="Network" value={server.stats.network} />
                  <InfoRow label="Block I/O" value={server.stats.blockIO} />
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* World Information */}
          {server.worldName && (
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    World
                  </Typography>
                  <Divider sx={{ mb: 2 }} />

                  <InfoRow label="Name" value={server.worldName} />
                  {server.worldSize && <InfoRow label="Size" value={server.worldSize} />}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </TabPanel>

      {/* Console Tab */}
      <TabPanel value={activeTab} index={1}>
        <Typography variant="body1" color="text.secondary">
          Console coming soon
        </Typography>
      </TabPanel>

      {/* Config Tab */}
      <TabPanel value={activeTab} index={2}>
        <Typography variant="body1" color="text.secondary">
          Configuration coming soon
        </Typography>
      </TabPanel>

      {/* Players Tab */}
      <TabPanel value={activeTab} index={3}>
        <Typography variant="body1" color="text.secondary">
          Player management coming soon
        </Typography>
      </TabPanel>

      {/* Logs Tab */}
      <TabPanel value={activeTab} index={4}>
        <Typography variant="body1" color="text.secondary">
          Logs coming soon
        </Typography>
      </TabPanel>

      {/* Backups Tab */}
      <TabPanel value={activeTab} index={5}>
        <Typography variant="body1" color="text.secondary">
          Backups coming soon
        </Typography>
      </TabPanel>
    </Box>
  );
}
