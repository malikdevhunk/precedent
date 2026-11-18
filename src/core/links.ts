import type { DecisionLink, LinkType } from './types';
import { LINK_TYPES } from './types';

const JIRA_KEY = /^[A-Z][A-Z0-9]+-\d+$/;
const PAGE_ID = /^\d{1,20}$/;
const PULL_REQUEST_ID = /^[a-z0-9._-]+\/[a-z0-9._-]+\/\d+$/;
const HTTPS_URL = /^https:\/\/[^\s]+$/;

export function isLinkType(value: string): value is LinkType {
  return (LINK_TYPES as readonly string[]).includes(value);
}

export function canonicalLink(link: DecisionLink): DecisionLink {
  const url = link.url.trim();
  if (link.type === 'jiraIssue') {
    return { type: link.type, id: link.id.trim().toUpperCase(), url };
  }
  if (link.type === 'bitbucketPr') {
    const trimmed = link.id.trim().toLowerCase();
    return { type: link.type, id: trimmed, url };
  }
  return { type: link.type, id: link.id.trim(), url };
}

export function linkIdentity(link: DecisionLink): string {
  const canonical = canonicalLink(link);
  return `${canonical.type}:${canonical.id}`;
}

export function linkIdError(link: DecisionLink): string | undefined {
  const canonical = canonicalLink(link);
  if (canonical.type === 'jiraIssue' && !JIRA_KEY.test(canonical.id)) {
    return 'Use a Jira issue key such as PAY-42.';
  }
  if (canonical.type === 'confluencePage' && !PAGE_ID.test(canonical.id)) {
    return 'Use the numeric Confluence page id.';
  }
  if (canonical.type === 'bitbucketPr' && !PULL_REQUEST_ID.test(canonical.id)) {
    return 'Use a pull request id in the form workspace/repo/123.';
  }
  if (!HTTPS_URL.test(canonical.url) || canonical.url.length > 2000) {
    return 'Link URL must be an https URL.';
  }
  return undefined;
}

export function parseBitbucketPullRequestUrl(url: string): { id: string; url: string } | undefined {
  const match = /^https:\/\/[^/\s]+\/([^/\s]+)\/([^/\s]+)\/pull-requests\/(\d+)(?:[/?#]|$)/.exec(
    url.trim(),
  );
  if (!match) {
    return undefined;
  }
  return {
    id: `${match[1].toLowerCase()}/${match[2].toLowerCase()}/${match[3]}`,
    url: url.trim(),
  };
}

export function dedupeLinks(links: DecisionLink[]): DecisionLink[] {
  const seen = new Set<string>();
  const result: DecisionLink[] = [];
  for (const link of links) {
    const canonical = canonicalLink(link);
    const identity = linkIdentity(canonical);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    result.push(canonical);
  }
  return result;
}
