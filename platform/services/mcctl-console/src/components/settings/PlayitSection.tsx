'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import PublicIcon from '@mui/icons-material/Public';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import { usePlayitStatus, useStartPlayit, useStopPlayit } from '@/hooks/usePlayit';

const cellLabelSx = { fontWeight: 500, color: 'text.secondary', border: 0, width: '40%', py: 1 } as const;
const cellValueSx = { border: 0, py: 1 } as const;

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <IconButton
      size="small"
      onClick={handleCopy}
      sx={{
        ml: 1,
        color: copied ? 'success.main' : 'text.secondary',
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
    </IconButton>
  );
}

export function PlayitSection() {
  const { data, isLoading, error } = usePlayitStatus();
  const startPlayit = useStartPlayit();
  const stopPlayit = useStopPlayit();

  const handleStart = () => {
    startPlayit.mutate();
  };

  const handleStop = () => {
    stopPlayit.mutate();
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PublicIcon color="primary" />
            <Typography variant="h6" component="h2">
              External Access (playit.gg)
            </Typography>
          </Box>
          <Alert severity="error">
            Failed to load playit status: {error.message}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="text" width="40%" height={32} />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="text" width="40%" />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
            <Skeleton variant="text" width="35%" />
            <Skeleton variant="text" width="40%" />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (!data?.enabled) {
    return (
      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PublicIcon color="primary" />
            <Typography variant="h6" component="h2">
              External Access (playit.gg)
            </Typography>
          </Box>
          <Alert severity="info">
            <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
              Not configured
            </Typography>
            <Typography variant="body2" color="text.secondary">
              playit.gg agent is not set up. Configure PLAYIT_SECRET to enable external access.
            </Typography>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const isRunning = data.agentRunning && data.containerStatus === 'running';
  const isActionPending = startPlayit.isPending || stopPlayit.isPending;
  const actionError = startPlayit.error || stopPlayit.error;

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <PublicIcon color="primary" />
          <Typography variant="h6" component="h2">
            External Access (playit.gg)
          </Typography>
        </Box>
        {actionError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {actionError.message || 'Action failed'}
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {isRunning ? (
            <Button
              variant="outlined"
              size="small"
              color="error"
              startIcon={isActionPending ? <CircularProgress size={16} /> : <StopIcon />}
              onClick={handleStop}
              disabled={isActionPending}
              sx={{ fontSize: 12 }}
            >
              {isActionPending ? 'Stopping...' : 'Stop Agent'}
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              color="success"
              startIcon={isActionPending ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
              onClick={handleStart}
              disabled={isActionPending}
              sx={{ fontSize: 12 }}
            >
              {isActionPending ? 'Starting...' : 'Start Agent'}
            </Button>
          )}
          <Button
            component="a"
            href="https://playit.gg/account/tunnels"
            target="_blank"
            rel="noopener noreferrer"
            size="small"
            startIcon={<OpenInNewIcon />}
            sx={{ fontSize: 12 }}
          >
            View Dashboard
          </Button>
        </Box>

        {/* Agent Status */}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ mb: 3 }}>
            <TableBody>
              <TableRow>
                <TableCell sx={cellLabelSx}>Agent Status</TableCell>
                <TableCell sx={cellValueSx}>
                  <Chip
                    label={isRunning ? 'Running' : 'Stopped'}
                    size="small"
                    color={isRunning ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
              </TableRow>
              {data.uptime && (
                <TableRow>
                  <TableCell sx={cellLabelSx}>Uptime</TableCell>
                  <TableCell sx={cellValueSx}>{data.uptime}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>

        {/* Server Domains Table */}
        {data.servers && data.servers.length > 0 && (() => {
          const configured = data.servers.filter((s) => s.playitDomain);
          const unconfigured = data.servers.filter((s) => !s.playitDomain);

          return (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                Server Domains
              </Typography>
              {configured.length > 0 ? (
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small" sx={{ mb: unconfigured.length > 0 ? 2 : 0 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, borderBottom: 2, borderColor: 'divider' }}>
                          Server
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, borderBottom: 2, borderColor: 'divider' }}>
                          External Domain
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {configured.map((server) => (
                        <TableRow key={server.serverName}>
                          <TableCell sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                            {server.serverName}
                          </TableCell>
                          <TableCell sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Typography variant="body2" sx={{ fontFamily: '"Roboto Mono", monospace', wordBreak: 'break-all' }}>
                                {server.playitDomain}
                              </Typography>
                              <CopyButton text={server.playitDomain!} />
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  No servers with external domains configured.
                  Use <code>mcctl create --playit-domain</code> to register a domain.
                </Typography>
              )}
              {unconfigured.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  {unconfigured.length} server{unconfigured.length > 1 ? 's' : ''} without external domain: {unconfigured.map((s) => s.serverName).join(', ')}
                </Typography>
              )}
            </>
          );
        })()}
      </CardContent>
    </Card>
  );
}
