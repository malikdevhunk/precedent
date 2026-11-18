import { describe, expect, it } from 'vitest';
import { applyVisibility, filterVisibleDecisions, visibleLinkKeySet } from './permissions';
import { sampleDecision } from './sample';
import type { DecisionLink } from './types';

const publicIssue: DecisionLink = {
  type: 'jiraIssue',
  id: 'PAY-1',
  url: 'https://example.atlassian.net/browse/PAY-1',
};
const privateIssue: DecisionLink = {
  type: 'jiraIssue',
  id: 'SEC-9',
  url: 'https://example.atlassian.net/browse/SEC-9',
};

describe('applyVisibility', () => {
  it('drops a hidden link and drops a decision whose only context is hidden', () => {
    const mixed = sampleDecision({
      id: 'mixed',
      key: 'DEC-2',
      title: 'Private launch date',
      links: [publicIssue, privateIssue],
    });
    const secret = sampleDecision({
      id: 'secret',
      key: 'DEC-9',
      title: 'Project Nimbus date',
      links: [privateIssue],
    });
    const siteWide = sampleDecision({ id: 'site', key: 'DEC-1', links: [] });
    const visible = visibleLinkKeySet([publicIssue, privateIssue], (link) => link.id === 'PAY-1');
    expect(applyVisibility(mixed, visible)?.links).toEqual([publicIssue]);
    expect(applyVisibility(secret, visible)).toBeNull();
    expect(applyVisibility(siteWide, visible)?.key).toBe('DEC-1');
    const shown = filterVisibleDecisions([mixed, secret, siteWide], visible);
    expect(shown.map((decision) => decision.key)).toEqual(['DEC-2', 'DEC-1']);
    expect(JSON.stringify(shown)).not.toContain('Nimbus');
  });
});
