'use client';

import { useState, type ReactElement } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import CloseIcon from '@mui/icons-material/Close';
import SpeedIcon from '@mui/icons-material/Speed';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import BackupOutlinedIcon from '@mui/icons-material/BackupOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import type { ServerDetail as ServerDetailType } from '@/ports/api/IMcctlApiClient';
import { BentoGrid, BentoMetricCard, BentoPanel, BentoPanelHeader } from '@/components/bento';
import { useInstalledMods } from '@/hooks/useMods';
import { ServerConsole } from './ServerConsole';
import { OverviewConsole } from './OverviewConsole';
import { OverviewPlayerList } from './OverviewPlayerList';
import { ServerActivityTab } from './ServerActivityTab';
import { ServerWorldTab } from './ServerWorldTab';
import { ServerOptionsTab } from './ServerOptionsTab';
import { ServerAccessTab } from './ServerAccessTab';
import { ServerPlayersTab } from './ServerPlayersTab';
import { ConnectionInfoCard } from './ConnectionInfoCard';
import { ServerModsTab } from './ServerModsTab';
import { ServerFilesTab } from './files/ServerFilesTab';
import { ServerConfigHistoryTab } from './config-history';
import { ServerBackupTab } from './ServerBackupTab';
import {
  formatCpuPercent,
  formatMemoryUsage,
  getUsageLevel,
  parseAllocatedMemoryToMB,
  USAGE_LEVEL_ACCENT,
  USAGE_LEVEL_LABEL,
} from '@/utils/format';

interface ServerDetailProps {
  server: ServerDetailType;
  onSendCommand?: (command: string) => Promise<void>;
}

// Tab configuration
const TABS: ReadonlyArray<{ label: string; icon: ReactElement }> = [
  { label: 'Overview', icon: <DashboardOutlinedIcon fontSize="small" /> },
  { label: 'Players', icon: <PeopleOutlineIcon fontSize="small" /> },
  { label: 'World', icon: <PublicOutlinedIcon fontSize="small" /> },
  { label: 'Activity', icon: <TimelineOutlinedIcon fontSize="small" /> },
  { label: 'Mods', icon: <ExtensionOutlinedIcon fontSize="small" /> },
  { label: 'Files', icon: <FolderOutlinedIcon fontSize="small" /> },
  { label: 'Config History', icon: <HistoryOutlinedIcon fontSize="small" /> },
  { label: 'Backups', icon: <BackupOutlinedIcon fontSize="small" /> },
  { label: 'Access', icon: <LockOutlinedIcon fontSize="small" /> },
  { label: 'Options', icon: <TuneOutlinedIcon fontSize="small" /> },
];
type TabType = (typeof TABS)[number]['label'];

const tabId = (label: string) => `server-tab-${label.toLowerCase().replace(/\s+/g, '-')}`;
const TABPANEL_ID = 'server-tabpanel';

// Icon size for stat cards
const STAT_ICON_SIZE = 22;

const METRIC_COLUMN = { xs: '1 / -1', sm: 'span 2', md: 'span 4' } as const;

function MetricValue({ children }: { children: string }) {
  return (
    <Box component="span" sx={{ fontFamily: (theme) => theme.typography.mono.fontFamily }}>
      {children}
    </Box>
  );
}

function TabLabel({ label, count }: { label: string; count?: number }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
      <span>{label}</span>
      {count !== undefined && (
        <Box
          component="span"
          sx={{
            typography: 'mono',
            fontSize: '0.6875rem',
            lineHeight: '18px',
            minWidth: 18,
            px: 0.75,
            borderRadius: 9,
            textAlign: 'center',
            bgcolor: 'action.selected',
            color: 'text.primary',
          }}
        >
          {count}
        </Box>
      )}
    </Box>
  );
}

