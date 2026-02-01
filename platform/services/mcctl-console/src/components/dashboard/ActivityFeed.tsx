'use client';

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Stop as StopIcon,
  PersonAdd as JoinIcon,
  PersonRemove as LeaveIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

export interface ActivityItem {
  id: string;
  type: 'server_start' | 'server_stop' | 'player_join' | 'player_leave' | 'info';
  message: string;
  timestamp: string;
  serverName?: string;
}

export interface ActivityFeedProps {
  activities: ActivityItem[];
  maxItems?: number;
  title?: string;
}

export function ActivityFeed({ activities, maxItems, title = 'Activity Feed' }: ActivityFeedProps) {
  const displayedActivities = maxItems ? activities.slice(0, maxItems) : activities;

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'server_start':
        return <StartIcon sx={{ color: 'success.main' }} />;
      case 'server_stop':
        return <StopIcon sx={{ color: 'error.main' }} />;
      case 'player_join':
        return <JoinIcon sx={{ color: 'primary.main' }} />;
      case 'player_leave':
        return <LeaveIcon sx={{ color: 'text.secondary' }} />;
      default:
        return <InfoIcon sx={{ color: 'info.main' }} />;
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const now = new Date();
    const activityTime = new Date(timestamp);
    const diffMs = now.getTime() - activityTime.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffSeconds < 60) {
      return 'just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} ${diffMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else {
      return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
    }
  };

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader title={title} />
        <CardContent>
          <Typography color="text.secondary" align="center">
            No recent activity
          </Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        <List sx={{ py: 0 }}>
          {displayedActivities.map((activity) => (
            <ListItem
              key={activity.id}
              sx={{
                px: 0,
                py: 1.5,
                '&:not(:last-child)': {
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>
                {getActivityIcon(activity.type)}
              </ListItemIcon>
              <ListItemText
                primary={activity.message}
                secondary={formatTimestamp(activity.timestamp)}
                primaryTypographyProps={{
                  variant: 'body2',
                  sx: { fontWeight: 500 },
                }}
                secondaryTypographyProps={{
                  variant: 'caption',
                }}
              />
            </ListItem>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}
