import { describe, it, expect } from 'vitest';
import { parseEnvTemplate, diffEnvFiles, applyEnvDiff } from '../../../src/lib/env-diff.js';

describe('parseEnvTemplate', () => {
  it('should parse simple KEY=value lines', () => {
    const content = 'HOST_IP=192.168.1.100\nDEFAULT_MEMORY=4G';
    const parsed = parseEnvTemplate(content);

    expect(parsed.vars).toHaveLength(2);
    expect(parsed.vars[0]).toEqual({
      key: 'HOST_IP',
      defaultValue: '192.168.1.100',
      commented: false,
      section: '',
    });
    expect(parsed.vars[1]).toEqual({
      key: 'DEFAULT_MEMORY',
      defaultValue: '4G',
      commented: false,
      section: '',
    });
  });

  it('should track section headers from # comments', () => {
    const content = `# Network Configuration
HOST_IP=192.168.1.100

# Default Server Settings
DEFAULT_MEMORY=4G`;

    const parsed = parseEnvTemplate(content);
    expect(parsed.vars[0]!.section).toBe('Network Configuration');
    expect(parsed.vars[1]!.section).toBe('Default Server Settings');
  });

  it('should recognize section headers with === delimiters', () => {
    const content = `# =============================================================================
# External Access (playit.gg) - Optional
# =============================================================================
# PLAYIT_SECRET_KEY=your-secret-key-here`;

    const parsed = parseEnvTemplate(content);
    expect(parsed.vars).toHaveLength(1);
    expect(parsed.vars[0]!.section).toBe('External Access (playit.gg) - Optional');
    expect(parsed.vars[0]!.commented).toBe(true);
  });

  it('should parse commented-out variables (# VAR=value)', () => {
    const content = `# HOST_IPS=192.168.1.100,100.64.0.5
# PLAYIT_SECRET_KEY=your-secret-key-here`;

    const parsed = parseEnvTemplate(content);
    expect(parsed.vars).toHaveLength(2);
    expect(parsed.vars[0]).toEqual({
      key: 'HOST_IPS',
      defaultValue: '192.168.1.100,100.64.0.5',
      commented: true,
      section: '',
    });
    expect(parsed.vars[1]).toEqual({
      key: 'PLAYIT_SECRET_KEY',
      defaultValue: 'your-secret-key-here',
      commented: true,
      section: '',
    });
  });

  it('should skip pure comment lines without KEY=value pattern', () => {
    const content = `# This is a pure comment
# Another description line
HOST_IP=192.168.1.100
# Used by create-server.sh to configure mc-router hostnames`;

    const parsed = parseEnvTemplate(content);
    expect(parsed.vars).toHaveLength(1);
    expect(parsed.vars[0]!.key).toBe('HOST_IP');
  });

  it('should handle empty lines and whitespace', () => {
    const content = `
HOST_IP=192.168.1.100

DEFAULT_MEMORY=4G
`;

    const parsed = parseEnvTemplate(content);
    expect(parsed.vars).toHaveLength(2);
  });

  it('should handle values with = signs', () => {
    const content = 'SOME_VAR=foo=bar=baz';
    const parsed = parseEnvTemplate(content);
    expect(parsed.vars[0]!.defaultValue).toBe('foo=bar=baz');
  });

  it('should handle empty values', () => {
    const content = 'EMPTY_VAR=';
    const parsed = parseEnvTemplate(content);
    expect(parsed.vars[0]!.defaultValue).toBe('');
  });
});

