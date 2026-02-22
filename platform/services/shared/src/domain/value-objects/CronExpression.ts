/**
 * CronExpression Value Object
 * Represents a validated cron expression for backup scheduling
 */

const PRESETS: Record<string, string> = {
  hourly: '0 * * * *',
  daily: '0 3 * * *',
  'every-6h': '0 */6 * * *',
  'every-12h': '0 */12 * * *',
  weekly: '0 3 * * 0',
};

const FIELD_RANGES: Array<{ name: string; min: number; max: number }> = [
  { name: 'minute', min: 0, max: 59 },
  { name: 'hour', min: 0, max: 23 },
  { name: 'day of month', min: 1, max: 31 },
  { name: 'month', min: 1, max: 12 },
  { name: 'day of week', min: 0, max: 7 },
];

export class CronExpression {
  private readonly _expression: string;

  private constructor(expression: string) {
    this._expression = expression;
  }

  get expression(): string {
    return this._expression;
  }

  /**
   * Create a CronExpression from a raw cron string
   * Validates the expression before creating
   */
  static create(expression: string): CronExpression {
    const trimmed = expression.trim();
    if (!trimmed) {
      throw new Error('Cron expression cannot be empty');
    }

    const fields = trimmed.split(/\s+/);
    if (fields.length !== 5) {
      throw new Error(
        `Invalid cron expression: expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`
      );
    }

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i]!;
      const range = FIELD_RANGES[i]!;
      CronExpression.validateField(field, range.name, range.min, range.max);
    }

    return new CronExpression(trimmed);
  }

  /**
   * Create a CronExpression from a named preset
   */
  static fromPreset(preset: string): CronExpression {
    const expression = PRESETS[preset];
    if (!expression) {
      const available = Object.keys(PRESETS).join(', ');
      throw new Error(
        `Unknown cron preset: "${preset}". Available presets: ${available}`
      );
    }
    return new CronExpression(expression);
  }

  /**
   * Get available preset names
   */
  static getPresets(): Record<string, string> {
    return { ...PRESETS };
  }

  /**
   * Convert cron expression to a human-readable description
   */
  toHumanReadable(): string {
    // Check if it matches a preset
    for (const [name, expr] of Object.entries(PRESETS)) {
      if (this._expression === expr) {
        switch (name) {
          case 'hourly':
            return 'Every hour';
          case 'daily':
            return 'Daily at 3:00 AM';
          case 'every-6h':
            return 'Every 6 hours';
          case 'every-12h':
            return 'Every 12 hours';
          case 'weekly':
            return 'Weekly on Sunday at 3:00 AM';
        }
      }
    }
    return `Cron: ${this._expression}`;
  }

  toString(): string {
    return this._expression;
  }

  equals(other: CronExpression): boolean {
    return this._expression === other._expression;
  }

  /**
   * Validate a single cron field
   */
  private static validateField(
    field: string,
    name: string,
    min: number,
    max: number
  ): void {
    // Wildcard
    if (field === '*') return;

    // Step values: */n or n-m/s
    if (field.includes('/')) {
      const [range, step] = field.split('/');
      if (!step || isNaN(Number(step)) || Number(step) < 1) {
        throw new Error(`Invalid step value in ${name} field: "${field}"`);
      }
      if (range !== '*') {
        CronExpression.validateField(range!, name, min, max);
      }
      return;
    }

    // Range: n-m
    if (field.includes('-')) {
      const [start, end] = field.split('-');
      const startNum = Number(start);
      const endNum = Number(end);
      if (isNaN(startNum) || isNaN(endNum)) {
        throw new Error(`Invalid range in ${name} field: "${field}"`);
      }
      if (startNum < min || startNum > max || endNum < min || endNum > max) {
        throw new Error(
          `Value out of range in ${name} field: "${field}" (allowed: ${min}-${max})`
        );
      }
      if (startNum > endNum) {
        throw new Error(
          `Invalid range in ${name} field: start (${startNum}) > end (${endNum})`
        );
      }
      return;
    }

    // List: n,m,o
    if (field.includes(',')) {
      const values = field.split(',');
      for (const val of values) {
        CronExpression.validateField(val, name, min, max);
      }
      return;
    }

    // Simple number
    const num = Number(field);
    if (isNaN(num)) {
      throw new Error(`Invalid value in ${name} field: "${field}"`);
    }
    if (num < min || num > max) {
      throw new Error(
        `Value out of range in ${name} field: ${num} (allowed: ${min}-${max})`
      );
    }
  }
}
