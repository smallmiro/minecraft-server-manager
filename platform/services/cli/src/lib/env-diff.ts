/**
 * .env template diffing library for upgrade command.
 * Compares a template .env.example with a user's .env file
 * and identifies new variables that need to be added.
 *
 * Key principle: NEVER modify existing user values (append-only).
 */

export interface ParsedEnvVar {
  key: string;
  defaultValue: string;
  commented: boolean;
  section: string;
}

export interface ParsedEnvFile {
  vars: ParsedEnvVar[];
}

export interface EnvDiffResult {
  newVars: Array<{ key: string; defaultValue: string; section: string }>;
  newCommentedVars: Array<{ key: string; defaultValue: string; section: string }>;
}

/**
 * Check if a comment line is a section header.
 * Section headers are lines like "# Section Name" that describe groups of variables.
 * Excludes lines that are commented-out variables (# VAR=value),
 * delimiter lines (# ====), and multi-line description comments.
 */
function isSectionHeader(line: string): boolean {
  const trimmed = line.trim();
  // Must start with # but not be a delimiter line
  if (!trimmed.startsWith('#')) return false;
  const content = trimmed.slice(1).trim();
  // Skip empty comments
  if (!content) return false;
  // Skip delimiter lines
  if (/^[=\-*]+$/.test(content)) return false;
  // Skip commented-out variables
  if (/^[A-Z_][A-Z0-9_]*=/.test(content)) return false;
  // Skip description-like lines (start with lowercase, or contain typical description patterns)
  if (/^[a-z]/.test(content)) return false;
  if (content.startsWith('Setup:') || content.startsWith('Create') || content.startsWith('Token') || content.startsWith('Start') || content.startsWith('Or ') || content.startsWith('docker ')) return false;
  // Skip lines that reference URLs or are instructions
  if (content.includes('http://') || content.includes('https://')) return false;
  // Skip numbered list items
  if (/^\d+\./.test(content)) return false;
  // Skip lines starting with "e.g." or containing example patterns
  if (content.startsWith('e.g.') || content.includes('e.g.')) return false;
  // Skip "Copy this", "Use pre-built", "Generate with", etc. instructional lines
  if (/^(Copy |Use |Generate |Backup |Web-|Allowed |Public |JWT |NextAuth |Access |API |Or |Enables |If )/.test(content)) return false;
  // Accept if it looks like a section title (capitalized words, short-ish)
  if (/^[A-Z]/.test(content) && content.length < 80) return true;
  return false;
}

/**
 * Check if a comment line is a commented-out variable definition.
 * Pattern: # KEY=value (where KEY is uppercase with underscores/numbers)
 */
function isCommentedVar(line: string): { key: string; value: string } | null {
  const trimmed = line.trim();
  const match = trimmed.match(/^#\s*([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    return { key: match[1]!, value: match[2]! };
  }
  return null;
}

/**
 * Parse a .env template file into structured format.
 * Preserves section headers and distinguishes between
 * active variables and commented-out variables.
 */
export function parseEnvTemplate(content: string): ParsedEnvFile {
  const lines = content.split('\n');
  const vars: ParsedEnvVar[] = [];
  let currentSection = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Empty line - skip
    if (!trimmed) continue;

    // Check for section header
    if (isSectionHeader(trimmed)) {
      currentSection = trimmed.slice(1).trim();
      continue;
    }

    // Check for commented-out variable
    const commentedVar = isCommentedVar(trimmed);
    if (commentedVar) {
      vars.push({
        key: commentedVar.key,
        defaultValue: commentedVar.value,
        commented: true,
        section: currentSection,
      });
      continue;
    }

    // Check for active variable
    if (!trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        // Validate key is a valid env var name
        if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
          const value = trimmed.slice(eqIndex + 1);
          vars.push({
            key,
            defaultValue: value,
            commented: false,
            section: currentSection,
          });
        }
      }
    }
  }

  return { vars };
}

/**
 * Extract all variable keys from user .env file content.
 * Returns a Set of keys that exist in the user's file,
 * whether active or commented out.
 */
function extractUserKeys(userEnv: string): Set<string> {
  const keys = new Set<string>();
  const lines = userEnv.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Active variable
    if (!trimmed.startsWith('#')) {
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        keys.add(key);
      }
      continue;
    }

    // Commented-out variable
    const commentedVar = isCommentedVar(trimmed);
    if (commentedVar) {
      keys.add(commentedVar.key);
    }
  }

  return keys;
}

/**
 * Diff template .env against user .env to find new variables.
 * Returns variables that exist in the template but not in the user's file.
 */
export function diffEnvFiles(template: string, userEnv: string): EnvDiffResult {
  const parsed = parseEnvTemplate(template);
  const userKeys = extractUserKeys(userEnv);

  const newVars: EnvDiffResult['newVars'] = [];
  const newCommentedVars: EnvDiffResult['newCommentedVars'] = [];

  for (const v of parsed.vars) {
    if (userKeys.has(v.key)) continue;

    if (v.commented) {
      newCommentedVars.push({
        key: v.key,
        defaultValue: v.defaultValue,
        section: v.section,
      });
    } else {
      newVars.push({
        key: v.key,
        defaultValue: v.defaultValue,
        section: v.section,
      });
    }
  }

  return { newVars, newCommentedVars };
}

/**
 * Apply env diff to user's .env file content.
 * Appends new variables at the end, grouped by section.
 * Uses values from the `values` map when available, otherwise uses defaults.
 *
 * @param userEnv - Current user .env file content
 * @param diff - Diff result from diffEnvFiles
 * @param values - User-provided values for new variables
 * @returns Updated .env file content
 */
export function applyEnvDiff(
  userEnv: string,
  diff: EnvDiffResult,
  values: Map<string, string>,
): string {
  const allItems = [
    ...diff.newVars.map((v) => ({ ...v, commented: false })),
    ...diff.newCommentedVars.map((v) => ({ ...v, commented: true })),
  ];

  if (allItems.length === 0) {
    return userEnv;
  }

  // Group by section
  const sections = new Map<string, typeof allItems>();
  for (const item of allItems) {
    const section = item.section;
    if (!sections.has(section)) {
      sections.set(section, []);
    }
    sections.get(section)!.push(item);
  }

  const lines: string[] = [];

  // Add separator
  lines.push('');
  lines.push('# --- Added by mcctl upgrade ---');

  for (const [section, items] of sections) {
    if (section) {
      lines.push('');
      lines.push(`# ${section}`);
    }

    for (const item of items) {
      const value = values.get(item.key) ?? item.defaultValue;
      if (item.commented) {
        lines.push(`# ${item.key}=${item.defaultValue}`);
      } else {
        lines.push(`${item.key}=${value}`);
      }
    }
  }

  return userEnv + lines.join('\n');
}
