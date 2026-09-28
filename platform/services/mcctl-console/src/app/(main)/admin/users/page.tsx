'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import BlockIcon from '@mui/icons-material/Block';
import GroupIcon from '@mui/icons-material/Group';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import { BentoGrid, BentoMetricCard, BentoPanel, PageHero } from '@/components/bento';
import { useAdminUsers, type User } from '@/hooks/use-admin-users';
import { UserList } from '@/components/admin/UserList';
import { UserDetailDialog } from '@/components/admin/UserDetailDialog';

export default function UsersPage() {
  const { data: users, isLoading, isError, error } = useAdminUsers();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const usersUnavailable = !isLoading && !users;
  const currentUsers = users ?? [];
  const adminCount = currentUsers.filter((user) => user.role === 'admin').length;
  const bannedCount = currentUsers.filter((user) => user.banned).length;

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
  };

  const handleCloseDialog = () => {
    setSelectedUser(null);
  };

  return (
    <Stack spacing={{ xs: 2, sm: 2.5 }}>
      <PageHero
        compact
        title="User Management"
        description="Review accounts, administrative access, and user status"
        eyebrow="Administration"
        icon={<ManageAccountsIcon />}
      />

      <BentoGrid aria-label="User metrics">
        <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2', md: 'span 4' } }}>
          <BentoMetricCard
            title="Total users"
            value={isLoading ? <Skeleton width={56} /> : usersUnavailable ? 'Unavailable' : currentUsers.length}
            description="Registered accounts"
            icon={<GroupIcon />}
            accent="primary"
          />
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2', md: 'span 4' } }}>
          <BentoMetricCard
            title="Administrators"
            value={isLoading ? <Skeleton width={56} /> : usersUnavailable ? 'Unavailable' : adminCount}
            description="Accounts with admin access"
            icon={<AdminPanelSettingsIcon />}
            accent="info"
          />
        </Box>
        <Box sx={{ gridColumn: { xs: 'span 1', sm: 'span 2', md: 'span 4' } }}>
          <BentoMetricCard
            title="Banned users"
            value={isLoading ? <Skeleton width={56} /> : usersUnavailable ? 'Unavailable' : bannedCount}
            description="Restricted accounts"
            icon={<BlockIcon />}
            accent={bannedCount > 0 ? 'error' : 'success'}
          />
        </Box>

        <BentoPanel
          role="region"
          aria-label="User directory"
          sx={{
            gridColumn: { xs: 'span 1', sm: 'span 6', md: 'span 12' },
            minWidth: 0,
            '& > .MuiPaper-root': { border: 0, borderRadius: 0, boxShadow: 'none' },
          }}
        >
          {isLoading ? (
            <Box
              sx={{
                minHeight: 280,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <CircularProgress aria-label="Loading users" />
            </Box>
          ) : usersUnavailable ? (
            <Box sx={{ p: { xs: 2, sm: 3 } }}>
              <Alert severity="error">
                Failed to load users. {error?.message || 'Please try again later.'}
              </Alert>
            </Box>
          ) : (
            <Box sx={{ minWidth: 0, overflowX: 'auto' }}>
              <UserList users={currentUsers} onUserClick={handleUserClick} />
            </Box>
          )}
        </BentoPanel>
      </BentoGrid>

      {selectedUser && (
        <UserDetailDialog user={selectedUser} open onClose={handleCloseDialog} />
      )}
    </Stack>
  );
}
