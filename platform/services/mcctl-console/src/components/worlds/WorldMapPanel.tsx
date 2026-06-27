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
import PlaceIcon from '@mui/icons-material/Place';
import { useMapStatus, useRenderMap, useWriteMapMarkers } from '@/hooks/useMcctl';

export interface WorldMapPanelProps {
  worldName: string;
}

/**
 * World map section (#529 Phase 2, #530 Phase 3): renders a BlueMap web map and
 * embeds BlueMap's own viewer in an iframe. A manual button triggers an offline
 * render with live progress (SSE); a second button extracts world structures
 * and writes them as BlueMap markers (shown natively in the viewer, with
 * per-category toggle and click popups).
 */
export function WorldMapPanel({ worldName }: WorldMapPanelProps) {
  const statusQuery = useMapStatus(worldName);
  const { render, isRendering, progress, error } = useRenderMap();
  const markers = useWriteMapMarkers();
  // Bump to force the iframe to reload after a fresh render / marker update.
  const [iframeKey, setIframeKey] = useState(0);
  const [markerCount, setMarkerCount] = useState<number | null>(null);

  const rendered = statusQuery.data?.rendered ?? false;
  const mapSrc = `/api/worlds/${encodeURIComponent(worldName)}/map/web/index.html`;

  const handleRender = async () => {
    await render(worldName);
    setIframeKey((k) => k + 1);
    await statusQuery.refetch();
  };

  const handleMarkers = async () => {
    const result = await markers.mutateAsync(worldName);
    setMarkerCount(result.total);
    setIframeKey((k) => k + 1); // reload so BlueMap re-fetches markers.json
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
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
          {rendered && (
            <Button
              size="small"
              variant="outlined"
              color="secondary"
              startIcon={<PlaceIcon />}
              onClick={handleMarkers}
              disabled={markers.isPending || isRendering}
              data-testid="world-map-markers-button"
            >
              {markers.isPending ? 'Marking…' : 'Show structures'}
            </Button>
          )}
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRender}
            disabled={isRendering || markers.isPending}
            data-testid="world-map-render-button"
          >
            {isRendering ? 'Rendering…' : rendered ? 'Re-render' : 'Render map'}
          </Button>
        </Stack>
      </Box>

      {markerCount !== null && !markers.isPending && (
        <Alert severity="success" sx={{ mb: 1 }} data-testid="world-map-markers-result">
          {markerCount > 0
            ? `${markerCount} structures marked on the map (toggle types in the BlueMap legend).`
            : 'No structures found in this world.'}
        </Alert>
      )}

      {markers.isError && (
        <Alert severity="error" sx={{ mb: 1 }} data-testid="world-map-markers-error">
          {markers.error?.message ?? 'Failed to write structure markers'}
        </Alert>
      )}

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
