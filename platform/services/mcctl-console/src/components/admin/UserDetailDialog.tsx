import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { User } from '@/hooks/use-admin-users';

interface UserDetailDialogProps {
  user: User;
  open: boolean;
  onClose: () => void;
}

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

export function UserDetailDialog({ user, open, onClose }: UserDetailDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">User Details</Typography>
          <IconButton onClick={onClose} size="small" aria-label="close">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Email
            </Typography>
            <Typography variant="body1">{user.email}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Name
            </Typography>
            <Typography variant="body1">{user.name || 'N/A'}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Role
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {user.role === 'admin' ? (
                <Chip label="Admin" color="primary" size="small" />
              ) : (
                <Chip label="User" size="small" />
              )}
            </Box>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {user.banned ? (
                <Chip label="Banned" color="error" size="small" />
              ) : (
                <Chip label="Active" color="success" size="small" />
              )}
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="caption" color="text.secondary">
              Created At
            </Typography>
            <Typography variant="body2">{formatDate(user.createdAt)}</Typography>
          </Box>

          <Box>
            <Typography variant="caption" color="text.secondary">
              User ID
            </Typography>
            <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
              {user.id}
            </Typography>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
