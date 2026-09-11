/*
 * Stamps the built service worker with a unique build id.
 *
 * A browser decides whether a service worker is new by comparing bytes. The
 * worker used to carry a version constant bumped by hand, so it was byte
 * identical from one deploy to the next: no update was detected, no reload was
 * offered, and an installed app could stay on an old build forever while the
 * server had a new one. Stamping it removes the human from that loop.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readdir } from 'node:fs/promises';

const assets = await readdir('dist/assets').catch(() => []);
// Hash the asset filenames: they are content-hashed by Vite, so this changes
// exactly when the shipped code changes, and not on a no-op rebuild.
const buildId = createHash('sha256')
  .update(assets.sort().join('|'))
  .digest('hex')
  .slice(0, 12);

const path = 'dist/sw.js';
const source = await readFile(path, 'utf8');
if (!source.includes('__BUILD_ID__')) {
  throw new Error('dist/sw.js has no __BUILD_ID__ placeholder to stamp');
}
await writeFile(path, source.replaceAll('__BUILD_ID__', buildId));
console.log(`sw.js stamped with build ${buildId}`);
