import { describe, expect, it } from 'vitest';
import { getActivityDotColor } from './activityDot';

describe('getActivityDotColor', () => {
  it.each(['server.create', 'server.delete', 'server.start', 'server.stop', 'server.restart'])(
    'maps %s to success',
    (action) => {
      expect(getActivityDotColor(action)).toBe('success.main');
    }
  );

  it.each(['backup.push', 'backup.restore', 'backup.schedule.create', 'server.backup'])(
    'maps backup action %s to info',
    (action) => {
      expect(getActivityDotColor(action)).toBe('info.main');
    }
  );

  it.each([
    'platform.settings.update',
    'config.snapshot.create',
    'config.snapshot.restore',
    'server.config.update',
  ])('maps config/settings action %s to secondary', (action) => {
    expect(getActivityDotColor(action)).toBe('secondary.main');
  });

  it('maps failed entries to error regardless of the action', () => {
    expect(getActivityDotColor('server.start', 'failure')).toBe('error.main');
    expect(getActivityDotColor('backup.push', 'failure')).toBe('error.main');
    expect(getActivityDotColor('player.ban', 'failure')).toBe('error.main');
  });

  it('keeps the category colour for successful entries', () => {
    expect(getActivityDotColor('server.start', 'success')).toBe('success.main');
  });

  it.each(['player.ban', 'player.whitelist.add', 'audit.purge', 'something.unknown', ''])(
    'maps other action %j to text.disabled',
    (action) => {
      expect(getActivityDotColor(action)).toBe('text.disabled');
    }
  );
});
