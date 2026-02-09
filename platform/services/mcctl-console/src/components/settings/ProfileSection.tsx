'use client';

import { useState, useEffect } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import PersonIcon from '@mui/icons-material/Person';
import { updateUser, useSession } from '@/lib/auth-client';

interface ProfileSectionProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function ProfileSection({ onSuccess, onError }: ProfileSectionProps) {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || '');
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const user = session?.user;

  // Sync name when session loads (handles SSR→CSR hydration)
  useEffect(() => {
    if (user?.name && !initialized) {
      setName(user.name);
      setInitialized(true);
    }
  }, [user?.name, initialized]);

  const hasChanged = name !== (user?.name || '');

  const handleSave = async () => {
    if (!hasChanged || !name.trim()) return;

    setLoading(true);
    try {
      const { error } = await updateUser({ name: name.trim() });
      if (error) {
        onError(error.message || 'Failed to update profile');
      } else {
        onSuccess('Profile updated successfully');
      }
    } catch {
      onError('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <PersonIcon color="primary" />
          <Typography variant="h6" component="h2">
            Profile
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            size="small"
          />

          <TextField
            label="Email"
            value={user.email}
            fullWidth
            size="small"
            disabled
            helperText="Email cannot be changed"
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Role:
            </Typography>
            <Chip
              label={user.role === 'admin' ? 'Admin' : 'User'}
              size="small"
              color={user.role === 'admin' ? 'primary' : 'default'}
              variant="outlined"
            />
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!hasChanged || !name.trim() || loading}
              startIcon={loading ? <CircularProgress size={16} /> : null}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
