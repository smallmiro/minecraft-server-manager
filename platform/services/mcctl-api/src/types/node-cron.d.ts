/**
 * Type declarations for node-cron
 * This ensures the project compiles even when node-cron is not installed
 */
declare module 'node-cron' {
  interface ScheduledTask {
    start(): void;
    stop(): void;
  }

  interface ScheduleOptions {
    scheduled?: boolean;
    timezone?: string;
  }

  export function schedule(
    expression: string,
    func: () => void | Promise<void>,
    options?: ScheduleOptions
  ): ScheduledTask;

  export function validate(expression: string): boolean;
}
