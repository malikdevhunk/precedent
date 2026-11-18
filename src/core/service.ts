import { linkIdentity } from './links';
import { applyVisibility } from './permissions';
import { presentDecision } from './present';
import { rankDecisions } from './rank';
import type { DecisionRepository } from './repository';
import { appliedSupersessionViolation, supersedeViolation } from './supersede';
import { tokens } from './text';
import {
  DECISION_STATUSES,
  NO_DECISION_RECORDED,
  type Decision,
  type DecisionDraft,
  type DecisionLink,
  type DomainError,
  type RankContext,
  type Result,
} from './types';
import { contentUpdateAllowed, decisionKeyNumber, formatDecisionKey, validateDecision, validateDraft } from './validate';

const SEARCH_LIMIT = 25;
const PRECEDENT_LIMIT = 8;

export interface LinkVisibility {
  canView(link: DecisionLink): Promise<boolean>;
}

export interface ServiceDeps {
  repo: DecisionRepository;
  visibility: LinkVisibility;
  now: () => string;
  newId: () => string;
}

export interface ImportSummary {
  created: number;
  updated: number;
  skipped: number;
}

async function visibleCopy(decision: Decision, visibility: LinkVisibility): Promise<Decision | null> {
  if (decision.links.length === 0) {
    return decision;
  }
  const visible = new Set<string>();
  for (const link of decision.links) {
    if (await visibility.canView(link)) {
      visible.add(linkIdentity(link));
    }
  }
  return applyVisibility(decision, visible);
}

async function filterAll(decisions: Decision[], visibility: LinkVisibility): Promise<Decision[]> {
  const unique = new Map<string, DecisionLink>();
  for (const decision of decisions) {
    for (const link of decision.links) {
      unique.set(linkIdentity(link), link);
    }
  }
  const visible = new Set<string>();
  await Promise.all(
    [...unique.values()].map(async (link) => {
      if (await visibility.canView(link)) {
        visible.add(linkIdentity(link));
      }
    }),
  );
  return decisions.flatMap((decision) => {
    const filtered = applyVisibility(decision, visible);
    return filtered ? [filtered] : [];
  });
}

function failure(error: DomainError): Result<never> {
  return { ok: false, error };
}

