import { mkdirSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Never fall back to the developer's real ~/minecraft-servers. Test files that
// set MCCTL_ROOT themselves override this; the sqlite repos need data/ and backups/meta.
if (!process.env.MCCTL_ROOT) {
  const root = mkdtempSync(join(tmpdir(), 'mcctl-api-test-'));
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'backups', 'meta'), { recursive: true });
  process.env.MCCTL_ROOT = root;
}
