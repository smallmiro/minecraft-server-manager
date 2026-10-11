export interface ParsedLog {
  time: string;
  thread: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  msg: string;
}

/**
 * Strip ANSI codes and control characters from log line
 */
export function stripAnsi(text: string): string {
  return text
    // ESC sequences with \x1b
    .replace(/\x1b\[\?[\d;]*[a-zA-Z]/g, '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b=/g, '')
    // ESC sequences without \x1b (already stripped). Digits are required:
    // `[Server thread`, `[minecraft/...` must survive.
    .replace(/\[\?[\d;]+[a-zA-Z]/g, '')
    .replace(/\[[0-9;]+[a-zA-Z]/g, '')
    // Control characters
    .replace(/>\.\.\.\.\r?/g, '')
    .replace(/\r/g, '')
    .trim();
}

export function parseLogLine(log: string): ParsedLog | null {
  // Format: [HH:MM:SS] [Thread/LEVEL]: Message  (NeoForge: ... [Thread/LEVEL] [source]: Message)
  const match = stripAnsi(log).match(/\[(\d{2}:\d{2}:\d{2})\]\s*\[([^/\]]+)\/(\w+)\]:?\s*(.+)/);
  if (!match) return null;
  return {
    time: match[1],
    thread: match[2],
    level: (match[3] as ParsedLog['level']) || 'INFO',
    msg: match[4],
  };
}
