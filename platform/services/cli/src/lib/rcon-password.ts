import { randomBytes } from 'node:crypto';

/** 24-char base64url password (144 bits). */
export function generateRconPassword(): string {
  return randomBytes(18).toString('base64url');
}

/** Replace the template default `RCON_PASSWORD=changeme`; any other value is left as-is. */
export function randomizeRconPassword(content: string): string {
  return content.replace(/^RCON_PASSWORD=changeme\s*$/m, () => `RCON_PASSWORD=${generateRconPassword()}`);
}
