/**
 * IServerSpecRepository and ServerSpec were public (reserved) exports before
 * #675. v2.x keeps their contract (#715, #736): ServerSpec stays { name } and
 * list/get/save/delete keep their signatures; #675 only adds load/write.
 */
import { describe, it, expect } from 'vitest';
import { rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

describe('IServerSpecRepository v2 contract (#675)', () => {
  it('v2 consumer code still type-checks against the package root', () => {
    const testsDir = dirname(fileURLToPath(import.meta.url));
    const file = join(testsDir, `.server-spec-compat-${process.pid}.ts`);
    writeFileSync(
      file,
      [
        "import type { IServerSpecRepository, ServerSpec } from '../src/index.js';",
        "export const s: ServerSpec = { name: 'a' };",
        'export async function use(repo: IServerSpecRepository): Promise<void> {',
        '  const all: ServerSpec[] = await repo.list();',
        "  const one: ServerSpec | null = await repo.get('a');",
        '  await repo.save(s);',
        "  await repo.delete('a');",
        '  void all; void one;',
        '}',
      ].join('\n')
    );
    try {
      const { options } = ts.parseJsonConfigFileContent(
        { extends: '../tsconfig.json', compilerOptions: { noEmit: true, rootDir: '..' } },
        ts.sys,
        testsDir
      );
      const program = ts.createProgram([file], options);
      const errors = ts
        .getPreEmitDiagnostics(program)
        .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
      expect(errors).toEqual([]);
    } finally {
      rmSync(file, { force: true });
    }
  });
});
