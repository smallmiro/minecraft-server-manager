'use client';

import { Fragment, useMemo, useState } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import DnsIcon from '@mui/icons-material/Dns';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RouterIcon from '@mui/icons-material/Router';
import SearchIcon from '@mui/icons-material/Search';
import { BentoPanelHeader } from '@/components/bento';
import { CopyButton } from '@/components/common';
import { useStartServer } from '@/hooks/useMcctl';
import type { RouteInfo } from '@/ports/api/IMcctlApiClient';
import {
  HOSTNAME_TYPE_LABEL,
  classifyRouteHostname,
  extractServerName,
  isRouteStartable,
  pickPrimaryHostname,
  routeStatusDisplay,
  type HostnameType,
} from './hostnameType';

interface RoutingTableProps {
  routes: RouteInfo[];
  /** playitDomain values from usePlayitStatus().servers (null when unassigned). */
  playitDomains: ReadonlyArray<string | null | undefined>;
}

interface HostRow {
  hostname: string;
  type: HostnameType;
  discoveredByRouter?: boolean;
}

interface ServerRow {
  /** mc-router target; hostnames alone can repeat across servers. */
  key: string;
  serverName: string;
  detail: string;
  /** Status and actions are per server, so the first route stands for all of them. */
  route: RouteInfo;
  hosts: HostRow[];
  primary: HostRow;
  /** Unrouted hostnames other than the primary, which carries its own warning. */
  hiddenUnrouted: number;
}

const TYPE_COLOR: Record<HostnameType, 'info' | 'secondary' | 'primary' | 'default'> = {
  nipio: 'info',
  mdns: 'secondary',
  wan: 'primary',
  custom: 'default',
};

const wrapSx = { wordBreak: 'break-word', overflowWrap: 'anywhere' } as const;

// Pixel strings on purpose: sx reads width/height <= 1 as a percentage.
const visuallyHiddenSx = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  m: '-1px',
  p: 0,
  border: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

function TypeBadge({ type }: { type: HostnameType }) {
  return <Chip label={HOSTNAME_TYPE_LABEL[type]} size="small" color={TYPE_COLOR[type]} variant="outlined" />;
}

function StatusBadge({ route }: { route: RouteInfo }) {
  const { color, label } = routeStatusDisplay(route.serverStatus, route.autoScaleUp);
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      sx={{
        height: 'auto',
        '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 },
      }}
    />
  );
}

const NOT_ROUTED_HINT =
  'mc-router has not registered this hostname, so connections to it will not reach the server. ' +
  'Check the server container labels and restart mc-router.';

function NotRoutedChip() {
  return (
    <Tooltip title={NOT_ROUTED_HINT}>
      <Chip label="Not routed" size="small" color="warning" variant="outlined" />
    </Tooltip>
  );
}

function UnroutedSummaryChip({ count }: { count: number }) {
  const hint =
    `mc-router has not registered ${count} ${count === 1 ? 'hostname' : 'hostnames'} of this server, ` +
    'so connections to them will not reach it. Expand the row to see which ones.';
  return (
    <Tooltip title={hint}>
      <Chip label={`${count} not routed`} size="small" color="warning" variant="outlined" />
    </Tooltip>
  );
}

function StatusCell({ server }: { server: ServerRow }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <StatusBadge route={server.route} />
      {server.hiddenUnrouted > 0 && <UnroutedSummaryChip count={server.hiddenUnrouted} />}
    </Stack>
  );
}

