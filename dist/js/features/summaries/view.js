import { readSummaryPreferences, toggleSummaryTagMode } from './preferences.js?v=b8179ad8cdac';
import { node } from '../../shared/dom.js?v=b8179ad8cdac';
import { HOLIDAY_SOURCE } from '../../shared/holidays.js?v=b8179ad8cdac';
import { summaryParts, focusTime } from './model.js?v=b8179ad8cdac';

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
    const preferences = readSummaryPreferences();
    const parts = summaryParts(data, preferences);
    element.hidden = !parts.length;
    const tagScroll = line.querySelector('.summary-tags-scroll')?.scrollLeft || 0;
    line.replaceChildren();
    let tagScroller = null;
    for (const [index, part] of parts.entries()) {
      if (index) line.append(node('span', 'summary-separator', ' · '));
      if (part.key !== 'tags') {
        line.append(node('span', `summary-part summary-part--${part.key}`, part.text));
        continue;
      }
      const scroller = node('span', 'summary-tags-scroll');
      scroller.tabIndex = 0;
      scroller.setAttribute('role', 'region');
      scroller.setAttribute(
        'aria-label',
        'Tag breakdown. Scroll horizontally or use Left and Right arrow keys for more tags. Click the figures to switch percentages and counts.',
      );
      scroller.addEventListener('keydown', (event) => {
        if (event.target === scroller && ['Enter', ' '].includes(event.key)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Home') scroller.scrollLeft = 0;
        else if (event.key === 'End') scroller.scrollLeft = scroller.scrollWidth;
        else scroller.scrollLeft += event.key === 'ArrowRight' ? 100 : -100;
      });
      let pointerX = null,
        dragged = false;
      scroller.addEventListener('pointerdown', (event) => {
        pointerX = event.clientX;
        dragged = false;
      });
      scroller.addEventListener('pointermove', (event) => {
        if (pointerX !== null && Math.abs(event.clientX - pointerX) > 6) dragged = true;
      });
      scroller.addEventListener('pointerup', () => {
        pointerX = null;
      });
      scroller.addEventListener('pointercancel', () => {
        pointerX = null;
      });
      scroller.addEventListener(
        'click',
        (event) => {
          if ((dragged && event.detail !== 0) || event.target === scroller) {
            event.preventDefault();
            event.stopPropagation();
          }
          dragged = false;
        },
        true,
      );
      const toggle = node('button', 'summary-tags-toggle', part.text);
      toggle.type = 'button';
      const nextMode = preferences.tagMode === 'percentage' ? 'note counts' : 'percentages';
      toggle.title = `Click to show tag ${nextMode}`;
      toggle.setAttribute('aria-label', `${part.text}. Show tag ${nextMode}`);
      toggle.setAttribute('aria-pressed', String(preferences.tagMode === 'count'));
      toggle.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
      });
      toggle.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (dragged && event.detail !== 0) {
          dragged = false;
          return;
        }
        try {
          toggleSummaryTagMode();
          update(data);
          line.querySelector('.summary-tags-toggle')?.focus({ preventScroll: true });
        } catch {
          window.dispatchEvent(new window.Event('dayline:summary-preference-error'));
        }
      });
      scroller.append(toggle);
      line.append(scroller);
      tagScroller = scroller;
    }
    if (tagScroller) tagScroller.scrollLeft = tagScroll;
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