export function createDecisionService(deps: ServiceDeps) {
  async function requireVisible(key: string): Promise<Result<Decision>> {
    const decision = await deps.repo.getByKey(key);
    if (!decision) {
      return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
    }
    const visible = await visibleCopy(decision, deps.visibility);
    if (!visible) {
      return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
    }
    return { ok: true, value: visible };
  }

  async function assertLinksVisible(links: DecisionLink[]): Promise<Result<void>> {
    for (const link of links) {
      if (!(await deps.visibility.canView(link))) {
        return failure({ code: 'link_not_visible', message: 'That link is not visible to you.' });
      }
    }
    return { ok: true, value: undefined };
  }

  return {
    async create(draftInput: Parameters<typeof validateDraft>[0], actorAccountId?: string): Promise<Result<Decision>> {
      const owners = Array.isArray(draftInput.ownerAccountIds) ? draftInput.ownerAccountIds : [];
      const withOwner =
        owners.length === 0 && actorAccountId
          ? { ...draftInput, ownerAccountIds: [actorAccountId] }
          : draftInput;
      const draft = validateDraft(withOwner);
      if (!draft.ok) {
        return failure({ code: 'validation', message: 'Check the highlighted fields.', fieldErrors: draft.errors });
      }
      const visible = await assertLinksVisible(draft.value.links);
      if (!visible.ok) {
        return visible;
      }
      const at = deps.now();
      const sequence = await deps.repo.nextSequence();
      const decision: Decision = {
        ...draft.value,
        id: deps.newId(),
        key: formatDecisionKey(sequence),
        createdAt: at,
        updatedAt: at,
        statusHistory: [{ at, from: draft.value.status, to: draft.value.status, reason: 'Recorded' }],
      };
      const stored = validateDecision(decision);
      if (!stored.ok) {
        return failure({ code: 'validation', message: 'Check the highlighted fields.', fieldErrors: stored.errors });
      }
      await deps.repo.save(stored.value);
      return { ok: true, value: stored.value };
    },

    async get(key: string): Promise<Result<Decision>> {
      return requireVisible(key);
    },

    async search(query: string, status?: string): Promise<Result<Decision[]>> {
      if (status && !(DECISION_STATUSES as readonly string[]).includes(status)) {
        return failure({
          code: 'validation',
          message: 'Status must be proposed, accepted, superseded, or deprecated.',
        });
      }
      if (query.trim() && tokens(query).length === 0) {
        return { ok: true, value: [] };
      }
      const all = await filterAll(await deps.repo.list(), deps.visibility);
      const filtered = status ? all.filter((decision) => decision.status === status) : all;
      if (!query.trim()) {
        const ranked = rankDecisions(filtered, { links: [], relatedIssueKeys: [], text: '', now: deps.now() });
        return { ok: true, value: ranked.slice(0, SEARCH_LIMIT).map((item) => item.decision) };
      }
      const ranked = rankDecisions(filtered, {
        links: [],
        relatedIssueKeys: [],
        text: query,
        now: deps.now(),
      });
      return {
        ok: true,
        value: keepWithSuccessors(ranked, (item) => item.textScore > 0).slice(0, SEARCH_LIMIT),
      };
    },

    async precedents(context: RankContext): Promise<Result<Decision[]>> {
      const linked = context.links.length > 0 ? await deps.repo.findByLinks(context.links) : [];
      const listed = context.text.trim() ? await deps.repo.list() : [];
      const successorKeys = [...linked, ...listed]
        .map((decision) => decision.supersededBy)
        .filter((key): key is string => Boolean(key));
      const loadedSuccessors = (
        await Promise.all(successorKeys.map((key) => deps.repo.getByKey(key)))
      ).filter((decision): decision is Decision => Boolean(decision));
      const byId = new Map<string, Decision>();
      for (const decision of [...linked, ...listed, ...loadedSuccessors]) {
        byId.set(decision.id, decision);
      }
      const visible = await filterAll([...byId.values()], deps.visibility);
      const ranked = rankDecisions(visible, context, visible);
      return {
        ok: true,
        value: keepWithSuccessors(
          ranked,
          (item) => item.sharedLinkCount > 0 || item.relatedIssueCount > 0 || item.textScore > 0,
        ).slice(0, PRECEDENT_LIMIT),
      };
    },

    async link(key: string, link: DecisionLink): Promise<Result<Decision>> {
      const existing = await deps.repo.getByKey(key);
      if (!existing) {
        return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
      }
      const visibleExisting = await visibleCopy(existing, deps.visibility);
      if (!visibleExisting) {
        return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
      }
      if (!contentUpdateAllowed(existing)) {
        return failure({
          code: 'read_only',
          message: 'This decision is superseded and cannot be changed.',
        });
      }
      const draft = validateDraft({ ...toDraft(existing), links: [...existing.links, link] });
      if (!draft.ok) {
        return failure({ code: 'validation', message: 'Check the highlighted fields.', fieldErrors: draft.errors });
      }
      const added = draft.value.links.find((item) => !existing.links.some((current) => linkIdentity(current) === linkIdentity(item)));
      if (!added) {
        return { ok: true, value: visibleExisting };
      }
      const visible = await assertLinksVisible([added]);
      if (!visible.ok) {
        return visible;
      }
      const updated: Decision = {
        ...existing,
        links: draft.value.links,
        updatedAt: deps.now(),
      };
      await deps.repo.save(updated);
      const shown = await visibleCopy(updated, deps.visibility);
      return shown ? { ok: true, value: shown } : failure({ code: 'not_found', message: NO_DECISION_RECORDED });
    },

    async supersede(key: string, successorKey: string, reason: string): Promise<Result<Decision>> {
      const target = await deps.repo.getByKey(key);
      const successor = await deps.repo.getByKey(successorKey);
      if (!target || !(await visibleCopy(target, deps.visibility))) {
        return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
      }
      if (!successor || !(await visibleCopy(successor, deps.visibility))) {
        return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
      }
      const universe = await deps.repo.list();
      const violation = supersedeViolation(target, successor, universe, reason);
      if (violation === 'already_superseded') {
        return failure({ code: 'read_only', message: 'This decision is superseded and cannot be changed.' });
      }
      if (violation === 'cycle' || violation === 'self') {
        return failure({ code: 'cycle', message: 'That successor would create a cycle.' });
      }
      if (violation === 'bad_successor_status') {
        return failure({
          code: 'invalid_successor',
          message: 'The successor must be a proposed or accepted decision.',
        });
      }
      if (violation === 'reason') {
        return failure({
          code: 'validation',
          message: 'Add a reason.',
          fieldErrors: { reason: 'Add a reason.' },
        });
      }
      if (violation) {
        return failure({ code: 'not_found', message: NO_DECISION_RECORDED });
      }
      const at = deps.now();
      const updated: Decision = {
        ...target,
        status: 'superseded',
        supersededBy: successor.key,
        supersedeReason: reason.trim(),
        updatedAt: at,
        statusHistory: [
          ...target.statusHistory,
          { at, from: target.status, to: 'superseded', reason: reason.trim() },
        ],
      };
      const stored = validateDecision(updated);
      if (!stored.ok) {
        return failure({ code: 'validation', message: 'Check the highlighted fields.', fieldErrors: stored.errors });
      }
      await deps.repo.save(stored.value);
      const shown = await visibleCopy(stored.value, deps.visibility);
      return shown ? { ok: true, value: shown } : failure({ code: 'not_found', message: NO_DECISION_RECORDED });
    },

    async importDecisions(decisions: Decision[]): Promise<Result<ImportSummary>> {
      const summary: ImportSummary = { created: 0, updated: 0, skipped: 0 };
      const ordered = [...decisions].sort((left, right) => {
        return Number(left.status === 'superseded') - Number(right.status === 'superseded');
      });
      let floor = 0;
      for (const candidate of ordered) {
        const stored = validateDecision(candidate);
        if (!stored.ok) {
          return failure({
            code: 'validation',
            message: 'Demo decision is invalid.',
            fieldErrors: stored.errors,
          });
        }
        const keyNumber = decisionKeyNumber(stored.value.key) ?? 0;
        floor = Math.max(floor, keyNumber);
        if (stored.value.status === 'superseded') {
          const successor = await deps.repo.getByKey(stored.value.supersededBy ?? '');
          const violation = appliedSupersessionViolation(stored.value, successor, await deps.repo.list());
          if (violation) {
            return failure({ code: 'validation', message: 'Demo decision breaks the supersede rules.' });
          }
        }
        const existing = await deps.repo.getByKey(stored.value.key);
        if (!existing) {
          await deps.repo.save(stored.value);
          summary.created += 1;
          continue;
        }
        if (!contentUpdateAllowed(existing)) {
          summary.skipped += 1;
          continue;
        }
        const missing = stored.value.links.filter(
          (link) => !existing.links.some((current) => linkIdentity(current) === linkIdentity(link)),
        );
        if (missing.length === 0) {
          summary.skipped += 1;
          continue;
        }
        await deps.repo.save({
          ...existing,
          links: [...existing.links, ...missing],
          updatedAt: deps.now(),
        });
        summary.updated += 1;
      }
      await deps.repo.setSequenceFloor(floor);
      return { ok: true, value: summary };
    },

    present: presentDecision,
  };
}

function keepWithSuccessors(
  ranked: { decision: Decision; score: number; textScore: number; sharedLinkCount: number; relatedIssueCount: number }[],
  predicate: (item: (typeof ranked)[number]) => boolean,
): Decision[] {
  const matched = ranked.filter(predicate);
  const keys = new Set(matched.map((item) => item.decision.key));
  for (const item of ranked) {
    if (keys.has(item.decision.key)) {
      continue;
    }
    if (matched.some((rel) => rel.decision.supersededBy === item.decision.key)) {
      matched.push(item);
      keys.add(item.decision.key);
    }
  }
  matched.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.decision.key.localeCompare(right.decision.key);
  });
  return matched.map((item) => item.decision);
}

function toDraft(decision: Decision): DecisionDraft {
  return {
    title: decision.title,
    status: decision.status === 'superseded' || decision.status === 'deprecated' ? 'accepted' : decision.status,
    problem: decision.problem,
    optionsConsidered: decision.optionsConsidered,
    chosenOption: decision.chosenOption,
    rationale: decision.rationale,
    consequences: decision.consequences,
    ownerAccountIds: decision.ownerAccountIds,
    links: decision.links,
  };
}
