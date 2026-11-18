import { describe, expect, it } from 'vitest';
import { rankDecisions } from './rank';
import { sampleDecision } from './sample';
import { extractIssueKeys } from './text';

const now = '2026-11-01T00:00:00.000Z';

describe('rankDecisions', () => {
  it('ranks an accepted decision above a proposed one when nothing else differs', () => {
    const ranked = rankDecisions(
      [
        sampleDecision({ id: 'b', key: 'DEC-2', status: 'proposed' }),
        sampleDecision({ id: 'a', key: 'DEC-1', status: 'accepted' }),
      ],
      { links: [], relatedIssueKeys: [], text: '', now },
    );
    expect(ranked.map((item) => item.decision.key)).toEqual(['DEC-1', 'DEC-2']);
  });

  it('ranks a shared link above a newer unrelated decision', () => {
    const linked = sampleDecision({
      id: 'old',
      key: 'DEC-2',
      updatedAt: '2025-01-01T00:00:00.000Z',
      links: [{ type: 'jiraIssue', id: 'PAY-9', url: 'https://example.atlassian.net/browse/PAY-9' }],
    });
    const newer = sampleDecision({
      id: 'new',
      key: 'DEC-3',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    const ranked = rankDecisions([newer, linked], {
      links: [{ type: 'jiraIssue', id: 'pay-9', url: 'https://example.atlassian.net/browse/PAY-9' }],
      relatedIssueKeys: [],
      text: '',
      now,
    });
    expect(ranked[0]?.decision.key).toBe('DEC-2');
    expect(ranked[0]?.sharedLinkCount).toBe(1);
  });

  it('boosts a decision linked to an issue named on a pull request', () => {
    const onIssue = sampleDecision({
      id: 'issue',
      key: 'DEC-4',
      links: [{ type: 'jiraIssue', id: 'PAY-15', url: 'https://example.atlassian.net/browse/PAY-15' }],
    });
    const other = sampleDecision({ id: 'other', key: 'DEC-5', title: 'Something else' });
    const ranked = rankDecisions([other, onIssue], {
      links: [
        {
          type: 'bitbucketPr',
          id: 'acme/billing/15',
          url: 'https://bitbucket.org/acme/billing/pull-requests/15',
        },
      ],
      relatedIssueKeys: ['PAY-15'],
      text: '',
      now,
    });
    expect(ranked[0]?.decision.key).toBe('DEC-4');
    expect(ranked[0]?.relatedIssueCount).toBe(1);
  });

  it('uses title and problem overlap, and prefers a newer decision when text is equal', () => {
    const older = sampleDecision({
      id: 'old',
      key: 'DEC-2',
      title: 'PostgreSQL for the billing service',
      problem: 'Billing needs a durable relational store.',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const newer = sampleDecision({
      id: 'new',
      key: 'DEC-8',
      title: 'PostgreSQL for the billing service',
      problem: 'Billing needs a durable relational store.',
      updatedAt: '2026-10-01T00:00:00.000Z',
    });
    const unrelated = sampleDecision({ id: 'other', key: 'DEC-3', title: 'Trunk based development' });
    const ranked = rankDecisions([unrelated, older, newer], {
      links: [],
      relatedIssueKeys: [],
      text: 'Why PostgreSQL for billing?',
      now,
    });
    expect(ranked[0]?.decision.key).toBe('DEC-8');
    expect(ranked[1]?.decision.key).toBe('DEC-2');
    expect(ranked[2]?.decision.key).toBe('DEC-3');
    expect(ranked[2]?.textScore).toBe(0);
  });

  it('places a superseded decision below its successor even when the older text matches better', () => {
    const successor = sampleDecision({
      id: 'next',
      key: 'DEC-6',
      title: 'Weekday deploy window',
      problem: 'Ship during staffed hours.',
      status: 'accepted',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
    const superseded = sampleDecision({
      id: 'old',
      key: 'DEC-5',
      title: 'Friday production deploys',
      problem: 'Friday production deploys emptied the office before the weekend.',
      status: 'superseded',
      supersededBy: 'DEC-6',
      supersedeReason: 'Incidents sat until Monday.',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });
    const ranked = rankDecisions([superseded, successor], {
      links: [],
      relatedIssueKeys: [],
      text: 'Friday production deploys',
      now,
    });
    expect(ranked.map((item) => item.decision.key)).toEqual(['DEC-6', 'DEC-5']);
    expect(ranked[0]?.score).toBeGreaterThan(ranked[1]?.score ?? 0);
  });
});

describe('extractIssueKeys', () => {
  it('reads issue keys from a pull request and ignores decision keys', () => {
    expect(extractIssueKeys('feature/PAY-12-billing fixes pay-13, see DEC-2')).toEqual(['PAY-12', 'PAY-13']);
  });
});
