'use client';

import { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';

export interface ResourceStatCardProps {
  value: string;
  unit: string;
  label: string;
  icon: ReactNode;
  progress: number;
  progressMax: number;
  color?: string;
}

/**
 * ResourceStatCard - Displays resource usage (CPU, Memory, Storage)
 * with a progress bar in Modrinth-style design
 */
export function ResourceStatCard({
  value,
  unit,
  label,
  icon,
  progress,
  progressMax,
  color = '#1bd96a',
}: ResourceStatCardProps) {
  const percentage = Math.min((progress / progressMax) * 100, 100);

  return (
    <Card
      data-testid="resource-stat-card"
      sx={{
        flex: 1,
        minWidth: 0,
        p: 2.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
          <Typography
            variant="h4"
            component="span"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              letterSpacing: '-0.5px',
            }}
          >
            {value}
          </Typography>
          <Typography
            variant="body2"
            component="span"
            sx={{ color: 'text.secondary', fontWeight: 500 }}
          >
            {unit}
          </Typography>
        </Box>
        <Box sx={{ color: 'text.secondary', mt: 0.5 }}>{icon}</Box>
      </Box>

      <Typography
        variant="body2"
        sx={{ color: 'text.secondary', fontWeight: 500, mt: 0.5 }}
      >
        {label}
      </Typography>

      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          mt: 1,
          height: 6,
          borderRadius: 1.5,
          bgcolor: '#2a2d3a',
          '& .MuiLinearProgress-bar': {
            borderRadius: 1.5,
            background: `linear-gradient(90deg, ${color} 0%, ${color}cc 100%)`,
          },
        }}
      />
    </Card>
  );
}
