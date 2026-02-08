'use client';

import { useState } from 'react';
import { Box, Typography, CircularProgress, Alert } from '@mui/material';
import { useAdminUsers, type User } from '@/hooks/use-admin-users';
import { UserList } from '@/components/admin/UserList';
import { UserDetailDialog } from '@/components/admin/UserDetailDialog';

export default function UsersPage() {
  const { data: users, isLoading, isError, error } = useAdminUsers();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleUserClick = (user: User) => {
    setSelectedUser(user);
  };

  const handleCloseDialog = () => {
    setSelectedUser(null);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load users. {error?.message || 'Please try again later.'}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        User Management
      </Typography>

      <UserList users={users || []} onUserClick={handleUserClick} />

      {selectedUser && (
        <UserDetailDialog
          user={selectedUser}
          open={true}
          onClose={handleCloseDialog}
        />
      )}
    </Box>
  );
}
