'use client';

import { useId, useMemo, useState } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
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
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RouterIcon from '@mui/icons-material/Router';
import SearchIcon from '@mui/icons-material/Search';
import { BentoPanelHeader } from '@/components/bento';
import { CopyButton } from '@/components/common';
import { useStartServer } from '@/hooks/useMcctl';
import type { RouteInfo } from '@/ports/api/IMcctlApiClient';
import { groupRoutesByServer, type ServerRouteGroup } from './groupRoutes';
import { HOSTNAME_TYPE_LABEL, isRouteStartable, routeStatusDisplay, type HostnameType } from './hostnameType';

interface RoutingTableProps {
  routes: RouteInfo[];
  /** playitDomain values from usePlayitStatus().servers (null when unassigned). */
  playitDomains: ReadonlyArray<string | null | undefined>;
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

function TypeBadge({ type, count = 1 }: { type: HostnameType; count?: number }) {
  const label = count > 1 ? `${HOSTNAME_TYPE_LABEL[type]} ×${count}` : HOSTNAME_TYPE_LABEL[type];
  return <Chip label={label} size="small" color={TYPE_COLOR[type]} variant="outlined" />;
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

function NotRoutedChip({ count }: { count?: number }) {
  return (
    <Tooltip title={NOT_ROUTED_HINT}>
      <Chip
        label={count === undefined ? 'Not routed' : `${count} not routed`}
        size="small"
        color="warning"
        variant="outlined"
      />
    </Tooltip>
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

function TargetCell({ serverName, detail }: { serverName: string; detail: string }) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600, ...wrapSx }}>
        {serverName}
      </Typography>
      {detail && (
        <Typography variant="caption" color="text.secondary" sx={wrapSx}>
          {detail}
        </Typography>
      )}
    </>
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

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

interface ToggleProps {
  open: boolean;
  serverName: string;
  controls: string;
  onToggle: () => void;
}

function ExpandToggle({ open, serverName, controls, onToggle }: ToggleProps) {
  return (
    <IconButton
      size="small"
      aria-label={`Show domains of ${serverName}`}
      aria-expanded={open}
      aria-controls={controls}
      onClick={(event) => {
        // The row toggles on click too; stop here so one click toggles once.
        event.stopPropagation();
        onToggle();
      }}
    >
      <KeyboardArrowRightIcon
        fontSize="small"
        sx={{ transition: 'transform 150ms', transform: open ? 'rotate(90deg)' : 'none' }}
      />
    </IconButton>
  );
}

/** Collapsed view of a server's hostnames: the primary address, its type and how many more there are. */
function PrimaryAddress({ group }: { group: ServerRouteGroup }) {
  const [primary, ...rest] = group.hostnames;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', minWidth: 0, gap: 0.5, mt: 0.5 }}>
      <TypeBadge type={primary.type} />
      <HostnameCell hostname={primary.hostname} />
      {rest.length > 0 && (
        <Typography variant="caption" color="text.secondary">
          +{rest.length}
        </Typography>
      )}
    </Box>
  );
}

function StatusCell({ group }: { group: ServerRouteGroup }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
      <StatusBadge route={group.route} />
      {group.notRoutedCount > 0 && <NotRoutedChip count={group.notRoutedCount} />}
    </Stack>
  );
}

