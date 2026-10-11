import { Config, Paths, isTelemetryEnabled } from '@minecraft-docker/shared';

/** Shared notice text; `<root>` is replaced with the platform root. Docs quote this verbatim. */
export const TELEMETRY_NOTICE =
  'Console usage analytics is on (anonymous install ID and page paths, sent to Google Analytics). To turn it off, set "telemetry": false in <root>/.mcctl.json.';

/** The notice for `rootDir`, or null when telemetry is disabled (opt-out, DO_NOT_TRACK, no config). */
export function getTelemetryNotice(
  rootDir: string,
  env: Record<string, string | undefined> = process.env
): string | null {
  const config = new Config(new Paths(rootDir)).load();
  return isTelemetryEnabled(config, env) ? TELEMETRY_NOTICE.replace('<root>', rootDir) : null;
}

/** Print the notice (dimmed by caller's choice of `print`) when telemetry is on. */
export function printTelemetryNotice(rootDir: string, print: (s: string) => void = console.log): void {
  const notice = getTelemetryNotice(rootDir);
  if (notice) print(notice);
}
