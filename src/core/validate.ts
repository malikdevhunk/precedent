import { canonicalLink, dedupeLinks, isLinkType, linkIdError } from './links';
import type { Decision, DecisionDraft, DecisionLink, DecisionStatus, StatusChange } from './types';
import { DECISION_STATUSES } from './types';

const ACCOUNT_ID = /^[A-Za-z0-9:-]{1,128}$/;
const DECISION_KEY = /^DEC-([1-9]\d*)$/;

export interface ValidationOptions {
  allowEmptyOwners?: boolean;
}

function isStatus(value: string): value is DecisionStatus {
  return (DECISION_STATUSES as readonly string[]).includes(value);
}

function clean(value: string): string {
  return value.trim();
}

export function decisionKeyNumber(key: string): number | undefined {
  const match = DECISION_KEY.exec(key);
  return match ? Number(match[1]) : undefined;
}

export function formatDecisionKey(sequence: number): string {
  return `DEC-${sequence}`;
}

function pushError(errors: Record<string, string>, field: string, message: string): void {
  if (!errors[field]) {
    errors[field] = message;
  }
}

function parseLinks(value: unknown, errors: Record<string, string>): DecisionLink[] {
  if (!Array.isArray(value)) {
    pushError(errors, 'links', 'Links must be a list.');
    return [];
  }
  const links: DecisionLink[] = [];
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      pushError(errors, 'links', 'A link is incomplete.');
      return;
    }
    const record = entry as Record<string, unknown>;
    const type = typeof record.type === 'string' ? record.type : '';
    const id = typeof record.id === 'string' ? record.id : '';
    const url = typeof record.url === 'string' ? record.url : '';
    if (!isLinkType(type)) {
      pushError(errors, 'links', 'Link type must be jiraIssue, confluencePage, or bitbucketPr.');
      return;
    }
    const link = canonicalLink({ type, id, url });
    const idError = linkIdError(link);
    if (idError) {
      pushError(errors, `links.${index}`, idError);
      return;
    }
    links.push(link);
  });
  return dedupeLinks(links);
}

function parseOwners(value: unknown, errors: Record<string, string>, allowEmpty: boolean): string[] {
  if (!Array.isArray(value)) {
    pushError(errors, 'ownerAccountIds', 'Add at least one owner.');
    return [];
  }
  const owners: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || !ACCOUNT_ID.test(entry)) {
      pushError(errors, 'ownerAccountIds', 'Owner must be an Atlassian account ID.');
      continue;
    }
    if (!owners.includes(entry)) {
      owners.push(entry);
    }
  }
  if (owners.length === 0 && !allowEmpty) {
    pushError(errors, 'ownerAccountIds', 'Add at least one owner.');
  }
  if (owners.length > 20) {
    pushError(errors, 'ownerAccountIds', 'A decision can have at most 20 owners.');
  }
  return owners;
}

function parseHistory(value: unknown, errors: Record<string, string>): StatusChange[] {
  if (!Array.isArray(value)) {
    pushError(errors, 'statusHistory', 'Status history must be a list.');
    return [];
  }
  const history: StatusChange[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      pushError(errors, 'statusHistory', 'A status history entry is incomplete.');
      continue;
    }
    const record = entry as Record<string, unknown>;
    const at = typeof record.at === 'string' ? record.at : '';
    const from = typeof record.from === 'string' ? record.from : '';
    const to = typeof record.to === 'string' ? record.to : '';
    const reason = typeof record.reason === 'string' ? clean(record.reason) : '';
    if (!at || Number.isNaN(Date.parse(at)) || !isStatus(from) || !isStatus(to)) {
      pushError(errors, 'statusHistory', 'A status history entry is invalid.');
      continue;
    }
    history.push(reason ? { at, from, to, reason } : { at, from, to });
  }
  return history;
}

