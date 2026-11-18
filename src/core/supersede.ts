import { decisionKeyNumber } from './validate';
import type { Decision } from './types';

export type SupersedeViolation = 'missing_successor' | 'self' | 'bad_successor_status' | 'already_superseded' | 'cycle' | 'reason';

export function supersedeViolation(
  target: Decision,
  successor: Decision | undefined,
  universe: Decision[],
  reason: string,
): SupersedeViolation | undefined {
  if (target.status === 'superseded') {
    return 'already_superseded';
  }
  return successorShape(target, successor, universe, reason);
}

export function appliedSupersessionViolation(
  target: Decision,
  successor: Decision | undefined,
  universe: Decision[],
): SupersedeViolation | undefined {
  return successorShape(target, successor, universe, target.supersedeReason ?? '');
}

function successorShape(
  target: Decision,
  successor: Decision | undefined,
  universe: Decision[],
  reason: string,
): SupersedeViolation | undefined {
  if (!reason.trim()) {
    return 'reason';
  }
  if (!successor) {
    return 'missing_successor';
  }
  if (successor.id === target.id || successor.key === target.key) {
    return 'self';
  }
  if (!decisionKeyNumber(successor.key)) {
    return 'missing_successor';
  }
  if (createsCycle(target, successor, universe)) {
    return 'cycle';
  }
  if (successor.status !== 'proposed' && successor.status !== 'accepted') {
    return 'bad_successor_status';
  }
  return undefined;
}

function createsCycle(target: Decision, successor: Decision, universe: Decision[]): boolean {
  const byKey = new Map<string, Decision>(universe.map((decision) => [decision.key, decision]));
  byKey.set(target.key, target);
  byKey.set(successor.key, successor);
  const seen = new Set<string>();
  let currentKey: string | undefined = successor.key;
  while (currentKey) {
    if (currentKey === target.key) {
      return true;
    }
    if (seen.has(currentKey)) {
      return true;
    }
    seen.add(currentKey);
    const current = byKey.get(currentKey);
    currentKey = current?.supersededBy;
  }
  return false;
}
