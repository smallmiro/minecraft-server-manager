'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type { ServerSummary } from '@/ports/api/IMcctlApiClient';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useServers } from '@/hooks/useMcctl';

export interface ServerSwitcherProps {
  currentServer: string;
}

function formatStatus(status: ServerSummary['status']) {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Dropdown beside the server title to jump to another server (#771).
 */
export function ServerSwitcher({ currentServer }: ServerSwitcherProps) {
  const router = useAppRouter();
  const { data, isLoading } = useServers();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);
  const servers = data?.servers ?? [];

  const choose = (name: string) => {
    setAnchorEl(null);
    if (name !== currentServer) router.push(`/servers/${encodeURIComponent(name)}`);
  };

  return (
    <>
      <Tooltip title="Switch server">
        <IconButton
          id="server-switcher-button"
          size="small"
          aria-label="Switch server"
          aria-haspopup="menu"
          aria-controls={open ? 'server-switcher-menu' : undefined}
          aria-expanded={open ? 'true' : 'false'}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setAnchorEl(event.currentTarget);
            }
          }}
          sx={{ flexShrink: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
        >
          <UnfoldMoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        id="server-switcher-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        MenuListProps={{ 'aria-labelledby': 'server-switcher-button', dense: true }}
        PaperProps={{ sx: { minWidth: 220, maxHeight: 360 } }}
      >
        {isLoading && servers.length === 0 ? (
          <MenuItem disabled>Loading servers…</MenuItem>
        ) : servers.length === 0 ? (
          <MenuItem disabled>No servers</MenuItem>
        ) : (
          servers.map((server) => {
            const isCurrent = server.name === currentServer;
            return (
              <MenuItem
                key={server.name}
                selected={isCurrent}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => choose(server.name)}
              >
                <ListItemIcon sx={{ minWidth: 24 }}>
                  <Box
                    aria-hidden
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: server.status === 'running' ? 'success.main' : 'text.disabled',
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={server.name}
                  secondary={formatStatus(server.status)}
                  primaryTypographyProps={{ noWrap: true, fontWeight: isCurrent ? 700 : 500 }}
                />
              </MenuItem>
            );
          })
        )}
      </Menu>
    </>
  );
}
