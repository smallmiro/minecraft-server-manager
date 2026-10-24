'use client';

import { useMemo, useState } from 'react';
import NextLink from 'next/link';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RouterIcon from '@mui/icons-material/Router';
import SearchIcon from '@mui/icons-material/Search';
import { CopyButton } from '@/components/common';
import type { RouteInfo } from '@/ports/api/IMcctlApiClient';
import {
  HOSTNAME_TYPE_LABEL,
  classifyHostname,
  extractServerName,
  routeStatusDisplay,
  type HostnameType,
} from './hostnameType';

interface RoutingTableProps {
  routes: RouteInfo[];
  /** playitDomain values from usePlayitStatus().servers (null when unassigned). */
  playitDomains: ReadonlyArray<string | null | undefined>;
}

interface RouteRow {
  hostname: string;
  serverName: string;
  detail: string;
  type: HostnameType;
  route: RouteInfo;
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
  return (
    <Chip
      label={HOSTNAME_TYPE_LABEL[type]}
      size="small"
      color={TYPE_COLOR[type]}
      variant="outlined"
    />
  );
}

function StatusBadge({ route }: { route: RouteInfo }) {
  const { color, label } = routeStatusDisplay(route.serverStatus);
  return (
    <Chip
      label={label}
      size="small"
      color={color}
      sx={{ height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } }}
    />
  );
}

function ServerLink({ serverName }: { serverName: string }) {
  return (
    <IconButton
      component={NextLink}
      href={`/servers/${serverName}`}
      size="small"
      aria-label={`Open ${serverName}`}
      title={`Open ${serverName}`}
    >
      <OpenInNewIcon fontSize="small" />
    </IconButton>
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

function TargetCell({ row }: { row: RouteRow }) {
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 600, ...wrapSx }}>
        {row.serverName}
      </Typography>
      {row.detail && (
        <Typography variant="caption" color="text.secondary" sx={wrapSx}>
          {row.detail}
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

export function RoutingTable({ routes, playitDomains }: RoutingTableProps) {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');

  const rows = useMemo<RouteRow[]>(
    () =>
      routes.map((route) => ({
        hostname: route.hostname,
        serverName: extractServerName(route.target),
        detail: [route.serverType, route.serverVersion].filter(Boolean).join(' '),
        type: classifyHostname(route.hostname, playitDomains),
        route,
      })),
    [routes, playitDomains]
  );

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? rows.filter((r) => r.hostname.toLowerCase().includes(needle) || r.serverName.toLowerCase().includes(needle))
    : rows;

  return (
    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Typography variant="h6" component="h2">
          Routing Table
        </Typography>
        <TextField
          size="small"
          placeholder="Search hostname or server"
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
          sx={{ minWidth: { sm: 260 } }}
        />
      </Stack>

      {visible.length === 0 ? (
        <EmptyState message={rows.length === 0 ? 'No routes configured' : `No routes match "${query.trim()}"`} />
      ) : isXs ? (
        <Stack component="ul" aria-label="Routes" spacing={1.5} sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {visible.map((row) => (
            <Box
              component="li"
              key={row.hostname}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2, p: 1.5, minWidth: 0 }}
            >
              <HostnameCell hostname={row.hostname} />
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <TypeBadge type={row.type} />
                <StatusBadge route={row.route} />
              </Stack>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 1 }}>
                <Box sx={{ minWidth: 0 }}>
                  <TargetCell row={row} />
                </Box>
                <ServerLink serverName={row.serverName} />
              </Stack>
            </Box>
          ))}
        </Stack>
      ) : (
        <Table size="small" sx={{ width: '100%', tableLayout: 'auto' }}>
          <TableHead>
            <TableRow>
              <TableCell>Hostname</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right" sx={{ width: 48 }}>
                <Box component="span" sx={visuallyHiddenSx}>
                  Actions
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((row) => (
              <TableRow key={row.hostname} hover>
                <TableCell sx={wrapSx}>
                  <HostnameCell hostname={row.hostname} />
                </TableCell>
                <TableCell>
                  <TypeBadge type={row.type} />
                </TableCell>
                <TableCell sx={wrapSx}>
                  <Stack>
                    <TargetCell row={row} />
                  </Stack>
                </TableCell>
                <TableCell>
                  <StatusBadge route={row.route} />
                </TableCell>
                <TableCell align="right">
                  <ServerLink serverName={row.serverName} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
