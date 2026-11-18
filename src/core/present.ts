import type { AgentDecisionPayload, Decision, PresentedDecision } from './types';
import { NO_DECISION_RECORDED } from './types';

export function presentDecision(decision: Decision): PresentedDecision {
  const presented: PresentedDecision = {
    key: decision.key,
    title: decision.title,
    status: decision.status,
    problem: decision.problem,
    optionsConsidered: decision.optionsConsidered,
    chosenOption: decision.chosenOption,
    rationale: decision.rationale,
    ownerAccountIds: decision.ownerAccountIds,
    links: decision.links,
    updatedAt: decision.updatedAt,
  };
  if (decision.consequences) {
    presented.consequences = decision.consequences;
  }
  if (decision.supersededBy) {
    presented.supersededBy = decision.supersededBy;
    presented.supersedeReason = decision.supersedeReason;
  }
  return presented;
}

export function agentDecisionResponse(decisions: Decision[]): AgentDecisionPayload {
  if (decisions.length === 0) {
    return { message: NO_DECISION_RECORDED, decisions: [] };
  }
  return {
    message: 'Cite each decision by its key and title.',
    decisions: decisions.map(presentDecision),
  };
}
