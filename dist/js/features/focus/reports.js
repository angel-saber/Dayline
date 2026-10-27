import { node } from '../../shared/dom.js?v=5841dd2bd659';
import { durationLabel } from './model.js?v=5841dd2bd659';

export function renderFocusReports(container, reports = []) {
  for (const report of reports) {
    const details = node('details', 'focus-report'),
      when = new Date(report.startedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    details.append(
      node('summary', '', `Focus session · ${when} · ${durationLabel(report.durationMs)}`),
    );
    details.append(node('h4', '', 'My commitment'), node('p', '', report.mantra));
    const combined = report.logs
      .filter((l) => l.text.trim())
      .map(
        (l) =>
          `${l.date} · ${String(Math.floor(l.minute / 60)).padStart(2, '0')}:${String(l.minute % 60).padStart(2, '0')}\n${l.text}`,
      )
      .join('\n\n');
    details.append(
      node('h4', '', 'Interruption log'),
      node('pre', 'focus-combined-log', combined || 'No interruptions recorded.'),
    );
    for (const [key, label] of [
      ['progress', 'What moved forward'],
      ['learned', 'What I learned'],
      ['next', 'Where I will pick up next'],
    ])
      if (report.reflection[key])
        details.append(
          node('h4', '', label),
          node('p', 'focus-reflection-answer', report.reflection[key]),
        );
    if (!Object.values(report.reflection).some(Boolean))
      details.append(node('p', 'field-hint', 'Reflection skipped.'));
    container.append(details);
  }
}
