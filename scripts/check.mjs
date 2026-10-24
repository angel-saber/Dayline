import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { SourceTextModule } from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = new URL('../dist/', import.meta.url);
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? files(path) : [path];
  });
}
const modules = new Map();
function dependency(specifier, owner) {
  if (!specifier.startsWith('.')) throw new Error(`Use a local module: ${specifier} in ${owner}`);
  const path = new URL(specifier, owner);
  path.search = ''; path.hash = '';
  if (!path.href.startsWith(root.href) || !existsSync(path)) throw new Error(`Missing published dependency: ${path.href}`);
  return path;
}
function load(path) {
  if (!modules.has(path.href)) modules.set(path.href, new SourceTextModule(readFileSync(path, 'utf8'), { identifier: path.href }));
  return modules.get(path.href);
}
const published = files(root);
for (const path of published) {
  if (path.pathname.endsWith('.js') && !path.pathname.includes('/vendor/')) {
    const result = spawnSync(process.execPath, ['--check', path.pathname], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
    const source = readFileSync(path, 'utf8');
    // Link without running planner code; also check lazy library import paths.
    for (const match of source.matchAll(/import\s*\(\s*['"](\.[^'"]+)['"]/g)) dependency(match[1], path);
    load(path);
  } else if (path.pathname.endsWith('.css')) {
    for (const match of readFileSync(path, 'utf8').matchAll(/@import\s+(?:url\()?['"](\.[^'"]+)['"]/g)) dependency(match[1], path);
  } else if (path.pathname.endsWith('.html')) {
    for (const match of readFileSync(path, 'utf8').matchAll(/(?:src|href)=["'](\.[^"']+)["']/g)) dependency(match[1], path);
  }
}
for (const module of modules.values()) {
  if (module.status === 'unlinked') await module.link((specifier, owner) => load(dependency(specifier, owner.identifier)));
}
console.log(`Published modules passed syntax, dependency-path, and export checks (${modules.size} modules).`);
