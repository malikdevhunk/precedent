import { privacy } from '@forge/api';
import { KvsDecisionRepository } from '../storage/kvs-repository';

export async function reportStoredAccounts(): Promise<{ statusCode: number; body: string }> {
  try {
    const repo = new KvsDecisionRepository();
    const decisions = await repo.list();
    const latest = new Map<string, string>();
    for (const decision of decisions) {
      for (const accountId of decision.ownerAccountIds) {
        const current = latest.get(accountId);
        if (!current || decision.updatedAt > current) {
          latest.set(accountId, decision.updatedAt);
        }
      }
    }
    if (latest.size === 0) {
      return { statusCode: 204, body: '' };
    }
    const updates = await privacy.reportPersonalData(
      [...latest.entries()].map(([accountId, updatedAt]) => ({ accountId, updatedAt })),
    );
    const at = new Date().toISOString();
    for (const update of updates) {
      if (update.status === 'closed') {
        await repo.removeOwner(update.accountId, at);
      }
    }
    return { statusCode: 204, body: '' };
  } catch {
    return { statusCode: 500, body: 'Privacy report failed' };
  }
}
