import { flowLines, recoveryLines } from './flow-model.js?v=a482c04a82dd';
import { node } from '../../shared/dom.js?v=a482c04a82dd';
import { durationLabel } from './model.js?v=a482c04a82dd';

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
    if (report.timing)
      details.append(
        node(
          'p',
          'field-hint',
          report.timing.mode === 'timed'
            ? `Timed session · ${report.timing.workMinutes} min planned · ${report.recovery?.minutes ?? report.timing.breakMinutes} min suggested break`
            : 'Untimed session · Flowtime break guidance',
        ),
      );
    if (report.practice)
      details.append(
        node(
          'p',
          'field-hint',
          `Daily practice · ${report.practice.title} · ${report.practice.minutes}-minute target. Time spent, not an outcome requirement.`,
        ),
      );
    details.append(node('h4', '', 'My commitment'), node('p', '', report.mantra));
    for (const [title, lines] of [
      ['Flow preparation', flowLines(report.flow)],
      ['Recovery & acknowledgment', recoveryLines(report.recovery)],
    ])
      if (lines.length)
        details.append(node('h4', '', title), node('pre', 'focus-combined-log', lines.join('\n')));
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
