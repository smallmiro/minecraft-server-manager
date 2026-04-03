import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import PublicIcon from '@mui/icons-material/Public';
import ShieldIcon from '@mui/icons-material/Shield';
import SpeedIcon from '@mui/icons-material/Speed';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import SettingsIcon from '@mui/icons-material/Settings';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import type { FieldConfig } from './fieldConfigs';
import {
  gameplayEssentialFields,
  gameplayAdvancedFields,
  worldEssentialFields,
  worldAdvancedFields,
  securityEssentialFields,
  securityAdvancedFields,
  performanceEssentialFields,
  performanceAdvancedFields,
  autopauseEssentialFields,
  autopauseAdvancedFields,
  systemEssentialFields,
  systemAdvancedFields,
  configRepoFields,
} from './fieldConfigs';

export interface SectionConfig {
  id: string;
  icon: typeof SportsEsportsIcon;
  title: string;
  description: string;
  essentialFields: FieldConfig[];
  advancedFields: FieldConfig[];
}

export const sectionConfigs: SectionConfig[] = [
  {
    id: 'gameplay',
    icon: SportsEsportsIcon,
    title: 'Gameplay',
    description: 'Core game rules and player experience settings.',
    essentialFields: gameplayEssentialFields,
    advancedFields: gameplayAdvancedFields,
  },
  {
    id: 'world',
    icon: PublicIcon,
    title: 'World',
    description: 'World generation and server identity settings.',
    essentialFields: worldEssentialFields,
    advancedFields: worldAdvancedFields,
  },
  {
    id: 'security',
    icon: ShieldIcon,
    title: 'Security',
    description: 'Authentication and access control settings.',
    essentialFields: securityEssentialFields,
    advancedFields: securityAdvancedFields,
  },
  {
    id: 'performance',
    icon: SpeedIcon,
    title: 'Performance & JVM',
    description: 'Memory, view distance, and JVM optimization settings.',
    essentialFields: performanceEssentialFields,
    advancedFields: performanceAdvancedFields,
  },
  {
    id: 'autopause',
    icon: PauseCircleOutlineIcon,
    title: 'Auto-pause / Auto-stop',
    description: 'Automatically pause or stop when no players are connected.',
    essentialFields: autopauseEssentialFields,
    advancedFields: autopauseAdvancedFields,
  },
  {
    id: 'system',
    icon: SettingsIcon,
    title: 'System',
    description: 'Timezone, resource pack, RCON, and container settings.',
    essentialFields: systemEssentialFields,
    advancedFields: systemAdvancedFields,
  },
  {
    id: 'config-repos',
    icon: FolderSpecialIcon,
    title: 'Configuration Repositories',
    description: 'Git repository URLs for server configuration templates (applied at startup).',
    essentialFields: configRepoFields,
    advancedFields: [],
  },
];
