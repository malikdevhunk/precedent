import Resolver from '@forge/resolver';
import { actorAccountId } from '../core/action-input';
import { parseBitbucketPullRequestUrl } from '../core/links';
import type { DecisionLink } from '../core/types';
import { NO_DECISION_RECORDED } from '../core/types';
import { buildSeedDecisions, type SeedLinks } from '../demo/seed-data';
import { appService } from './app';
import { uiFrom } from './http';
import { readVisibleIssue, readVisiblePage, readVisiblePullRequest } from './visibility';

const resolver = new Resolver();

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

resolver.define('searchDecisions', async ({ payload }) => {
  const status = text(payload?.status);
  const result = await appService().search(text(payload?.query), status || undefined);
  const ui = uiFrom(result);
  if (!ui.ok) {
    return ui;
  }
  return {
    ok: true,
    decisions: ui.value,
    message: ui.value.length === 0 ? NO_DECISION_RECORDED : undefined,
  };
});

resolver.define('getDecision', async ({ payload }) => {
  const ui = uiFrom(await appService().get(text(payload?.decisionKey)));
  if (!ui.ok) {
    return ui;
  }
  return { ok: true, decision: ui.value };
});

resolver.define('recordDecision', async ({ payload, context }) => {
  const ui = uiFrom(
    await appService().create(
      {
        title: payload?.title,
        problem: payload?.problem,
        optionsConsidered: payload?.optionsConsidered,
        chosenOption: payload?.chosenOption,
        rationale: payload?.rationale,
        consequences: payload?.consequences,
        status: payload?.status,
        ownerAccountIds: payload?.ownerAccountIds,
        links: payload?.links,
      },
      actorAccountId(context),
    ),
  );
  if (!ui.ok) {
    return ui;
  }
  return { ok: true, decision: ui.value };
});

resolver.define('linkDecision', async ({ payload }) => {
  const ui = uiFrom(await appService().link(text(payload?.decisionKey), payload?.link as DecisionLink));
  if (!ui.ok) {
    return ui;
  }
  return { ok: true, decision: ui.value };
});

resolver.define('supersedeDecision', async ({ payload }) => {
  const ui = uiFrom(
    await appService().supersede(text(payload?.decisionKey), text(payload?.successorKey), text(payload?.reason)),
  );
  if (!ui.ok) {
    return ui;
  }
  return { ok: true, decision: ui.value };
});

resolver.define('precedentsForIssue', async ({ payload }) => {
  const issue = await readVisibleIssue(text(payload?.issueKey));
  if (!issue) {
    return { ok: true, decisions: [], message: NO_DECISION_RECORDED };
  }
  const ui = uiFrom(
    await appService().precedents({
      links: [issue.link],
      relatedIssueKeys: [],
      text: issue.summary,
      now: new Date().toISOString(),
    }),
  );
  if (!ui.ok) {
    return ui;
  }
  return {
    ok: true,
    decisions: ui.value,
    message: ui.value.length === 0 ? NO_DECISION_RECORDED : undefined,
  };
});

resolver.define('precedentsForPage', async ({ payload }) => {
  const page = await readVisiblePage(text(payload?.pageId), text(payload?.pageUrl));
  if (!page) {
    return { ok: true, decisions: [], message: NO_DECISION_RECORDED };
  }
  const ui = uiFrom(
    await appService().precedents({
      links: [page],
      relatedIssueKeys: [],
      text: text(payload?.text),
      now: new Date().toISOString(),
    }),
  );
  if (!ui.ok) {
    return ui;
  }
  return {
    ok: true,
    decisions: ui.value,
    message: ui.value.length === 0 ? NO_DECISION_RECORDED : undefined,
  };
});

resolver.define('precedentsForPullRequest', async ({ payload }) => {
  const parsed = parseBitbucketPullRequestUrl(text(payload?.pullRequestUrl));
  const pullRequestId = text(payload?.pullRequestId) || parsed?.id || '';
  const pullRequest = await readVisiblePullRequest(pullRequestId, text(payload?.pullRequestUrl) || parsed?.url);
  if (!pullRequest) {
    return { ok: true, decisions: [], message: NO_DECISION_RECORDED };
  }
  const ui = uiFrom(
    await appService().precedents({
      links: [pullRequest.link],
      relatedIssueKeys: pullRequest.relatedIssueKeys,
      text: pullRequest.text,
      now: new Date().toISOString(),
    }),
  );
  if (!ui.ok) {
    return ui;
  }
  return {
    ok: true,
    decisions: ui.value,
    message: ui.value.length === 0 ? NO_DECISION_RECORDED : undefined,
  };
});

resolver.define('loadDemo', async ({ payload, context }) => {
  const actor = actorAccountId(context);
  if (!actor) {
    return { ok: false, message: 'Sign in is required to load the demo decisions.' };
  }
  const links: SeedLinks = {};
  const notes: string[] = [];
  const issueKey = text(payload?.jiraIssueKey);
  if (issueKey) {
    const issue = await readVisibleIssue(issueKey);
    if (issue) {
      links.jira = issue.link;
    } else {
      notes.push('The Jira issue was not linked because it is not visible.');
    }
  }
  const pageId = text(payload?.confluencePageId);
  const pageUrl = text(payload?.confluencePageUrl);
  if (pageId) {
    const page = await readVisiblePage(pageId, pageUrl);
    if (page) {
      links.page = page;
    } else {
      notes.push('The Confluence page was not linked because it is not visible.');
    }
  }
  const pullRequestUrl = text(payload?.bitbucketPrUrl);
  const parsed = pullRequestUrl ? parseBitbucketPullRequestUrl(pullRequestUrl) : undefined;
  const pullRequestId = text(payload?.bitbucketPrId) || parsed?.id || '';
  if (pullRequestId) {
    const pullRequest = await readVisiblePullRequest(pullRequestId, pullRequestUrl || parsed?.url);
    if (pullRequest) {
      links.pullRequest = pullRequest.link;
    } else {
      notes.push('The pull request was not linked because it is not visible.');
    }
  }
  const ui = uiFrom(await appService().importDecisions(buildSeedDecisions(actor, links)));
  if (!ui.ok) {
    return ui;
  }
  return {
    ok: true,
    created: ui.value.created,
    updated: ui.value.updated,
    skipped: ui.value.skipped,
    note: notes.join(' '),
  };
});

export const handler = resolver.getDefinitions();
