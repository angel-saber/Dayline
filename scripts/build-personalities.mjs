import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { PERSONALITIES } from '../dist/js/personalities/index.js';
const root = new URL('../', import.meta.url);
const check = process.argv.includes('--check');
const profiles = Object.values(PERSONALITIES);
const themes = Object.fromEntries(profiles.map((profile) => [profile.id, profile.themeColor]));
const template = readFileSync(new URL('scripts/appearance.template.txt', root), 'utf8');
const appearance = await format(
  '/* Generated from the personality registry. Edit scripts/appearance.template.txt. */\n' +
    template.replace("'__PERSONALITY_THEMES__'", JSON.stringify(themes)),
  { parser: 'babel', ...JSON.parse(readFileSync(new URL('.prettierrc.json', root))) },
);
const escape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
const cards = profiles
  .map(
    (profile) =>
      `<label class="layout-choice"><input type="radio" name="layout" value="${escape(profile.id)}"><span class="layout-swatch swatch-${escape(profile.id)}" aria-hidden="true"><i></i><i></i><i></i></span><strong data-personality-name="${escape(profile.id)}">${escape(profile.name)}</strong><span data-personality-description="${escape(profile.id)}">${escape(profile.settingsDescription)}</span></label>`,
  )
  .join('\n');
const htmlPath = new URL('dist/index.html', root);
const source = readFileSync(htmlPath, 'utf8');
const html = await format(
  source.replace(
    /<fieldset class="layout-options"[\s\S]*?<\/fieldset\s*>/,
    `<fieldset class="layout-options" aria-describedby="layout-description layout-status"><legend class="sr-only">Layout design</legend><!-- Generated from the personality registry. -->${cards}</fieldset>`,
  ),
  { parser: 'html', ...JSON.parse(readFileSync(new URL('.prettierrc.json', root))) },
);
for (const [path, content] of [
  [new URL('dist/js/personalities/appearance.js', root), appearance],
  [htmlPath, html],
]) {
  if (check) {
    if (readFileSync(path, 'utf8') !== content)
      throw new Error('Personality output is stale. Run npm run format: ' + path.pathname);
  } else writeFileSync(path, content);
}
console.log(
  check
    ? 'Personality bootstrap and Settings match the registry.'
    : 'Built personality bootstrap and Settings from the registry.',
);
