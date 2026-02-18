'use client';

import { useState, useEffect, useRef } from 'react';
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
const MODPACK_PLATFORMS = ['MODRINTH'];
const MOD_LOADERS = ['', 'forge', 'fabric', 'neoforge', 'quilt'];

type ServerCategory = 'standard' | 'modpack';

const DEFAULT_FORM_VALUES: CreateServerRequest = {
  name: '',
  type: 'PAPER',
  version: '1.21.1',
  memory: '4G',
  autoStart: false,
  sudoPassword: '',
};

const DEFAULT_MODPACK_VALUES: CreateServerRequest = {
  name: '',
  type: 'MODRINTH',
  memory: '6G',
  autoStart: false,
  sudoPassword: '',
  modpack: '',
  modpackVersion: '',
  modLoader: '',
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

  // Refs for accessibility
  const firstModpackFieldRef = useRef<HTMLInputElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Determine active step based on status
  const activeStep = PROGRESS_STEPS.findIndex((step) => step.key === status);
  const isCreating = status !== 'idle' && status !== 'completed' && status !== 'error';

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setCategory('standard');
      setFormData(DEFAULT_FORM_VALUES);
      setErrors({});
      setMemoryTouched(false);
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
      return 'Modpack slug is required';
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

    // Validate modpack slug if in modpack mode
    if (category === 'modpack') {
      const slugError = validateModpackSlug(formData.modpack || '');
      if (slugError) {
        setErrors({ modpack: slugError });
        return;
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
      // Modpack: include modpack fields
      submitData.type = 'MODRINTH';
      submitData.modpack = formData.modpack;
      if (formData.modpackVersion) {
        submitData.modpackVersion = formData.modpackVersion;
      }
      if (formData.modLoader) {
        submitData.modLoader = formData.modLoader;
      }
    }

    // Submit
    onSubmit(submitData);
  };

  return (
    <Dialog open={open} onClose={isCreating ? undefined : onClose} maxWidth="sm" fullWidth fullScreen={isSmallScreen}>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
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
                      Minecraft version is automatically determined by the modpack
                    </Alert>

                    <TextField
                      label="Modpack Slug"
                      value={formData.modpack || ''}
                      onChange={handleChange('modpack')}
                      error={!!errors.modpack}
                      helperText={
                        errors.modpack || 'e.g., cobblemon, adrenaserver (from modrinth.com/modpacks/SLUG)'
                      }
                      fullWidth
                      disabled={isCreating}
                      inputRef={firstModpackFieldRef}
                    />

                    <TextField
                      label="Mod Loader"
                      select
                      value={formData.modLoader || ''}
                      onChange={handleChange('modLoader')}
                      helperText="Leave empty to auto-detect from modpack"
                      fullWidth
                      disabled={isCreating}
                    >
                      <MenuItem value="">Auto-detect</MenuItem>
                      {MOD_LOADERS.filter((l) => l).map((loader) => (
                        <MenuItem key={loader} value={loader}>
                          {loader}
                        </MenuItem>
                      ))}
                    </TextField>

                    <TextField
                      label="Modpack Version"
                      value={formData.modpackVersion || ''}
                      onChange={handleChange('modpackVersion')}
                      helperText="Leave empty for latest"
                      fullWidth
                      disabled={isCreating}
                    />
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
                disabled={isCreating}
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
