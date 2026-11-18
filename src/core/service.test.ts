import { describe, expect, it } from 'vitest';
import { agentDecisionResponse } from './present';
import { MemoryDecisionRepository } from './repository';
import { sampleDecision } from './sample';
import { createDecisionService } from './service';
import type { DecisionLink } from './types';
import { NO_DECISION_RECORDED } from './types';

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

function serviceWith(hidden: DecisionLink[] = []) {
  const hiddenKeys = new Set(hidden.map((link) => `${link.type}:${link.id}`));
  let clock = Date.parse('2026-11-01T00:00:00.000Z');
  let ids = 0;
  const repo = new MemoryDecisionRepository();
  const service = createDecisionService({
    repo,
    visibility: {
      async canView(link) {
        return !hiddenKeys.has(`${link.type}:${link.id}`);
      },
    },
    now: () => new Date(clock).toISOString(),
    newId: () => {
      ids += 1;
      return `id-${ids}`;
    },
  });
  return {
    service,
    repo,
    advance(ms: number) {
      clock += ms;
    },
  };
}

describe('decision service', () => {
  it('records a decision, then refuses to change it after it is superseded', async () => {
    const { service } = serviceWith();
    const first = await service.create({
      title: 'Friday production deploys',
      problem: 'The team shipped whenever the branch was green.',
      optionsConsidered: ['Friday deploys', 'Weekday window'],
      chosenOption: 'Friday deploys',
      rationale: 'Friday was when the release captain was online.',
      ownerAccountIds: ['712020:owner'],
      links: [publicIssue],
    });
    const second = await service.create({
      title: 'Weekday deploy window',
      problem: 'Incidents sat until Monday.',
      optionsConsidered: ['Weekday window', 'Friday deploys'],
      chosenOption: 'Weekday window',
      rationale: 'Someone is around to roll back.',
      status: 'accepted',
      ownerAccountIds: ['712020:owner'],
      links: [publicIssue],
    });
    expect(first.ok && first.value.key).toBe('DEC-1');
    expect(second.ok && second.value.key).toBe('DEC-2');
    if (!first.ok || !second.ok) {
      return;
    }
    const superseded = await service.supersede(first.value.key, second.value.key, 'Incidents sat until Monday.');
    expect(superseded.ok).toBe(true);
    if (superseded.ok) {
      expect(superseded.value.status).toBe('superseded');
      expect(superseded.value.supersededBy).toBe('DEC-2');
      expect(superseded.value.statusHistory.at(-1)?.to).toBe('superseded');
      expect(superseded.value.rationale).toBe(first.value.rationale);
    }
    const linked = await service.link(first.value.key, {
      type: 'confluencePage',
      id: '100',
      url: 'https://example.atlassian.net/wiki/spaces/ENG/pages/100',
    });
    expect(linked.ok).toBe(false);
    if (!linked.ok) {
      expect(linked.error.code).toBe('read_only');
    }
    const again = await service.supersede(first.value.key, second.value.key, 'Once more');
    expect(again.ok).toBe(false);
  });

  it('rejects a successor cycle and a hidden successor', async () => {
    const { service } = serviceWith([privateIssue]);
    const first = await service.create({
      title: 'One',
      problem: 'Problem one is still open.',
      optionsConsidered: ['Keep', 'Drop'],
      chosenOption: 'Keep',
      rationale: 'It still matches the current contract.',
      ownerAccountIds: ['712020:owner'],
      links: [],
    });
    const second = await service.create({
      title: 'Two',
      problem: 'Problem two is the replacement.',
      optionsConsidered: ['Keep', 'Drop'],
      chosenOption: 'Drop',
      rationale: 'The old path is unused.',
      ownerAccountIds: ['712020:owner'],
      links: [],
    });
    if (!first.ok || !second.ok) {
      throw new Error('setup failed');
    }
    await service.supersede(first.value.key, second.value.key, 'Replaced.');
    const cycle = await service.supersede(second.value.key, first.value.key, 'Swap back.');
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) {
      expect(cycle.error.code).toBe('cycle');
    }
    const hidden = await service.link(second.value.key, privateIssue);
    expect(hidden.ok).toBe(false);
    if (!hidden.ok) {
      expect(hidden.error.code).toBe('link_not_visible');
    }
  });

  it('hides a decision that would leak a private title and says nothing was recorded', async () => {
    const { service, repo } = serviceWith([privateIssue]);
    await repo.save(
      sampleDecision({
        id: 'secret',
        key: 'DEC-9',
        title: 'Project Nimbus launch date',
        problem: 'When should Nimbus launch?',
        optionsConsidered: ['March', 'June'],
        chosenOption: 'June',
        rationale: 'March overlaps the billing migration.',
        links: [privateIssue],
      }),
    );
    await service.create({
      title: 'PostgreSQL for the billing service',
      problem: 'Billing needs a durable store.',
      optionsConsidered: ['PostgreSQL', 'A document store'],
      chosenOption: 'PostgreSQL',
      rationale: 'The ledger needs transactions.',
      ownerAccountIds: ['712020:owner'],
      links: [publicIssue],
    });
    const secret = await service.search('Nimbus launch');
    expect(secret.ok && secret.value).toEqual([]);
    expect(agentDecisionResponse(secret.ok ? secret.value : []).message).toBe(NO_DECISION_RECORDED);
    const billing = await service.search('Why did we choose PostgreSQL for billing?');
    expect(billing.ok && billing.value.map((decision) => decision.key)).toEqual(['DEC-1']);
    const vague = await service.search('why did we decide this?');
    expect(vague.ok && vague.value).toEqual([]);
    const byKey = await service.get('DEC-9');
    expect(byKey.ok).toBe(false);
  });

  it('imports a superseded pair once, then only attaches new visible links', async () => {
    const { service } = serviceWith();
    const older = sampleDecision({
      id: 'seed-5',
      key: 'DEC-5',
      title: 'Friday production deploys',
      status: 'superseded',
      supersededBy: 'DEC-6',
      supersedeReason: 'Incidents sat until Monday.',
      links: [publicIssue],
    });
    const newer = sampleDecision({
      id: 'seed-6',
      key: 'DEC-6',
      title: 'Weekday deploy window',
      links: [publicIssue],
    });
    const first = await service.importDecisions([older, newer]);
    expect(first.ok && first.value.created).toBe(2);
    const second = await service.importDecisions([
      older,
      { ...newer, links: [...newer.links, { type: 'confluencePage', id: '55', url: 'https://example.atlassian.net/wiki/spaces/ENG/pages/55' }] },
    ]);
    expect(second.ok && second.value.updated).toBe(1);
    const stored = await service.get('DEC-6');
    expect(stored.ok && stored.value.links).toHaveLength(2);
    const superseded = await service.get('DEC-5');
    expect(superseded.ok && superseded.value.links).toHaveLength(1);
  });
});