describe('diffEnvFiles', () => {
  it('should find new variables not in user env', () => {
    const template = `HOST_IP=192.168.1.100
NEW_VAR=default-value`;
    const userEnv = `HOST_IP=10.0.0.1`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newVars).toHaveLength(1);
    expect(diff.newVars[0]!.key).toBe('NEW_VAR');
    expect(diff.newVars[0]!.defaultValue).toBe('default-value');
  });

  it('should find new commented variables not in user env', () => {
    const template = `HOST_IP=192.168.1.100
# PLAYIT_SECRET_KEY=your-secret-key-here`;
    const userEnv = `HOST_IP=10.0.0.1`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newCommentedVars).toHaveLength(1);
    expect(diff.newCommentedVars[0]!.key).toBe('PLAYIT_SECRET_KEY');
  });

  it('should not include existing variables (even if values differ)', () => {
    const template = `HOST_IP=192.168.1.100
DEFAULT_MEMORY=4G`;
    const userEnv = `HOST_IP=10.0.0.1
DEFAULT_MEMORY=8G`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newVars).toHaveLength(0);
    expect(diff.newCommentedVars).toHaveLength(0);
  });

  it('should not include variables that exist commented in user env', () => {
    const template = `# BACKUP_GITHUB_TOKEN=ghp_xxx`;
    const userEnv = `# BACKUP_GITHUB_TOKEN=my-token`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newCommentedVars).toHaveLength(0);
  });

  it('should not include variables that exist uncommented in user env when template has them commented', () => {
    const template = `# PLAYIT_SECRET_KEY=your-secret-key-here`;
    const userEnv = `PLAYIT_SECRET_KEY=my-actual-key`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newCommentedVars).toHaveLength(0);
  });

  it('should preserve section info in diff results', () => {
    const template = `# Network Configuration
HOST_IP=192.168.1.100

# New Feature Section
NEW_VAR=default`;
    const userEnv = `HOST_IP=10.0.0.1`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newVars[0]!.section).toBe('New Feature Section');
  });

  it('should return empty when template and user env match', () => {
    const template = `HOST_IP=192.168.1.100
DEFAULT_MEMORY=4G`;
    const userEnv = `HOST_IP=10.0.0.1
DEFAULT_MEMORY=8G`;

    const diff = diffEnvFiles(template, userEnv);
    expect(diff.newVars).toHaveLength(0);
    expect(diff.newCommentedVars).toHaveLength(0);
  });
});

describe('applyEnvDiff', () => {
  it('should append new variables at the end of user env', () => {
    const userEnv = `HOST_IP=10.0.0.1
DEFAULT_MEMORY=4G`;

    const diff = {
      newVars: [{ key: 'NEW_VAR', defaultValue: 'default', section: 'New Section' }],
      newCommentedVars: [],
    };

    const result = applyEnvDiff(userEnv, diff, new Map());
    expect(result).toContain('NEW_VAR=default');
    expect(result).toContain('# New Section');
  });

  it('should use user-provided values from the values map', () => {
    const userEnv = `HOST_IP=10.0.0.1`;

    const diff = {
      newVars: [{ key: 'NEW_VAR', defaultValue: 'default', section: '' }],
      newCommentedVars: [],
    };

    const values = new Map([['NEW_VAR', 'user-value']]);
    const result = applyEnvDiff(userEnv, diff, values);
    expect(result).toContain('NEW_VAR=user-value');
    expect(result).not.toContain('NEW_VAR=default');
  });

  it('should append commented variables as commented', () => {
    const userEnv = `HOST_IP=10.0.0.1`;

    const diff = {
      newVars: [],
      newCommentedVars: [{ key: 'OPT_VAR', defaultValue: 'default', section: 'Optional' }],
    };

    const result = applyEnvDiff(userEnv, diff, new Map());
    expect(result).toContain('# OPT_VAR=default');
  });

  it('should group variables by section', () => {
    const userEnv = `HOST_IP=10.0.0.1`;

    const diff = {
      newVars: [
        { key: 'VAR_A', defaultValue: 'a', section: 'Section 1' },
        { key: 'VAR_B', defaultValue: 'b', section: 'Section 1' },
        { key: 'VAR_C', defaultValue: 'c', section: 'Section 2' },
      ],
      newCommentedVars: [],
    };

    const result = applyEnvDiff(userEnv, diff, new Map());
    const lines = result.split('\n');

    // Section 1 header should appear once
    const section1Occurrences = lines.filter((l) => l.includes('# Section 1'));
    expect(section1Occurrences).toHaveLength(1);

    // Section 2 header should appear once
    const section2Occurrences = lines.filter((l) => l.includes('# Section 2'));
    expect(section2Occurrences).toHaveLength(1);
  });

  it('should return original env when no changes needed', () => {
    const userEnv = `HOST_IP=10.0.0.1`;
    const diff = { newVars: [], newCommentedVars: [] };

    const result = applyEnvDiff(userEnv, diff, new Map());
    expect(result).toBe(userEnv);
  });

  it('should handle empty user env', () => {
    const userEnv = '';
    const diff = {
      newVars: [{ key: 'NEW_VAR', defaultValue: 'val', section: '' }],
      newCommentedVars: [],
    };

    const result = applyEnvDiff(userEnv, diff, new Map());
    expect(result).toContain('NEW_VAR=val');
  });
});
