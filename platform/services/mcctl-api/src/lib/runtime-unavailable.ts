import type { FastifyReply } from 'fastify';
import { RuntimeUnavailableError } from '@minecraft-docker/shared';

/**
 * Answers 503 when the container runtime could not be asked (#669, a timeout
 * included), so "cannot tell" never reads as "absent"; undefined for any other
 * error. Usage: `return sendRuntimeUnavailable(reply, error) ?? reply.code(500)...`
 */
export function sendRuntimeUnavailable(reply: FastifyReply, error: unknown): FastifyReply | undefined {
  if (!(error instanceof RuntimeUnavailableError)) return undefined;
  return reply
    .code(503)
    .header('Retry-After', '5')
    .send({ error: 'ServiceUnavailable', message: 'The container runtime is not answering; try again shortly' });
}
