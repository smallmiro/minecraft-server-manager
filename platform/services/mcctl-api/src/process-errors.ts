interface ErrorLog {
  error(obj: object, msg: string): void;
}

/**
 * Process-wide error handling for the API (#657).
 * - unhandledRejection: log and keep serving. A stray rejected promise in a
 *   background task must not take every request down with it.
 * - uncaughtException: log, then exit(1). The process state is unknown after
 *   it, so Node's convention is to stop; PM2 restarts the API.
 */
export function installProcessErrorHandlers(
  log: ErrorLog,
  proc: Pick<NodeJS.Process, 'on'> = process,
  exit: (code: number) => void = process.exit
): void {
  proc.on('unhandledRejection', (reason) => {
    log.error({ err: reason }, 'Unhandled promise rejection');
  });
  proc.on('uncaughtException', (err) => {
    log.error({ err }, 'Uncaught exception, exiting');
    exit(1);
  });
}
