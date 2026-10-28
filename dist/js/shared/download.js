import { node } from './dom.js?v=31f307a53cca';
export function downloadText(text, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = node('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
