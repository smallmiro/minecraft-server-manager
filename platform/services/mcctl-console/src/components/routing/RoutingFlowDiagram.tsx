'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import type { ContainerStatus, RouteInfo, RouterDetail } from '@/ports/api/IMcctlApiClient';
import {
  HOSTNAME_TYPE_LABEL,
  classifyRouteHostname,
  extractServerName,
  routeStatusDisplay,
  type HostnameType,
  type StatusColor,
} from './hostnameType';

export const FLOW_MAX_SERVERS = 8;

const TYPE_ORDER: HostnameType[] = ['mdns', 'nipio', 'wan', 'custom'];

// Geometry in viewBox units; the SVG scales with its container.
const ROW_HEIGHT = 56;
const NODE_HEIGHT = 44;
const PAD = 12;
const TYPE_X = PAD;
const TYPE_W = 120;
const ROUTER_X = 250;
const ROUTER_W = 120;
const SERVER_X = 470;
const SERVER_W = 180;
const VIEW_W = SERVER_X + SERVER_W + PAD;

interface ServerNode {
  name: string;
  status: ContainerStatus;
  autoScaleUp?: boolean;
  color: StatusColor;
  label: string;
  types: Set<HostnameType>;
}

function resolveColor(theme: Theme, color: StatusColor): string {
  return color === 'default' ? theme.palette.grey[500] : theme.palette[color].main;
}

