#!/usr/bin/env node
// Refresh image-pins.json (#663): node scripts/pin-images.mjs <version>
// Re-reads digest and linux platforms of every listed image, rewrites the file,
// prints a markdown table for the release notes. Exit 1 when an image lacks
// linux/arm64 or linux/amd64 (hold the release). Reads the registry only.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'image-pins.json');
const version = process.argv[2];
if (!version) {
  console.error('usage: node scripts/pin-images.mjs <version>');
  process.exit(2);
}

const pins = JSON.parse(readFileSync(file, 'utf-8'));
const missing = [];

for (const entry of pins.images) {
  const manifest = JSON.parse(
    execFileSync('docker', ['buildx', 'imagetools', 'inspect', entry.image, '--format', '{{json .Manifest}}'], {
      encoding: 'utf-8',
    })
  );
  const found = (manifest.manifests ?? [])
    .map((m) => m.platform)
    .filter((p) => p && p.os === 'linux' && p.architecture !== 'unknown');
  entry.digest = manifest.digest;
  entry.platforms = [
    ...new Set(found.map((p) => `linux/${p.architecture}${p.variant ? `/${p.variant}` : ''}`)),
  ].sort();
  for (const arch of ['amd64', 'arm64']) {
    if (!found.some((p) => p.architecture === arch)) missing.push(`${entry.image}: no linux/${arch}`);
  }
}

pins.release = version;
pins.checkedAt = new Date().toISOString().slice(0, 10);
writeFileSync(file, `${JSON.stringify(pins, null, 2)}\n`);

console.log('| Image | Digest | Platforms |\n| --- | --- | --- |');
for (const { image, digest, platforms } of pins.images) {
  console.log(`| \`${image}\` | \`${digest}\` | ${platforms.join(', ')} |`);
}

if (missing.length > 0) {
  console.error(`\nMissing platforms (hold the release):\n${missing.map((m) => `  ${m}`).join('\n')}`);
  process.exit(1);
}
