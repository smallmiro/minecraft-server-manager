import { log, colors } from '@minecraft-docker/shared';
import { getContainer } from '../../infrastructure/di/container.js';
import type { FileDiff } from '@minecraft-docker/shared';

export interface ConfigSnapshotDiffOptions {
  root?: string;
  id1: string;
  id2: string;
  unified?: boolean;
  sideBySide?: boolean;
  filesOnly?: boolean;
  json?: boolean;
}

/**
 * Display diff between two config snapshots
 */
export async function configSnapshotDiffCommand(
  options: ConfigSnapshotDiffOptions
): Promise<number> {
  if (!options.id1 || !options.id2) {
    log.error(
      'Two snapshot IDs are required. Usage: mcctl config-snapshot diff <id1> <id2>'
    );
    return 1;
  }

  const container = getContainer(options.root);
  const useCase = container.configSnapshotUseCase;

  try {
    const diff = await useCase.diff(options.id1, options.id2);

    if (options.json) {
      console.log(JSON.stringify(diff.toJSON(), null, 2));
      return 0;
    }

    // Summary header
    const { added, modified, deleted } = diff.summary;
    console.log('');
    console.log(colors.bold('Snapshot Diff'));
    console.log(`  Base:    ${colors.dim(options.id1.substring(0, 8))}...`);
    console.log(`  Compare: ${colors.dim(options.id2.substring(0, 8))}...`);
    console.log('');

    if (!diff.hasChanges) {
      console.log(colors.dim('No differences found between snapshots.'));
      console.log('');
      return 0;
    }

    // Summary line
    const summaryParts: string[] = [];
    if (added > 0) summaryParts.push(colors.green(`+${added} added`));
    if (modified > 0) summaryParts.push(colors.yellow(`~${modified} modified`));
    if (deleted > 0) summaryParts.push(colors.red(`-${deleted} deleted`));
    console.log(`  Changes: ${summaryParts.join(', ')}`);
    console.log('');

    if (options.filesOnly) {
      // Show only file names with status indicators
      console.log(colors.bold('Changed Files:'));
      console.log('');

      for (const change of diff.changes) {
        const statusIcon = getStatusIcon(change.status);
        const statusColor = getStatusColor(change.status);
        console.log(`  ${statusIcon} ${statusColor(change.path)}`);
      }

      console.log('');
      return 0;
    }

    // Full diff output
    for (const change of diff.changes) {
      printFileDiff(change);
    }

    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error(`Failed to compute diff: ${message}`);
    return 1;
  }
}

/**
 * Get the status icon for a file change
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'added':
      return colors.green('+');
    case 'deleted':
      return colors.red('-');
    case 'modified':
      return colors.yellow('~');
    default:
      return ' ';
  }
}

/**
 * Get the color function for a file change status
 */
function getStatusColor(
  status: string
): (text: string) => string {
  switch (status) {
    case 'added':
      return colors.green;
    case 'deleted':
      return colors.red;
    case 'modified':
      return colors.yellow;
    default:
      return (t: string) => t;
  }
}

/**
 * Print unified diff output for a single file
 */
function printFileDiff(change: FileDiff): void {
  const statusLabel =
    change.status === 'added'
      ? colors.green('[ADDED]')
      : change.status === 'deleted'
        ? colors.red('[DELETED]')
        : colors.yellow('[MODIFIED]');

  console.log(`${statusLabel} ${colors.bold(change.path)}`);

  if (change.status === 'added' && change.newContent !== undefined) {
    // Show added file content (first 10 lines)
    const lines = change.newContent.split('\n').slice(0, 10);
    for (const line of lines) {
      console.log(colors.green(`  + ${line}`));
    }
    if (change.newContent.split('\n').length > 10) {
      console.log(colors.dim('  ... (truncated)'));
    }
  } else if (change.status === 'deleted' && change.oldContent !== undefined) {
    // Show deleted file content (first 10 lines)
    const lines = change.oldContent.split('\n').slice(0, 10);
    for (const line of lines) {
      console.log(colors.red(`  - ${line}`));
    }
    if (change.oldContent.split('\n').length > 10) {
      console.log(colors.dim('  ... (truncated)'));
    }
  } else if (
    change.status === 'modified' &&
    change.oldContent !== undefined &&
    change.newContent !== undefined
  ) {
    // Produce a simple line-by-line diff
    const oldLines = change.oldContent.split('\n');
    const newLines = change.newContent.split('\n');

    const maxLines = Math.min(Math.max(oldLines.length, newLines.length), 20);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        console.log(colors.green(`  + ${newLine}`));
      } else if (newLine === undefined && oldLine !== undefined) {
        console.log(colors.red(`  - ${oldLine}`));
      } else if (oldLine !== newLine) {
        if (oldLine !== undefined) {
          console.log(colors.red(`  - ${oldLine}`));
        }
        if (newLine !== undefined) {
          console.log(colors.green(`  + ${newLine}`));
        }
      }
    }

    const totalLines = Math.max(oldLines.length, newLines.length);
    if (totalLines > 20) {
      console.log(colors.dim(`  ... (${totalLines - 20} more lines)`));
    }
  }

  console.log('');
}
