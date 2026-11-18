import { agentDecisionResponse } from '../core/present';
import type { Decision, DomainError, Result } from '../core/types';
import { NO_DECISION_RECORDED } from '../core/types';

export function agentFrom(result: Result<Decision | Decision[]>): { message: string; decisions: ReturnType<typeof agentDecisionResponse>['decisions'] } {
  if (!result.ok) {
    if (result.error.code === 'not_found') {
      return agentDecisionResponse([]);
    }
    return { message: explain(result.error), decisions: [] };
  }
  const decisions = Array.isArray(result.value) ? result.value : [result.value];
  return agentDecisionResponse(decisions);
}

export function uiFrom<T>(result: Result<T>): { ok: false; message: string; fieldErrors?: Record<string, string> } | { ok: true; value: T } {
  if (!result.ok) {
    return {
      ok: false,
      message: result.error.code === 'not_found' ? NO_DECISION_RECORDED : explain(result.error),
      fieldErrors: result.error.fieldErrors,
    };
  }
  return { ok: true, value: result.value };
}

function explain(error: DomainError): string {
  if (!error.fieldErrors) {
    return error.message;
  }
  const details = Object.values(error.fieldErrors).join(' ');
  return details ? `${error.message} ${details}` : error.message;
}
