'use client';

import Alert from '@mui/material/Alert';
import { WorldInfoPanel } from '../worlds/WorldInfoPanel';

export interface ServerWorldTabProps {
  serverName: string;
  /** World assigned to the server (LEVEL). */
  worldName?: string;
}

/**
 * "World" tab content for the server detail view (#525).
 * Shows the assigned world's info and live player locations.
 */
export function ServerWorldTab({ serverName, worldName }: ServerWorldTabProps) {
  const resolved = worldName ?? serverName;
  if (!resolved) {
    return (
      <Alert severity="info" data-testid="server-world-none">
        No world is assigned to this server.
      </Alert>
    );
  }
  return <WorldInfoPanel worldName={resolved} serverName={serverName} />;
}
