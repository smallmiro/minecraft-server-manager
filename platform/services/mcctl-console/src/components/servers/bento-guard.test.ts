import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Server detail tab content is built on Bento panels (#781); MUI Card
// nested in the tab panel doubles the border.
const FILES = [
  'ServerModsTab.tsx',
  'ServerAccessTab.tsx',
  'HostnameSection.tsx',
  'files/ServerFilesTab.tsx',
  'ServerPlayersTab.tsx',
  'ServerOptionsTab.tsx',
  'settings/SettingsSection.tsx',
  'files/PlayerEditorDialog.tsx',
  'files/ServerPropertiesView.tsx',
  'files/TextEditor.tsx',
  'PlayerDetailModal.tsx',
];

describe('server detail tabs use Bento panels', () => {
  it.each(FILES)('%s does not import MUI Card', (file) => {
    const source = readFileSync(join(__dirname, file), 'utf8');
    expect(source).not.toMatch(/from '@mui\/material\/Card(Content|Header|Actions)?'/);
  });
});
