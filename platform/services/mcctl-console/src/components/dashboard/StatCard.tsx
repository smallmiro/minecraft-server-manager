'use client';

import { ReactNode } from 'react';
import { Card, CardContent, Typography, Box } from '@mui/material';

export interface StatCardProps {
  title: string;
  value: number;
  icon?: ReactNode;
  color?: 'primary' | 'success' | 'info' | 'secondary';
  description?: string;
}

export function StatCard({ title, value, icon, color = 'primary', description }: StatCardProps) {
  const colorMap = {
    primary: '#1bd96a',
    success: '#22c55e',
    info: '#3b82f6',
    secondary: '#7c3aed',
  };

  return (
    <Card
      data-testid="stat-card"
      sx={{
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: colorMap[color],
        },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
          {icon && (
            <Box sx={{ color: colorMap[color], opacity: 0.8 }}>
              {icon}
            </Box>
          )}
        </Box>

        <Typography
          variant="h3"
          component="div"
          sx={{
            fontWeight: 700,
            color: 'text.primary',
            mb: description ? 1 : 0,
          }}
        >
          {value}
        </Typography>

        {description && (
          <Typography variant="caption" color="text.secondary">
            {description}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