function routerColor(status: ContainerStatus): StatusColor {
  if (status === 'running') return 'success';
  if (status === 'restarting' || status === 'paused') return 'warning';
  return 'error';
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function nodeY(index: number, count: number, rows: number): number {
  // Centre a column of `count` nodes against the tallest column.
  const offset = ((rows - count) * ROW_HEIGHT) / 2;
  return PAD + offset + index * ROW_HEIGHT + (ROW_HEIGHT - NODE_HEIGHT) / 2;
}

function edgePath(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}

interface RoutingFlowDiagramProps {
  router: RouterDetail;
  playitDomains: ReadonlyArray<string | null | undefined>;
}

export function RoutingFlowDiagram({ router, playitDomains }: RoutingFlowDiagramProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const { typeCounts, servers } = useMemo(() => {
    const counts = new Map<HostnameType, number>();
    const byName = new Map<string, ServerNode>();
    router.routes.forEach((route: RouteInfo) => {
      const type = classifyRouteHostname(route.hostname, playitDomains);
      counts.set(type, (counts.get(type) ?? 0) + 1);
      const name = extractServerName(route.target);
      let node = byName.get(name);
      if (!node) {
        const display = routeStatusDisplay(route.serverStatus, route.autoScaleUp);
        node = {
          name,
          status: route.serverStatus,
          autoScaleUp: route.autoScaleUp,
          color: display.color,
          label: display.label,
          types: new Set(),
        };
        byName.set(name, node);
      }
      node.types.add(type);
    });
    return {
      typeCounts: TYPE_ORDER.filter((type) => counts.has(type)).map((type) => ({ type, count: counts.get(type) ?? 0 })),
      servers: Array.from(byName.values()),
    };
  }, [router.routes, playitDomains]);

  if (servers.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>
        No routes configured.
      </Typography>
    );
  }

  const overflow = servers.length > FLOW_MAX_SERVERS;
  const visibleServers = overflow && !expanded ? servers.slice(0, FLOW_MAX_SERVERS) : servers;
  const hiddenCount = servers.length - visibleServers.length;
  const rightCount = visibleServers.length + (hiddenCount > 0 ? 1 : 0);
  const rows = Math.max(typeCounts.length, rightCount, 1);
  const height = rows * ROW_HEIGHT + PAD * 2;
  const routerY = nodeY(0, 1, rows);
  const routerCenterY = routerY + NODE_HEIGHT / 2;
  const routerStatus = routerColor(router.status);
  const routerStroke = resolveColor(theme, routerStatus);

  const statusSummary = Array.from(
    servers.reduce((acc, server) => acc.set(server.label, (acc.get(server.label) ?? 0) + 1), new Map<string, number>())
  )
    .map(([label, count]) => `${count} ${label}`)
    .join(', ');
  const ariaLabel =
    `Routing flow: ${plural(typeCounts.length, 'access type')} (${typeCounts.map((t) => HOSTNAME_TYPE_LABEL[t.type]).join(', ')}) ` +
    `to mc-router (${router.status}, port ${router.port}) to ${plural(servers.length, 'server')} (${statusSummary})`;

  const textPrimary = theme.palette.text.primary;
  const textSecondary = theme.palette.text.secondary;
  const paper = theme.palette.background.paper;

  return (
    <Box sx={{ px: 2.5, pb: 2.5, minWidth: 0 }}>
      <Box
        component="svg"
        role="img"
        aria-label={ariaLabel}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: 640 }}
      >
        <title>Routing flow</title>

        {typeCounts.map(({ type }, index) => {
          const y = nodeY(index, typeCounts.length, rows) + NODE_HEIGHT / 2;
          return (
            <path
              key={`edge-${type}`}
              data-testid="flow-edge-type"
              d={edgePath(TYPE_X + TYPE_W, y, ROUTER_X, routerCenterY)}
              fill="none"
              stroke={theme.palette.primary.main}
              strokeOpacity={0.5}
              strokeWidth={1.5}
            />
          );
        })}
        {visibleServers.map((server, index) => (
          <path
            key={`edge-${server.name}`}
            data-testid="flow-edge-server"
            d={edgePath(ROUTER_X + ROUTER_W, routerCenterY, SERVER_X, nodeY(index, rightCount, rows) + NODE_HEIGHT / 2)}
            fill="none"
            stroke={resolveColor(theme, server.color)}
            strokeOpacity={0.6}
            strokeWidth={1.5}
          />
        ))}
        {hiddenCount > 0 && (
          <path
            data-testid="flow-edge-server"
            d={edgePath(
              ROUTER_X + ROUTER_W,
              routerCenterY,
              SERVER_X,
              nodeY(visibleServers.length, rightCount, rows) + NODE_HEIGHT / 2
            )}
            fill="none"
            stroke={theme.palette.divider}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}

        {typeCounts.map(({ type, count }, index) => {
          const y = nodeY(index, typeCounts.length, rows);
          return (
            <g key={type} data-testid="flow-type-node" data-type={type}>
              <title>{`${HOSTNAME_TYPE_LABEL[type]}: ${plural(count, 'route')}`}</title>
              <rect
                x={TYPE_X}
                y={y}
                width={TYPE_W}
                height={NODE_HEIGHT}
                rx={10}
                fill={alpha(theme.palette.primary.main, 0.12)}
                stroke={theme.palette.primary.main}
              />
              <text x={TYPE_X + 12} y={y + 19} fill={textPrimary} fontSize={13} fontWeight={700}>
                {HOSTNAME_TYPE_LABEL[type]}
              </text>
              <text x={TYPE_X + 12} y={y + 35} fill={textSecondary} fontSize={11}>
                {plural(count, 'route')}
              </text>
            </g>
          );
        })}

        <g data-testid="flow-router-node" data-color={routerStatus}>
          <rect
            x={ROUTER_X}
            y={routerY}
            width={ROUTER_W}
            height={NODE_HEIGHT}
            rx={10}
            fill={alpha(routerStroke, 0.14)}
            stroke={routerStroke}
            strokeWidth={2}
          />
          <text x={ROUTER_X + 12} y={routerY + 19} fill={textPrimary} fontSize={13} fontWeight={700}>
            mc-router
          </text>
          <text x={ROUTER_X + 12} y={routerY + 35} fill={textSecondary} fontSize={11}>
            {`${router.status} · ${router.port}`}
          </text>
        </g>

        {visibleServers.map((server, index) => {
          const y = nodeY(index, rightCount, rows);
          const stroke = resolveColor(theme, server.color);
          return (
            <g key={server.name} data-testid="flow-server-node" data-server={server.name} data-color={server.color}>
              <title>{`${server.name}: ${server.label}`}</title>
              <rect
                x={SERVER_X}
                y={y}
                width={SERVER_W}
                height={NODE_HEIGHT}
                rx={10}
                fill={alpha(stroke, 0.12)}
                stroke={stroke}
              />
              <circle cx={SERVER_X + 14} cy={y + 15} r={4} fill={stroke} />
              <text x={SERVER_X + 26} y={y + 19} fill={textPrimary} fontSize={13} fontWeight={700}>
                {truncate(server.name, 20)}
              </text>
              <text x={SERVER_X + 26} y={y + 35} fill={textSecondary} fontSize={11}>
                {truncate(server.label, 24)}
              </text>
            </g>
          );
        })}

        {hiddenCount > 0 && (
          <g data-testid="flow-more-node">
            <rect
              x={SERVER_X}
              y={nodeY(visibleServers.length, rightCount, rows)}
              width={SERVER_W}
              height={NODE_HEIGHT}
              rx={10}
              fill={paper}
              stroke={theme.palette.divider}
              strokeDasharray="4 4"
            />
            <text
              x={SERVER_X + SERVER_W / 2}
              y={nodeY(visibleServers.length, rightCount, rows) + NODE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fill={textSecondary}
              fontSize={13}
              fontWeight={700}
            >
              {`+${hiddenCount} more`}
            </text>
          </g>
        )}
      </Box>

      {overflow && (
        <Button size="small" onClick={() => setExpanded((value) => !value)} sx={{ mt: 1 }}>
          {expanded ? 'Show fewer servers' : `Show all ${servers.length} servers`}
        </Button>
      )}
    </Box>
  );
}
