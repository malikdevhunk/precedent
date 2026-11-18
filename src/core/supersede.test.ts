import { describe, expect, it } from 'vitest';
import { sampleDecision } from './sample';
import { supersedeViolation } from './supersede';

describe('supersedeViolation', () => {
  const successor = sampleDecision({ id: 'next', key: 'DEC-6', status: 'accepted' });
  const target = sampleDecision({ id: 'old', key: 'DEC-5', status: 'accepted' });

  it('requires a live successor and a reason', () => {
    expect(supersedeViolation(target, undefined, [target], 'because')).toBe('missing_successor');
    expect(supersedeViolation(target, successor, [target, successor], '  ')).toBe('reason');
  });

  it('rejects a self link, a superseded target, and a deprecated successor', () => {
    expect(supersedeViolation(target, target, [target], 'because')).toBe('self');
    expect(
      supersedeViolation(
        sampleDecision({ status: 'superseded', supersededBy: 'DEC-6', supersedeReason: 'done' }),
        successor,
        [successor],
        'again',
      ),
    ).toBe('already_superseded');
    expect(
      supersedeViolation(
        target,
        sampleDecision({ id: 'old-way', key: 'DEC-7', status: 'deprecated' }),
        [target],
        'because',
      ),
    ).toBe('bad_successor_status');
  });

  it('rejects a cycle through the successor chain', () => {
    const first = sampleDecision({
      id: 'a',
      key: 'DEC-1',
      status: 'superseded',
      supersededBy: 'DEC-2',
      supersedeReason: 'replaced',
    });
    const second = sampleDecision({ id: 'b', key: 'DEC-2', status: 'accepted' });
    expect(supersedeViolation(second, first, [first, second], 'swap them')).toBe('cycle');
  });

  it('allows a proposed or accepted successor that does not loop', () => {
    expect(supersedeViolation(target, successor, [target, successor], 'Incidents sat until Monday.')).toBeUndefined();
  });
});
