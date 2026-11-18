import { linkIdentity } from './links';
import type { Decision, DecisionLink } from './types';

export interface DecisionRepository {
  getById(id: string): Promise<Decision | undefined>;
  getByKey(key: string): Promise<Decision | undefined>;
  list(): Promise<Decision[]>;
  findByLinks(links: DecisionLink[]): Promise<Decision[]>;
  save(decision: Decision): Promise<void>;
  nextSequence(): Promise<number>;
  setSequenceFloor(value: number): Promise<void>;
  removeOwner(accountId: string, at: string): Promise<number>;
}

export class MemoryDecisionRepository implements DecisionRepository {
  private readonly decisions = new Map<string, Decision>();
  private sequence = 0;

  async getById(id: string): Promise<Decision | undefined> {
    const decision = this.decisions.get(id);
    return decision ? structuredClone(decision) : undefined;
  }

  async getByKey(key: string): Promise<Decision | undefined> {
    const decision = [...this.decisions.values()].find((item) => item.key === key);
    return decision ? structuredClone(decision) : undefined;
  }

  async list(): Promise<Decision[]> {
    return [...this.decisions.values()]
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .map((decision) => structuredClone(decision));
  }

  async findByLinks(links: DecisionLink[]): Promise<Decision[]> {
    const wanted = new Set(links.map((link) => linkIdentity(link)));
    return [...this.decisions.values()]
      .filter((decision) => decision.links.some((link) => wanted.has(linkIdentity(link))))
      .map((decision) => structuredClone(decision));
  }

  async save(decision: Decision): Promise<void> {
    this.decisions.set(decision.id, structuredClone(decision));
  }

  async nextSequence(): Promise<number> {
    this.sequence += 1;
    return this.sequence;
  }

  async setSequenceFloor(value: number): Promise<void> {
    if (value > this.sequence) {
      this.sequence = value;
    }
  }

  async removeOwner(accountId: string, at: string): Promise<number> {
    let count = 0;
    for (const decision of this.decisions.values()) {
      if (!decision.ownerAccountIds.includes(accountId)) {
        continue;
      }
      decision.ownerAccountIds = decision.ownerAccountIds.filter((id) => id !== accountId);
      decision.updatedAt = at;
      count += 1;
    }
    return count;
  }
}
