import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { versionedAssets } from '../../scripts/build-assets.mjs';

test('changing a leaf personality invalidates every parent module URL and rebuilding is stable', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dayline-assets-'));
  const root = pathToFileURL(directory + '/');
  const write = (path, content) => writeFileSync(new URL(path, root), content);
  try {
    mkdirSync(new URL('js/personalities/', root), { recursive: true });
    write(
      'index.html',
      '<html><head><script src="./js/personalities/appearance.js?v=old"></script><link rel="stylesheet" href="./styles.css?v=old"></head><body><script type="module" src="./js/app.js?v=old"></script></body></html>',
    );
    write(
      'google-connect.html',
      '<html><head><link rel="stylesheet" href="./styles.css"></head><body><script type="module" src="./js/app.js"></script></body></html>',
    );
    write('styles.css', 'body { color: black; }');
    write('js/app.js', "import './personalities/index.js?v=stale';");
    write('js/personalities/index.js', "export { default } from './mode.js';");
    write('js/personalities/mode.js', "export default { name: 'First' };");
    write('js/personalities/appearance.js', "document.documentElement.dataset.layout = 'zen';\n");
    const first = await versionedAssets(root);
    for (const [path, source] of first.outputs) writeFileSync(path, source);
    const again = await versionedAssets(root);
    assert.equal(again.version, first.version);
    for (const [path, source] of again.outputs) assert.equal(readFileSync(path, 'utf8'), source);
    write('js/personalities/mode.js', "export default { name: 'Updated' };");
    const next = await versionedAssets(root);
    assert.notEqual(next.version, first.version);
    const outputs = new Map(
      next.outputs.map(([path, source]) => [path.href.slice(root.href.length), source]),
    );
    for (const path of [
      'js/app.js',
      'js/personalities/index.js',
      'index.html',
      'google-connect.html',
    ]) {
      assert.ok(outputs.get(path).includes('?v=' + next.version), path);
      assert.ok(!outputs.get(path).includes('?v=' + first.version), path);
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
