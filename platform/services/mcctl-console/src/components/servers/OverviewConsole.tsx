'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardDoubleArrowDownIcon from '@mui/icons-material/KeyboardDoubleArrowDown';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import SendIcon from '@mui/icons-material/Send';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import { BentoPanel } from '@/components/bento';
import { useServerLogs } from '@/hooks/useServerLogs';
import { classifyLogLine, parseLogLine, stripAnsi, type LogEvent } from '@/utils/log';

export interface OverviewConsoleProps {
  serverName: string;
  serverStatus: ServerSummary['status'];
  onSendCommand?: (command: string) => Promise<void>;
  onExpand?: () => void;
}

const QUICK_COMMANDS = ['/list', '/tps', '/save-all', '/say ', '/whitelist list'] as const;

const LOG_EVENT_COLOR: Record<LogEvent, string> = {
  error: 'error.main',
  warn: 'warning.main',
  join: 'success.main',
  leave: 'info.main',
  done: 'primary.main',
  info: 'text.primary',
};

/**
 * Why the console input cannot be used right now, or null when it can.
 */
export function getConsoleUnavailableReason(
  status: ServerSummary['status'],
  isConnected: boolean,
  retryCount: number,
): string | null {
  if (status !== 'running') return 'Server is not running. Start it to send commands.';
  if (isConnected) return null;
  if (retryCount > 0) return `Connection lost. Reconnecting (attempt ${retryCount})…`;
  return 'Connecting to the server console…';
}

function isRconNoise(log: string) {
  return log.includes('RCON Listener') || log.includes('RCON Client') || log.includes('RconClient');
}

export function OverviewConsole({
  serverName,
  serverStatus,
  onSendCommand,
  onExpand,
}: OverviewConsoleProps) {
  const [command, setCommand] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { logs: rawLogs, isConnected, retryCount, clearLogs } = useServerLogs({
    serverName,
    serverStatus,
  });
  const logs = useMemo(() => rawLogs.filter((log) => !isRconNoise(log)), [rawLogs]);
  const unavailableReason = getConsoleUnavailableReason(serverStatus, isConnected, retryCount);

  useEffect(() => {
    if (logRef.current && isAtBottom) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, isAtBottom]);

  const handleScroll = () => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 30);
  };

  const scrollToBottom = () => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  };

  const handleDownload = () => {
    const blob = new Blob([logs.map(stripAnsi).join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${serverName}-console.log`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSend = async () => {
    const trimmed = command.trim();
    if (!trimmed || !onSendCommand || isSending) return;
    setIsSending(true);
    setSendError(null);
    try {
      await onSendCommand(trimmed);
      setCommand('');
    } catch (error) {
      setSendError(
        `Failed to send command: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setIsSending(false);
    }
  };

  const insertCommand = (value: string) => {
    setCommand(value);
    setSendError(null);
    inputRef.current?.focus();
  };

  const inputDisabled = unavailableReason !== null;

  return (
    <BentoPanel aria-label="Server console" sx={{ gridColumn: '1 / -1' }}>
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.25,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          columnGap: 1.25,
          rowGap: 0.5,
        }}
      >
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          Console
        </Typography>
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: isConnected ? 'success.main' : 'error.main',
          }}
        />
        <Typography variant="label" color="text.secondary">
          {isConnected ? 'Connected' : 'Disconnected'}
        </Typography>
        <Box
          role="toolbar"
          aria-label="Console tools"
          sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          {!isAtBottom && (
            <Tooltip title="Jump to latest">
              <IconButton size="small" aria-label="Jump to latest" onClick={scrollToBottom}>
                <KeyboardDoubleArrowDownIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Download logs">
            <span>
              <IconButton
                size="small"
                aria-label="Download logs"
                onClick={handleDownload}
                disabled={logs.length === 0}
              >
                <FileDownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear console (screen only)">
            <IconButton size="small" aria-label="Clear console" onClick={clearLogs}>
              <DeleteSweepOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {onExpand && (
            <Tooltip title="Expand console">
              <IconButton size="small" aria-label="Expand console" onClick={onExpand}>
                <OpenInFullIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      <Box
        ref={logRef}
        role="log"
        aria-label="Console output"
        aria-live="off"
        onScroll={handleScroll}
        sx={{
          typography: 'mono',
          height: { xs: 240, sm: 360 },
          overflowY: 'auto',
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          lineHeight: 1.7,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          color: 'text.primary',
          bgcolor: 'background.default',
        }}
      >
        {logs.length === 0 ? (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
            Waiting for logs...
          </Typography>
        ) : (
          logs.map((log, index) => {
            const event = classifyLogLine(log);
            const parsed = parseLogLine(log);
            return (
              <Box
                key={index}
                data-testid="console-line"
                data-log-event={event}
                sx={{ color: LOG_EVENT_COLOR[event] }}
              >
                {parsed ? (
                  <>
                    <Box component="span" sx={{ color: 'text.disabled' }}>
                      [{parsed.time}] [{parsed.thread}/{parsed.level}]:{' '}
                    </Box>
                    {parsed.msg}
                  </>
                ) : (
                  stripAnsi(log)
                )}
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          <TextField
            fullWidth
            size="small"
            inputRef={inputRef}
            value={command}
            onChange={(event) => {
              setCommand(event.target.value);
              if (sendError) setSendError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleSend();
              }
            }}
            disabled={inputDisabled}
            placeholder={unavailableReason ?? 'Enter a command, e.g. /say, /whitelist, /tp ...'}
            helperText={unavailableReason ?? undefined}
            inputProps={{ 'aria-label': 'Console command', spellCheck: false }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Typography variant="mono" sx={{ color: 'primary.main', fontWeight: 700 }}>
                    &gt;
                  </Typography>
                </InputAdornment>
              ),
              sx: { typography: 'mono' },
            }}
          />
          <Button
            variant="contained"
            aria-label="Send command"
            onClick={handleSend}
            disabled={inputDisabled || isSending || !command.trim() || !onSendCommand}
            startIcon={
              isSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />
            }
            sx={{ flexShrink: 0, height: 40 }}
          >
            {isSending ? 'Sending' : 'Send'}
          </Button>
        </Stack>

        {sendError && (
          <Typography role="alert" variant="body2" color="error" sx={{ mt: 1 }}>
            {sendError}
          </Typography>
        )}

        <Box
          role="group"
          aria-label="Quick commands"
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.25 }}
        >
          {QUICK_COMMANDS.map((quick) => (
            <Chip
              key={quick}
              label={quick.trim()}
              size="small"
              variant="outlined"
              onClick={() => insertCommand(quick)}
              disabled={inputDisabled}
              sx={(theme) => ({
                typography: 'mono',
                borderColor: 'divider',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
              })}
            />
          ))}
        </Box>
      </Box>
    </BentoPanel>
  );
}