export function validateDraft(
  input: {
    title?: unknown;
    status?: unknown;
    problem?: unknown;
    optionsConsidered?: unknown;
    chosenOption?: unknown;
    rationale?: unknown;
    consequences?: unknown;
    ownerAccountIds?: unknown;
    links?: unknown;
  },
  options: ValidationOptions = {},
): { ok: true; value: DecisionDraft } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const title = typeof input.title === 'string' ? clean(input.title) : '';
  const problem = typeof input.problem === 'string' ? clean(input.problem) : '';
  const rationale = typeof input.rationale === 'string' ? clean(input.rationale) : '';
  const chosenOption = typeof input.chosenOption === 'string' ? clean(input.chosenOption) : '';
  const consequences = typeof input.consequences === 'string' ? clean(input.consequences) : '';
  const statusText = typeof input.status === 'string' && input.status.trim() ? clean(input.status) : 'proposed';

  if (!title) {
    pushError(errors, 'title', 'Add a title.');
  } else if (title.length > 140) {
    pushError(errors, 'title', 'Title must be 140 characters or fewer.');
  }
  if (!problem) {
    pushError(errors, 'problem', 'Describe the problem.');
  } else if (problem.length > 4000) {
    pushError(errors, 'problem', 'Problem must be 4000 characters or fewer.');
  }
  if (!rationale) {
    pushError(errors, 'rationale', 'Explain why this option was chosen.');
  } else if (rationale.length > 4000) {
    pushError(errors, 'rationale', 'Rationale must be 4000 characters or fewer.');
  }
  if (consequences.length > 4000) {
    pushError(errors, 'consequences', 'Consequences must be 4000 characters or fewer.');
  }
  if (!isStatus(statusText) || statusText === 'superseded' || statusText === 'deprecated') {
    pushError(errors, 'status', 'Status must be proposed or accepted when recording a decision.');
  }

  const optionsConsidered = Array.isArray(input.optionsConsidered)
    ? input.optionsConsidered
        .filter((option): option is string => typeof option === 'string')
        .map(clean)
        .filter((option) => option.length > 0)
    : [];
  if (!Array.isArray(input.optionsConsidered)) {
    pushError(errors, 'optionsConsidered', 'Add the options the team considered.');
  } else if (optionsConsidered.length === 0) {
    pushError(errors, 'optionsConsidered', 'Add at least one option.');
  } else if (optionsConsidered.length > 12) {
    pushError(errors, 'optionsConsidered', 'A decision can list at most 12 options.');
  } else if (optionsConsidered.some((option) => option.length > 500)) {
    pushError(errors, 'optionsConsidered', 'Each option must be 500 characters or fewer.');
  }
  if (!chosenOption) {
    pushError(errors, 'chosenOption', 'Name the chosen option.');
  } else if (optionsConsidered.length > 0 && !optionsConsidered.includes(chosenOption)) {
    pushError(errors, 'chosenOption', 'The chosen option must be one of the options considered.');
  }

  const owners = parseOwners(input.ownerAccountIds ?? [], errors, options.allowEmptyOwners ?? false);
  const links = parseLinks(input.links ?? [], errors);

  if (Object.keys(errors).length > 0 || !isStatus(statusText)) {
    return { ok: false, errors };
  }

  const draft: DecisionDraft = {
    title,
    status: statusText,
    problem,
    optionsConsidered,
    chosenOption,
    rationale,
    ownerAccountIds: owners,
    links,
  };
  if (consequences) {
    draft.consequences = consequences;
  }
  return { ok: true, value: draft };
}

export function validateDecision(
  input: unknown,
  options: ValidationOptions = {},
): { ok: true; value: Decision } | { ok: false; errors: Record<string, string> } {
  if (!input || typeof input !== 'object') {
    return { ok: false, errors: { decision: 'Decision is incomplete.' } };
  }
  const record = input as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const key = typeof record.key === 'string' ? record.key.trim() : '';
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt : '';
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  const status = typeof record.status === 'string' ? record.status : '';

  if (!id || id.length > 80) {
    pushError(errors, 'id', 'Decision id is missing.');
  }
  if (!decisionKeyNumber(key)) {
    pushError(errors, 'key', 'Decision key must look like DEC-12.');
  }
  if (!createdAt || Number.isNaN(Date.parse(createdAt))) {
    pushError(errors, 'createdAt', 'Created time is invalid.');
  }
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) {
    pushError(errors, 'updatedAt', 'Updated time is invalid.');
  }
  if (!isStatus(status)) {
    pushError(errors, 'status', 'Status is invalid.');
  }

  const draftResult = validateDraft(
    {
      title: record.title,
      status: status === 'superseded' || status === 'deprecated' ? 'accepted' : status,
      problem: record.problem,
      optionsConsidered: record.optionsConsidered,
      chosenOption: record.chosenOption,
      rationale: record.rationale,
      consequences: record.consequences,
      ownerAccountIds: record.ownerAccountIds,
      links: record.links,
    },
    options,
  );
  if (!draftResult.ok) {
    Object.assign(errors, draftResult.errors);
    delete errors.status;
  }

  const supersededBy = typeof record.supersededBy === 'string' ? record.supersededBy.trim() : '';
  const supersedeReason = typeof record.supersedeReason === 'string' ? clean(record.supersedeReason) : '';
  if (status === 'superseded') {
    if (!decisionKeyNumber(supersededBy)) {
      pushError(errors, 'supersededBy', 'A superseded decision needs the successor key.');
    }
    if (!supersedeReason) {
      pushError(errors, 'supersedeReason', 'A superseded decision needs a reason.');
    } else if (supersedeReason.length > 1000) {
      pushError(errors, 'supersedeReason', 'Reason must be 1000 characters or fewer.');
    }
    if (supersededBy && supersededBy === key) {
      pushError(errors, 'supersededBy', 'A decision cannot supersede itself.');
    }
  } else if (supersededBy || supersedeReason) {
    pushError(errors, 'supersededBy', 'Only a superseded decision can name a successor.');
  }

  const statusHistory = parseHistory(record.statusHistory ?? [], errors);
  if (Object.keys(errors).length > 0 || !draftResult.ok || !isStatus(status)) {
    return { ok: false, errors };
  }

  const decision: Decision = {
    id,
    key,
    title: draftResult.value.title,
    status,
    problem: draftResult.value.problem,
    optionsConsidered: draftResult.value.optionsConsidered,
    chosenOption: draftResult.value.chosenOption,
    rationale: draftResult.value.rationale,
    ownerAccountIds: draftResult.value.ownerAccountIds,
    links: draftResult.value.links,
    createdAt,
    updatedAt,
    statusHistory,
  };
  if (draftResult.value.consequences) {
    decision.consequences = draftResult.value.consequences;
  }
  if (status === 'superseded') {
    decision.supersededBy = supersededBy;
    decision.supersedeReason = supersedeReason;
  }
  return { ok: true, value: decision };
}

export function contentUpdateAllowed(decision: Decision): boolean {
  return decision.status !== 'superseded';
}
