export function safeLink(value) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u0020\u007f]/.test(value.trim()))
    return null;
  let href = value.trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(href)) {
    if (!/^(?:www\.)?[a-z\d-]+(?:\.[a-z\d-]+)+(?:[/:?#]|$)/i.test(href)) return null;
    href = 'https://' + href;
  }
  try {
    const url = new URL(href);
    return ['http:', 'https:'].includes(url.protocol) &&
      url.hostname &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function detectedLinks(text) {
  const links = [];
  const pattern =
    /(?:https?:\/\/|www\.)[^\s<>]+|\b[a-z\d](?:[a-z\d-]*[a-z\d])?(?:\.[a-z\d](?:[a-z\d-]*[a-z\d])?)*\.[a-z]{2,}(?:[/?#][^\s<>]*)?/gi;
  for (const match of text.matchAll(pattern)) {
    if (match.index > 0 && /[\w@/:.-]/.test(text[match.index - 1])) continue;
    let value = match[0].replace(/[.,!?;:]+$/, '');
    for (const [open, close] of [
      ['(', ')'],
      ['[', ']'],
      ['{', '}'],
    ])
      while (value.endsWith(close) && value.split(close).length > value.split(open).length)
        value = value.slice(0, -1);
    const href = safeLink(value);
    if (href) links.push({ start: match.index, end: match.index + value.length, href });
  }
  return links;
}
