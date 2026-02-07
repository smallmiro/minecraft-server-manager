'use client';

import { useState, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import {
  useSearchUsers,
  useGrantAccess,
} from '@/hooks/useUserServers';
import type { UserSearchResult } from '@/hooks/useUserServers';

interface ServerAccessDialogProps {
  open: boolean;
  onClose: () => void;
  serverId: string;
}

export function ServerAccessDialog({ open, onClose, serverId }: ServerAccessDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [permission, setPermission] = useState<'view' | 'manage' | 'admin'>('view');

  const { data: searchData, isLoading: isSearching } = useSearchUsers(searchQuery, {
    enabled: open,
  });
  const grantAccess = useGrantAccess();

  const users = useMemo(() => searchData?.users ?? [], [searchData]);

  const handleClose = () => {
    setSearchQuery('');
    setSelectedUser(null);
    setPermission('view');
    grantAccess.reset();
    onClose();
  };

  const handleSubmit = () => {
    if (!selectedUser) return;
    grantAccess.mutate(
      { userId: selectedUser.id, serverId, permission },
      { onSuccess: handleClose }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
    >
      <DialogTitle sx={{ fontWeight: 600 }}>Add User Access</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: '8px !important' }}>
        {grantAccess.isError && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {grantAccess.error?.message || 'Failed to grant access'}
          </Alert>
        )}

        <Autocomplete
          options={users}
          getOptionLabel={(option) => option.name || option.email}
          isOptionEqualToValue={(option, value) => option.id === value.id}
          value={selectedUser}
          onChange={(_, value) => setSelectedUser(value)}
          inputValue={searchQuery}
          onInputChange={(_, value) => setSearchQuery(value)}
          loading={isSearching}
          filterOptions={(x) => x}
          noOptionsText={searchQuery.length < 2 ? 'Type at least 2 characters' : 'No users found'}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Search User"
              placeholder="Search by name or email..."
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {isSearching && <CircularProgress size={20} />}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
          renderOption={(props, option) => {
            const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & { key: string };
            return (
              <Box component="li" key={key} {...rest} sx={{ display: 'flex', gap: 1.5, py: 1 }}>
                <Avatar
                  src={option.image ?? undefined}
                  sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14 }}
                >
                  {(option.name?.[0] || option.email?.[0] || '?').toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    {option.name || 'Unknown'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.email}
                  </Typography>
                </Box>
              </Box>
            );
          }}
        />

        <FormControl>
          <FormLabel sx={{ fontWeight: 500, mb: 1 }}>Permission Level</FormLabel>
          <RadioGroup
            value={permission}
            onChange={(e) => setPermission(e.target.value as 'view' | 'manage' | 'admin')}
          >
            <FormControlLabel
              value="view"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Viewer</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Can view server status and logs
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="manage"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Operator</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Can start, stop, and configure the server
                  </Typography>
                </Box>
              }
            />
            <FormControlLabel
              value="admin"
              control={<Radio size="small" />}
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>Owner</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Full control including managing other users
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!selectedUser || grantAccess.isPending}
          sx={{ borderRadius: 2 }}
        >
          {grantAccess.isPending ? 'Adding...' : 'Add User'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
