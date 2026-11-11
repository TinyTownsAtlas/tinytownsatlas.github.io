// Vite plugin for the My TEN4TEN synthetic demo. Only active in `--mode demo`.
// It serves and emits ONLY an allowlist of files from demo/my-ten4ten/data: the public measure
// definitions, the demo accounts and per-person participant views. The research store in
// demo/my-ten4ten/research is never read here. Participant views are checked against the release
// rules by a test (src/my-ten4ten/integration.test.mjs), not by this plugin.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
const URL_PREFIX = 'my-ten4ten/data/';
const TTID_FILE = /^participant_views\/T4T-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}\.json$/;

export function isAllowedAsset(rel) {
  return rel === 'measure_catalogue.json' || rel === 'demo_accounts.json' || TTID_FILE.test(rel);
}

// Every file in the data folder (relative POSIX paths), allowed or not.
export async function listAllDataFiles(dir = DATA_DIR) {
  const out = [];
  async function walk(current, rel) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const next = path.join(current, entry.name);
      const relPath = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(next, relPath);
      else out.push(relPath);
    }
  }
  await walk(dir, '');
  return out.sort();
}

// The files a demo build ships: the allowlisted subset of the data folder.
export async function listDemoAssets(dir = DATA_DIR) {
  return (await listAllDataFiles(dir)).filter(isAllowedAsset);
}

export function myTen4tenDemo({ dir = DATA_DIR } = {}) {
  let base = '/';
  return {
    name: 'my-ten4ten-demo',
    configResolved(config) {
      base = config.base;
    },
    // Dev server: serve the allowlisted demo data files. (Preview serves the built dist-demo.)
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const prefix = `${base}${URL_PREFIX}`;
        try {
          const pathname = decodeURIComponent((req.url || '').split('?')[0]);
          if (!pathname.startsWith(prefix)) return next();
          const rel = pathname.slice(prefix.length);
          const full = path.resolve(dir, rel);
          if (!full.startsWith(path.resolve(dir) + path.sep) || !isAllowedAsset(rel)) {
            res.statusCode = 404;
            res.end('Not found');
            return;
          }
          const body = await readFile(full);
          res.setHeader('content-type', 'application/json; charset=utf-8');
          res.setHeader('cache-control', 'no-store');
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end('Not found');
        }
      });
    },
    // Build: emit the allowlisted demo data next to the page.
    async generateBundle() {
      for (const rel of await listDemoAssets(dir)) {
        this.emitFile({ type: 'asset', fileName: `${URL_PREFIX}${rel}`, source: await readFile(path.join(dir, rel)) });
      }
    },
  };
}