export function ServerDetail({ server, onSendCommand }: ServerDetailProps) {
  // `?tab=Options` deep-links into a tab (e.g. the Routing page links to the hostname editor).
  const requestedTab = useSearchParams()?.get('tab');
  const [activeTab, setActiveTab] = useState<TabType>(
    TABS.find((tab) => tab.label === requestedTab)?.label ?? 'Overview'
  );
  const [consoleOpen, setConsoleOpen] = useState(false);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Only a count that is already cached: never fetch for the badge
  const { data: installedMods } = useInstalledMods(server.name, { enabled: false });

  const tabCounts: Partial<Record<TabType, number>> = {
    Players: server.players?.online,
    Mods: installedMods?.mods.length,
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (tab !== 'Overview') setConsoleOpen(false);
  };

  // Resource metrics
  const stats = server.stats;
  const cpuLevel = stats ? getUsageLevel(stats.cpuPercent) : undefined;
  const memoryLevel = stats ? getUsageLevel(stats.memoryPercent) : undefined;
  const allocatedMB = parseAllocatedMemoryToMB(server.memory);

  return (
    <BentoGrid aria-label="Server detail">
      <Box sx={{ gridColumn: METRIC_COLUMN }}>
        <BentoMetricCard
          title="CPU usage"
          value={<MetricValue>{stats ? formatCpuPercent(stats.cpuPercent) : '—'}</MetricValue>}
          icon={<SpeedIcon sx={{ fontSize: STAT_ICON_SIZE }} />}
          accent={cpuLevel ? USAGE_LEVEL_ACCENT[cpuLevel] : 'neutral'}
          description={cpuLevel ? USAGE_LEVEL_LABEL[cpuLevel] : 'No data'}
        />
      </Box>
      <Box sx={{ gridColumn: METRIC_COLUMN }}>
        <BentoMetricCard
          title="Memory usage"
          value={
            <MetricValue>
              {stats ? formatMemoryUsage(stats.memoryUsage, allocatedMB) : '—'}
            </MetricValue>
          }
          icon={<SdStorageIcon sx={{ fontSize: STAT_ICON_SIZE }} />}
          accent={memoryLevel ? USAGE_LEVEL_ACCENT[memoryLevel] : 'neutral'}
          description={
            stats && memoryLevel
              ? `${stats.memoryPercent.toFixed(1)}% · ${USAGE_LEVEL_LABEL[memoryLevel]}`
              : 'No data'
          }
        />
      </Box>
      <Box sx={{ gridColumn: METRIC_COLUMN }}>
        <BentoMetricCard
          title="World size"
          value={<MetricValue>{server.worldSize || '—'}</MetricValue>}
          icon={<FolderOpenIcon sx={{ fontSize: STAT_ICON_SIZE }} />}
          accent="info"
          description={server.worldName}
        />
      </Box>

      {/* Tabs and their content share one panel */}
      <BentoPanel aria-label="Server details" sx={{ gridColumn: '1 / -1' }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: TabType) => handleTabChange(value)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          aria-label="Server detail sections"
          sx={{
            minHeight: 48,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 600 },
          }}
        >
          {TABS.map(({ label, icon }) => (
            <Tab
              key={label}
              value={label}
              id={tabId(label)}
              aria-controls={TABPANEL_ID}
              icon={icon}
              iconPosition="start"
              label={<TabLabel label={label} count={tabCounts[label]} />}
            />
          ))}
        </Tabs>

        <Box
          role="tabpanel"
          id={TABPANEL_ID}
          aria-labelledby={tabId(activeTab)}
          sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}
        >
          {activeTab === 'Overview' && (
            <BentoGrid>
              <OverviewConsole
                serverName={server.name}
                serverStatus={server.status}
                onSendCommand={onSendCommand}
                onExpand={() => setConsoleOpen(true)}
              />
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 6' }, minWidth: 0 }}>
                <ServerSettingsSummary server={server} />
              </Box>
              <Box sx={{ gridColumn: { xs: '1 / -1', md: 'span 6' }, minWidth: 0 }}>
                <OverviewPlayerList serverName={server.name} players={server.players} />
              </Box>
              <Box sx={{ gridColumn: '1 / -1', minWidth: 0 }}>
                <ConnectionInfoCard serverName={server.name} hostname={server.hostname} />
              </Box>
            </BentoGrid>
          )}

          {activeTab === 'Players' && <ServerPlayersTab serverName={server.name} />}

          {activeTab === 'World' && (
            <ServerWorldTab serverName={server.name} worldName={server.worldName} />
          )}

          {activeTab === 'Activity' && <ServerActivityTab serverName={server.name} />}

          {activeTab === 'Mods' && <ServerModsTab serverName={server.name} />}

          {activeTab === 'Files' && <ServerFilesTab serverName={server.name} />}

          {activeTab === 'Config History' && (
            <ServerConfigHistoryTab
              serverName={server.name}
              isServerRunning={server.status === 'running'}
            />
          )}

          {activeTab === 'Backups' && <ServerBackupTab serverName={server.name} />}

          {activeTab === 'Access' && <ServerAccessTab serverId={server.name} />}

          {activeTab === 'Options' && (
            <ServerOptionsTab serverName={server.name} isRunning={server.status === 'running'} />
          )}
        </Box>
      </BentoPanel>

      {/* Full-screen Console Dialog - Overview tab only */}
      {activeTab === 'Overview' && (
        <Dialog
          open={consoleOpen}
          onClose={() => setConsoleOpen(false)}
          maxWidth="xl"
          fullWidth
          fullScreen={isSmallScreen}
          PaperProps={{
            sx: {
              height: isSmallScreen ? '100vh' : '90vh',
              bgcolor: 'background.paper',
            },
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography
              variant="h6"
              sx={{
                fontFamily: '"Minecraft", sans-serif',
                fontWeight: 400,
                letterSpacing: '0.05em',
              }}
            >
              Console - {server.name}
            </Typography>
            <IconButton onClick={() => setConsoleOpen(false)} aria-label="Close console">
              <CloseIcon />
            </IconButton>
          </Box>
          <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
            <ServerConsole serverName={server.name} serverStatus={server.status} />
          </DialogContent>
        </Dialog>
      )}
    </BentoGrid>
  );
}

// Settings that the hero does not already show
function ServerSettingsSummary({ server }: { server: ServerDetailType }) {
  return (
    <BentoPanel aria-label="Server settings" sx={{ height: '100%' }}>
      <BentoPanelHeader title="Settings" />
      <Box component="dl" sx={{ m: 0, px: 2.5, pb: 1.5 }}>
        <SettingRow label="Container" value={server.container} />
        <SettingRow label="Memory allocation" value={server.memory} />
        <SettingRow label="World" value={server.worldName} />
      </Box>
    </BentoPanel>
  );
}

function SettingRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 2,
        minWidth: 0,
        py: 1,
      }}
    >
      <Typography component="dt" variant="label" color="text.secondary">
        {label}
      </Typography>
      <Typography
        component="dd"
        variant="mono"
        sx={{ m: 0, minWidth: 0, overflowWrap: 'anywhere', textAlign: 'right' }}
      >
        {value}
      </Typography>
    </Box>
  );
}
