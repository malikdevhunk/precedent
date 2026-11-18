import type { Decision, DecisionLink } from '../core/types';

export const GAP_QUESTION = 'Why did we choose Kafka for notifications?';

export interface SeedLinks {
  jira?: DecisionLink;
  page?: DecisionLink;
  pullRequest?: DecisionLink;
}

interface SeedShape {
  id: string;
  key: string;
  title: string;
  status: Decision['status'];
  problem: string;
  optionsConsidered: string[];
  chosenOption: string;
  rationale: string;
  consequences?: string;
  createdAt: string;
  updatedAt: string;
  supersededBy?: string;
  supersedeReason?: string;
  historyReason: string;
  attach: Array<keyof SeedLinks>;
}

const SHAPES: SeedShape[] = [
  {
    id: 'seed-dec-1',
    key: 'DEC-1',
    title: 'Trunk-based development',
    status: 'accepted',
    problem: 'Long-lived branches turned release day into a merge queue.',
    optionsConsidered: ['Trunk-based development', 'Git flow', 'Release branches'],
    chosenOption: 'Trunk-based development',
    rationale: 'A team of eight keeps main releasable by integrating small batches every day.',
    consequences: 'Incomplete work needs a feature flag instead of a long branch.',
    createdAt: '2026-01-10T09:00:00.000Z',
    updatedAt: '2026-01-10T09:00:00.000Z',
    historyReason: 'Recorded',
    attach: [],
  },
  {
    id: 'seed-dec-2',
    key: 'DEC-2',
    title: 'PostgreSQL for the billing service',
    status: 'accepted',
    problem: 'The billing ledger needs transactions and a schema the finance team can audit.',
    optionsConsidered: ['PostgreSQL', 'A document store', 'A proprietary warehouse'],
    chosenOption: 'PostgreSQL',
    rationale: 'The ledger needs multi-row transactions, and the team already operates PostgreSQL.',
    consequences: 'Reporting copies are built from the primary, not from a second write path.',
    createdAt: '2026-02-02T09:00:00.000Z',
    updatedAt: '2026-02-02T09:00:00.000Z',
    historyReason: 'Recorded',
    attach: ['jira'],
  },
  {
    id: 'seed-dec-3',
    key: 'DEC-3',
    title: 'Feature flag vendor evaluation',
    status: 'proposed',
    problem: 'Trunk-based work needs a flag service before the next unfinished project lands.',
    optionsConsidered: ['Build a small internal flag service', 'Buy a hosted flag service'],
    chosenOption: 'Buy a hosted flag service',
    rationale: 'An internal service would delay the billing launch. The hosted service is a proposal until security review finishes.',
    createdAt: '2026-03-03T09:00:00.000Z',
    updatedAt: '2026-03-03T09:00:00.000Z',
    historyReason: 'Recorded',
    attach: [],
  },
  {
    id: 'seed-dec-4',
    key: 'DEC-4',
    title: 'Public API stays on REST',
    status: 'accepted',
    problem: 'Partners asked whether the public billing API should move to a query language.',
    optionsConsidered: ['Stay on REST', 'Add a query language beside REST', 'Replace REST'],
    chosenOption: 'Stay on REST',
    rationale: 'Current partners already ship REST clients. A second contract would split the documentation and the support load.',
    createdAt: '2026-04-04T09:00:00.000Z',
    updatedAt: '2026-04-04T09:00:00.000Z',
    historyReason: 'Recorded',
    attach: ['page'],
  },
  {
    id: 'seed-dec-5',
    key: 'DEC-5',
    title: 'Friday production deploys',
    status: 'superseded',
    problem: 'The release captain was only scheduled on Fridays, so production shipped that afternoon.',
    optionsConsidered: ['Friday production deploys', 'Ship any weekday'],
    chosenOption: 'Friday production deploys',
    rationale: 'Friday matched the only staffed release shift at the time.',
    consequences: 'Rollback waited until Monday whenever a Friday ship went wrong.',
    createdAt: '2026-05-05T09:00:00.000Z',
    updatedAt: '2026-07-01T11:00:00.000Z',
    supersededBy: 'DEC-6',
    supersedeReason: 'A Friday incident sat unseen until Monday.',
    historyReason: 'A Friday incident sat unseen until Monday.',
    attach: ['jira'],
  },
  {
    id: 'seed-dec-6',
    key: 'DEC-6',
    title: 'Weekday deploy window at 10:00 UTC',
    status: 'accepted',
    problem: 'Production ships need a staffed window so a bad release can be rolled back the same day.',
    optionsConsidered: ['Weekday deploy window at 10:00 UTC', 'Friday production deploys', 'Continuous production deploys'],
    chosenOption: 'Weekday deploy window at 10:00 UTC',
    rationale: 'The on-call rotation is staffed on weekdays at 10:00 UTC, which leaves the workday for a rollback.',
    createdAt: '2026-07-01T11:00:00.000Z',
    updatedAt: '2026-07-01T11:00:00.000Z',
    historyReason: 'Recorded',
    attach: ['jira'],
  },
  {
    id: 'seed-dec-7',
    key: 'DEC-7',
    title: 'In-memory session store',
    status: 'deprecated',
    problem: 'The first billing prototype kept sessions in process memory.',
    optionsConsidered: ['In-memory session store', 'A shared session store'],
    chosenOption: 'In-memory session store',
    rationale: 'It was enough for a single prototype instance and was never meant to survive the second replica.',
    consequences: 'Sessions vanished on restart and could not be shared across instances.',
    createdAt: '2026-06-01T09:00:00.000Z',
    updatedAt: '2026-06-15T09:00:00.000Z',
    historyReason: 'Deprecated after the second replica shipped.',
    attach: [],
  },
  {
    id: 'seed-dec-8',
    key: 'DEC-8',
    title: 'Two reviewers on payment changes',
    status: 'accepted',
    problem: 'Payment code was merging with a single review, and two incidents came from unread edge cases.',
    optionsConsidered: ['Two reviewers on payment changes', 'One reviewer plus a checklist'],
    chosenOption: 'Two reviewers on payment changes',
    rationale: 'A second reviewer caught the ledger edge cases that the checklist kept missing.',
    createdAt: '2026-08-08T09:00:00.000Z',
    updatedAt: '2026-08-08T09:00:00.000Z',
    historyReason: 'Recorded',
    attach: ['pullRequest'],
  },
];

export function buildSeedDecisions(ownerAccountId: string, links: SeedLinks = {}): Decision[] {
  return SHAPES.map((shape) => {
    const attached = shape.attach.flatMap((slot) => {
      const link = links[slot];
      return link ? [link] : [];
    });
    const decision: Decision = {
      id: shape.id,
      key: shape.key,
      title: shape.title,
      status: shape.status,
      problem: shape.problem,
      optionsConsidered: shape.optionsConsidered,
      chosenOption: shape.chosenOption,
      rationale: shape.rationale,
      ownerAccountIds: [ownerAccountId],
      links: attached,
      createdAt: shape.createdAt,
      updatedAt: shape.updatedAt,
      statusHistory: [
        {
          at: shape.updatedAt,
          from: shape.status === 'superseded' ? 'accepted' : shape.status,
          to: shape.status,
          reason: shape.historyReason,
        },
      ],
    };
    if (shape.consequences) {
      decision.consequences = shape.consequences;
    }
    if (shape.supersededBy) {
      decision.supersededBy = shape.supersededBy;
      decision.supersedeReason = shape.supersedeReason;
    }
    return decision;
  });
}
