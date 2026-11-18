import { kvs, Sort, WhereConditions } from '@forge/kvs';
import { linkIdentity } from '../core/links';
import type { DecisionRepository } from '../core/repository';
import type { Decision, DecisionLink, DecisionStatus, StatusChange } from '../core/types';
import { validateDecision } from '../core/validate';

const DECISION_ENTITY = 'decision';
const LINK_ENTITY = 'decision-link';
const SEQUENCE_KEY = 'decision-sequence';
const PAGE_SIZE = 50;
const MAX_DECISIONS = 500;

interface StoredDecision {
  bucket: 'all';
  decisionKey: string;
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

interface StoredLink {
  linkKey: string;
  decisionId: string;
  updatedAt: string;
}

function toStored(decision: Decision): StoredDecision {
  const stored: StoredDecision = {
    bucket: 'all',
    decisionKey: decision.key,
    title: decision.title,
    status: decision.status,
    problem: decision.problem,
    optionsConsidered: decision.optionsConsidered,
    chosenOption: decision.chosenOption,
    rationale: decision.rationale,
    ownerAccountIds: decision.ownerAccountIds,
    links: decision.links,
    createdAt: decision.createdAt,
    updatedAt: decision.updatedAt,
    statusHistory: decision.statusHistory,
  };
  if (decision.consequences) {
    stored.consequences = decision.consequences;
  }
  if (decision.supersededBy) {
    stored.supersededBy = decision.supersededBy;
  }
  if (decision.supersedeReason) {
    stored.supersedeReason = decision.supersedeReason;
  }
  return stored;
}

function fromStored(id: string, stored: StoredDecision): Decision | undefined {
  const result = validateDecision(
    {
      id,
      key: stored.decisionKey,
      title: stored.title,
      status: stored.status,
      problem: stored.problem,
      optionsConsidered: stored.optionsConsidered,
      chosenOption: stored.chosenOption,
      rationale: stored.rationale,
      consequences: stored.consequences,
      ownerAccountIds: stored.ownerAccountIds,
      links: stored.links,
      supersededBy: stored.supersededBy,
      supersedeReason: stored.supersedeReason,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      statusHistory: stored.statusHistory,
    },
    { allowEmptyOwners: true },
  );
  return result.ok ? result.value : undefined;
}

function linkRowKey(decisionId: string, link: DecisionLink): string {
  return `${linkIdentity(link)}#${decisionId}`;
}

export class KvsDecisionRepository implements DecisionRepository {
  async getById(id: string): Promise<Decision | undefined> {
    const stored = await kvs.entity<StoredDecision>(DECISION_ENTITY).get(id);
    return stored ? fromStored(id, stored) : undefined;
  }

  async getByKey(key: string): Promise<Decision | undefined> {
    const found = await kvs
      .entity<StoredDecision>(DECISION_ENTITY)
      .query()
      .index('decisionKey')
      .where(WhereConditions.equalTo(key))
      .getOne();
    return found ? fromStored(found.key, found.value) : undefined;
  }

  async list(): Promise<Decision[]> {
    const decisions: Decision[] = [];
    let cursor: string | undefined;
    do {
      let query = kvs
        .entity<StoredDecision>(DECISION_ENTITY)
        .query()
        .index('by-updated', { partition: ['all'] })
        .sort(Sort.DESC)
        .limit(PAGE_SIZE);
      if (cursor) {
        query = query.cursor(cursor);
      }
      const page = await query.getMany();
      for (const row of page.results) {
        const decision = fromStored(row.key, row.value);
        if (decision) {
          decisions.push(decision);
        }
      }
      cursor = page.nextCursor;
    } while (cursor && decisions.length < MAX_DECISIONS);
    return decisions;
  }

  async findByLinks(links: DecisionLink[]): Promise<Decision[]> {
    const ids = new Set<string>();
    for (const link of links) {
      const page = await kvs
        .entity<StoredLink>(LINK_ENTITY)
        .query()
        .index('by-link', { partition: [linkIdentity(link)] })
        .limit(PAGE_SIZE)
        .getMany();
      for (const row of page.results) {
        ids.add(row.value.decisionId);
      }
    }
    const decisions: Decision[] = [];
    for (const id of ids) {
      const decision = await this.getById(id);
      if (decision) {
        decisions.push(decision);
      }
    }
    return decisions;
  }

  async save(decision: Decision): Promise<void> {
    await kvs.entity<StoredDecision>(DECISION_ENTITY).set(decision.id, toStored(decision));
    const existing = await kvs
      .entity<StoredLink>(LINK_ENTITY)
      .query()
      .index('by-decision', { partition: [decision.id] })
      .limit(PAGE_SIZE)
      .getMany();
    const desired = new Map(decision.links.map((link) => [linkRowKey(decision.id, link), link]));
    for (const row of existing.results) {
      if (!desired.has(row.key)) {
        await kvs.entity(LINK_ENTITY).delete(row.key);
      }
    }
    for (const [key, link] of desired) {
      await kvs.entity<StoredLink>(LINK_ENTITY).set(key, {
        linkKey: linkIdentity(link),
        decisionId: decision.id,
        updatedAt: decision.updatedAt,
      });
    }
  }

  async nextSequence(): Promise<number> {
    const current = (await kvs.get<number>(SEQUENCE_KEY)) ?? 0;
    const next = current + 1;
    await kvs.set(SEQUENCE_KEY, next);
    return next;
  }

  async setSequenceFloor(value: number): Promise<void> {
    const current = (await kvs.get<number>(SEQUENCE_KEY)) ?? 0;
    if (value > current) {
      await kvs.set(SEQUENCE_KEY, value);
    }
  }

  async removeOwner(accountId: string, at: string): Promise<number> {
    const decisions = await this.list();
    let count = 0;
    for (const decision of decisions) {
      if (!decision.ownerAccountIds.includes(accountId)) {
        continue;
      }
      await this.save({
        ...decision,
        ownerAccountIds: decision.ownerAccountIds.filter((id) => id !== accountId),
        updatedAt: at,
      });
      count += 1;
    }
    return count;
  }
}
