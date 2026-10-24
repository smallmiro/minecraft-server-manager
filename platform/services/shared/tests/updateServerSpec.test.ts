/** updateServerSpec (#675, ADR-0003 §6): load, mutate, write with the revision, one retry. */
import { describe, it, expect, vi } from 'vitest';
import { updateServerSpec } from '../src/application/use-cases/updateServerSpec.js';
import { ServerSpecError, type ServerSpecDocument } from '../src/domain/server-spec/ServerSpecDocument.js';
import type { IServerSpecRepository } from '../src/application/ports/index.js';

const doc = { name: 'alpha', memory: '4G' } as ServerSpecDocument;

function repo(writes: Array<Error | undefined>) {
  let revision = 0;
  return {
    load: vi.fn(async () => ({ document: { ...doc }, revision: `r${++revision}`, warnings: [] })),
    write: vi.fn(async () => {
      const outcome = writes.shift();
      if (outcome) throw outcome;
    }),
  };
}

describe('updateServerSpec', () => {
  it('writes the mutated copy with the loaded revision', async () => {
    const r = repo([undefined]);
    const written = await updateServerSpec(r as unknown as IServerSpecRepository, 'alpha', (d) => ({ ...d, memory: '6G' }), {
      force: true,
    });
    expect(written.memory).toBe('6G');
    expect(r.write).toHaveBeenCalledWith(expect.objectContaining({ memory: '6G' }), { force: true, expectedRevision: 'r1' });
  });

  it('retries once after a revision conflict with a fresh load', async () => {
    const r = repo([new ServerSpecError('conflict', 'changed', 'alpha'), undefined]);
    await updateServerSpec(r as unknown as IServerSpecRepository, 'alpha', (d) => d);
    expect(r.load).toHaveBeenCalledTimes(2);
    expect(r.write).toHaveBeenLastCalledWith(expect.anything(), { expectedRevision: 'r2' });
  });

  it('gives up after the second conflict and rethrows other errors at once', async () => {
    const conflict = () => new ServerSpecError('conflict', 'changed', 'alpha');
    await expect(updateServerSpec(repo([conflict(), conflict()]) as never, 'alpha', (d) => d)).rejects.toMatchObject({ code: 'conflict' });
    const other = repo([new ServerSpecError('compose_edited', 'edited', 'alpha')]);
    await expect(updateServerSpec(other as never, 'alpha', (d) => d)).rejects.toMatchObject({ code: 'compose_edited' });
    expect(other.load).toHaveBeenCalledTimes(1);
  });

  it('does not retry a conflict that left files it could not put back', async () => {
    const left = Object.assign(new ServerSpecError('conflict', 'lost entries', 'alpha'), {
      unrestoredFiles: ['servers/alpha/config.env'],
    });
    const r = repo([left, undefined]);
    await expect(updateServerSpec(r as never, 'alpha', (d) => d)).rejects.toBe(left);
    expect(r.write).toHaveBeenCalledTimes(1);
  });

  it("rejects 'not_found' for an unknown server", async () => {
    const r = { load: vi.fn(async () => null), write: vi.fn() };
    await expect(updateServerSpec(r as never, 'ghost', (d) => d)).rejects.toMatchObject({ code: 'not_found' });
  });
});
