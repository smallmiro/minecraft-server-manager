/** Pure helpers for the Ore & Block Stats visualization (#567). */

export interface OreSlice {
  key: string;
  label: string;
  count: number;
  /** Share of all ores, 0-100. */
  share: number;
  color: string;
  rare: boolean;
}

const FALLBACK_COLOR = '#9e9e9e';

const ORE_META: Record<string, { color: string; rare?: boolean }> = {
  coal: { color: '#4b4b4b' },
  iron: { color: '#d8a47f' },
  copper: { color: '#e07b39' },
  gold: { color: '#f5c518', rare: true },
  redstone: { color: '#e53935' },
  lapis: { color: '#2f5fd0' },
  diamond: { color: '#26d0e0', rare: true },
  emerald: { color: '#2ecc71', rare: true },
  quartz: { color: '#ece6dc' },
  ancient_debris: { color: '#7b4a2e', rare: true },
};

/** `minecraft:deepslate_iron_ore` -> `iron`; `nether_gold_ore` -> `gold`. */
function oreBase(id: string): string {
  const name = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return name.replace(/^(deepslate_|nether_)/, '').replace(/_ore$/, '');
}

const pretty = (s: string) => s.replace(/_/g, ' ');

export function percent(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

/** Group ores (optionally merging stone/deepslate/nether variants) into donut slices. */
export function buildOreSlices(ores: Record<string, number>, merge = true): OreSlice[] {
  const grouped = new Map<string, number>();
  for (const [id, count] of Object.entries(ores)) {
    const key = merge ? oreBase(id) : id;
    grouped.set(key, (grouped.get(key) ?? 0) + count);
  }
  const total = [...grouped.values()].reduce((a, b) => a + b, 0);
  return [...grouped.entries()]
    .map(([key, count]) => {
      const meta = ORE_META[merge ? key : oreBase(key)];
      return {
        key,
        label: pretty(merge ? key : key.slice(key.indexOf(':') + 1)),
        count,
        share: percent(count, total),
        color: meta?.color ?? FALLBACK_COLOR,
        rare: Boolean(meta?.rare),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface BlockCategory {
  label: string;
  color: string;
}

const CATEGORIES: [RegExp, BlockCategory][] = [
  [/(^|_)(water|lava|ice|snow)(_|$)/, { label: 'Fluid', color: '#42a5f5' }],
  [/(netherrack|soul_|basalt|blackstone|magma|nylium|glowstone)/, { label: 'Nether', color: '#b71c1c' }],
  [/(_log|_planks|_leaves|_wood)$/, { label: 'Wood', color: '#8d6e63' }],
  [/(^|_)(dirt|grass_block|sand|gravel|clay|mud|podzol|mycelium)(_|$)/, { label: 'Earth', color: '#a1887f' }],
  [/(stone|deepslate|granite|diorite|andesite|tuff|calcite|bedrock|obsidian)/, { label: 'Stone', color: '#78909c' }],
];
const OTHER: BlockCategory = { label: 'Other', color: FALLBACK_COLOR };

export function blockCategory(id: string): BlockCategory {
  const name = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return CATEGORIES.find(([re]) => re.test(name))?.[1] ?? OTHER;
}

export function formatDuration(ms: number): string {
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
