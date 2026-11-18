import api, { route } from '@forge/api';
import { linkIdentity } from '../core/links';
import type { LinkVisibility } from '../core/service';
import type { DecisionLink } from '../core/types';
import { extractIssueKeys } from '../core/text';

export function productVisibility(): LinkVisibility {
  const cache = new Map<string, Promise<boolean>>();
  return {
    canView(link) {
      const identity = linkIdentity(link);
      const cached = cache.get(identity);
      if (cached) {
        return cached;
      }
      const pending = canViewLink(link).catch(() => false);
      cache.set(identity, pending);
      return pending;
    },
  };
}

async function canViewLink(link: DecisionLink): Promise<boolean> {
  if (link.type === 'jiraIssue') {
    const response = await api.asUser().requestJira(route`/rest/api/3/issue/${link.id}?fields=summary`);
    return response.ok;
  }
  if (link.type === 'confluencePage') {
    const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${link.id}`);
    return response.ok;
  }
  const parts = link.id.split('/');
  if (parts.length !== 3) {
    return false;
  }
  const [workspace, repo, pullRequestId] = parts;
  const response = await api
    .asUser()
    .requestBitbucket(route`/2.0/repositories/${workspace}/${repo}/pullrequests/${pullRequestId}`);
  return response.ok;
}

export interface VisibleIssue {
  link: DecisionLink;
  summary: string;
}

export async function readVisibleIssue(issueKey: string): Promise<VisibleIssue | undefined> {
  const key = issueKey.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9]+-\d+$/.test(key)) {
    return undefined;
  }
  const response = await api.asUser().requestJira(route`/rest/api/3/issue/${key}?fields=summary`);
  if (!response.ok) {
    return undefined;
  }
  const body = (await response.json()) as { self?: unknown; fields?: { summary?: unknown } };
  const self = typeof body.self === 'string' ? body.self : '';
  const site = self.replace(/\/rest\/api\/3\/issue\/.*$/, '');
  const summary = typeof body.fields?.summary === 'string' ? body.fields.summary : '';
  if (!site.startsWith('https://')) {
    return undefined;
  }
  return {
    link: { type: 'jiraIssue', id: key, url: `${site}/browse/${key}` },
    summary,
  };
}

export async function readVisiblePage(pageId: string, pageUrl: string): Promise<DecisionLink | undefined> {
  if (!/^\d{1,20}$/.test(pageId) || !pageUrl.startsWith('https://')) {
    return undefined;
  }
  const response = await api.asUser().requestConfluence(route`/wiki/api/v2/pages/${pageId}`);
  if (!response.ok) {
    return undefined;
  }
  return { type: 'confluencePage', id: pageId, url: pageUrl };
}

export interface VisiblePullRequest {
  link: DecisionLink;
  text: string;
  relatedIssueKeys: string[];
}

export async function readVisiblePullRequest(pullRequestId: string, pageUrl?: string): Promise<VisiblePullRequest | undefined> {
  const parts = pullRequestId.split('/');
  if (parts.length !== 3) {
    return undefined;
  }
  const [workspace, repo, pullRequestNumber] = parts;
  const response = await api
    .asUser()
    .requestBitbucket(route`/2.0/repositories/${workspace}/${repo}/pullrequests/${pullRequestNumber}`);
  if (!response.ok) {
    return undefined;
  }
  const body = (await response.json()) as {
    title?: unknown;
    description?: unknown;
    source?: { branch?: { name?: unknown } };
    links?: { html?: { href?: unknown } };
  };
  const html = typeof body.links?.html?.href === 'string' ? body.links.html.href : pageUrl;
  if (!html || !html.startsWith('https://')) {
    return undefined;
  }
  const title = typeof body.title === 'string' ? body.title : '';
  const description = typeof body.description === 'string' ? body.description : '';
  const branch = typeof body.source?.branch?.name === 'string' ? body.source.branch.name : '';
  const text = [title, description, branch].filter(Boolean).join('\n');
  return {
    link: { type: 'bitbucketPr', id: `${workspace}/${repo}/${pullRequestNumber}`, url: html },
    text,
    relatedIssueKeys: extractIssueKeys(text),
  };
}