function DomainList({ group, needle }: { group: ServerRouteGroup; needle: string }) {
  return (
    <Box
      component="ul"
      aria-label={`Domains of ${group.serverName}`}
      sx={{ listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'divider', borderRadius: 1 }}
    >
      {group.hostnames.map((host) => {
        const match = needle !== '' && host.hostname.toLowerCase().includes(needle);
        return (
          <Box
            component="li"
            key={host.key}
            data-match={match ? 'true' : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              px: 1.5,
              py: 0.75,
              minWidth: 0,
              bgcolor: match ? 'action.selected' : undefined,
              '&:not(:last-of-type)': { borderBottom: 1, borderColor: 'divider' },
            }}
          >
            <Box sx={{ flex: '1 1 16rem', minWidth: 0 }}>
              <HostnameCell hostname={host.hostname} />
            </Box>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <TypeBadge type={host.type} />
              {host.discoveredByRouter === false && <NotRoutedChip />}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

interface VisibleGroup {
  group: ServerRouteGroup;
  domainsId: string;
  open: boolean;
}

export function RoutingTable({ routes, playitDomains }: RoutingTableProps) {
  const theme = useTheme();
  // Rendered only on the client after data loads, so read the query on the first pass.
  const isXs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const idPrefix = useId();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const groups = useMemo(() => groupRoutesByServer(routes, playitDomains), [routes, playitDomains]);

  const needle = query.trim().toLowerCase();
  const visible: VisibleGroup[] = groups.flatMap((group, index) => {
    const hostMatch = needle !== '' && group.hostnames.some((h) => h.hostname.toLowerCase().includes(needle));
    if (needle && !hostMatch && !group.serverName.toLowerCase().includes(needle)) return [];
    // A hostname match opens the server so the match is visible; clearing the search restores the user's choice.
    return [{ group, domainsId: `${idPrefix}-domains-${index}`, open: expanded.has(group.serverName) || hostMatch }];
  });

  const allExpanded = groups.length > 0 && groups.every((g) => expanded.has(g.serverName));
  const toggle = (serverName: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(serverName)) next.add(serverName);
      return next;
    });

  return (
    <>
      <BentoPanelHeader
        title="Routing Table"
        subtitle={`${plural(groups.length, 'server')} · ${plural(routes.length, 'hostname')}`}
        icon={<RouterIcon fontSize="small" />}
      />
      <Box sx={{ px: 2.5, pb: 2.5 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          <TextField
            size="small"
            placeholder="Search server or hostname"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputProps={{ 'aria-label': 'Search routes' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 320 } }}
          />
          {groups.length > 0 && (
            <Button
              size="small"
              color="inherit"
              onClick={() => setExpanded(allExpanded ? new Set() : new Set(groups.map((g) => g.serverName)))}
            >
              {allExpanded ? 'Collapse all' : 'Expand all'}
            </Button>
          )}
        </Stack>

        {visible.length === 0 ? (
          <EmptyState message={groups.length === 0 ? 'No routes configured' : `No routes match "${query.trim()}"`} />
        ) : isXs ? (
          <Stack component="ul" aria-label="Routes" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {visible.map(({ group, domainsId, open }) => (
              <Box
                component="li"
                key={group.serverName}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2,
                  p: 1.5,
                  minWidth: 0,
                }}
              >
                <Box
                  onClick={() => toggle(group.serverName)}
                  sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, cursor: 'pointer', minWidth: 0 }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <TargetCell serverName={group.serverName} detail={group.detail} />
                  </Box>
                  <ExpandToggle
                    open={open}
                    serverName={group.serverName}
                    controls={domainsId}
                    onToggle={() => toggle(group.serverName)}
                  />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <PrimaryAddress group={group} />
                </Box>
                <Box sx={{ mt: 1 }}>
                  <StatusCell group={group} />
                </Box>
                <Box id={domainsId}>
                  <Collapse in={open} unmountOnExit>
                    <Box sx={{ mt: 1 }}>
                      <DomainList group={group} needle={needle} />
                    </Box>
                  </Collapse>
                </Box>
                <Box sx={{ mt: 1 }}>
                  <RowActions route={group.route} serverName={group.serverName} />
                </Box>
              </Box>
            ))}
          </Stack>
        ) : (
          <Table size="small" sx={{ width: '100%', tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>Server</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">
                  <Box component="span" sx={visuallyHiddenSx}>
                    Actions
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map(({ group, domainsId, open }) => (
                <ServerRows
                  key={group.serverName}
                  group={group}
                  domainsId={domainsId}
                  open={open}
                  needle={needle}
                  onToggle={() => toggle(group.serverName)}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </>
  );
}

interface ServerRowsProps extends VisibleGroup {
  needle: string;
  onToggle: () => void;
}

function ServerRows({ group, domainsId, open, needle, onToggle }: ServerRowsProps) {
  return (
    <>
      <TableRow
        hover
        selected={open}
        onClick={onToggle}
        sx={{ cursor: 'pointer', '& > td': open ? { borderBottom: 0 } : undefined }}
      >
        <TableCell padding="checkbox">
          <ExpandToggle open={open} serverName={group.serverName} controls={domainsId} onToggle={onToggle} />
        </TableCell>
        <TableCell sx={wrapSx}>
          <Stack>
            <TargetCell serverName={group.serverName} detail={group.detail} />
            <PrimaryAddress group={group} />
          </Stack>
        </TableCell>
        <TableCell>
          <StatusCell group={group} />
        </TableCell>
        <TableCell align="right">
          <RowActions route={group.route} serverName={group.serverName} />
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell id={domainsId} colSpan={4} sx={{ py: 0, ...(open ? {} : { borderBottom: 0 }) }}>
          <Collapse in={open} unmountOnExit>
            <Box sx={{ pb: 1.5, pl: { sm: 6 } }}>
              <DomainList group={group} needle={needle} />
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
