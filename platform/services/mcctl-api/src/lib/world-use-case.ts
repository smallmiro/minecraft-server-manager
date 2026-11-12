import type { ServerSpecErrorCode, WorldAssignmentErrorCode } from '@minecraft-docker/shared';
import { serverSpecFailure } from './server-spec.js';

/**
 * HTTP status and body for a failed world operation (#670): invalid_world ->
 * 400, server_not_found or a missing world -> 404, every other assignment
 * refusal (conflict, undetermined, server_running, ...) -> 409. A refused
 * ServerSpec write (#675) maps as serverSpecFailure.
 */
export function worldFailure(
  result: { error?: string; errorCode?: WorldAssignmentErrorCode; specErrorCode?: ServerSpecErrorCode },
  fallback: string
): { status: 400 | 404 | 409; body: { error: string; message: string } } {
  const message = result.error || fallback;
  if (result.specErrorCode) return serverSpecFailure({ code: result.specErrorCode, message });
  if (result.errorCode === 'invalid_world') return { status: 400, body: { error: 'BadRequest', message } };
  if (result.errorCode === 'server_not_found' || (!result.errorCode && / not found$/.test(message))) {
    return { status: 404, body: { error: 'NotFound', message } };
  }
  if (result.errorCode) return { status: 409, body: { error: 'Conflict', message } };
  return { status: 400, body: { error: 'BadRequest', message } };
}
