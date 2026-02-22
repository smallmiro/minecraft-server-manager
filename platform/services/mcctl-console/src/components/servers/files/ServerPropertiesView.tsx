'use client';

import { useState, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import Dialog from '@mui/material/Dialog';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TuneIcon from '@mui/icons-material/Tune';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CodeIcon from '@mui/icons-material/Code';
import SaveIcon from '@mui/icons-material/Save';
import { ServerPropertiesEditor } from './ServerPropertiesEditor';
import { RawPropertiesEditor } from './RawPropertiesEditor';
import type { RawPropertiesEditorHandle } from './RawPropertiesEditor';

type ViewMode = 'form' | 'raw';

interface ServerPropertiesViewProps {
  serverName: string;
  onBack: () => void;
}

export function isServerPropertiesFile(fileName: string): boolean {
  return fileName === 'server.properties';
}

export function ServerPropertiesView({ serverName, onBack }: ServerPropertiesViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [rawDirty, setRawDirty] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'back' | 'form' | null>(null);
  const rawEditorRef = useRef<RawPropertiesEditorHandle>(null);

  const handleViewModeChange = useCallback((_: React.MouseEvent<HTMLElement>, newMode: ViewMode | null) => {
    if (!newMode || newMode === viewMode) return;

    if (viewMode === 'raw' && rawDirty) {
      // RAW→FORM with unsaved changes: confirm discard
      setConfirmAction('form');
    } else {
      setViewMode(newMode);
    }
  }, [viewMode, rawDirty]);

  const handleBack = useCallback(() => {
    if (viewMode === 'raw' && rawDirty) {
      setConfirmAction('back');
    } else {
      onBack();
    }
  }, [viewMode, rawDirty, onBack]);

  const handleConfirmDiscard = useCallback(() => {
    const action = confirmAction;
    setConfirmAction(null);
    setRawDirty(false);

    if (action === 'back') {
      onBack();
    } else if (action === 'form') {
      setViewMode('form');
    }
  }, [confirmAction, onBack]);

  const handleSave = useCallback(() => {
    rawEditorRef.current?.save();
  }, []);

  return (
    <>
      <Card sx={{ borderRadius: 3, display: 'flex', flexDirection: 'column', minHeight: 600 }}>
        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <IconButton size="small" onClick={handleBack} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <TuneIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }} noWrap>
            server.properties
          </Typography>

          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="form">
              <ListAltIcon fontSize="small" sx={{ mr: 0.5 }} />
              Form
            </ToggleButton>
            <ToggleButton value="raw">
              <CodeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Raw
            </ToggleButton>
          </ToggleButtonGroup>

          {viewMode === 'raw' && (
            <Button
              size="small"
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!rawDirty}
            >
              Save
            </Button>
          )}
        </Box>

        {/* Content */}
        <CardContent sx={{ flex: 1, overflow: 'auto', p: 0, '&:last-child': { pb: 0 } }}>
          {viewMode === 'form' ? (
            <ServerPropertiesEditor serverName={serverName} />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
              <RawPropertiesEditor
                ref={rawEditorRef}
                serverName={serverName}
                filePath="/server.properties"
                onDirtyChange={setRawDirty}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Discard Confirmation Dialog */}
      <Dialog open={confirmAction !== null} onClose={() => setConfirmAction(null)} maxWidth="xs" fullWidth>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Unsaved Changes
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            You have unsaved changes in the raw editor. Do you want to discard them?
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
            <Button onClick={handleConfirmDiscard} color="error" variant="contained">
              Discard
            </Button>
          </Box>
        </Box>
      </Dialog>
    </>
  );
}
