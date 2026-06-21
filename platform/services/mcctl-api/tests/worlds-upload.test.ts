/**
 * Tests for POST /api/worlds/upload (multipart zip import)
 *
 * Coverage:
 *  - Schema validation: bad world name pattern → 400
 *  - No file part → 400
 *  - Non-zip filename → 400
 *  - Duplicate world name → 409
 *  - Happy-path: valid zip with level.dat → 201
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import JSZip from 'jszip';

const TEST_PLATFORM_PATH = join(import.meta.dirname, '.tmp-worlds-upload-test');

// Set env BEFORE imports so config + Paths resolve to the fixture.
process.env.MCCTL_ROOT = TEST_PLATFORM_PATH;
process.env.PLATFORM_PATH = TEST_PLATFORM_PATH;
process.env.AUTH_MODE = 'disabled';
process.env.NODE_ENV = 'test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal multipart/form-data body for Fastify inject.
 * Supports file parts only (no field parts needed for this route).
 */
function buildMultipartBody(
  boundary: string,
  files: Array<{ fieldName: string; filename: string; content: Buffer; contentType?: string }>,
): Buffer {
  const parts: Buffer[] = [];

  for (const file of files) {
    const ct = file.contentType ?? 'application/octet-stream';
    parts.push(
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"\r\n` +
          `Content-Type: ${ct}\r\n` +
          `\r\n`,
      ),
    );
    parts.push(file.content);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

/**
 * Build a multipart body with no file parts (empty body, just closing boundary).
 */
function buildEmptyMultipartBody(boundary: string): Buffer {
  return Buffer.from(`--${boundary}--\r\n`);
}

/**
 * Create a valid zip buffer containing a level.dat file using JSZip.
 * The zip structure is: world/level.dat
 */
async function buildValidWorldZip(): Promise<Buffer> {
  const zip = new JSZip();
  // Minimal level.dat content (just needs to exist as a file)
  zip.folder('world')!.file('level.dat', Buffer.from('NBTDATA'));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('POST /api/worlds/upload', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
    mkdirSync(join(TEST_PLATFORM_PATH, 'backups', 'meta'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds'), { recursive: true });
    mkdirSync(join(TEST_PLATFORM_PATH, 'servers'), { recursive: true });

    const { config } = await import('../src/config/index.js');
    (config as Record<string, unknown>).platformPath = TEST_PLATFORM_PATH;
    (config as Record<string, unknown>).mcctlRoot = TEST_PLATFORM_PATH;

    const { buildApp } = await import('../src/app.js');
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    if (existsSync(TEST_PLATFORM_PATH)) {
      rmSync(TEST_PLATFORM_PATH, { recursive: true, force: true });
    }
  });

  // -------------------------------------------------------------------------
  // Schema validation (caught by Fastify before handler runs)
  // -------------------------------------------------------------------------

  it('returns 400 when world name contains invalid characters', async () => {
    const boundary = 'boundary123';
    const body = buildEmptyMultipartBody(boundary);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload?name=Invalid%20Name!',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 when name query parameter is missing', async () => {
    const boundary = 'boundary123';
    const body = buildEmptyMultipartBody(boundary);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
  });

  // -------------------------------------------------------------------------
  // Handler-level validations
  // -------------------------------------------------------------------------

  it('returns 400 when no file part is included in the multipart body', async () => {
    const boundary = 'boundarynoop';
    const body = buildEmptyMultipartBody(boundary);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload?name=my-world',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    const json = response.json<{ error: string; message: string }>();
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain('zip file');
  });

  it('returns 400 when the uploaded file is not a .zip', async () => {
    const boundary = 'boundarytxt';
    const body = buildMultipartBody(boundary, [
      {
        fieldName: 'file',
        filename: 'world.tar.gz',
        content: Buffer.from('not a zip'),
        contentType: 'application/gzip',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload?name=my-world',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    const json = response.json<{ error: string; message: string }>();
    expect(json.error).toBe('BadRequest');
    expect(json.message).toContain('.zip');
  });

  it('returns 400 when a .txt file is uploaded instead of .zip', async () => {
    const boundary = 'boundarytxt2';
    const body = buildMultipartBody(boundary, [
      {
        fieldName: 'file',
        filename: 'README.txt',
        content: Buffer.from('hello world'),
        contentType: 'text/plain',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload?name=my-world',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(400);
    const json = response.json<{ error: string; message: string }>();
    expect(json.error).toBe('BadRequest');
  });

  it('returns 409 when a world with the same name already exists', async () => {
    // Pre-create the world directory to simulate an existing world
    mkdirSync(join(TEST_PLATFORM_PATH, 'worlds', 'existing-world'), { recursive: true });
    // Create a minimal level.dat so it is recognized as a valid world
    writeFileSync(join(TEST_PLATFORM_PATH, 'worlds', 'existing-world', 'level.dat'), 'NBT');

    const boundary = 'boundarydup';
    const body = buildEmptyMultipartBody(boundary);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload?name=existing-world',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(409);
    const json = response.json<{ error: string; message: string }>();
    expect(json.error).toBe('Conflict');
    expect(json.message).toContain('already exists');
  });

  // -------------------------------------------------------------------------
  // Happy path: valid zip → 201
  // -------------------------------------------------------------------------

  it('returns 201 and worldName when a valid world zip is uploaded', async () => {
    const zipBuffer = await buildValidWorldZip();
    const boundary = 'boundaryhappy';
    const body = buildMultipartBody(boundary, [
      {
        fieldName: 'file',
        filename: 'my-world.zip',
        content: zipBuffer,
        contentType: 'application/zip',
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/worlds/upload?name=my-world',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: body,
    });

    expect(response.statusCode).toBe(201);
    const json = response.json<{ success: boolean; worldName: string }>();
    expect(json.success).toBe(true);
    expect(json.worldName).toBe('my-world');

    // Verify the world was created on disk
    expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', 'my-world'))).toBe(true);
    expect(existsSync(join(TEST_PLATFORM_PATH, 'worlds', 'my-world', 'level.dat'))).toBe(true);
  });
});
