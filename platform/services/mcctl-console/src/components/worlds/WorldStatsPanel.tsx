'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AssessmentIcon from '@mui/icons-material/Assessment';
import type { BlockCount } from '@/ports/api/IMcctlApiClient';
import { useWorldStats, useAnalyzeStats } from '@/hooks/useMcctl';

export interface WorldStatsPanelProps {
  worldName: string;
}

/** Strip the `minecraft:` namespace and prettify a block id. */
function blockLabel(id: string): string {
  const name = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return name.replace(/_/g, ' ');
}

/** Horizontal bar list for block/ore counts, scaled to the max. */
function BarList({ items, testId }: { items: BlockCount[]; testId: string }) {
  const max = items.reduce((m, i) => Math.max(m, i.count), 0) || 1;
  return (
    <Stack spacing={0.75} data-testid={testId}>
      {items.map((item) => (
        <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ width: 140, flexShrink: 0, textTransform: 'capitalize' }}>
            {blockLabel(item.id)}
          </Typography>
          <Box sx={{ flexGrow: 1 }}>
            <LinearProgress
              variant="determinate"
              value={(item.count / max) * 100}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
          <Typography variant="caption" sx={{ width: 80, textAlign: 'right', flexShrink: 0 }}>
            {item.count.toLocaleString()}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

/**
 * World ore/block statistics (#531, Phase 4). A heavy, on-demand full region
 * scan: the "Analyze" button streams progress over SSE and the cached result
 * is shown as bar charts. This can take minutes on large worlds.
 */
export function WorldStatsPanel({ worldName }: WorldStatsPanelProps) {
  const statsQuery = useWorldStats(worldName);
  const { analyze, isAnalyzing, progress, error } = useAnalyzeStats();

  const stats = statsQuery.data;
  // 404 = never analyzed; treat as a normal "no data" state, not an error.
  const notAnalyzed =
    !stats &&
    (statsQuery.error as (Error & { statusCode?: number }) | null)?.statusCode === 404;

  const handleAnalyze = async () => {
    await analyze(worldName);
    await statsQuery.refetch();
  };

  const ores: BlockCount[] = stats
    ? Object.entries(stats.ores)
        .map(([id, count]) => ({ id, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <Box data-testid="world-stats-panel">
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
          <AssessmentIcon fontSize="small" /> Ore &amp; Block Stats
        </Typography>
        <Tooltip title="Scans every chunk in the world — can take minutes on large worlds" arrow>
          <span>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AssessmentIcon />}
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              data-testid="world-stats-analyze-button"
            >
              {isAnalyzing ? 'Analyzing…' : stats ? 'Re-analyze' : 'Analyze'}
            </Button>
          </span>
        </Tooltip>
      </Box>

      {isAnalyzing && (
        <Box sx={{ mb: 1 }} data-testid="world-stats-progress">
          <LinearProgress
            variant={progress ? 'determinate' : 'indeterminate'}
            value={progress ? (progress.regionsDone / Math.max(progress.regionsTotal, 1)) * 100 : 0}
          />
          <Typography variant="caption" color="text.secondary">
            {progress
              ? `Scanning ${progress.dimension}: ${progress.regionsDone}/${progress.regionsTotal} regions`
              : 'Starting analysis… (this can take a while)'}
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 1 }} data-testid="world-stats-error">
          {error}
        </Alert>
      )}

      {stats ? (
        <Stack spacing={2} data-testid="world-stats-result">
          <Typography variant="caption" color="text.secondary">
            Last analyzed {new Date(stats.analyzedAt).toLocaleString()} ·{' '}
            {stats.totalBlocks.toLocaleString()} blocks · {stats.blockTypeCount} types ·{' '}
            {stats.regionsScanned} regions ({stats.dimensions.join(', ')})
          </Typography>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              ⛏️ Ores
            </Typography>
            {ores.length > 0 ? (
              <BarList items={ores} testId="world-stats-ores" />
            ) : (
              <Typography variant="caption" color="text.secondary">
                No ores found.
              </Typography>
            )}
          </Box>

          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              🧱 Top blocks
            </Typography>
            <BarList items={stats.topBlocks} testId="world-stats-top-blocks" />
          </Box>
        </Stack>
      ) : (
        !isAnalyzing &&
        notAnalyzed && (
          <Stack
            spacing={1}
            alignItems="center"
            justifyContent="center"
            sx={{ minHeight: 120, border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 2 }}
            data-testid="world-stats-empty"
          >
            <Typography variant="body2" color="text.secondary">
              No analysis yet.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Click “Analyze” to scan the world for ore and block statistics.
            </Typography>
          </Stack>
        )
      )}
    </Box>
  );
}
