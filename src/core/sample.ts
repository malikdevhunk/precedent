import type { Decision } from './types';

export function sampleDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: 'id-1',
    key: 'DEC-1',
    title: 'Use trunk based development',
    status: 'accepted',
    problem: 'Releases spent days merging long lived branches.',
    optionsConsidered: ['Trunk-based development', 'Git flow'],
    chosenOption: 'Trunk-based development',
    rationale: 'Small batches keep main releasable.',
    ownerAccountIds: ['712020:owner'],
    links: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    statusHistory: [
      {
        at: '2026-01-01T00:00:00.000Z',
        from: 'accepted',
        to: 'accepted',
        reason: 'Recorded',
      },
    ],
    ...overrides,
  };
}
