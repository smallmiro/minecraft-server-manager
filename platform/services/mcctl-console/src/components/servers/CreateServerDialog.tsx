'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIcon from '@mui/icons-material/Download';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import Autocomplete from '@mui/material/Autocomplete';
import { useWorlds } from '@/hooks/useMcctl';
import { useModpackSearch, useModVersions } from '@/hooks/useMods';
import { useDebounce } from '@/hooks/useDebounce';
import type { CreateServerRequest } from '@/ports/api/IMcctlApiClient';
import type { CreateServerStatus } from '@/hooks/useCreateServerSSE';

interface CreateServerDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateServerRequest) => void;
  loading?: boolean;
  status?: CreateServerStatus;
  progress?: number;
  message?: string;
}

const STANDARD_SERVER_TYPES = ['VANILLA', 'PAPER', 'FABRIC', 'FORGE', 'NEOFORGE'];

function formatDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type ServerCategory = 'standard' | 'modpack';

const DEFAULT_FORM_VALUES: CreateServerRequest = {
  name: '',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  autoStart: false,
  sudoPassword: '',
};

const PROGRESS_STEPS = [
  { key: 'initializing', label: 'Initializing' },
  { key: 'creating', label: 'Creating' },
  { key: 'configuring', label: 'Configuring' },
  { key: 'starting', label: 'Starting' },
];

