'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Snackbar from '@mui/material/Snackbar';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Avatar from '@mui/material/Avatar';
import InputAdornment from '@mui/material/InputAdornment';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import ExtensionIcon from '@mui/icons-material/Extension';
import DownloadIcon from '@mui/icons-material/Download';
import { useServerMods, useModSearch, useAddMod, useRemoveMod } from '@/hooks/useMods';

interface ServerModsTabProps {
  serverName: string;
}

interface SnackbarState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function ServerModsTab({ serverName }: ServerModsTabProps) {
  const { data: modsData, isLoading, error } = useServerMods(serverName);
  const addMod = useAddMod();
  const removeMod = useRemoveMod();

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [modChanged, setModChanged] = useState(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    open: false,
    message: '',
    severity: 'info',
  });

  const { data: searchData, isLoading: isSearching } = useModSearch(debouncedQuery, {
    limit: 10,
    enabled: searchOpen && debouncedQuery.length > 0,
  });

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleRemoveMod = useCallback(async (slug: string) => {
    try {
      await removeMod.mutateAsync({ serverName, slug });
      setModChanged(true);
      setSnackbar({ open: true, message: `Removed ${slug}`, severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to remove mod',
        severity: 'error',
      });
    }
  }, [removeMod, serverName]);

  const handleAddMod = useCallback(async (slug: string) => {
    try {
      await addMod.mutateAsync({ serverName, slugs: [slug] });
      setModChanged(true);
      setSnackbar({ open: true, message: `Added ${slug}`, severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : 'Failed to add mod',
        severity: 'error',
      });
    }
  }, [addMod, serverName]);

  // Collect all installed mod slugs for "already installed" check
  const installedSlugs = new Set<string>();
  if (modsData?.mods) {
    for (const slugs of Object.values(modsData.mods)) {
      for (const s of slugs) {
        installedSlugs.add(s);
      }
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Failed to load mods: {error.message}
      </Alert>
    );
  }

  const hasAnyMods = installedSlugs.size > 0;

  return (
    <Box>
      {/* Restart Alert */}
      {modChanged && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Restart the server to apply mod changes.
        </Alert>
      )}

      {/* Installed Mods */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              Installed Mods
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => {
                setSearchQuery('');
                setDebouncedQuery('');
                setSearchOpen(true);
              }}
            >
              Add Mods
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {!hasAnyMods ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <ExtensionIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body1" color="text.secondary">
                No mods installed
              </Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                Click &quot;Add Mods&quot; to search and install mods from Modrinth
              </Typography>
            </Box>
          ) : (
            Object.entries(modsData!.mods).map(([source, slugs]) => (
              <Box key={source} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'capitalize' }}>
                  {source}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {slugs.map((slug) => (
                    <Chip
                      key={slug}
                      label={slug}
                      icon={<ExtensionIcon />}
                      onDelete={() => handleRemoveMod(slug)}
                      deleteIcon={<DeleteIcon />}
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            ))
          )}
        </CardContent>
      </Card>

      {/* Search Dialog */}
      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { minHeight: 400 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Search Mods
          <IconButton onClick={() => setSearchOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            autoFocus
            placeholder="Search Modrinth..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2 }}
          />

          {isSearching && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          )}

          {!isSearching && searchData && searchData.hits.length === 0 && debouncedQuery && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No mods found for &quot;{debouncedQuery}&quot;
            </Typography>
          )}

          {!isSearching && searchData && searchData.hits.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {searchData.hits.map((hit) => {
                const isInstalled = installedSlugs.has(hit.slug);
                return (
                  <Card
                    key={hit.slug}
                    variant="outlined"
                    sx={{ borderRadius: 2 }}
                  >
                    <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                        <Avatar
                          src={hit.iconUrl || undefined}
                          variant="rounded"
                          sx={{ width: 40, height: 40, bgcolor: 'action.hover' }}
                        >
                          <ExtensionIcon />
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="subtitle2" noWrap>
                              {hit.title}
                            </Typography>
                            <Button
                              size="small"
                              variant={isInstalled ? 'outlined' : 'contained'}
                              disabled={isInstalled || addMod.isPending}
                              onClick={() => handleAddMod(hit.slug)}
                              sx={{ ml: 1, minWidth: 80, flexShrink: 0 }}
                            >
                              {isInstalled ? 'Installed' : 'Add'}
                            </Button>
                          </Box>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mt: 0.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            {hit.description}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                              <DownloadIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                              <Typography variant="caption" color="text.disabled">
                                {formatDownloads(hit.downloads)}
                              </Typography>
                            </Box>
                            {hit.author && (
                              <Typography variant="caption" color="text.disabled">
                                by {hit.author}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
