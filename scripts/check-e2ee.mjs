// Compile/link the isolated lab without running it or making network requests.
// The published-app check separately forbids imports outside dist/.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { SourceTextModule } from 'node:vm';
import { spawnSync } from 'node:child_process';

const published = new URL('../dist/', import.meta.url);
const experiment = new URL('../experiments/e2ee/', import.meta.url);
function files(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    return entry.isDirectory() ? files(path) : [path];
  });
}
function dependency(specifier, owner) {
  if (!specifier.startsWith('.')) throw new Error(`Non-local lab dependency: ${specifier}`);
  const path = new URL(specifier, owner);
  path.search = '';
  path.hash = '';
  if (
    (!path.href.startsWith(published.href) && !path.href.startsWith(experiment.href)) ||
    !existsSync(path)
  ) {
    throw new Error(`Missing or out-of-scope lab dependency: ${path.href}`);
  }
  return path;
}
const modules = new Map();
function load(path) {
  if (!modules.has(path.href)) {
    modules.set(
      path.href,
      new SourceTextModule(readFileSync(path, 'utf8'), { identifier: path.href }),
    );
  }
  return modules.get(path.href);
}
for (const path of files(experiment)) {
  if (path.pathname.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', path.pathname], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
    // Tests import Node/test-only packages. Browser lab modules must link only
    // through local files and the actual published model/validation interfaces.
    if (!path.pathname.includes('/tests/')) load(path);
  } else if (path.pathname.endsWith('.html')) {
    for (const match of readFileSync(path, 'utf8').matchAll(/(?:src|href)=["'](\.[^"']+)["']/g)) {
      dependency(match[1], path);
    }
  }
}
for (const module of modules.values()) {
  if (module.status === 'unlinked') {
    await module.link((specifier, owner) => load(dependency(specifier, owner.identifier)));
  }
}
console.log(
  `Isolated encryption lab passed syntax, dependency, and export checks (${modules.size} modules).`,
);
