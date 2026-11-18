import { describe, expect, it } from 'vitest';
import { tokens } from '../core/text';
import { NO_DECISION_RECORDED } from '../core/types';
import { validateDecision } from '../core/validate';
import { MemoryDecisionRepository } from '../core/repository';
import { createDecisionService } from '../core/service';
import { GAP_QUESTION, buildSeedDecisions } from './seed-data';

describe('demo seed', () => {
  const decisions = buildSeedDecisions('712020:demo-owner', {
    jira: { type: 'jiraIssue', id: 'PAY-42', url: 'https://example.atlassian.net/browse/PAY-42' },
    page: { type: 'confluencePage', id: '88', url: 'https://example.atlassian.net/wiki/spaces/ENG/pages/88' },
    pullRequest: {
      type: 'bitbucketPr',
      id: 'acme/billing/7',
      url: 'https://bitbucket.org/acme/billing/pull-requests/7',
    },
  });

  it('ships eight decisions, including one superseded record and one deprecated record', () => {
    expect(decisions).toHaveLength(8);
    expect(decisions.map((decision) => decision.key)).toEqual([
      'DEC-1',
      'DEC-2',
      'DEC-3',
      'DEC-4',
      'DEC-5',
      'DEC-6',
      'DEC-7',
      'DEC-8',
    ]);
    const superseded = decisions.find((decision) => decision.status === 'superseded');
    expect(superseded?.key).toBe('DEC-5');
    expect(superseded?.supersededBy).toBe('DEC-6');
    expect(decisions.some((decision) => decision.status === 'deprecated')).toBe(true);
    for (const decision of decisions) {
      expect(validateDecision(decision).ok).toBe(true);
    }
  });

  it('answers the billing question from DEC-2 and leaves the deliberate gap empty', async () => {
    const repo = new MemoryDecisionRepository();
    const service = createDecisionService({
      repo,
      visibility: { async canView() { return true; } },
      now: () => '2026-11-01T00:00:00.000Z',
      newId: () => 'unused',
    });
    const imported = await service.importDecisions(decisions);
    expect(imported.ok && imported.value.created).toBe(8);
    const billing = await service.search('Why did we choose PostgreSQL for billing?');
    expect(billing.ok && billing.value[0]?.key).toBe('DEC-2');
    const gap = await service.search(GAP_QUESTION);
    expect(gap.ok && gap.value).toEqual([]);
    expect(tokens(GAP_QUESTION).length).toBeGreaterThan(0);
    const corpus = JSON.stringify(decisions);
    expect(corpus.toLowerCase()).not.toContain('kafka');
    expect(NO_DECISION_RECORDED).toBe('No decision recorded');
  });
});
