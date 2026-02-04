/**
 * Creeper Icon Component
 * Minecraft-style creeper face icon
 */

import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon';

export function CreeperIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} viewBox="0 0 32 32">
      {/* Background */}
      <rect width="32" height="32" fill="#5DA840" />
      {/* Eyes */}
      <rect x="4" y="8" width="8" height="8" fill="#000" />
      <rect x="20" y="8" width="8" height="8" fill="#000" />
      {/* Mouth */}
      <rect x="12" y="16" width="8" height="4" fill="#000" />
      <rect x="8" y="20" width="16" height="8" fill="#000" />
      <rect x="8" y="28" width="4" height="4" fill="#000" />
      <rect x="20" y="28" width="4" height="4" fill="#000" />
      {/* Texture */}
      <rect x="0" y="0" width="4" height="4" fill="#4A9030" opacity="0.5" />
      <rect x="8" y="4" width="4" height="4" fill="#4A9030" opacity="0.5" />
      <rect x="24" y="0" width="4" height="4" fill="#4A9030" opacity="0.5" />
      <rect x="28" y="8" width="4" height="4" fill="#4A9030" opacity="0.5" />
      <rect x="0" y="24" width="4" height="4" fill="#4A9030" opacity="0.5" />
    </SvgIcon>
  );
}
