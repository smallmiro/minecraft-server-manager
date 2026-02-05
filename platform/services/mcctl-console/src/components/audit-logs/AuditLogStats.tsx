'use client';

import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import PeopleIcon from '@mui/icons-material/People';
import type { AuditLogStatsResponse } from '@/types/audit-log';

export interface AuditLogStatsProps {
  stats: AuditLogStatsResponse | undefined;
  isLoading: boolean;
}

interface StatItem {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  description: string;
}

/**
 * Audit log statistics cards
 */
export function AuditLogStats({ stats, isLoading }: AuditLogStatsProps) {
  if (isLoading) {
    return (
      <Grid container spacing={2}>
        {[0, 1, 2, 3].map((i) => (
          <Grid item xs={6} md={3} key={i}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="40%" height={40} />
                <Skeleton variant="text" width="80%" />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  const total = stats?.total ?? 0;
  const successRate = total > 0
    ? ((stats?.byStatus.success ?? 0) / total * 100).toFixed(1)
    : '0.0';
  const failuresToday = stats?.byStatus.failure ?? 0;
  const activeUsers = stats ? Object.keys(stats.byActor).length : 0;

  const items: StatItem[] = [
    {
      title: 'Total Logs',
      value: total.toLocaleString(),
      icon: <AssignmentIcon fontSize="large" />,
      color: '#1bd96a',
      description: 'All audit log entries',
    },
    {
      title: 'Success Rate',
      value: `${successRate}%`,
      icon: <CheckCircleIcon fontSize="large" />,
      color: '#22c55e',
      description: 'Successful operations',
    },
    {
      title: 'Failures',
      value: failuresToday,
      icon: <ErrorOutlineIcon fontSize="large" />,
      color: '#ef4444',
      description: 'Failed operations',
    },
    {
      title: 'Active Users',
      value: activeUsers,
      icon: <PeopleIcon fontSize="large" />,
      color: '#3b82f6',
      description: 'Unique actors',
    },
  ];

  return (
    <Grid container spacing={2}>
      {items.map((item) => (
        <Grid item xs={6} md={3} key={item.title}>
          <Card
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
                background: item.color,
              },
            }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                  {item.title}
                </Typography>
                <Box sx={{ color: item.color, opacity: 0.8 }}>
                  {item.icon}
                </Box>
              </Box>
              <Typography
                variant="h3"
                component="div"
                sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}
              >
                {item.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.description}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}
