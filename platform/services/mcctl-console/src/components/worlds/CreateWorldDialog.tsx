'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import type { CreateWorldRequest } from '@/ports/api/IMcctlApiClient';

// ----------------------------------------------------------------
// Loader guidance text
// ----------------------------------------------------------------

const SINGLE_FOLDER_BASE =
  '월드 폴더 하나(예: `world/`)를 통째로 압축하세요. 폴더 안에 `level.dat`가 있어야 하며, 네더/엔드는 `DIM-1`·`DIM1`·`dimensions/` 하위 폴더로 자동 포함됩니다. (싱글플레이 월드는 `.minecraft/saves/<월드명>/` 폴더)';

const SINGLE_FOLDER_MOD_SUFFIX =
  '※ 모드팩/설정에 따라 `<월드명>_nether`·`<월드명>_the_end`로 분할되어 있다면, 세 폴더를 모두 함께 압축하세요.';

const SPLIT_FOLDER_TEXT =
  '월드가 `<월드명>/`, `<월드명>_nether/`, `<월드명>_the_end/` 세 폴더로 나뉩니다. **세 폴더를 모두 함께** 압축하세요. 하나라도 빠지면 해당 차원이 사라집니다.';

const LOADER_GUIDANCE: Record<string, string> = {
  VANILLA: SINGLE_FOLDER_BASE,
  PAPER: SPLIT_FOLDER_TEXT,
  SPIGOT: SPLIT_FOLDER_TEXT,
  BUKKIT: SPLIT_FOLDER_TEXT,
  FORGE: `${SINGLE_FOLDER_BASE} ${SINGLE_FOLDER_MOD_SUFFIX}`,
  NEOFORGE: `${SINGLE_FOLDER_BASE} ${SINGLE_FOLDER_MOD_SUFFIX}`,
  FABRIC: `${SINGLE_FOLDER_BASE} ${SINGLE_FOLDER_MOD_SUFFIX}`,
  QUILT: `${SINGLE_FOLDER_BASE} ${SINGLE_FOLDER_MOD_SUFFIX}`,
};

const LOADER_OPTIONS = [
  'VANILLA',
  'PAPER',
  'SPIGOT',
  'BUKKIT',
  'FORGE',
  'NEOFORGE',
  'FABRIC',
  'QUILT',
] as const;

// ----------------------------------------------------------------
// Props & component
// ----------------------------------------------------------------

interface CreateWorldDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateWorldRequest, zipFile?: File | null) => void;
  loading?: boolean;
}

const DEFAULT_FORM_VALUES: CreateWorldRequest = {
  name: '',
  seed: '',
};

export function CreateWorldDialog({
  open,
  onClose,
  onSubmit,
  loading = false,
}: CreateWorldDialogProps) {
  const [formData, setFormData] = useState<CreateWorldRequest>(DEFAULT_FORM_VALUES);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loaderType, setLoaderType] = useState<string>('VANILLA');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setFormData(DEFAULT_FORM_VALUES);
      setErrors({});
      setLoaderType('VANILLA');
      setZipFile(null);
      setDragActive(false);
    }
  }, [open]);

  const validateName = (name: string): string | null => {
    if (!name) {
      return 'World name is required';
    }
    if (!/^[a-z0-9-]+$/.test(name)) {
      return 'Only lowercase letters, numbers, and hyphens are allowed';
    }
    return null;
  };

  const handleChange =
    (field: keyof CreateWorldRequest) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) {
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    };

  const handleZipSelect = useCallback((file: File) => {
    if (file.name.endsWith('.zip')) {
      setZipFile(file);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleZipSelect(file);
    },
    [handleZipSelect]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleZipSelect(file);
    // Reset the input so the same file can be re-selected
    e.target.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const nameError = validateName(formData.name);
    if (nameError) {
      setErrors({ name: nameError });
      return;
    }

    if (zipFile) {
      // When importing a zip, seed is irrelevant
      onSubmit({ name: formData.name }, zipFile);
    } else {
      onSubmit({
        name: formData.name,
        ...(formData.seed ? { seed: formData.seed } : {}),
      });
    }
  };

  const guidanceText = LOADER_GUIDANCE[loaderType] ?? LOADER_GUIDANCE.VANILLA;

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Create New World</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* World Name */}
            <TextField
              label="World Name"
              value={formData.name}
              onChange={handleChange('name')}
              error={!!errors.name}
              helperText={errors.name || 'Only lowercase letters, numbers, and hyphens'}
              fullWidth
              autoFocus
              disabled={loading}
            />

            {/* Seed — hidden when a zip is selected */}
            {!zipFile && (
              <TextField
                label="Seed (optional)"
                value={formData.seed || ''}
                onChange={handleChange('seed')}
                helperText="Leave empty for a random seed"
                fullWidth
                disabled={loading}
              />
            )}

            {/* Server type selector (for guidance only) */}
            <TextField
              select
              label="Server type (압축 안내용)"
              value={loaderType}
              onChange={(e) => setLoaderType(e.target.value)}
              fullWidth
              disabled={loading}
              helperText="월드 zip 압축 방식을 서버 유형에 맞게 안내합니다"
            >
              {LOADER_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </TextField>

            {/* Loader guidance alert */}
            <Alert severity="info" sx={{ '& .MuiAlert-message': { fontSize: '0.8125rem' } }}>
              {guidanceText}
            </Alert>

            {/* Zip drop-zone */}
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                월드 .zip 업로드 (선택)
              </Typography>
              <Box
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                sx={{
                  border: '2px dashed',
                  borderColor: dragActive ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 3,
                  textAlign: 'center',
                  cursor: loading ? 'default' : 'pointer',
                  bgcolor: dragActive ? 'action.hover' : 'transparent',
                  transition: 'all 0.2s',
                  '&:hover': loading
                    ? {}
                    : { borderColor: 'primary.main', bgcolor: 'action.hover' },
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 36, color: 'text.secondary', mb: 0.5 }} />
                {zipFile ? (
                  <Typography variant="body2" color="primary" fontWeight={500}>
                    {zipFile.name}
                  </Typography>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      .zip 파일을 드래그하거나 클릭해서 선택하세요
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      업로드하면 Seed 필드는 무시됩니다
                    </Typography>
                  </>
                )}
              </Box>
              <input
                ref={inputRef}
                type="file"
                accept=".zip"
                hidden
                disabled={loading}
                onChange={handleFileInputChange}
                data-testid="zip-file-input"
              />
              {zipFile && (
                <Button
                  size="small"
                  color="inherit"
                  sx={{ mt: 0.5 }}
                  disabled={loading}
                  onClick={() => setZipFile(null)}
                >
                  파일 제거
                </Button>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : null}
          >
            {loading ? 'Creating...' : zipFile ? 'Import' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
