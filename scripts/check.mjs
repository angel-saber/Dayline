import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

for (const file of readdirSync(new URL('../dist/js/', import.meta.url))) {
  if (!file.endsWith('.js')) continue;
  const path = new URL(`../dist/js/${file}`, import.meta.url);
  const result = spawnSync(process.execPath, ['--check', path.pathname], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('All application modules passed syntax checks.');
