import { describe, expect, it } from 'vitest';
import { actionFields, actorAccountId, readLines, readString } from './action-input';

describe('action input', () => {
  it('reads fields from a direct payload or an inputs wrapper', () => {
    expect(readString({ decisionKey: ' DEC-4 ' }, 'decisionKey')).toBe('DEC-4');
    expect(actionFields({ inputs: { query: 'billing' } }).query).toBe('billing');
    expect(readLines({ optionsConsidered: 'REST\nGraphQL\n' }, 'optionsConsidered')).toEqual(['REST', 'GraphQL']);
  });

  it('takes the actor from the platform context, not from the payload', () => {
    expect(actorAccountId({ principal: { accountId: '712020:abc' } })).toBe('712020:abc');
    expect(actorAccountId({ accountId: '712020:xyz' })).toBe('712020:xyz');
    expect(actorAccountId(undefined)).toBeUndefined();
  });
});
