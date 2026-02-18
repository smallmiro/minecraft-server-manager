import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import type { User } from '@/hooks/use-admin-users';

function formatDate(date: Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

interface UserListProps {
  users: User[];
  onUserClick: (user: User) => void;
}

export function UserList({ users, onUserClick }: UserListProps) {
  if (users.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '200px',
          p: 4,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No users found
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Created At</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow
              key={user.id}
              hover
              onClick={() => onUserClick(user)}
              sx={{ cursor: 'pointer' }}
            >
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.name || 'N/A'}</TableCell>
              <TableCell>
                {user.role === 'admin' ? (
                  <Chip label="Admin" color="primary" size="small" />
                ) : (
                  <Chip label="User" size="small" />
                )}
              </TableCell>
              <TableCell>
                {user.banned ? (
                  <Chip label="Banned" color="error" size="small" />
                ) : (
                  <Chip label="Active" color="success" size="small" />
                )}
              </TableCell>
              <TableCell>{formatDate(user.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
