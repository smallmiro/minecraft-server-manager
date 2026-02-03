'use client';

import { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Grid from '@mui/material/Grid';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import SpeedIcon from '@mui/icons-material/Speed';
import SdStorageIcon from '@mui/icons-material/SdStorage';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TerminalIcon from '@mui/icons-material/Terminal';
import type { ServerDetail as ServerDetailType } from '@/ports/api/IMcctlApiClient';
import { ResourceStatCard } from './ResourceStatCard';
import { useServerLogs } from '@/hooks/useServerLogs';

interface ServerDetailProps {
  server: ServerDetailType;
  onSendCommand?: (command: string) => Promise<void>;
}

// Tab configuration
const TABS = ['Overview', 'Content', 'Files', 'Backups', 'Options'] as const;
type TabType = (typeof TABS)[number];

// Icon size for stat cards
const STAT_ICON_SIZE = 28;

// Parse log line for console display
interface ParsedLog {
  time: string;
  thread: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}

function parseLogLine(log: string): ParsedLog | null {
  // Format: [HH:MM:SS] [Thread/LEVEL]: Message
  const match = log.match(/\[(\d{2}:\d{2}:\d{2})\]\s*\[([^/]+)\/(\w+)\]:\s*(.+)/);
  if (match) {
    return {
      time: match[1],
      thread: match[2],
      level: (match[3] as 'INFO' | 'WARN' | 'ERROR') || 'INFO',
      msg: match[4],
    };
  }
  return null;
}

// Format uptime from seconds
function formatUptime(seconds?: number): string {
  if (!seconds || seconds < 0) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Parse memory string to MB value
function parseMemoryToMB(memStr?: string): number {
  if (!memStr) return 0;
  const match = memStr.match(/^([\d.]+)\s*(B|KB|MB|MiB|GB|GiB)?$/i);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = (match[2] || 'B').toUpperCase();
  switch (unit) {
    case 'GB':
    case 'GIB':
      return value * 1024;
    case 'MB':
    case 'MIB':
      return value;
    case 'KB':
      return value / 1024;
    default:
      return value / (1024 * 1024);
  }
}

// Parse allocated memory to MB
function parseAllocatedMemoryToMB(memStr?: string): number {
  if (!memStr) return 4096; // Default 4GB
  const match = memStr.match(/^(\d+)\s*(M|G)?$/i);
  if (!match) return 4096;
  const value = parseInt(match[1], 10);
  const unit = (match[2] || 'M').toUpperCase();
  return unit === 'G' ? value * 1024 : value;
}

export function ServerDetail({ server, onSendCommand }: ServerDetailProps) {
  const [activeTab, setActiveTab] = useState<TabType>('Overview');
  const [command, setCommand] = useState('');
  const [isAtBottom, setIsAtBottom] = useState(true);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Connect to server logs
  const { logs, isConnected } = useServerLogs({ serverName: server.name });

  // Auto-scroll to bottom
  useEffect(() => {
    if (consoleRef.current && isAtBottom) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  const handleScroll = () => {
    if (!consoleRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = consoleRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 30);
  };

  const scrollToBottom = () => {
    if (consoleRef.current) {
      consoleRef.current.scrollTo({ top: consoleRef.current.scrollHeight, behavior: 'smooth' });
    }
  };

  const handleSendCommand = async () => {
    if (!command.trim() || !onSendCommand) return;
    await onSendCommand(command.trim());
    setCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendCommand();
    }
  };

  // Parse resource stats (API returns numeric values directly)
  const cpuPercent = server.stats?.cpuPercent ?? 0;
  const memoryUsedMB = server.stats?.memoryUsage ? server.stats.memoryUsage / (1024 * 1024) : 0;
  const memoryAllocatedMB = parseAllocatedMemoryToMB(server.memory);
  const memoryPercent = server.stats?.memoryPercent ?? 0;

  return (
    <Box>
      {/* Tabs - Pill Style */}
      <Box sx={{ display: 'flex', gap: 0.5, mb: 3 }}>
        {TABS.map((tab) => (
          <Button
            key={tab}
            onClick={() => setActiveTab(tab)}
            sx={{
              px: 2,
              py: 1,
              borderRadius: 5,
              fontSize: 14,
              fontWeight: 500,
              textTransform: 'none',
              bgcolor: activeTab === tab ? 'primary.main' : 'transparent',
              color: activeTab === tab ? '#0a0e14' : 'text.secondary',
              '&:hover': {
                bgcolor: activeTab === tab ? 'primary.main' : alpha('#1bd96a', 0.1),
              },
            }}
          >
            {tab}
          </Button>
        ))}
      </Box>

      {/* Stats Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 2,
          mb: 2.5,
        }}
      >
        <ResourceStatCard
          value={`${cpuPercent.toFixed(2)}%`}
          unit="/ 100%"
          label="CPU usage"
          icon={<SpeedIcon sx={{ fontSize: STAT_ICON_SIZE }} />}
          progress={cpuPercent}
          progressMax={100}
          color="#1bd96a"
        />
        <ResourceStatCard
          value={`${memoryPercent.toFixed(2)}%`}
          unit="/ 100%"
          label="Memory usage"
          icon={<SdStorageIcon sx={{ fontSize: STAT_ICON_SIZE }} />}
          progress={memoryPercent}
          progressMax={100}
          color="#1bd96a"
        />
        <ResourceStatCard
          value={server.worldSize || '0 B'}
          unit="/ 10 GB"
          label="World size"
          icon={<FolderOpenIcon sx={{ fontSize: STAT_ICON_SIZE }} />}
          progress={parseMemoryToMB(server.worldSize)}
          progressMax={10240}
          color="#1bd96a"
        />
      </Box>

      {/* Console */}
      <Card
        sx={{
          bgcolor: 'background.paper',
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
        }}
      >
        {/* Console Header */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderBottom: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
            Console
          </Typography>
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              bgcolor: isConnected ? 'primary.main' : 'error.main',
              boxShadow: isConnected
                ? '0 0 8px rgba(27, 217, 106, 0.4)'
                : '0 0 8px rgba(239, 68, 68, 0.4)',
            }}
          />
        </Box>

        {/* Console Body */}
        <Box sx={{ position: 'relative' }}>
          <Box
            ref={consoleRef}
            onScroll={handleScroll}
            sx={{
              height: 360,
              overflowY: 'auto',
              px: 2.5,
              py: 2,
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 1.85,
              color: '#b4b6c4',
              bgcolor: 'background.paper',
              scrollbarWidth: 'thin',
              scrollbarColor: '#3a3d4e #1e2030',
              '&::-webkit-scrollbar': {
                width: 8,
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: '#1e2030',
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#3a3d4e',
                borderRadius: 4,
              },
            }}
          >
            {logs.length === 0 ? (
              <Typography
                sx={{
                  color: 'text.secondary',
                  textAlign: 'center',
                  py: 8,
                }}
              >
                Waiting for logs...
              </Typography>
            ) : (
              logs.map((log, i) => {
                const parsed = parseLogLine(log);
                if (parsed) {
                  return (
                    <Box
                      key={i}
                      sx={{
                        display: 'flex',
                        gap: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      <Box component="span" sx={{ color: '#4a4d60' }}>
                        [{parsed.time}]
                      </Box>
                      <Box component="span" sx={{ color: '#4a4d60' }}>
                        &nbsp;[{parsed.thread}/
                        <Box
                          component="span"
                          sx={{
                            color: parsed.level === 'WARN' ? '#e8a848' : '#6b6e80',
                          }}
                        >
                          {parsed.level}
                        </Box>
                        ]:&nbsp;
                      </Box>
                      <Box
                        component="span"
                        sx={{
                          color: parsed.level === 'WARN' ? '#c4a45a' : '#b4b6c4',
                        }}
                      >
                        {parsed.msg}
                      </Box>
                    </Box>
                  );
                }
                // Raw log line
                return (
                  <Box key={i} sx={{ color: '#b4b6c4' }}>
                    {log}
                  </Box>
                );
              })
            )}
          </Box>

          {/* Expand button */}
          <IconButton
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: '#282a3a',
              border: '1px solid #3a3d4e',
              color: '#8b8da0',
              '&:hover': {
                bgcolor: '#313440',
              },
            }}
          >
            <OpenInFullIcon sx={{ fontSize: 18 }} />
          </IconButton>

          {/* Scroll to bottom button */}
          {!isAtBottom && (
            <IconButton
              onClick={scrollToBottom}
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: '#282a3a',
                border: '1px solid #3a3d4e',
                color: '#8b8da0',
                '&:hover': {
                  bgcolor: '#313440',
                },
              }}
            >
              <KeyboardArrowDownIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {/* Command Input */}
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderTop: '1px solid',
            borderColor: 'divider',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Send a command"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!isConnected}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <TerminalIcon sx={{ fontSize: 16, color: '#999' }} />
                </InputAdornment>
              ),
              sx: {
                bgcolor: '#13141c',
                borderRadius: 2,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                fontSize: 14,
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#2a2d3e',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#3a3d4e',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'primary.main',
                },
              },
            }}
          />
        </Box>
      </Card>

      {/* Additional content based on tab */}
      {activeTab === 'Overview' && (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {/* Server Information */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Server Information
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <InfoRow label="Name" value={server.name} />
                <InfoRow label="Container" value={server.container} />
                <InfoRow label="Hostname" value={server.hostname} />
                <InfoRow label="Type" value={server.type} />
                <InfoRow label="Version" value={server.version} />
                <InfoRow label="Memory" value={server.memory} />
                <InfoRow
                  label="Uptime"
                  value={server.uptime || formatUptime(server.uptimeSeconds)}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Players */}
          <Grid item xs={12} md={6}>
            <Card sx={{ borderRadius: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  Players
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {server.players ? (
                  <>
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
                  </>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Player information unavailable
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {activeTab === 'Content' && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Content management coming soon
          </Typography>
        </Box>
      )}

      {activeTab === 'Files' && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" color="text.secondary">
            File browser coming soon
          </Typography>
        </Box>
      )}

      {activeTab === 'Backups' && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Backup management coming soon
          </Typography>
        </Box>
      )}

      {activeTab === 'Options' && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="body1" color="text.secondary">
            Server options coming soon
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// Info Row component for displaying key-value pairs
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
