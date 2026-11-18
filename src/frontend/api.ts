import { invoke } from '@forge/bridge';
import type { Decision, DecisionDraft } from '../core/types';

export interface UiFailure {
  ok: false;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface DecisionList {
  ok: true;
  decisions: Decision[];
  message?: string;
}

export interface DecisionOne {
  ok: true;
  decision: Decision;
}

export interface DemoResult {
  ok: true;
  created: number;
  updated: number;
  skipped: number;
  note: string;
}

async function call<T>(name: string, payload?: Record<string, unknown>): Promise<T | UiFailure> {
  try {
    return (await invoke(name, payload)) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Precedent could not complete that request.';
    return { ok: false, message };
  }
}

export function searchDecisions(query: string, status: string): Promise<DecisionList | UiFailure> {
  return call('searchDecisions', { query, status: status === 'any' ? '' : status });
}

export function precedentsForIssue(issueKey: string): Promise<DecisionList | UiFailure> {
  return call('precedentsForIssue', { issueKey });
}

export function precedentsForPage(pageId: string, pageUrl: string, text: string): Promise<DecisionList | UiFailure> {
  return call('precedentsForPage', { pageId, pageUrl, text });
}

export function precedentsForPullRequest(pullRequestId: string, pullRequestUrl: string): Promise<DecisionList | UiFailure> {
  return call('precedentsForPullRequest', { pullRequestId, pullRequestUrl });
}

export function getDecision(decisionKey: string): Promise<DecisionOne | UiFailure> {
  return call('getDecision', { decisionKey });
}

export function recordDecision(draft: DecisionDraft): Promise<DecisionOne | UiFailure> {
  return call('recordDecision', { ...draft });
}

export function supersedeDecision(decisionKey: string, successorKey: string, reason: string): Promise<DecisionOne | UiFailure> {
  return call('supersedeDecision', { decisionKey, successorKey, reason });
}

export function loadDemo(payload: Record<string, string>): Promise<DemoResult | UiFailure> {
  return call('loadDemo', payload);
}
