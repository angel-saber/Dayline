import { node } from '../../shared/dom.js?v=e84921dfd9a4';
import { HOLIDAY_SOURCE } from '../../shared/holidays.js?v=e84921dfd9a4';
import { summaryLine, focusTime } from './model.js?v=e84921dfd9a4';

export function createPeriodSummary(label) {
  const element = node('details', 'period-summary');
  const heading = node('summary');
  heading.setAttribute('aria-label', `${label} summary; expand for the full breakdown`);
  const line = node('span', 'period-summary-line');
  const hint = node('span', 'period-summary-hint', 'Details');
  heading.append(line, hint);
  const body = node('div', 'period-summary-breakdown');
  element.append(heading, body);
  function update(data) {
    line.textContent = summaryLine(data);
    heading.setAttribute(
      'aria-label',
      `${label} summary: ${line.textContent}. Expand for the full breakdown`,
    );
    heading.title = line.textContent;
    body.replaceChildren();
    body.append(
      node(
        'p',
        '',
        `${data.start} to ${data.end} · ${data.count} notes${data.weeklyCount ? `, including ${data.weeklyCount} undated Weekly Notes` : ''}.`,
      ),
    );
    if (data.tags.length) {
      const tags = node('ul');
      for (const tag of data.tags)
        tags.append(
          node('li', '', `${tag.label}: ${tag.count} of ${data.count} notes (${tag.percentage}%)`),
        );
      body.append(tags);
    } else body.append(node('p', '', 'No tags to summarize yet.'));
    body.append(
      node(
        'p',
        '',
        'Tag percentages use all notes in the period, regardless of visible filters. A note carrying multiple tags counts toward each, so percentages may add up to more than 100%. Weekly Notes are counted once in each period their week overlaps; dated notes are limited to the dates above.',
      ),
    );
    body.append(
      node(
        'p',
        '',
        `Focus: ${focusTime(data.focusMs)} from ${data.focusSessions} saved ${data.focusSessions === 1 ? 'session' : 'sessions'}. Only time spent within this period is counted, even if the report’s note was moved. Active sessions are not included. Duplicate reports count once; deleted reports are no longer included.`,
      ),
    );
    if (data.holidays.length) {
      const holidays = node('ul');
      for (const holiday of data.holidays)
        holidays.append(node('li', '', `${holiday.date}: ${holiday.names.join(', ')}`));
      body.append(holidays);
    } else body.append(node('p', '', 'No annual U.S. federal holiday dates in this period.'));
    const source = node('a', '', 'U.S. federal holiday calendar (OPM)');
    source.href = HOLIDAY_SOURCE;
    source.target = '_blank';
    source.rel = 'noopener noreferrer';
    body.append(
      node(
        'p',
        '',
        'Holiday flags use current annual federal rules and standard observed dates from 2021 onward. Local holidays, special closures, and regional Inauguration Day are not included.',
      ),
      source,
    );
  }
  return { element, update };
}
