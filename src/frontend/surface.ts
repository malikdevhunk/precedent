import type { FullContext } from '@forge/bridge';
import { parseBitbucketPullRequestUrl } from '../core/links';
import type { DecisionLink } from '../core/types';

export interface CaptureSeed {
  problem: string;
  links: DecisionLink[];
  closable: boolean;
  hint: string;
}

export type Screen =
  | { name: 'panel'; issueKey: string }
  | { name: 'capture'; seed: CaptureSeed }
  | { name: 'register' }
  | { name: 'page'; pageId: string; pageUrl: string }
  | { name: 'macro' }
  | { name: 'pullRequest'; pullRequestId: string; pullRequestUrl: string }
  | { name: 'unknown' };

function extensionOf(context: FullContext): Record<string, unknown> {
  return (context.extension ?? {}) as Record<string, unknown>;
}

function issueKeyFrom(extension: Record<string, unknown>): string {
  const issue = extension.issue as { key?: unknown } | undefined;
  if (typeof issue?.key === 'string') {
    return issue.key;
  }
  return typeof extension.issueKey === 'string' ? extension.issueKey : '';
}

function pageIdFrom(extension: Record<string, unknown>): string {
  const content = extension.content as { id?: unknown } | undefined;
  return typeof content?.id === 'string' ? content.id : '';
}

function httpsUrl(value: string): string {
  return value.startsWith('https://') ? value : '';
}

function issueLinks(issueKey: string, location: string, siteUrl: string): DecisionLink[] {
  if (!issueKey) {
    return [];
  }
  const url = httpsUrl(location) || (siteUrl ? `${siteUrl.replace(/\/$/, '')}/browse/${issueKey}` : '');
  if (!httpsUrl(url)) {
    return [];
  }
  return [{ type: 'jiraIssue', id: issueKey, url }];
}

function pageLinks(pageId: string, location: string): DecisionLink[] {
  const url = httpsUrl(location);
  if (!pageId || !url) {
    return [];
  }
  return [{ type: 'confluencePage', id: pageId, url }];
}

export function screenFor(context: FullContext): Screen {
  const extension = extensionOf(context);
  const location = typeof extension.location === 'string' ? extension.location : '';
  const issueKey = issueKeyFrom(extension);
  const pageId = pageIdFrom(extension);
  switch (context.moduleKey) {
    case 'precedents-panel':
      return { name: 'panel', issueKey };
    case 'capture-decision':
      return {
        name: 'capture',
        seed: {
          problem: '',
          links: issueLinks(issueKey, location, context.siteUrl ?? ''),
          closable: true,
          hint: issueKey ? `This decision will be linked to ${issueKey}.` : 'Open this action from an issue to link it.',
        },
      };
    case 'capture-from-selection':
      return {
        name: 'capture',
        seed: {
          problem: typeof extension.selectedText === 'string' ? extension.selectedText : '',
          links: pageLinks(pageId, location),
          closable: true,
          hint: 'The selected text is the starting problem. Edit it before you record the decision.',
        },
      };
    case 'decision-register':
      return { name: 'register' };
    case 'precedents-byline':
      return { name: 'page', pageId, pageUrl: httpsUrl(location) };
    case 'precedent-macro':
      return { name: 'macro' };
    case 'precedents-pull-request': {
      const parsed = httpsUrl(location) ? parseBitbucketPullRequestUrl(location) : undefined;
      return {
        name: 'pullRequest',
        pullRequestId: parsed?.id ?? '',
        pullRequestUrl: parsed?.url ?? '',
      };
    }
    default:
      return { name: 'unknown' };
  }
}
