/**
 * Turn the raw AUTO_SCALE_ASLEEP_MOTD value into plain text for display: literal two-char `\n`
 * sequences become line breaks and `§x` formatting codes are dropped. Callers render the result
 * as text (never innerHTML).
 */
export function formatAsleepMotd(raw: string): string {
  return raw
    .replace(/\\n/g, '\n')
    .replace(/§[0-9a-fk-orx]/gi, '')
    .trim();
}
