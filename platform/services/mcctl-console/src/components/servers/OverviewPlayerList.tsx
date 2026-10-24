'use client';

import { useMemo, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import PersonIcon from '@mui/icons-material/Person';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import type { PlayerSummary, ServerDetail } from '@/ports/api/IMcctlApiClient';
import { BentoPanel } from '@/components/bento';
import { useServerPlayers } from '@/hooks/useServerPlayers';
import { PlayerDetailModal } from './PlayerDetailModal';

export interface OverviewPlayerListProps {
  serverName: string;
  players?: ServerDetail['players'];
}

function toSummary(name: string): PlayerSummary {
  return {
    uuid: '',
    name,
    online: true,
    lastSeen: null,
    isOp: false,
    isBanned: false,
    isWhitelisted: false,
  };
}

/**
 * Overview "Players" section (#771): online players as rows with the
 * roster's badges; a row opens the player detail modal.
 */
export function OverviewPlayerList({ serverName, players }: OverviewPlayerListProps) {
  const { roster } = useServerPlayers({ serverName });
  const [selected, setSelected] = useState<PlayerSummary | null>(null);

  const onlinePlayers = useMemo(() => {
    const byName = new Map(roster.map((player) => [player.name, player]));
    const names = players?.players ?? [];
    const fromRoster = roster.filter((player) => player.online).map((player) => player.name);
    const allNames = Array.from(new Set([...names, ...fromRoster]));
    return allNames.map((name) => byName.get(name) ?? toSummary(name));
  }, [players, roster]);

  return (
    <BentoPanel aria-label="Players" sx={{ height: '100%' }}>
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Typography variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
          Players
        </Typography>
        {players && (
          <Typography variant="mono" color="text.secondary">
            {`${players.online} / ${players.max}`}
          </Typography>
        )}
      </Box>

      {onlinePlayers.length === 0 ? (
        <Box sx={{ px: 2.5, py: 4, textAlign: 'center', color: 'text.secondary' }}>
          <PeopleOutlineIcon sx={{ fontSize: 32, mb: 1 }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            No players online
          </Typography>
          <Typography variant="caption">Players appear here when they join.</Typography>
        </Box>
      ) : (
        <List dense disablePadding aria-label="Online players">
          {onlinePlayers.map((player) => (
            <ListItemButton
              key={player.name}
              onClick={() => setSelected(player)}
              sx={{ px: 2.5 }}
            >
              <ListItemAvatar sx={{ minWidth: 44 }}>
                <Avatar
                  src={player.uuid ? `https://mc-heads.net/avatar/${player.uuid}/32` : undefined}
                  alt={player.name}
                  variant="rounded"
                  sx={{ width: 32, height: 32 }}
                >
                  <PersonIcon fontSize="small" />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={player.name}
                primaryTypographyProps={{ fontWeight: 600, noWrap: true }}
              />
              <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                {player.isOp && <Chip label="OP" size="small" color="warning" variant="outlined" />}
                {player.isWhitelisted && (
                  <Chip label="Whitelisted" size="small" variant="outlined" />
                )}
              </Box>
            </ListItemButton>
          ))}
        </List>
      )}

      <PlayerDetailModal
        serverName={serverName}
        player={selected}
        open={selected !== null}
        onClose={() => setSelected(null)}
      />
    </BentoPanel>
  );
}