// One hook instance per row, so only the row being started shows a pending state.
function RowActions({ route, serverName }: { route: RouteInfo; serverName: string }) {
  const startServer = useStartServer();
  const [startError, setStartError] = useState<string | null>(null);
  const label = route.autoScaleUp === true ? 'Wake' : 'Start';
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" flexWrap="wrap" useFlexGap>
      {isRouteStartable(route.serverStatus) && (
        <Button
          size="small"
          variant="outlined"
          color={route.autoScaleUp === true ? 'warning' : 'primary'}
          aria-label={`${label} ${serverName}`}
          disabled={startServer.isPending}
          startIcon={startServer.isPending ? <CircularProgress size={14} color="inherit" /> : <PlayArrowIcon />}
          onClick={(event) => {
            stop(event);
            setStartError(null);
            startServer.mutate(serverName, { onError: (error) => setStartError(error.message) });
          }}
        >
          {label}
        </Button>
      )}
      {startError && (
        <Tooltip title={startError}>
          <Chip
            label="Start failed"
            size="small"
            color="error"
            variant="outlined"
            aria-label={`Start failed: ${startError}`}
          />
        </Tooltip>
      )}
      <Tooltip title="Edit hostnames">
        <IconButton
          component={NextLink}
          href={`/servers/${encodeURIComponent(serverName)}?tab=Options#hostnames`}
          size="small"
          aria-label={`Edit hostnames of ${serverName}`}
          onClick={stop}
        >
          <DnsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Open server">
        <IconButton
          component={NextLink}
          href={`/servers/${encodeURIComponent(serverName)}`}
          size="small"
          aria-label={`Open ${serverName}`}
          onClick={stop}
        >
          <OpenInNewIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

function HostnameCell({ hostname }: { hostname: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontFamily: 'monospace', ...wrapSx }}>
        {hostname}
      </Typography>
      <CopyButton text={hostname} />
    </Box>
  );
}

// Targets look like `mc-a:25565`; keep the id selector-safe.
const hostnameListId = (server: ServerRow) => `hostnames-${server.key.replace(/[^\w-]/g, '-')}`;

function ExpandToggle({ server, open, onToggle }: { server: ServerRow; open: boolean; onToggle: () => void }) {
  return (
    <IconButton
      size="small"
      aria-expanded={open}
      aria-controls={open ? hostnameListId(server) : undefined}
      aria-label={`${open ? 'Hide' : 'Show'} hostnames of ${server.serverName}`}
      onClick={onToggle}
    >
      {open ? <ExpandMoreIcon fontSize="small" /> : <KeyboardArrowRightIcon fontSize="small" />}
    </IconButton>
  );
}

function PrimaryHostname({ server }: { server: ServerRow }) {
  const others = server.hosts.length - 1;
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ minWidth: 0 }}>
      <TypeBadge type={server.primary.type} />
      <HostnameCell hostname={server.primary.hostname} />
      {server.primary.discoveredByRouter === false && <NotRoutedChip />}
      {others > 0 && (
        <Typography variant="caption" color="text.secondary">
          +{others}
        </Typography>
      )}
    </Stack>
  );
}

function TargetCell({ server, open, onToggle }: { server: ServerRow; open: boolean; onToggle: () => void }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="flex-start" sx={{ minWidth: 0 }}>
      <ExpandToggle server={server} open={open} onToggle={onToggle} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, ...wrapSx }}>
          {server.serverName}
        </Typography>
        {server.detail && (
          <Typography variant="caption" color="text.secondary" component="div" sx={wrapSx}>
            {server.detail}
          </Typography>
        )}
        <PrimaryHostname server={server} />
      </Box>
    </Stack>
  );
}

function HostnameList({ server }: { server: ServerRow }) {
  return (
    <Stack
      component="ul"
      id={hostnameListId(server)}
      aria-label={`Hostnames of ${server.serverName}`}
      spacing={0.75}
      sx={{ listStyle: 'none', m: 0, p: 0 }}
    >
      {server.hosts.map((host) => (
        <Stack
          component="li"
          key={host.hostname}
          direction="row"
          spacing={1}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ minWidth: 0 }}
        >
          <TypeBadge type={host.type} />
          <HostnameCell hostname={host.hostname} />
          {host.discoveredByRouter === false && <NotRoutedChip />}
        </Stack>
      ))}
    </Stack>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Stack alignItems="center" spacing={1} sx={{ py: 5, color: 'text.secondary' }}>
      <RouterIcon />
      <Typography variant="body2">{message}</Typography>
    </Stack>
  );
}

