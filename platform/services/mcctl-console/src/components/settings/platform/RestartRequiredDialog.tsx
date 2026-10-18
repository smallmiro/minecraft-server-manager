'use client';

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from 'next/link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import type { RestartScope } from '@/types/platform-settings';

interface Guidance {
  title: string;
  text: string;
  cli?: string;
  link?: { href: string; label: string };
}

const GUIDANCE: Record<Exclude<RestartScope, 'none'>, Guidance> = {
  servers: {
    title: 'Minecraft servers',
    text:
      'Stop, then start each server. Restart does not reload .env. mc-router auto-scale wakes an existing container with its old env, so a recreate through start is required.',
    cli: 'mcctl stop <name> && mcctl start <name>',
    link: { href: '/servers', label: 'Open Servers' },
  },
  router: {
    title: 'mc-router',
    text: 'Use start, not restart: only start recreates the container with the new .env.',
    cli: 'mcctl router start',
  },
  playit: {
    title: 'playit.gg agent',
    text: 'Stop, then start the playit agent so the container is recreated.',
    cli: 'mcctl playit stop && mcctl playit start',
    link: { href: '/routing', label: 'Open Routing' },
  },
  api: {
    title: 'mcctl-api',
    text: 'The API reads these values at startup. Restart it from the CLI; it never restarts itself during save.',
    cli: 'mcctl console service restart --api',
  },
  'next-create': {
    title: 'New servers',
    text: 'Applies to servers created after this change. Existing server hostnames are unchanged.',
  },
};

const ORDER: Exclude<RestartScope, 'none'>[] = ['servers', 'router', 'playit', 'api', 'next-create'];

export interface RestartRequiredDialogProps {
  open: boolean;
  scopes: RestartScope[];
  onClose: () => void;
}

export function RestartRequiredDialog({ open, scopes, onClose }: RestartRequiredDialogProps) {
  const shown = ORDER.filter((s) => scopes.includes(s));

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="restart-required-title">
      <DialogTitle id="restart-required-title">Restart required</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Settings were saved to .env. Saving never restarts anything; apply the changes as follows.
        </Typography>
        <Stack spacing={2}>
          {shown.map((scope) => {
            const g = GUIDANCE[scope];
            return (
              <div key={scope}>
                <Typography variant="subtitle2">{g.title}</Typography>
                <Typography variant="body2">{g.text}</Typography>
                {g.cli && (
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
                    {g.cli}
                  </Typography>
                )}
                {g.link && (
                  <Link href={g.link.href} onClick={onClose}>
                    {g.link.label}
                  </Link>
                )}
              </div>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Got it</Button>
      </DialogActions>
    </Dialog>
  );
}