export function CreateServerDialog({
  open,
  onClose,
  onSubmit,
  loading = false,
  status = 'idle',
  progress = 0,
  message = '',
}: CreateServerDialogProps) {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const [category, setCategory] = useState<ServerCategory>('standard');
  const [formData, setFormData] = useState<CreateServerRequest>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [memoryTouched, setMemoryTouched] = useState(false);
  const [worldMode, setWorldMode] = useState<'none' | 'seed' | 'existingWorld'>('none');
  const [selectedWorldName, setSelectedWorldName] = useState('');

  // Modpack selection state
  const [modpackSlug, setModpackSlug] = useState('');
  const [modpackSearchInput, setModpackSearchInput] = useState('');
  const [selectedLoader, setSelectedLoader] = useState('');
  const [selectedGameVersion, setSelectedGameVersion] = useState('');
  // Comma-separated list of mods to exclude from the modpack (e.g. client-only mods)
  const [excludeFilesInput, setExcludeFilesInput] = useState('');

  // Refs for accessibility
  const firstModpackFieldRef = useRef<HTMLInputElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Determine active step based on status
  const activeStep = PROGRESS_STEPS.findIndex((step) => step.key === status);
  const isCreating = status !== 'idle' && status !== 'completed' && status !== 'error';

  // World data for "Existing World" option
  const { data: worldsData, isLoading: worldsLoading } = useWorlds();
  const unmappedWorlds = (worldsData?.worlds ?? []).filter(
    (w) => (!w.servers || w.servers.length === 0) && !w.isLocked
  );

  // Modpack search autocomplete (only when in modpack mode)
  const { data: modpackSearchData, isLoading: modpackSearchLoading } = useModpackSearch(
    modpackSearchInput,
    { enabled: category === 'modpack' && modpackSearchInput.trim().length >= 2 }
  );
  const modpackOptions = modpackSearchData?.hits ?? [];

  // Debounce the slug used for the compatibility lookup so we don't fire a
  // request for every keystroke while the user types/pastes a slug. The lookup
  // treats its input as an exact slug, so intermediate prefixes (e.g. "c",
  // "cr", "cre") would otherwise hammer the API with not-found requests.
  const debouncedModpackSlug = useDebounce(modpackSlug, 400);

  // Compatibility matrix for the chosen modpack slug
  const {
    data: matrix,
    isLoading: matrixLoading,
    isError: matrixError,
  } = useModVersions(debouncedModpackSlug, {
    enabled: category === 'modpack' && debouncedModpackSlug.trim().length > 0,
  });
  const availableLoaders = useMemo(() => matrix?.loaders ?? [], [matrix]);
  const availableGameVersions = useMemo(
    () =>
      selectedLoader && matrix?.byLoader[selectedLoader]
        ? matrix.byLoader[selectedLoader].gameVersions
        : [],
    [matrix, selectedLoader]
  );
  // No resolved matrix yet for a chosen modpack and no error either — covers
  // both the debounce gap (lookup not started) and the in-flight request.
  // Treated like "loading" so the form can't be submitted with an unresolved
  // compatibility matrix, while a failed lookup (404/error) still lets the
  // backend's secondary validation respond.
  const matrixUnresolved = !!modpackSlug && !matrix && !matrixError;

  // Auto-select the first loader once the matrix resolves.
  useEffect(() => {
    if (availableLoaders.length > 0 && !availableLoaders.includes(selectedLoader)) {
      setSelectedLoader(availableLoaders[0]);
    }
  }, [availableLoaders, selectedLoader]);

  // Auto-select the newest compatible Minecraft version when loader/matrix changes.
  useEffect(() => {
    if (availableGameVersions.length > 0 && !availableGameVersions.includes(selectedGameVersion)) {
      setSelectedGameVersion(availableGameVersions[0]);
    }
  }, [availableGameVersions, selectedGameVersion]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory('standard');
      setFormData(DEFAULT_FORM_VALUES);
      setErrors({});
      setMemoryTouched(false);
      setWorldMode('none');
      setSelectedWorldName('');
      setModpackSlug('');
      setModpackSearchInput('');
      setSelectedLoader('');
      setSelectedGameVersion('');
      setExcludeFilesInput('');
    }
  }, [open]);

  const validateName = (name: string): string | null => {
    if (!name) {
      return 'Server name is required';
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      return 'Only lowercase letters, numbers, and hyphens are allowed';
    }
    return null;
  };

  const validateModpackSlug = (slug: string): string | null => {
    if (!slug) {
      return 'Modpack is required';
    }
    return null;
  };

  const handleCategoryChange = (_: React.MouseEvent<HTMLElement>, newCategory: ServerCategory | null) => {
    if (newCategory === null) return;

    setCategory(newCategory);

    // Update aria-live region
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = `${newCategory === 'standard' ? 'Standard Server' : 'Modpack'} category selected`;
    }

    // Update memory default if not touched by user
    if (!memoryTouched) {
      setFormData((prev) => ({
        ...prev,
        memory: newCategory === 'standard' ? '4G' : '6G',
      }));
    }

    // Focus first field after category switch (with delay for Collapse animation)
    setTimeout(() => {
      if (newCategory === 'modpack' && firstModpackFieldRef.current) {
        firstModpackFieldRef.current.focus();
      }
    }, 300);
  };

  const handleWorldModeChange = (
    _: React.MouseEvent<HTMLElement>,
    newMode: 'none' | 'seed' | 'existingWorld' | null,
  ) => {
    if (newMode === null) return;

    if (newMode !== 'seed') {
      setFormData((prev) => ({ ...prev, seed: undefined }));
    }
    if (newMode !== 'existingWorld') {
      setSelectedWorldName('');
    }
    setErrors((prev) => ({ ...prev, world: '' }));
    setWorldMode(newMode);
  };

  const handleChange = (field: keyof CreateServerRequest) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Track if user manually modified memory
    if (field === 'memory') {
      setMemoryTouched(true);
    }

    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const handleCheckboxChange = (field: keyof CreateServerRequest) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Clear existing errors
    setErrors({});

    // Validate server name
    const nameError = validateName(formData.name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    // Validate modpack selection if in modpack mode
    if (category === 'modpack') {
      const slugError = validateModpackSlug(modpackSlug);
      if (slugError) {
        setErrors({ modpack: slugError });
        return;
      }
      // Block submission while compatibility data is still loading (or a lookup
      // for the just-typed slug hasn't started yet due to debounce).
      if (matrixLoading || matrixUnresolved) {
        setErrors({ modpack: 'Loading modpack compatibility — please wait a moment' });
        return;
      }
      // Once a matrix is available, require a compatible loader + version.
      if (matrix && availableLoaders.length > 0) {
        if (!selectedLoader) {
          setErrors({ modpack: 'Please select a mod loader' });
          return;
        }
        if (!selectedGameVersion) {
          setErrors({ modpack: 'Please select a Minecraft version' });
          return;
        }
      }
    }

    // Prepare submission data based on category
    const submitData: CreateServerRequest = {
      name: formData.name,
      memory: formData.memory,
      autoStart: formData.autoStart,
      sudoPassword: formData.sudoPassword,
    };

    if (category === 'standard') {
      // Standard server: include type and version
      submitData.type = formData.type;
      submitData.version = formData.version;
    } else {
      // Modpack: include modpack fields with a validated (loader, version) pair.
      submitData.type = 'MODRINTH';
      submitData.modpack = modpackSlug;
      if (selectedLoader) {
        submitData.modLoader = selectedLoader;
      }
      if (selectedGameVersion) {
        submitData.version = selectedGameVersion;
        // Use the modpack release recommended for this (loader, version) pair.
        const recommended = matrix?.byLoader[selectedLoader]?.recommended[selectedGameVersion];
        if (recommended) {
          submitData.modpackVersion = recommended;
        }
      }
      // Exclude client-only mods that would crash a dedicated server.
      const excludeFiles = excludeFilesInput
        .split(',')
        .map((f) => f.trim())
        .filter((f) => f.length > 0);
      if (excludeFiles.length > 0) {
        submitData.excludeFiles = excludeFiles;
      }
    }

    // Apply world setup fields
    if (worldMode === 'seed' && formData.seed) {
      submitData.seed = formData.seed;
    } else if (worldMode === 'existingWorld') {
      if (!selectedWorldName) {
        setErrors((prev) => ({ ...prev, world: 'Please select a world' }));
        return;
      }
      submitData.worldName = selectedWorldName;
    }

    // Submit
    onSubmit(submitData);
  };

  // In modpack mode, Create stays disabled until a modpack is chosen and its
  // compatible loader + Minecraft version are resolved (or the matrix failed,
  // in which case we let the backend's secondary validation respond).
  const modpackSelectionIncomplete =
    category === 'modpack' &&
    !!modpackSlug &&
    !matrixError &&
    (matrixLoading ||
      matrixUnresolved ||
      (availableLoaders.length > 0 && (!selectedLoader || !selectedGameVersion)));

  return (
    <Dialog open={open} onClose={isCreating ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={isSmallScreen}>
      <form onSubmit={handleSubmit}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {status === 'completed' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CheckCircleIcon color="success" />
              Server Created Successfully
            </Box>
          ) : status === 'error' ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ErrorIcon color="error" />
              Creation Failed
            </Box>
          ) : (
            'Create New Server'
          )}
          {isSmallScreen && !isCreating && (
            <IconButton
              onClick={onClose}
              aria-label="Close dialog"
              edge="end"
            >
              <CloseIcon />
            </IconButton>
          )}
        </DialogTitle>
        <DialogContent>
          {isCreating || status === 'completed' || status === 'error' ? (
            <Box sx={{ py: 2 }}>
              {/* Progress Stepper */}
              <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                {PROGRESS_STEPS.map((step) => (
                  <Step key={step.key}>
                    <StepLabel>{step.label}</StepLabel>
                  </Step>
                ))}
              </Stepper>

              {/* Progress Bar */}
              {isCreating && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {message}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {progress}%
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={progress} />
                </Box>
              )}

              {/* Completion/Error Message */}
              {status === 'completed' && (
                <Typography color="success.main" sx={{ textAlign: 'center' }}>
                  {message}
                </Typography>
              )}
              {status === 'error' && (
                <Typography color="error.main" sx={{ textAlign: 'center' }}>
                  {message}
                </Typography>
              )}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              {/* Aria-live region for category changes */}
              <Box
                ref={liveRegionRef}
                role="status"
                aria-live="polite"
                sx={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
              />

              {/* Group 1: Identity */}
              <TextField
                label="Server Name"
                value={formData.name}
                onChange={handleChange('name')}
                error={!!errors.name}
                helperText={errors.name || 'Only lowercase letters, numbers, and hyphens'}
                fullWidth
                autoFocus
                disabled={isCreating}
              />

              {/* Group 2: Server Type */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Server Type
                </Typography>

                {/* Category Toggle */}
                <ToggleButtonGroup
                  value={category}
                  exclusive
                  onChange={handleCategoryChange}
                  aria-label="Server category"
                  fullWidth
                  disabled={isCreating}
                >
                  <ToggleButton value="standard" aria-label="Standard Server">
                    Standard Server
                  </ToggleButton>
                  <ToggleButton value="modpack" aria-label="Modpack">
                    Modpack
                  </ToggleButton>
                </ToggleButtonGroup>

                {/* Standard Server Fields */}
                <Collapse in={category === 'standard'} unmountOnExit>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <TextField
                      label="Server Type"
                      select
                      value={formData.type}
                      onChange={handleChange('type')}
                      fullWidth
                      disabled={isCreating}
                    >
                      {STANDARD_SERVER_TYPES.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Minecraft Version"
                      value={formData.version}
                      onChange={handleChange('version')}
                      helperText="e.g., 1.21.1, 1.20.4, latest"
                      fullWidth
                      disabled={isCreating}
                    />
                  </Box>
                </Collapse>

                {/* Modpack Fields */}
                <Collapse in={category === 'modpack'} unmountOnExit>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                    <Alert severity="info">
                      Select a modpack, then a loader and a compatible Minecraft version.
                    </Alert>

                    {/* Modpack search autocomplete (freeSolo allows typing a slug directly) */}
                    <Autocomplete
                      freeSolo
                      options={modpackOptions}
                      loading={modpackSearchLoading}
                      filterOptions={(x) => x}
                      getOptionLabel={(option) =>
                        typeof option === 'string' ? option : option.slug
                      }
                      isOptionEqualToValue={(option, value) =>
                        (typeof option === 'string' ? option : option.slug) ===
                        (typeof value === 'string' ? value : value.slug)
                      }
                      inputValue={modpackSearchInput}
                      onInputChange={(_, newInput) => {
                        setModpackSearchInput(newInput);
                        // Typing also sets the slug (supports direct slug entry).
                        setModpackSlug(newInput.trim());
                        // Reset dependent selections so they re-populate from the
                        // new modpack's matrix. Without this, a loader name shared
                        // by the previous modpack would not trigger the auto-select
                        // Effect, leaving a stale (loader, version) pair.
                        setSelectedLoader('');
                        setSelectedGameVersion('');
                        if (errors.modpack) {
                          setErrors((prev) => ({ ...prev, modpack: '' }));
                        }
                      }}
                      onChange={(_, value) => {
                        const slug =
                          typeof value === 'string' ? value : value?.slug ?? '';
                        setModpackSlug(slug.trim());
                        setModpackSearchInput(slug);
                        // Reset dependent selections; they re-populate from the matrix.
                        setSelectedLoader('');
                        setSelectedGameVersion('');
                      }}
                      renderOption={(props, option) => {
                        if (typeof option === 'string') {
                          return (
                            <li {...props} key={option}>
                              {option}
                            </li>
                          );
                        }
                        return (
                          <li {...props} key={option.slug}>
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 1.5,
                                alignItems: 'flex-start',
                                width: '100%',
                                minWidth: 0,
                              }}
                            >
                              <Avatar
                                src={option.iconUrl || undefined}
                                variant="rounded"
                                sx={{ width: 40, height: 40, bgcolor: 'action.hover', flexShrink: 0 }}
                              >
                                <Inventory2Icon />
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" noWrap>
                                  {option.title}
                                </Typography>
                                {option.description && (
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
                                    {option.description}
                                  </Typography>
                                )}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                                    <DownloadIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
                                    <Typography variant="caption" color="text.disabled">
                                      {formatDownloads(option.downloads)}
                                    </Typography>
                                  </Box>
                                  {option.author && (
                                    <Typography variant="caption" color="text.disabled">
                                      by {option.author}
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Box>
                          </li>
                        );
                      }}
                      disabled={isCreating}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Modpack"
                          error={!!errors.modpack}
                          helperText={
                            errors.modpack ||
                            'Search modrinth.com modpacks, or type a slug (e.g., cobblemon)'
                          }
                          inputRef={firstModpackFieldRef}
                        />
                      )}
                    />

                    {/* Loader + Minecraft version selects (driven by compatibility matrix) */}
                    {modpackSlug && (matrixLoading || matrixUnresolved) && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={18} />
                        <Typography variant="body2" color="text.secondary">
                          Loading compatible loaders and versions…
                        </Typography>
                      </Box>
                    )}

                    {modpackSlug && matrixError && (
                      <Alert severity="warning">
                        Could not load modpack compatibility. Check the slug and try again.
                      </Alert>
                    )}

                    {modpackSlug && !matrixLoading && !matrixError && availableLoaders.length > 0 && (
                      <>
                        <TextField
                          label="Mod Loader"
                          select
                          value={selectedLoader}
                          onChange={(e) => {
                            setSelectedLoader(e.target.value);
                            setSelectedGameVersion('');
                          }}
                          helperText="Only loaders supported by this modpack"
                          fullWidth
                          disabled={isCreating}
                        >
                          {availableLoaders.map((loader) => (
                            <MenuItem key={loader} value={loader}>
                              {loader}
                            </MenuItem>
                          ))}
                        </TextField>

                        <TextField
                          label="Minecraft Version"
                          select
                          value={selectedGameVersion}
                          onChange={(e) => setSelectedGameVersion(e.target.value)}
                          helperText="Only versions compatible with the selected loader"
                          fullWidth
                          disabled={isCreating || availableGameVersions.length === 0}
                        >
                          {availableGameVersions.map((gv) => (
                            <MenuItem key={gv} value={gv}>
                              {gv}
                            </MenuItem>
                          ))}
                        </TextField>
                      </>
                    )}

                    {modpackSlug && (
                      <TextField
                        label="Exclude mods (optional)"
                        value={excludeFilesInput}
                        onChange={(e) => setExcludeFilesInput(e.target.value)}
                        placeholder="e.g. statuseffectbars, jei"
                        helperText="Comma-separated. Use this to drop client-only mods that crash a dedicated server."
                        fullWidth
                        disabled={isCreating}
                      />
                    )}
                  </Box>
                </Collapse>
              </Box>

              {/* Group 2.5: World Setup */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  World Setup
                </Typography>

                <ToggleButtonGroup
                  value={worldMode}
                  exclusive
                  onChange={handleWorldModeChange}
                  aria-label="World setup mode"
                  fullWidth
                  disabled={isCreating}
                >
                  <ToggleButton value="none" aria-label="Default World">
                    Default World
                  </ToggleButton>
                  <ToggleButton value="seed" aria-label="Seed">
                    Seed
                  </ToggleButton>
                  <ToggleButton value="existingWorld" aria-label="Existing World">
                    Existing World
                  </ToggleButton>
                </ToggleButtonGroup>

                <Collapse in={worldMode === 'seed'} unmountOnExit>
                  <TextField
                    label="Seed"
                    value={formData.seed || ''}
                    onChange={handleChange('seed')}
                    fullWidth
                    disabled={isCreating}
                    sx={{ mt: 2 }}
                  />
                </Collapse>

                <Collapse in={worldMode === 'existingWorld'} unmountOnExit>
                  <Box sx={{ mt: 2 }}>
                    {worldsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                        <CircularProgress size={24} />
                      </Box>
                    ) : (
                      <TextField
                        label="World"
                        select
                        value={selectedWorldName}
                        onChange={(e) => {
                          setSelectedWorldName(e.target.value);
                          if (errors.world) {
                            setErrors((prev) => ({ ...prev, world: '' }));
                          }
                        }}
                        fullWidth
                        disabled={isCreating || unmappedWorlds.length === 0}
                        error={!!errors.world}
                        helperText={
                          errors.world ||
                          (unmappedWorlds.length === 0 ? 'No unmapped worlds available' : '')
                        }
                      >
                        {unmappedWorlds.length === 0 ? (
                          <MenuItem value="" disabled>
                            No unmapped worlds available
                          </MenuItem>
                        ) : (
                          unmappedWorlds.map((world) => (
                            <MenuItem key={world.name} value={world.name}>
                              {world.name}
                            </MenuItem>
                          ))
                        )}
                      </TextField>
                    )}
                  </Box>
                </Collapse>
              </Box>

              {/* Group 3: Configuration */}
              <TextField
                label="Memory"
                value={formData.memory}
                onChange={handleChange('memory')}
                helperText="e.g., 4G, 8G, 16G"
                fullWidth
                disabled={isCreating}
              />

              <TextField
                label="Sudo Password"
                type="password"
                value={formData.sudoPassword || ''}
                onChange={handleChange('sudoPassword')}
                helperText="Required for mDNS hostname registration (avahi)"
                fullWidth
                disabled={isCreating}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData.autoStart || false}
                    onChange={handleCheckboxChange('autoStart')}
                    disabled={isCreating}
                  />
                }
                label="Auto-start after creation"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {status === 'completed' || status === 'error' ? (
            <Button onClick={onClose} variant="contained" fullWidth>
              Close
            </Button>
          ) : (
            <>
              <Button onClick={onClose} disabled={isCreating}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={isCreating || modpackSelectionIncomplete}
                startIcon={isCreating ? <CircularProgress size={16} /> : null}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </>
          )}
        </DialogActions>
      </form>
    </Dialog>
  );
}
