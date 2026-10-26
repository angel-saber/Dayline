// One release key for the whole local module graph, including bare imports.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { format } from 'prettier';
const root = new URL('../dist/', import.meta.url);
const options = JSON.parse(readFileSync(new URL('../.prettierrc.json', import.meta.url)));
const token = '000000000000';
const refs = /(['"])(\.[^'"\s]*?\.(?:js|css))(?:\?v=[^'"\s]*)?\1/g;
function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((entry) => {
      const path = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
      return entry.isDirectory()
        ? entry.name === 'vendor'
          ? []
          : files(path)
        : path.pathname.endsWith('.js')
          ? [path]
          : [];
    });
}
export async function versionedAssets(assetRoot = root) {
  const root = assetRoot;
  const paths = [...files(new URL('js/', root)), new URL('index.html', root)];
  const normalized = [];
  for (const path of paths) {
    const source = readFileSync(path, 'utf8').replace(
      refs,
      (_match, quote, url) => `${quote}${url}?v=${token}${quote}`,
    );
    normalized.push([
      path,
      await format(source, {
        ...options,
        parser: path.pathname.endsWith('.html') ? 'html' : 'babel',
      }),
    ]);
  }
  const hash = createHash('sha256');
  for (const [path, source] of normalized)
    hash.update(path.href.slice(root.href.length) + '\0' + source + '\0');
  hash.update(readFileSync(new URL('styles.css', root)));
  const version = hash.digest('hex').slice(0, 12);
  const appearance = createHash('sha256')
    .update(readFileSync(new URL('js/personalities/appearance.js', root)))
    .digest('hex')
    .slice(0, 12);
  const outputs = normalized.map(([path, source]) => {
    let output = source.replaceAll('?v=' + token, '?v=' + version);
    if (path.pathname.endsWith('.html'))
      output = output.replace(/(appearance\.js\?v=)[a-f0-9]+/, '$1' + appearance);
    return [path, output];
  });
  return { version, outputs };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { version, outputs } = await versionedAssets();
  for (const [path, output] of outputs) {
    if (process.argv.includes('--check')) {
      if (readFileSync(path, 'utf8') !== output)
        throw new Error('Asset versions are stale. Run npm run format: ' + path.pathname);
    } else writeFileSync(path, output);
  }
  console.log('Local module graph uses release key ' + version + '.');
}
