import { actorAccountId, readAccountIds, readLines, readString } from '../core/action-input';
import type { DecisionLink, LinkType } from '../core/types';
import { isLinkType } from '../core/links';
import { appService } from './app';
import { agentFrom } from './http';
import { readVisibleIssue } from './visibility';

function optionalLink(payload: unknown): DecisionLink[] {
  const linkType = readString(payload, 'linkType');
  const linkId = readString(payload, 'linkId');
  const linkUrl = readString(payload, 'linkUrl');
  if (!linkType && !linkId && !linkUrl) {
    return [];
  }
  return [{ type: linkType as LinkType, id: linkId, url: linkUrl }];
}

export async function searchDecisions(payload: unknown) {
  const status = readString(payload, 'status');
  const result = await appService().search(readString(payload, 'query'), status || undefined);
  return agentFrom(result);
}

export async function getDecision(payload: unknown) {
  return agentFrom(await appService().get(readString(payload, 'decisionKey')));
}

export async function recordDecision(payload: unknown, context?: unknown) {
  const status = readString(payload, 'status');
  const result = await appService().create(
    {
      title: readString(payload, 'title'),
      problem: readString(payload, 'problem'),
      optionsConsidered: readLines(payload, 'optionsConsidered'),
      chosenOption: readString(payload, 'chosenOption'),
      rationale: readString(payload, 'rationale'),
      consequences: readString(payload, 'consequences'),
      status: status || 'proposed',
      ownerAccountIds: readAccountIds(payload, 'ownerAccountIds'),
      links: optionalLink(payload),
    },
    actorAccountId(context),
  );
  return agentFrom(result);
}

export async function linkDecision(payload: unknown) {
  const linkType = readString(payload, 'linkType');
  const link: DecisionLink = {
    type: isLinkType(linkType) ? linkType : 'jiraIssue',
    id: readString(payload, 'linkId'),
    url: readString(payload, 'linkUrl'),
  };
  if (!isLinkType(linkType)) {
    link.type = 'jiraIssue';
    link.id = '';
  }
  return agentFrom(await appService().link(readString(payload, 'decisionKey'), link));
}

export async function supersedeDecision(payload: unknown) {
  return agentFrom(
    await appService().supersede(
      readString(payload, 'decisionKey'),
      readString(payload, 'successorKey'),
      readString(payload, 'reason'),
    ),
  );
}

export async function precedentsForIssue(payload: unknown) {
  const issue = await readVisibleIssue(readString(payload, 'issueKey'));
  if (!issue) {
    return agentFrom({ ok: true, value: [] });
  }
  const result = await appService().precedents({
    links: [issue.link],
    relatedIssueKeys: [],
    text: `${issue.summary}\n${readString(payload, 'query')}`.trim(),
    now: new Date().toISOString(),
  });
  return agentFrom(result);
}
