import { node } from '../../shared/dom.js?v=99c68c40b4e2';

export function externalShortcuts() {
  const section = node('div', 'note-external-shortcuts');
  const links = node('div', 'inline');
  for (const [label, href] of [
    ['Open Google Meet', 'https://meet.google.com/'],
    ['Open Google Drive', 'https://drive.google.com/'],
  ]) {
    const link = node('a', '', label);
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.title = label + ' in a new tab';
    links.append(link);
  }
  section.append(
    links,
    node(
      'small',
      'field-hint',
      'Opens in a new tab. Copy your meeting or file link, then paste it into this note. Google file permissions still apply.',
    ),
  );
  return section;
}
