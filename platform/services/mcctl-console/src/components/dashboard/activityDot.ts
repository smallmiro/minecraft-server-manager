/** Theme palette path used for the dot next to a recent-activity entry. */
export type ActivityDotColor =
  | 'success.main'
  | 'info.main'
  | 'secondary.main'
  | 'error.main'
  | 'text.disabled';

/**
 * Pick the dot colour for an audit entry. Failures always win; otherwise the
 * most specific category applies (backup and config before the broader server.*).
 */
export function getActivityDotColor(action: string, status?: string): ActivityDotColor {
  if (status === 'failure') return 'error.main';
  if (action.includes('backup')) return 'info.main';
  if (action.startsWith('platform.settings') || action.includes('config') || action.includes('snapshot')) {
    return 'secondary.main';
  }
  if (action.startsWith('server.')) return 'success.main';
  return 'text.disabled';
}
