import test from 'node:test';
import assert from 'node:assert/strict';
import {
  summarySource,
  summarizePeriod,
  summaryLine,
  focusTime,
} from '../../dist/js/features/summaries/model.js';

test('tag percentages describe note prevalence, including multiple tags and untagged notes', () => {
  const source = summarySource({
    '2026-11-26': [
      { id: 'a', tags: ['project', 'event'] },
      { id: 'b', tags: ['project'] },
      { id: 'c', tags: [] },
      { id: 'd', noteType: 'custom:Writing' },
    ],
  });
  const summary = summarizePeriod(source, '2026-11-26', '2026-11-26');
  assert.equal(summary.count, 4);
  assert.deepEqual(
    summary.tags.find((tag) => tag.key === 'project'),
    { key: 'project', label: 'Project', count: 2, percentage: 50 },
  );
  for (const key of ['event', 'none', 'custom:Writing'])
    assert.equal(summary.tags.find((tag) => tag.key === key).percentage, 25);
  assert.ok(summaryLine(summary).includes('4 notes'));
  for (const label of ['Project 50%', 'Event 25%', 'Writing 25%', 'Untagged 25%'])
    assert.ok(summaryLine(summary).includes(label));
  assert.doesNotMatch(summaryLine(summary), /\+\d+ tags/);
  assert.ok(summaryLine(summary).includes('Thanksgiving Day'));
});
test('month totals exclude padded dates and include Weekly Notes from overlapping weeks once', () => {
  const source = summarySource({
    '2026-04-26': [{ id: 'weekly', weekly: true, tags: ['admin'] }],
    '2026-04-30': [{ id: 'padding', tags: [] }],
    '2026-05-01': [{ id: 'dated', tags: ['project'] }],
    '2026-06-01': [{ id: 'next', tags: [] }],
  });
  const month = summarizePeriod(source, '2026-05-01', '2026-05-31', true);
  assert.equal(month.count, 2);
  assert.equal(month.weeklyCount, 1);
  const week = summarizePeriod(source, '2026-04-26', '2026-05-02', true);
  assert.equal(week.count, 3);
  assert.equal(week.weeklyCount, 1);
  assert.equal(summarizePeriod(source, '2026-04-26', '2026-04-26').count, 0);
});
test('Focus time is split at local midnight and deduplicated even when report notes move', () => {
  const old = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const report = {
      id: 'session',
      startedAt: Date.parse('2026-10-28T23:30:00-07:00'),
      endedAt: Date.parse('2026-10-29T00:30:00-07:00'),
    };
    const source = summarySource({
      '2026-11-10': [
        { id: 'moved', focusReports: [report] },
        { id: 'conflict', focusReports: [{ ...report }] },
      ],
    });
    const first = summarizePeriod(source, '2026-10-28', '2026-10-28');
    const second = summarizePeriod(source, '2026-10-29', '2026-10-29');
    assert.equal(first.focusMs, 30 * 60000);
    assert.equal(second.focusMs, 30 * 60000);
    assert.equal(first.focusSessions, 1);
    assert.equal(summarizePeriod(source, '2026-10-01', '2026-10-31').focusMs, 60 * 60000);
    assert.equal(summarizePeriod(source, '2026-11-10', '2026-11-10').focusMs, 0);
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test('local-day Focus bounds honor daylight-saving transitions rather than assuming 24 hours', () => {
  const old = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    const source = summarySource({
      '2026-11-01': [
        {
          id: 'a',
          focusReports: [
            {
              id: 'dst',
              startedAt: Date.parse('2026-11-01T00:00:00-07:00'),
              endedAt: Date.parse('2026-11-02T00:00:00-08:00'),
            },
          ],
        },
      ],
    });
    assert.equal(summarizePeriod(source, '2026-11-01', '2026-11-01').focusMs, 25 * 60 * 60000);
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
test('empty periods stay readable and observed holidays are present without notes', () => {
  const summary = summarizePeriod(summarySource({}), '2026-07-03', '2026-07-03');
  assert.equal(summary.count, 0);
  assert.deepEqual(summary.tags, []);
  assert.equal(summary.focusMs, 0);
  assert.ok(summaryLine(summary).includes('Independence Day (observed)'));
  assert.equal(focusTime(0), '0m');
  assert.equal(focusTime(45000), '45s');
  assert.equal(focusTime(75 * 60000), '1h 15m');
});
