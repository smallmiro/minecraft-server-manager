'use client';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { OreSection, StatsKpiRow, TopBlocksSection } from './stats/StatsCharts';
import { useWorldStats, useAnalyzeStats } from '@/hooks/useMcctl';

export interface WorldStatsPanelProps {
  worldName: string;
}

/**
 * World ore/block statistics (#531, Phase 4). A heavy, on-demand full region
 * scan: the "Analyze" button streams progress over SSE and the cached result
 * is shown as KPI cards, an ore donut and block-category bars. This can take minutes on large worlds.
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
            Last analyzed {new Date(stats.analyzedAt).toLocaleString()}
          </Typography>
          <StatsKpiRow stats={stats} />
          <OreSection ores={stats.ores} />
          <TopBlocksSection blocks={stats.topBlocks} totalBlocks={stats.totalBlocks} />
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
