import { describe, expect, it } from 'vitest';
import { sampleDecision } from './sample';
import { validateDecision, validateDraft } from './validate';

const owners = ['712020:owner'];

describe('validateDraft', () => {
  it('accepts a proposed decision and drops a duplicate link', () => {
    const result = validateDraft({
      title: '  Keep the public API on REST  ',
      problem: 'Clients already call REST.',
      optionsConsidered: ['REST', 'GraphQL'],
      chosenOption: 'REST',
      rationale: 'Changing the contract would strand current clients.',
      ownerAccountIds: owners,
      links: [
        { type: 'jiraIssue', id: 'pay-12', url: 'https://example.atlassian.net/browse/PAY-12' },
        { type: 'jiraIssue', id: 'PAY-12', url: 'https://example.atlassian.net/browse/PAY-12' },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Keep the public API on REST');
      expect(result.value.status).toBe('proposed');
      expect(result.value.links).toEqual([
        { type: 'jiraIssue', id: 'PAY-12', url: 'https://example.atlassian.net/browse/PAY-12' },
      ]);
    }
  });

  it('rejects a chosen option that was not considered', () => {
    const result = validateDraft({
      title: 'API style',
      problem: 'The public contract is unsettled.',
      optionsConsidered: ['REST'],
      chosenOption: 'GraphQL',
      rationale: 'Clients asked for a query language.',
      ownerAccountIds: owners,
      links: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.chosenOption).toMatch(/one of the options/i);
    }
  });

  it('rejects an empty title and a non-https link', () => {
    const result = validateDraft({
      title: '   ',
      problem: 'A problem.',
      optionsConsidered: ['One'],
      chosenOption: 'One',
      rationale: 'Because.',
      ownerAccountIds: owners,
      links: [{ type: 'jiraIssue', id: 'PAY-1', url: 'http://example.atlassian.net/browse/PAY-1' }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.title).toBeTruthy();
      expect(result.errors['links.0']).toMatch(/https/i);
    }
  });
});

describe('validateDecision', () => {
  it('requires a successor and a reason once a decision is superseded', () => {
    const result = validateDecision({
      ...sampleDecision({ status: 'superseded' }),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.supersededBy).toBeTruthy();
      expect(result.errors.supersedeReason).toBeTruthy();
    }
  });

  it('keeps a stored decision whose owners were erased', () => {
    const result = validateDecision(sampleDecision({ ownerAccountIds: [] }), { allowEmptyOwners: true });
    expect(result.ok).toBe(true);
  });
});