export function RoutingTable({ routes, playitDomains }: RoutingTableProps) {
  const theme = useTheme();
  // Rendered only on the client after data loads, so read the query on the first pass.
  const isXs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [query, setQuery] = useState('');
  // Rows the user opened or closed by hand; cleared on every search so it starts from the search's own state.
  const [manual, setManual] = useState<ReadonlyMap<string, boolean>>(() => new Map());

  const servers = useMemo<ServerRow[]>(() => {
    const byTarget = new Map<string, { route: RouteInfo; detail: string; hosts: HostRow[] }>();
    for (const route of routes) {
      const group = byTarget.get(route.target) ?? { route, detail: '', hosts: [] };
      group.detail ||= [route.serverType, route.serverVersion].filter(Boolean).join(' ');
      // mc-router matches hostnames case-insensitively, so one unrouted copy marks the hostname unrouted.
      const existing = group.hosts.find((h) => h.hostname.toLowerCase() === route.hostname.toLowerCase());
      if (existing) {
        if (route.discoveredByRouter === false) existing.discoveredByRouter = false;
      } else {
        group.hosts.push({
          hostname: route.hostname,
          type: classifyRouteHostname(route.hostname, playitDomains),
          discoveredByRouter: route.discoveredByRouter,
        });
      }
      byTarget.set(route.target, group);
    }
    return Array.from(byTarget, ([target, group]) => {
      const primary = pickPrimaryHostname(group.hosts);
      return {
        key: target,
        serverName: extractServerName(target),
        detail: group.detail,
        route: group.route,
        hosts: group.hosts,
        primary,
        hiddenUnrouted: group.hosts.filter((h) => h !== primary && h.discoveredByRouter === false).length,
      };
    });
  }, [routes, playitDomains]);

  const hostnameCount = servers.reduce((sum, server) => sum + server.hosts.length, 0);
  const needle = query.trim().toLowerCase();
  // A server matched only through a hostname opens, so the matching hostname is visible.
  const visible = servers.flatMap((server) => {
    if (!needle) return [{ server, forcedOpen: false }];
    if (server.serverName.toLowerCase().includes(needle)) return [{ server, forcedOpen: false }];
    if (server.hosts.some((h) => h.hostname.toLowerCase().includes(needle))) return [{ server, forcedOpen: true }];
    return [];
  });
  const isOpen = (server: ServerRow, forcedOpen: boolean) => manual.get(server.key) ?? forcedOpen;
  const toggle = (server: ServerRow, open: boolean) => setManual((prev) => new Map(prev).set(server.key, !open));

  return (
    <>
      <BentoPanelHeader
        title="Routing Table"
        subtitle={`${servers.length} ${servers.length === 1 ? 'server' : 'servers'} · ${hostnameCount} ${
          hostnameCount === 1 ? 'hostname' : 'hostnames'
        }`}
        icon={<RouterIcon fontSize="small" />}
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search hostname or server"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setManual(new Map());
          }}
          inputProps={{ 'aria-label': 'Search routes' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
        />

        {visible.length === 0 ? (
          <EmptyState message={servers.length === 0 ? 'No routes configured' : `No routes match "${query.trim()}"`} />
        ) : isXs ? (
          <Stack component="ul" aria-label="Routes" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visible.map(({ server, forcedOpen }) => {
              const open = isOpen(server, forcedOpen);
              return (
                <Stack
                  component="li"
                  key={server.key}
                  spacing={1}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    p: 1.5,
                    minWidth: 0,
                  }}
                >
                  <TargetCell server={server} open={open} onToggle={() => toggle(server, open)} />
                  <StatusCell server={server} />
                  {open && <HostnameList server={server} />}
                  <RowActions route={server.route} serverName={server.serverName} />
                </Stack>
              );
            })}
          </Stack>
        ) : (
          <Table size="small" sx={{ width: '100%', tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell>Target</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">
                  <Box component="span" sx={visuallyHiddenSx}>
                    Actions
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map(({ server, forcedOpen }) => {
                const open = isOpen(server, forcedOpen);
                return (
                  <Fragment key={server.key}>
                    <TableRow hover>
                      <TableCell sx={{ ...wrapSx, ...(open && { borderBottom: 0 }) }}>
                        <TargetCell server={server} open={open} onToggle={() => toggle(server, open)} />
                      </TableCell>
                      <TableCell sx={open ? { borderBottom: 0 } : undefined}>
                        <StatusCell server={server} />
                      </TableCell>
                      <TableCell align="right" sx={open ? { borderBottom: 0 } : undefined}>
                        <RowActions route={server.route} serverName={server.serverName} />
                      </TableCell>
                    </TableRow>
                    {open && (
                      <TableRow>
                        <TableCell colSpan={3} sx={{ pl: 6.5, pt: 0, ...wrapSx }}>
                          <HostnameList server={server} />
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Box>
    </>
  );
}
