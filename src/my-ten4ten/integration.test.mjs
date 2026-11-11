import { test } from 'vitest';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createServer, loadEnv } from 'vite';
import { buildAll, PATHS } from '../../demo/my-ten4ten/build_views.mjs';
import { isAllowedAsset, listAllDataFiles, listDemoAssets, myTen4tenDemo } from '../../demo/my-ten4ten/vite-plugin.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const read = (...p) => readFile(path.join(ROOT, ...p), 'utf8');

async function moduleSources() {
  const out = [];
  for (const name of await readdir(HERE)) {
    if (/\.(js|css|ts)$/.test(name)) out.push([name, await readFile(path.join(HERE, name), 'utf8')]);
  }
  return out;
}

// ---- Atlas isolation: a default build must not carry any of the demo ----

test('the default Atlas build and dev server do not include the demo', async () => {
  const config = await read('vite.config.ts');
  assert.match(config, /const demo = mode === "demo"/);
  assert.match(config, /plugins: demo \? \[myTen4tenDemo\(\)\] : \[\]/);
  assert.match(config, /outDir: demo \? "dist-demo" : "dist"/);
  assert.equal(existsSync(path.join(ROOT, 'public', 'my-ten4ten')), false, 'demo data must never sit in public/');
});

test('the only change to the Atlas entry module is one mode-gated import', async () => {
  const main = await read('src', 'main.ts');
  const lines = main.split(/\r?\n/).filter((l) => l.includes('my-ten4ten') && !l.trim().startsWith('//'));
  assert.deepEqual(lines, ['if (import.meta.env.MODE === "demo") void import("./my-ten4ten/entry-link");']);
});

test('the demo plugin ships only the data folder, never the research store', async () => {
  const assets = await listDemoAssets();
  assert.ok(assets.includes('demo_accounts.json'));
  assert.ok(assets.includes('measure_catalogue.json'));
  assert.ok(assets.some((a) => a.startsWith('participant_views/')));
  for (const a of assets) assert.equal(/research|registry|source_records/.test(a), false, a);
});

test('the dev middleware cannot be walked out of the data folder', async () => {
  const plugin = myTen4tenDemo();
  plugin.configResolved({ base: '/' });
  let handler;
  plugin.configureServer({ middlewares: { use: (fn) => { handler = fn; } } });
  async function call(url) {
    const res = { statusCode: 200, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = String(b ?? ''); } };
    let passedOn = false;
    await handler({ url }, res, () => { passedOn = true; });
    return { status: res.statusCode, body: res.body, passedOn };
  }
  assert.equal((await call('/my-ten4ten/data/participant_views/T4T-5RVC-3XTE.json')).status, 200);
  for (const u of [
    '/my-ten4ten/data/../research/registry.json',
    '/my-ten4ten/data/%2e%2e/research/registry.json',
    '/my-ten4ten/data/..%2fresearch%2fsource_records.json',
  ]) {
    const r = await call(u);
    assert.equal(r.status, 404, u);
    assert.equal(r.body.includes('W2-0204'), false, u);
  }
  assert.equal((await call('/index.html')).passedOn, true, 'other requests pass through to Vite');
});

// ---- The page: simple, safe, and free of technical or ethics detail ----

test('the entry page is minimal and carries the prototype notice', async () => {
  const html = await read('my-ten4ten', 'index.html');
  assert.match(html, /invented data/i);
  assert.match(html, /not medical advice/i);
  assert.equal(/redcap|protocol|bellberry|amendment|mycap|ethics/i.test(html), false, 'detail belongs in docs');
  const sections = (html.match(/<(section|article)\b/g) || []).length;
  assert.equal(sections, 0, 'no intro cards in the page shell');
});

test('the page sets a Content-Security-Policy with no inline scripts', async () => {
  const html = await read('my-ten4ten', 'index.html');
  const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/)[1];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.equal(/script-src[^;]*unsafe-inline/.test(csp), false);
  assert.match(csp, /connect-src 'self'/);
});

