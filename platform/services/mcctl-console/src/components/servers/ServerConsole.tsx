/**
 * ServerConsole Component
 * Real-time server console with log streaming and command execution
 */

'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import SendIcon from '@mui/icons-material/Send';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useServerLogs } from '@/hooks/useServerLogs';

/**
 * Log level filter types
 */
type LogLevel = 'ALL' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Props for ServerConsole component
 */
interface ServerConsoleProps {
  /**
   * Name of the server to connect to
   */
  serverName: string;
}

/**
 * Quick command button configuration
 */
interface QuickCommand {
  label: string;
  template: string;
}

const QUICK_COMMANDS: QuickCommand[] = [
  { label: 'say', template: 'say ' },
  { label: 'give', template: 'give ' },
  { label: 'tp', template: 'tp ' },
  { label: 'gamemode', template: 'gamemode ' },
];

/**
 * Extract log level from log line
 */
function getLogLevel(log: string): LogLevel {
  if (log.includes('/ERROR]') || log.includes('/ERROR:')) return 'ERROR';
  if (log.includes('/WARN]') || log.includes('/WARN:')) return 'WARN';
  if (log.includes('/INFO]') || log.includes('/INFO:')) return 'INFO';
  return 'INFO'; // Default to INFO for unrecognized formats
}

/**
 * Get color for log level
 */
function getLogLevelColor(level: LogLevel): string {
  switch (level) {
    case 'ERROR':
      return '#f44336'; // Red
    case 'WARN':
      return '#ff9800'; // Orange
    case 'INFO':
    default:
      return '#4caf50'; // Green
  }
}

/**
 * ServerConsole - Real-time log streaming and command execution
 */
export function ServerConsole({ serverName }: ServerConsoleProps) {
  const [command, setCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [logFilter, setLogFilter] = useState<LogLevel>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Connect to server logs via SSE
  const { logs, isConnected, clearLogs, reconnect, retryCount } = useServerLogs({
    serverName,
  });

  // Filter logs based on selected level
  const filteredLogs = useMemo(() => {
    if (logFilter === 'ALL') return logs;
    return logs.filter((log) => getLogLevel(log) === logFilter);
  }, [logs, logFilter]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Execute command
  const executeCommand = useCallback(async () => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand || isExecuting) return;

    setIsExecuting(true);

    try {
      // Add to history
      setCommandHistory((prev) => [...prev, trimmedCommand]);
      setHistoryIndex(-1);

      // Execute via API
      await fetch(`/api/servers/${encodeURIComponent(serverName)}/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: trimmedCommand }),
      });

      // Clear input
      setCommand('');
    } catch (error) {
      console.error('Failed to execute command:', error);
    } finally {
      setIsExecuting(false);
    }
  }, [command, serverName, isExecuting]);

  // Handle key events for command history navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        executeCommand();
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (commandHistory.length === 0) return;

        const newIndex =
          historyIndex === -1
            ? commandHistory.length - 1
            : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(commandHistory[newIndex]);
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        if (historyIndex === -1) return;

        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCommand(commandHistory[newIndex]);
        }
      }
    },
    [commandHistory, historyIndex, executeCommand]
  );

  // Handle quick command click
  const handleQuickCommand = useCallback((template: string) => {
    setCommand(template);
    inputRef.current?.focus();
  }, []);

  // Get connection status display
  const getConnectionStatus = () => {
    if (isConnected) {
      return { text: 'Connected', color: 'success' as const };
    }
    if (retryCount > 0) {
      return { text: `Disconnected (Retry ${retryCount})`, color: 'warning' as const };
    }
    return { text: 'Disconnected', color: 'error' as const };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <Paper
      data-testid="server-console"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 400,
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle2">Console</Typography>
          <Chip
            data-testid="connection-status"
            label={connectionStatus.text}
            color={connectionStatus.color}
            size="small"
          />
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center">
          {/* Log Level Filter */}
          <ButtonGroup size="small" variant="outlined">
            {(['ALL', 'INFO', 'WARN', 'ERROR'] as LogLevel[]).map((level) => (
              <Button
                key={level}
                onClick={() => setLogFilter(level)}
                variant={logFilter === level ? 'contained' : 'outlined'}
              >
                {level}
              </Button>
            ))}
          </ButtonGroup>

          {/* Auto-scroll toggle */}
          <FormControlLabel
            control={
              <Checkbox
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                size="small"
                inputProps={{ 'aria-label': 'Auto-scroll' }}
              />
            }
            label="Auto-scroll"
          />

          {/* Clear button */}
          <IconButton
            size="small"
            onClick={clearLogs}
            aria-label="Clear logs"
            title="Clear logs"
          >
            <DeleteOutlineIcon />
          </IconButton>

          {/* Reconnect button (only when disconnected) */}
          {!isConnected && (
            <Button
              size="small"
              startIcon={<RefreshIcon />}
              onClick={reconnect}
              aria-label="Reconnect"
            >
              Reconnect
            </Button>
          )}
        </Stack>
      </Box>

      {/* Logs Container */}
      <Box
        ref={logsContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          bgcolor: '#1a1a1a',
          p: 1,
          fontFamily: 'monospace',
          fontSize: '0.85rem',
        }}
      >
        {filteredLogs.length === 0 ? (
          <Typography
            color="text.secondary"
            sx={{ textAlign: 'center', py: 4, color: '#666' }}
          >
            Waiting for logs...
          </Typography>
        ) : (
          filteredLogs.map((log, index) => {
            const level = getLogLevel(log);
            return (
              <Box
                key={index}
                sx={{
                  py: 0.25,
                  color: getLogLevelColor(level),
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {log}
              </Box>
            );
          })
        )}
      </Box>

      <Divider />

      {/* Quick Commands */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'background.default' }}>
        <Stack direction="row" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
            Quick:
          </Typography>
          {QUICK_COMMANDS.map((cmd) => (
            <Button
              key={cmd.label}
              size="small"
              variant="outlined"
              onClick={() => handleQuickCommand(cmd.template)}
            >
              {cmd.label}
            </Button>
          ))}
        </Stack>
      </Box>

      <Divider />

      {/* Command Input */}
      <Box sx={{ display: 'flex', p: 1, gap: 1 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          size="small"
          placeholder="Enter command..."
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isConnected || isExecuting}
          InputProps={{
            sx: { fontFamily: 'monospace' },
          }}
        />
        <Button
          variant="contained"
          onClick={executeCommand}
          disabled={!command.trim() || !isConnected || isExecuting}
          startIcon={isExecuting ? <CircularProgress size={16} /> : <SendIcon />}
          aria-label="Send command"
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
}
