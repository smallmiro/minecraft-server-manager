'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import MapIcon from '@mui/icons-material/Map';
import { useMapStatus, useRenderMap } from '@/hooks/useMcctl';

export interface WorldMapPanelProps {
  worldName: string;
}

/**
 * World map section (#529, Phase 2): renders a BlueMap web map for the world
 * and embeds BlueMap's own viewer in an iframe. A manual button triggers an
 * offline render with live progress streamed over SSE.
 */
export function WorldMapPanel({ worldName }: WorldMapPanelProps) {
  const statusQuery = useMapStatus(worldName);
  const { render, isRendering, progress, error } = useRenderMap();
  // Bump to force the iframe to reload after a fresh render.
  const [iframeKey, setIframeKey] = useState(0);

  const rendered = statusQuery.data?.rendered ?? false;
  const mapSrc = `/api/worlds/${encodeURIComponent(worldName)}/map/web/index.html`;

  const handleRender = async () => {
    await render(worldName);
    setIframeKey((k) => k + 1);
    await statusQuery.refetch();
  };

  return (
    <Box data-testid="world-map-panel">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: 1,
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MapIcon fontSize="small" /> Map
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRender}
          disabled={isRendering}
          data-testid="world-map-render-button"
        >
          {isRendering ? 'Rendering…' : rendered ? 'Re-render' : 'Render map'}
        </Button>
      </Box>

      {isRendering && (
        <Box sx={{ mb: 1 }} data-testid="world-map-progress">
          <LinearProgress
            variant={progress ? 'determinate' : 'indeterminate'}
            value={progress?.percent ?? 0}
          />
          <Typography variant="caption" color="text.secondary">
            {progress
              ? `${progress.map}: ${progress.percent.toFixed(1)}%${
                  progress.eta ? ` (ETA: ${progress.eta})` : ''
                }`
              : 'Starting render…'}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} data-testid="world-map-error">
          {error}
        </Alert>
      )}

      {rendered ? (
        <Box
          component="iframe"
          key={iframeKey}
          src={mapSrc}
          title={`${worldName} map`}
          data-testid="world-map-iframe"
          sx={{
            width: '100%',
            height: { xs: 320, sm: 480 },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        />
      ) : (
        !isRendering && (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{
              minHeight: 160,
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
              p: 2,
            }}
            data-testid="world-map-empty"
          >
            <Typography variant="body2" color="text.secondary">
              No map rendered yet.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click “Render map” to generate a BlueMap view of this world.
            </Typography>
          </Stack>
        )
      )}
    </Box>
  );
}
