export const DECISION_STATUSES = ['proposed', 'accepted', 'superseded', 'deprecated'] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const LINK_TYPES = ['jiraIssue', 'confluencePage', 'bitbucketPr'] as const;
export type LinkType = (typeof LINK_TYPES)[number];

export const NO_DECISION_RECORDED = 'No decision recorded';

export interface DecisionLink {
  type: LinkType;
  id: string;
  url: string;
}

export interface StatusChange {
  at: string;
  from: DecisionStatus;
  to: DecisionStatus;
  reason?: string;
}

export interface Decision {
  id: string;
  key: string;
  title: string;
  status: DecisionStatus;
  problem: string;
  optionsConsidered: string[];
  chosenOption: string;
  rationale: string;
  consequences?: string;
  ownerAccountIds: string[];
  links: DecisionLink[];
  supersededBy?: string;
  supersedeReason?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory: StatusChange[];
}

export interface DecisionDraft {
  title: string;
  status: DecisionStatus;
  problem: string;
  optionsConsidered: string[];
  chosenOption: string;
  rationale: string;
  consequences?: string;
  ownerAccountIds: string[];
  links: DecisionLink[];
}

export interface RankContext {
  links: DecisionLink[];
  relatedIssueKeys: string[];
  text: string;
  now: string;
}

export interface RankedDecision {
  decision: Decision;
  score: number;
  textScore: number;
  sharedLinkCount: number;
  relatedIssueCount: number;
}

export type DomainErrorCode =
  | 'validation'
  | 'not_found'
  | 'read_only'
  | 'cycle'
  | 'invalid_successor'
  | 'link_not_visible';

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError };

export interface PresentedDecision {
  key: string;
  title: string;
  status: DecisionStatus;
  problem: string;
  optionsConsidered: string[];
  chosenOption: string;
  rationale: string;
  consequences?: string;
  ownerAccountIds: string[];
  links: DecisionLink[];
  supersededBy?: string;
  supersedeReason?: string;
  updatedAt: string;
}

export interface AgentDecisionPayload {
  message: string;
  decisions: PresentedDecision[];
}
