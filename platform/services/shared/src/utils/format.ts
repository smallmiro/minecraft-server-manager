/**
 * Pure formatting helpers (no I/O, safe for the domain layer to import).
 */

/**
 * Format a byte count into a human-readable string.
 * Matches the algorithm used in World.sizeFormatted (no space between number and unit).
 * e.g. 1024 → "1.0KB", 1536 → "1.5KB"
 */
export function formatWorldBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)}${units[unitIndex]}`;
}
