'use client';

import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import type { WorldInfo } from '@/ports/api/IMcctlApiClient';

export interface WorldInfoCardsProps {
  info: WorldInfo;
}

/** Format a byte count into a human-readable string. */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function copy(text: string): void {
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    void navigator.clipboard.writeText(text);
  }
}

function StatCell({
  label,
  value,
  copyValue,
}: {
  label: string;
  value: ReactNode;
  copyValue?: string;
}) {
  const clickable = Boolean(copyValue);
  const cell = (
    <Card
      data-testid={`world-stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
      onClick={clickable ? () => copy(copyValue!) : undefined}
      sx={{
        p: 2,
        height: '100%',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
        {label}
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.primary', fontWeight: 600, mt: 0.5, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Card>
  );
  return clickable ? <Tooltip title="Click to copy">{cell}</Tooltip> : cell;
}

/**
 * Grid of world metadata cards (seed, spawn, game mode, etc.) (#525).
 */
export function WorldInfoCards({ info }: WorldInfoCardsProps) {
  const { level, sizeBytes, regionCount } = info;
  const spawnStr = `${level.spawn.x}, ${level.spawn.y}, ${level.spawn.z}`;

  const cells: Array<{ label: string; value: ReactNode; copyValue?: string }> = [
    { label: 'Seed', value: level.seed, copyValue: level.seed },
    { label: 'Spawn', value: spawnStr, copyValue: spawnStr },
    { label: 'Game Mode', value: capitalize(level.gameMode) },
    { label: 'Difficulty', value: capitalize(level.difficulty) + (level.hardcore ? ' (Hardcore)' : '') },
    { label: 'Day', value: `Day ${level.dayCount}` },
    { label: 'Version', value: level.versionName },
    { label: 'Size', value: formatBytes(sizeBytes) },
    { label: 'Border', value: `${level.worldBorder.size.toLocaleString()} blocks` },
    { label: 'Regions', value: String(regionCount) },
    { label: 'Weather', value: level.thundering ? 'Thunder' : level.raining ? 'Rain' : 'Clear' },
  ];

  return (
    <Box data-testid="world-info-cards">
      <Grid container spacing={2}>
        {cells.map((c) => (
          <Grid item xs={6} sm={4} md={3} key={c.label}>
            <StatCell label={c.label} value={c.value} copyValue={c.copyValue} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
