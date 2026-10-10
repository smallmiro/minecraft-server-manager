'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import ViewInArIcon from '@mui/icons-material/ViewInAr';
import CategoryIcon from '@mui/icons-material/Category';
import MapIcon from '@mui/icons-material/Map';
import TimerIcon from '@mui/icons-material/Timer';
import PublicIcon from '@mui/icons-material/Public';
import DiamondIcon from '@mui/icons-material/Diamond';
import type { BlockCount, BlockStatsResult } from '@/ports/api/IMcctlApiClient';
import { blockCategory, buildOreSlices, formatDuration, percent } from './statsViz';

const fmtPct = (v: number) => (v < 0.1 && v > 0 ? '<0.1%' : `${v.toFixed(1)}%`);

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box sx={{ color: 'primary.main', display: 'flex' }}>{icon}</Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 700 }} noWrap>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

export function StatsKpiRow({ stats }: { stats: BlockStatsResult }) {
  return (
    <Box
      data-testid="world-stats-kpis"
      sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' } }}
    >
      <Kpi icon={<ViewInArIcon />} label="Total blocks" value={stats.totalBlocks.toLocaleString()} />
      <Kpi icon={<CategoryIcon />} label="Block types" value={stats.blockTypeCount.toLocaleString()} />
      <Kpi icon={<MapIcon />} label="Regions scanned" value={stats.regionsScanned.toLocaleString()} />
      <Kpi icon={<TimerIcon />} label="Analysis time" value={formatDuration(stats.durationMs)} />
      <Kpi icon={<PublicIcon />} label="Dimensions" value={stats.dimensions.join(' · ') || '-'} />
    </Box>
  );
}

const R = 40;
const C = 2 * Math.PI * R;

/** Ore composition donut + legend + rare-ore highlights. */
export function OreSection({ ores }: { ores: Record<string, number> }) {
  const [merge, setMerge] = useState(true);
  const slices = buildOreSlices(ores, merge);
  const total = slices.reduce((a, s) => a + s.count, 0);
  const rare = slices.filter((s) => s.rare);

  if (slices.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary">
        No ores found.
      </Typography>
    );
  }

  let offset = 0;
  return (
    <Stack spacing={1.5} data-testid="world-stats-ores">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          ⛏️ Ores
        </Typography>
        <FormControlLabel
          control={<Switch size="small" checked={merge} onChange={(e) => setMerge(e.target.checked)} />}
          label={<Typography variant="caption">Merge stone/deepslate variants</Typography>}
          sx={{ m: 0 }}
        />
      </Box>

      {rare.length > 0 && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap data-testid="world-stats-rare-ores">
          {rare.map((s) => (
            <Chip
              key={s.key}
              icon={<DiamondIcon style={{ color: s.color }} />}
              label={`${s.label} ${s.count.toLocaleString()}`}
              variant="outlined"
              size="small"
              sx={{ textTransform: 'capitalize', borderColor: s.color }}
            />
          ))}
        </Stack>
      )}

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
        <Box sx={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
          <svg
            viewBox="0 0 100 100"
            width="160"
            height="160"
            role="img"
            aria-label={`Ore composition: ${slices
              .slice(0, 5)
              .map((s) => `${s.label} ${fmtPct(s.share)}`)
              .join(', ')}`}
          >
            <g transform="rotate(-90 50 50)">
              {slices.map((s) => {
                const len = (s.share / 100) * C;
                const el = (
                  <circle
                    key={s.key}
                    cx="50"
                    cy="50"
                    r={R}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="16"
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return el;
              })}
            </g>
          </svg>
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
              {total.toLocaleString()}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              ores
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            flexGrow: 1,
            width: '100%',
            display: 'grid',
            gap: 0.5,
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          }}
        >
          {slices.map((s) => (
            <Box key={s.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: s.color, flexShrink: 0 }} />
              <Typography variant="caption" sx={{ textTransform: 'capitalize', flexGrow: 1 }} noWrap>
                {s.label}
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {s.count.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 48, textAlign: 'right' }}>
                {fmtPct(s.share)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Stack>
  );
}

const TOP_N = 5;
const blockLabel = (id: string) => (id.includes(':') ? id.slice(id.indexOf(':') + 1) : id).replace(/_/g, ' ');

/** Category-colored stacked bar + top-N list (expandable). */
export function TopBlocksSection({ blocks, totalBlocks }: { blocks: BlockCount[]; totalBlocks: number }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? blocks : blocks.slice(0, TOP_N);
  const max = blocks[0]?.count || 1;

  const byCat = new Map<string, { color: string; count: number }>();
  for (const b of blocks) {
    const cat = blockCategory(b.id);
    byCat.set(cat.label, { color: cat.color, count: (byCat.get(cat.label)?.count ?? 0) + b.count });
  }

  return (
    <Stack spacing={1} data-testid="world-stats-top-blocks">
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        🧱 Top blocks
      </Typography>

      <Box
        role="img"
        aria-label={`Block categories: ${Array.from(byCat.entries())
          .map(([l, v]) => `${l} ${fmtPct(percent(v.count, totalBlocks))}`)
          .join(', ')}`}
        sx={{ display: 'flex', height: 14, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}
      >
        {Array.from(byCat.entries()).map(([label, v]) => (
          <Tooltip key={label} title={`${label} ${fmtPct(percent(v.count, totalBlocks))}`} arrow>
            <Box sx={{ width: `${percent(v.count, totalBlocks)}%`, bgcolor: v.color }} />
          </Tooltip>
        ))}
      </Box>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {Array.from(byCat.entries()).map(([label, v]) => (
          <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: v.color }} />
            <Typography variant="caption">{label}</Typography>
          </Box>
        ))}
      </Stack>

      <Stack spacing={0.75}>
        {shown.map((b) => {
          const cat = blockCategory(b.id);
          return (
            <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ width: 140, flexShrink: 0, textTransform: 'capitalize' }} noWrap>
                {blockLabel(b.id)}
              </Typography>
              <Box sx={{ flexGrow: 1, height: 8, borderRadius: 1, bgcolor: 'action.hover' }}>
                <Box sx={{ width: `${(b.count / max) * 100}%`, height: '100%', borderRadius: 1, bgcolor: cat.color }} />
              </Box>
              <Typography variant="caption" sx={{ width: 84, textAlign: 'right', flexShrink: 0 }}>
                {b.count.toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ width: 48, textAlign: 'right', flexShrink: 0 }}>
                {fmtPct(percent(b.count, totalBlocks))}
              </Typography>
            </Box>
          );
        })}
      </Stack>
      {blocks.length > TOP_N && (
        <Button size="small" onClick={() => setExpanded((e) => !e)} data-testid="world-stats-top-toggle" sx={{ alignSelf: 'flex-start' }}>
          {expanded ? 'Show less' : `Show all ${blocks.length}`}
        </Button>
      )}
    </Stack>
  );
}
