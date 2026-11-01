import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, mkdir, mkdtemp, rm, rename, lstat, realpath } from 'node:fs/promises';
import { resolve, relative, dirname, join, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { marked } from 'marked';
import { DOMParser } from 'linkedom';

const exec = promisify(execFile);
const sourceDir = 'docs/diagrams';
const outputDir = 'public/diagrams';
const manifestPath = `${outputDir}/manifest.json`;
const inputs = ['docs/diagrams/mermaid-config.json', 'scripts/diagrams/workflow.mjs', 'package.json', 'pnpm-lock.yaml'];
const hash = data => createHash('sha256').update(data).digest('hex');
async function exists(path) { try { await lstat(path); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } }
async function files(root, dir, suffix) {
  const result = [];
  await safePath(root, dir);
  if (!await exists(join(root, dir))) return result;
  for (const item of await readdir(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${item.name}`;
    if (item.isSymbolicLink()) throw new Error(`Symlink is not supported: ${path}`);
    if (item.isDirectory()) result.push(...await files(root, path, suffix));
    else if (suffix.test(item.name)) result.push(path);
  }
  return result.sort();
}
async function safePath(root, path) {
  // Check every existing ancestor, including directory symlinks.
  const absolute = resolve(root, path);
  if (!absolute.startsWith(resolve(root) + sep)) throw new Error(`Select an existing .mmd under docs/diagrams; path escapes repository: ${path}`);
  let current = absolute;
  while (current !== resolve(root)) {
    if (await exists(current) && (await lstat(current)).isSymbolicLink()) throw new Error(`Symlink is not supported: ${path}`);
    current = dirname(current);
  }
  return absolute;
}
async function atomicWrite(root, file, data) {
  await safePath(root, file);
  await mkdir(join(root, dirname(file)), { recursive: true });
  const stage = await mkdtemp(join(root, dirname(file), '.diagram-'));
  const pending = join(stage, 'output');
  try { await writeFile(pending, data); await rename(pending, join(root, file)); }
  finally { await rm(stage, { recursive: true, force: true }); }
}
async function fingerprint(root) {
  return hash(Buffer.concat(await Promise.all(inputs.map(async file => Buffer.concat([Buffer.from(`${file}\0`), await readFile(join(root, file))])))));
}
async function manifest(root) {
  if (!await exists(join(root, manifestPath))) return { version: 1, diagrams: {} };
  const value = JSON.parse(await readFile(join(root, manifestPath), 'utf8'));
  if (value.version !== 1 || !value.diagrams || typeof value.diagrams !== 'object') throw new Error('Invalid diagram manifest');
  return value;
}
function svgValid(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.documentElement?.localName !== 'svg' || !doc.documentElement.getAttribute('viewBox') || doc.querySelector('.error-icon, .error-text')) throw new Error('Renderer did not produce a valid diagram SVG');
}
async function renderCli(input, output, root) {
  // Only conversion invokes mmdc; verification never launches Chromium.
  const bin = join(root, 'node_modules/.bin/mmdc');
  await exec(bin, ['-i', input, '-o', output, '-c', join(root, inputs[0]), '-b', 'white', '--svgId', 'diagram'], { cwd: root, timeout: 120_000, maxBuffer: 4 * 1024 * 1024 });
}
export async function render(root, selection, renderer = renderCli) {
  const all = await files(root, sourceDir, /\.mmd$/);
  let selected = all;
  if (selection !== undefined) {
    const path = relative(root, resolve(root, selection)).split(sep).join('/');
    await safePath(root, path);
    if (!all.includes(path)) throw new Error(`Select an existing .mmd under ${sourceDir}: ${selection}`);
    selected = [path];
  }
  await safePath(root, manifestPath);
  const previous = await manifest(root);
  if (!selected.length) {
    if (Object.keys(previous.diagrams).length) await atomicWrite(root, manifestPath, JSON.stringify({ version: 1, diagrams: {} }, null, 2) + '\n');
    return;
  }
  const provenance = await fingerprint(root);
  const staged = [];
  const temp = await mkdtemp(join(tmpdir(), 'gcake-mermaid-'));
  try {
    for (const [index, source] of selected.entries()) {
      const output = source.replace(/^docs\/diagrams\//, `${outputDir}/`).replace(/\.mmd$/, '.svg');
      await safePath(root, output);
      const input = await readFile(join(root, source));
      const snapshot = join(temp, `${index}.mmd`);
      const target = join(temp, `${index}.svg`);
      await writeFile(snapshot, input);
      let svg;
      try { await renderer(snapshot, target, root); svg = await readFile(target, 'utf8'); svgValid(svg); }
      catch (error) { throw new Error(`${source}: ${error.message}`, { cause: error }); }
      staged.push({ output, svg, source, receipt: { source: hash(input), svg: hash(svg), inputs: provenance } });
    }
    // Nothing is replaced until all selected sources have rendered successfully.
    for (const item of staged) {
      await atomicWrite(root, item.output, item.svg);
      previous.diagrams[item.source] = item.receipt;
    }
    const sorted = Object.fromEntries(Object.entries(previous.diagrams).filter(([source]) => all.includes(source)).sort(([a], [b]) => a.localeCompare(b, 'en')));
    await atomicWrite(root, manifestPath, JSON.stringify({ version: 1, diagrams: sorted }, null, 2) + '\n');
  } finally { await rm(temp, { recursive: true, force: true }); }
}
function diagramTarget(url, base) {
  const clean = decodeURIComponent(url.split(/[?#]/)[0]);
  const prefix = `${base.replace(/\/$/, '')}/diagrams/`;
  if (clean.startsWith(prefix)) return clean.slice(prefix.length);
  if (clean.startsWith('/diagrams/') || /^(?:\.\.?\/)*diagrams\//.test(clean)) throw new Error(`Diagram URL must start with ${prefix}: ${url}`);
  return null;
}
async function articleReferences(root, outputs, base) {
  for (const file of await files(root, 'src/content', /\.mdx?$/)) {
    const body = await readFile(join(root, file), 'utf8');
    const validate = (url, alt) => {
      const target = diagramTarget(url, base);
      if (target !== null && (!alt.trim() || !outputs.has(`${outputDir}/${target}`))) throw new Error(`Invalid diagram image (missing file or alt): ${url}`);
    };
    try {
      marked.walkTokens(marked.lexer(body), token => {
        if (token.type === 'code' && token.lang?.split(/\s/)[0].toLowerCase() === 'mermaid') throw new Error('Use a generated SVG instead of a Mermaid fence');
        if (token.type === 'image') validate(token.href, token.text);
        if (token.type === 'html') {
          const doc = new DOMParser().parseFromString(`<html><body>${token.text}</body></html>`, 'text/html');
          for (const img of doc.querySelectorAll('img')) validate(img.getAttribute('src') ?? '', img.getAttribute('alt') ?? '');
        }
      });
    } catch (error) { throw new Error(`${file}: ${error.message}`, { cause: error }); }
  }
}
export async function check(root, built = false, base = '/gcake-dev') {
  const sources = await files(root, sourceDir, /\.mmd$/);
  const outputs = await files(root, outputDir, /\.svg$/);
  const receipts = await manifest(root);
  const provenance = await fingerprint(root);
  const expected = sources.map(source => source.replace(/^docs\/diagrams\//, `${outputDir}/`).replace(/\.mmd$/, '.svg'));
  for (const file of outputs) if (!expected.includes(file)) throw new Error(`Orphan diagram output: ${file}; remove explicitly or restore its source`);
  for (const source of Object.keys(receipts.diagrams)) if (!sources.includes(source)) throw new Error(`Orphan manifest entry: ${source}; regenerate diagrams`);
  for (const [index, source] of sources.entries()) {
    const output = expected[index];
    const receipt = receipts.diagrams[source];
    if (!receipt || !await exists(join(root, output))) throw new Error(`Missing ${output} or provenance; regenerate with pnpm diagrams:render:all`);
    const svg = await readFile(join(root, output));
    if (receipt.source !== hash(await readFile(join(root, source))) || receipt.svg !== hash(svg) || receipt.inputs !== provenance) throw new Error(`Stale ${source} / ${output}; regenerate with pnpm diagrams:render:all`);
    svgValid(svg.toString());
    if (built) {
      const path = output.replace(/^public\//, 'dist/');
      if (!await exists(join(root, path)) || hash(await readFile(join(root, path))) !== receipt.svg) throw new Error(`Missing or changed built diagram: ${path}`);
    }
  }
  await articleReferences(root, new Set(outputs), base);
}
if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  const [command, selection, ...extra] = process.argv.slice(2);
  try {
    if (extra.length || !['render', 'check', 'check-built'].includes(command) || (command !== 'render' && selection)) throw new Error('Usage: workflow.mjs render [docs/diagrams/name.mmd] | check | check-built');
    if (command === 'render') await render(process.cwd(), selection);
    else await check(process.cwd(), command === 'check-built');
    console.log(`Diagrams ${command}: OK`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
