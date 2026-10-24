'use client';

import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import type { Theme } from '@mui/material/styles';
import TerminalIcon from '@mui/icons-material/Terminal';
import { BentoPanelHeader } from '@/components/bento';
import { useRouterLogStream, type RouterLogEntry, type RouterLogStreamStatus } from '@/hooks/useRouterLogStream';

const STATUS_DISPLAY: Record<RouterLogStreamStatus, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  connecting: { label: 'Connecting', color: 'default' },
  live: { label: 'Live', color: 'success' },
  disconnected: { label: 'Disconnected', color: 'warning' },
  ended: { label: 'Ended', color: 'default' },
};

function kindColor(theme: Theme, kind: RouterLogEntry['kind']): string {
  switch (kind) {
    case 'connect':
      return theme.palette.info.main;
    case 'wake':
      return theme.palette.warning.main;
    case 'error':
      return theme.palette.error.main;
    default:
      return theme.palette.text.secondary;
  }
}

/** HH:MM:SS from an ISO-like timestamp; falls back to the raw value. */
function formatTime(ts?: string): string {
  if (!ts) return '';
  const match = /T(\d{2}:\d{2}:\d{2})/.exec(ts);
  return match ? match[1] : ts;
}

const KIND_LABEL: Record<RouterLogEntry['kind'], string> = {
  connect: 'CONNECT',
  wake: 'WAKE',
  error: 'ERROR',
  info: 'INFO',
};

function describeEvent(event: RouterLogEntry): string {
  if (event.kind === 'connect' || event.kind === 'wake') {
    // "Scaling up" lines name only the hostname; the target arrives with "Woke up"
    if (event.hostname && event.target) return `${event.hostname} → ${event.target}`;
    if (event.hostname || event.target) return (event.hostname ?? event.target)!;
  }
  return event.raw;
}

export function RouterLogPanel() {
  const { events, status, clear } = useRouterLogStream();
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);
  const display = STATUS_DISPLAY[status];

  useEffect(() => {
    const el = logRef.current;
    if (autoScroll && el) el.scrollTop = el.scrollHeight;
  }, [events, autoScroll]);

  return (
    <>
      <BentoPanelHeader
        title="Live Router Log"
        subtitle="Connections and wake-ups from mc-router"
        icon={<TerminalIcon fontSize="small" />}
        action={
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip aria-label="Log stream status" label={display.label} color={display.color} size="small" />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoScroll}
                  onChange={(event) => setAutoScroll(event.target.checked)}
                  inputProps={{ 'aria-label': 'Auto-scroll' }}
                />
              }
              label="Auto-scroll"
              sx={{ mr: 0 }}
            />
            <Button size="small" variant="outlined" onClick={clear} disabled={events.length === 0}>
              Clear
            </Button>
          </Stack>
        }
      />
      <Box
        ref={logRef}
        role="log"
        aria-label="Router log lines"
        tabIndex={0}
        sx={{
          mx: 2.5,
          mb: 2.5,
          p: 1.5,
          height: 320,
          overflowY: 'auto',
          overflowX: 'hidden',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.default',
          fontFamily: 'monospace',
          fontSize: '0.8125rem',
        }}
      >
        {events.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'inherit' }}>
            No router log lines yet.
          </Typography>
        ) : (
          events.map((event) => (
            <Box
              key={event.id}
              data-testid="router-log-row"
              data-kind={event.kind}
              sx={{
                display: 'flex',
                gap: 1,
                alignItems: 'baseline',
                py: 0.25,
                color: (theme) => kindColor(theme, event.kind),
                overflowWrap: 'anywhere',
                minWidth: 0,
              }}
            >
              {event.ts && (
                <Box component="span" sx={{ flexShrink: 0, color: 'text.secondary' }}>
                  {formatTime(event.ts)}
                </Box>
              )}
              <Box component="span" sx={{ flexShrink: 0, minWidth: '7ch', fontWeight: 700 }}>
                {KIND_LABEL[event.kind]}
              </Box>
              <Box component="span" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {describeEvent(event)}
                {event.player && (
                  <Box component="span" sx={{ ml: 1, color: 'text.primary' }}>
                    {event.player}
                  </Box>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </>
  );
}
