import { linkIdentity } from './links';
import { tokens } from './text';
import type { Decision, DecisionLink, RankContext, RankedDecision } from './types';

const STATUS_WEIGHT: Record<Decision['status'], number> = {
  accepted: 40,
  proposed: 28,
  deprecated: 12,
  superseded: 4,
};
const SHARED_LINK_WEIGHT = 36;
const RELATED_ISSUE_WEIGHT = 28;
const TEXT_MAX = 70;
const RECENCY_MAX = 16;
const DAY_MS = 86_400_000;

function recencyScore(updatedAt: string, now: string): number {
  const updated = Date.parse(updatedAt);
  const current = Date.parse(now);
  if (Number.isNaN(updated) || Number.isNaN(current)) {
    return 0;
  }
  const ageDays = Math.max(0, (current - updated) / DAY_MS);
  return Math.max(0, RECENCY_MAX * (1 - Math.min(ageDays, 365) / 365));
}

function overlapScore(decision: Decision, query: string): number {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) {
    return 0;
  }
  const title = new Set(tokens(decision.title));
  const chosen = new Set(tokens(decision.chosenOption));
  const problem = new Set(tokens(decision.problem));
  const rationale = new Set(tokens(decision.rationale));
  let weighted = 0;
  for (const token of queryTokens) {
    if (title.has(token)) {
      weighted += 3;
    } else if (chosen.has(token) || problem.has(token)) {
      weighted += 2;
    } else if (rationale.has(token)) {
      weighted += 1;
    }
  }
  return (weighted / (queryTokens.length * 3)) * TEXT_MAX;
}

function countMatches(decision: Decision, links: DecisionLink[], relatedIssueKeys: string[]): {
  sharedLinkCount: number;
  relatedIssueCount: number;
} {
  const decisionLinks = new Set(decision.links.map(linkIdentity));
  const shared = new Set<string>();
  for (const link of links) {
    const identity = linkIdentity(link);
    if (decisionLinks.has(identity)) {
      shared.add(identity);
    }
  }
  let relatedIssueCount = 0;
  for (const issueKey of relatedIssueKeys) {
    const identity = linkIdentity({
      type: 'jiraIssue',
      id: issueKey,
      url: 'https://example.atlassian.net/browse/PLACE',
    });
    if (decisionLinks.has(identity) && !shared.has(identity)) {
      relatedIssueCount += 1;
    }
  }
  return { sharedLinkCount: shared.size, relatedIssueCount };
}

function rawScore(decision: Decision, context: RankContext): RankedDecision {
  const matches = countMatches(decision, context.links, context.relatedIssueKeys);
  const textScore = overlapScore(decision, context.text);
  const score =
    STATUS_WEIGHT[decision.status] +
    matches.sharedLinkCount * SHARED_LINK_WEIGHT +
    matches.relatedIssueCount * RELATED_ISSUE_WEIGHT +
    textScore +
    recencyScore(decision.updatedAt, context.now);
  return {
    decision,
    score,
    textScore,
    sharedLinkCount: matches.sharedLinkCount,
    relatedIssueCount: matches.relatedIssueCount,
  };
}

function includeSuccessors(ranked: RankedDecision[], universe: Decision[]): RankedDecision[] {
  const byKey = new Map(universe.map((decision) => [decision.key, decision]));
  const present = new Set(ranked.map((item) => item.decision.key));
  const extras: RankedDecision[] = [];
  for (const item of ranked) {
    const successorKey = item.decision.supersededBy;
    if (!successorKey || present.has(successorKey)) {
      continue;
    }
    const successor = byKey.get(successorKey);
    if (!successor) {
      continue;
    }
    extras.push({
      decision: successor,
      score: item.score + 1,
      textScore: 0,
      sharedLinkCount: 0,
      relatedIssueCount: 0,
    });
    present.add(successorKey);
  }
  return [...ranked, ...extras];
}

function liftSuccessors(ranked: RankedDecision[]): void {
  const byKey = new Map(ranked.map((item) => [item.decision.key, item]));
  for (let pass = 0; pass < ranked.length; pass += 1) {
    let changed = false;
    for (const item of ranked) {
      if (!item.decision.supersededBy) {
        continue;
      }
      const successor = byKey.get(item.decision.supersededBy);
      if (!successor || successor.score > item.score) {
        continue;
      }
      successor.score = item.score + 1;
      changed = true;
    }
    if (!changed) {
      break;
    }
  }
}

export function rankDecisions(
  candidates: Decision[],
  context: RankContext,
  universe: Decision[] = candidates,
): RankedDecision[] {
  const unique = new Map<string, Decision>();
  for (const decision of candidates) {
    unique.set(decision.id, decision);
  }
  const ranked = includeSuccessors([...unique.values()].map((decision) => rawScore(decision, context)), universe);
  liftSuccessors(ranked);
  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.decision.key.localeCompare(right.decision.key);
  });
  return ranked;
}