test('no external scripts, styles, images, fonts or fetches', async () => {
  const html = await read('my-ten4ten', 'index.html');
  assert.equal(/<(script|link|img|iframe)\b[^>]*\b(src|href)=["']https?:/i.test(html), false);
  for (const [name, text] of await moduleSources()) {
    if (name.endsWith('entry-link.ts') || name.endsWith('.test.mjs')) continue;
    assert.equal(/@import\s+url\(\s*['"]?https?:|url\(\s*['"]?https?:/.test(text), false, `${name} css url`);
    assert.equal(/fetch\(\s*['"`]https?:/.test(text), false, `${name} fetch`);
    assert.equal(/from\s+['"]https?:/.test(text), false, `${name} import`);
  }
});

test('identity never comes from the URL, and data is never written as HTML', async () => {
  for (const [name, text] of await moduleSources()) {
    if (name.endsWith('.test.mjs')) continue;
    assert.equal(/location\.search|URLSearchParams|location\.hash/.test(text), false, `${name} reads the URL`);
    assert.equal(/innerHTML\s*=|insertAdjacentHTML/.test(text), false, `${name} writes HTML`);
  }
});

test('the results area is not an aria-live region, and the dashboard checks the session', async () => {
  const html = await read('my-ten4ten', 'index.html');
  assert.equal(/id="mt-root"[^>]*aria-live/.test(html), false);
  const app = await read('src', 'my-ten4ten', 'app.js');
  assert.match(app, /getSession\(\)/);
  assert.match(app, /sanitiseView\(/);
  assert.match(app, /view\.ttid !== session\.ttid/);
});

test('the Atlas assistant is not wired into the demo', async () => {
  for (const [name, text] of await moduleSources()) {
    if (name.endsWith('.test.mjs')) continue;
    assert.equal(/assistant|VITE_ASSISTANT_URL|\/chat/i.test(text), false, `${name} references the assistant`);
  }
});

// ---- Real Vite runs: dev server exposure and actual build output ----

const CONFIG_FILE = path.join(ROOT, 'vite.config.ts');

async function buildOutput(mode) {
  const result = await build({ root: ROOT, configFile: CONFIG_FILE, mode, logLevel: 'silent', build: { write: false } });
  const bundles = Array.isArray(result) ? result : [result];
  return bundles.flatMap((b) => b.output);
}

test('the real Vite dev server never serves the research store (default and demo modes)', async () => {
  for (const mode of ['development', 'demo']) {
    const server = await createServer({ root: ROOT, configFile: CONFIG_FILE, mode, logLevel: 'silent', server: { port: 0, host: '127.0.0.1' } });
    try {
      await server.listen();
      const { port } = server.httpServer.address();
      for (const p of [
        '/demo/my-ten4ten/research/registry.json',
        '/demo/my-ten4ten/research/source_records.json',
        '/demo/my-ten4ten/research/../research/registry.json',
        '/@fs/' + path.join(ROOT, 'demo', 'my-ten4ten', 'research', 'registry.json').split(path.sep).join('/'),
      ]) {
        const res = await fetch(`http://127.0.0.1:${port}${p}`);
        const body = await res.text();
        assert.equal(body.includes('W2-0204'), false, `${mode} ${p} leaked research content`);
        assert.ok(res.status === 403 || res.status === 404, `${mode} ${p} returned ${res.status}`);
      }
    } finally {
      await server.close();
    }
  }
}, 60000);

test('the real default build contains no demo page, data or modules', async () => {
  const output = await buildOutput('production');
  const names = output.map((o) => o.fileName);
  assert.equal(names.some((n) => /my-ten4ten|myTen4ten|entry-link/i.test(n)), false, 'demo files in default build');
  const code = output.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n');
  assert.equal(/my-ten4ten|T4T-/.test(code), false, 'demo code in default bundle');
}, 120000);

test('the real demo build ships the page and only allowlisted data, never the research store', async () => {
  const output = await buildOutput('demo');
  const names = output.map((o) => o.fileName);
  assert.ok(names.includes('my-ten4ten/index.html'));
  assert.ok(names.includes('my-ten4ten/data/demo_accounts.json'));
  const data = names.filter((n) => n.startsWith('my-ten4ten/data/')).map((n) => n.slice('my-ten4ten/data/'.length));
  assert.ok(data.length > 0);
  for (const rel of data) assert.equal(isAllowedAsset(rel), true, rel);
  assert.equal(names.some((n) => /research|registry|source_records/.test(n)), false);
  for (const o of output) {
    const text = o.type === 'chunk' ? o.code : String(o.source);
    assert.equal(text.includes('W2-0204') || text.includes('TEST-0001'), false, `hidden record id in ${o.fileName}`);
  }
}, 120000);

test('the demo build carries the same production env values as the default build', async () => {
  const assistantUrl = loadEnv('production', ROOT, 'VITE_').VITE_ASSISTANT_URL;
  if (!assistantUrl) return; // nothing to carry
  const demo = await buildOutput('demo');
  const code = demo.filter((o) => o.type === 'chunk').map((o) => o.code).join('\n');
  assert.equal(code.includes(assistantUrl), true, 'assistant URL missing from the demo build');
}, 120000);

// ---- Shipped data must be exactly what the release rules produce ----

test('shipped demo data equals the build script output, with no stray files', async () => {
  const [registry, records, catalogue] = await Promise.all(
    [PATHS.registry, PATHS.records, PATHS.catalogue].map(async (f) => JSON.parse(await readFile(f, 'utf8'))),
  );
  const built = buildAll({ registry, records, catalogue });
  assert.deepEqual(built.problems, []);
  const dataDir = path.join(ROOT, 'demo', 'my-ten4ten', 'data');
  const all = await listAllDataFiles();
  const expected = [
    'demo_accounts.json',
    'measure_catalogue.json',
    ...Object.keys(built.views).map((t) => `participant_views/${t}.json`),
  ].sort();
  assert.deepEqual(all, expected, 'data folder holds exactly the generated files');
  assert.deepEqual(await listDemoAssets(), expected);
  for (const [ttid, view] of Object.entries(built.views)) {
    const onDisk = JSON.parse(await readFile(path.join(dataDir, 'participant_views', `${ttid}.json`), 'utf8'));
    assert.deepEqual(onDisk, JSON.parse(JSON.stringify(view)), `stale or edited view for ${ttid}`);
  }
  assert.deepEqual(JSON.parse(await readFile(path.join(dataDir, 'demo_accounts.json'), 'utf8')), built.accounts);
});

test('the demo page is noindex, and the Atlas pages are not', async () => {
  const demo = await read('my-ten4ten', 'index.html');
  assert.match(demo, /<meta name="robots" content="noindex, nofollow"/);
  const atlas = await read('index.html');
  assert.equal(/noindex/i.test(atlas), false, 'the Atlas page must stay indexable');
  assert.equal(existsSync(path.join(ROOT, 'public', 'robots.txt')), false, 'no robots.txt: it would hide the noindex tag from crawlers');
  const real = await buildOutput('demo');
  const demoHtml = real.find((o) => o.fileName === 'index.html');
  assert.equal(/noindex/i.test(String(demoHtml.source)), false, 'built Atlas page must not be noindex');
}, 120000);

test('the entry link is a discreet text link under the header subtitle, not on the map layer card', async () => {
  const link = await read('src', 'my-ten4ten', 'entry-link.ts');
  assert.match(link, /getElementById\("brand"\)/);
  assert.equal(/layer-control|topbar-actions/.test(link), false, 'must not touch the layer card or the search and actions row');
  assert.match(link, /link\.rel = "nofollow"/);
  const css = await read('src', 'my-ten4ten', 'entry-link.css');
  assert.equal(/background:\s*var\(--color-accent\)/.test(css), false, 'no button styling');
  assert.match(css, /color: var\(--color-muted\)/);
  assert.match(css, /font-size: 0\.75rem/);
});

test('the deploy workflow tests, then publishes the demo build', async () => {
  const wf = (await read('.github', 'workflows', 'deploy.yml')).replace(/\r\n/g, '\n');
  assert.match(wf, /- run: npm test\n/);
  assert.match(wf, /- run: npm run build:demo\n/);
  assert.match(wf, /path: dist-demo\n/);
  assert.equal(/path: dist\n/.test(wf), false, 'must not publish the default dist');
  assert.ok(wf.indexOf('npm test') < wf.indexOf('npm run build:demo'), 'tests run before the build');
  assert.match(wf, /branches: \[main\]/);
});

test('the page refuses to run inside a frame', async () => {
  const app = await read('src', 'my-ten4ten', 'app.js');
  assert.match(app, /window\.top !== window\.self/);
});
