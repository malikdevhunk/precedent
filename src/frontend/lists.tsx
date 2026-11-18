import React, { useEffect, useState } from 'react';
import { Button, EmptyState, Stack } from '@forge/react';
import type { Decision } from '../core/types';
import { NO_DECISION_RECORDED } from '../core/types';
import { getDecision, loadDemo, precedentsForIssue, precedentsForPage, precedentsForPullRequest } from './api';
import { DecisionCard, Loading, Notice, RecordBody } from './components';

function useDecisionList(loader: () => Promise<{ ok: true; decisions: Decision[]; message?: string } | { ok: false; message: string }>) {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState('');

  async function refresh() {
    setLoading(true);
    const result = await loader();
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      setDecisions([]);
      return;
    }
    setError('');
    setDecisions(result.decisions);
    setMessage(result.message ?? '');
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { decisions, message, error, loading, openKey, setOpenKey, refresh };
}

export function DecisionList({
  emptyDescription,
  loader,
  demo,
}: {
  emptyDescription: string;
  loader: () => Promise<{ ok: true; decisions: Decision[]; message?: string } | { ok: false; message: string }>;
  demo?: Record<string, string>;
}) {
  const state = useDecisionList(loader);
  const [demoMessage, setDemoMessage] = useState('');
  const [demoError, setDemoError] = useState('');
  const open = state.decisions.find((decision) => decision.key === state.openKey);

  async function onDemo() {
    if (!demo) {
      return;
    }
    setDemoError('');
    const result = await loadDemo(demo);
    if (!result.ok) {
      setDemoError(result.message);
      return;
    }
    setDemoMessage(`Created ${result.created}, updated ${result.updated}, left ${result.skipped} unchanged. ${result.note}`.trim());
    await state.refresh();
  }

  if (state.loading) {
    return <Loading label="Loading decisions" />;
  }
  if (open) {
    return (
      <Stack space="space.150">
        <Button appearance="subtle" onClick={() => state.setOpenKey('')}>
          Back to precedents
        </Button>
        <RecordBody decision={open} />
      </Stack>
    );
  }
  return (
    <Stack space="space.150">
      {state.error ? (
        <Notice appearance="error" title="Could not load precedents">
          {state.error}
        </Notice>
      ) : null}
      {demoError ? (
        <Notice appearance="error" title="Demo data was not loaded">
          {demoError}
        </Notice>
      ) : null}
      {demoMessage ? (
        <Notice appearance="success" title="Demo decisions">
          {demoMessage}
        </Notice>
      ) : null}
      {state.decisions.length === 0 ? (
        <EmptyState
          header={state.message || NO_DECISION_RECORDED}
          description={emptyDescription}
          headingLevel={3}
          primaryAction={
            demo ? (
              <Button appearance="primary" onClick={onDemo}>
                Load demo on this work
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stack space="space.100">
          {state.decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} onOpen={() => state.setOpenKey(decision.key)} />
          ))}
          {demo ? (
            <Button appearance="subtle" onClick={onDemo}>
              Load demo on this work
            </Button>
          ) : null}
        </Stack>
      )}
    </Stack>
  );
}

export function IssuePrecedents({ issueKey }: { issueKey: string }) {
  if (!issueKey) {
    return (
      <EmptyState header={NO_DECISION_RECORDED} description="Open this panel from a Jira issue." headingLevel={3} />
    );
  }
  return (
    <DecisionList
      emptyDescription="Capture a decision from the issue actions menu, or load the demo set onto this issue."
      loader={() => precedentsForIssue(issueKey)}
      demo={{ jiraIssueKey: issueKey }}
    />
  );
}

export function PagePrecedents({ pageId, pageUrl }: { pageId: string; pageUrl: string }) {
  if (!pageId || !pageUrl) {
    return (
      <EmptyState header={NO_DECISION_RECORDED} description="Open this from a Confluence page." headingLevel={3} />
    );
  }
  return (
    <DecisionList
      emptyDescription="Record a decision from the page context menu, or load the demo set onto this page."
      loader={() => precedentsForPage(pageId, pageUrl, '')}
      demo={{ confluencePageId: pageId, confluencePageUrl: pageUrl }}
    />
  );
}

export function PullRequestPrecedents({ pullRequestId, pullRequestUrl }: { pullRequestId: string; pullRequestUrl: string }) {
  if (!pullRequestId) {
    return (
      <EmptyState
        header={NO_DECISION_RECORDED}
        description="Precedent could not read this pull request URL."
        headingLevel={3}
      />
    );
  }
  return (
    <DecisionList
      emptyDescription="Link a decision to this pull request, or load the demo set here. Issue keys in the title, description, and branch are included."
      loader={() => precedentsForPullRequest(pullRequestId, pullRequestUrl)}
      demo={{ bitbucketPrId: pullRequestId, bitbucketPrUrl: pullRequestUrl }}
    />
  );
}

export function MacroDecision({ decisionKey }: { decisionKey: string }) {
  const [decision, setDecision] = useState<Decision | undefined>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getDecision(decisionKey).then((result) => {
      if (cancelled) {
        return;
      }
      setLoading(false);
      if (!result.ok) {
        setError(result.message);
        setDecision(undefined);
        return;
      }
      setDecision(result.decision);
    });
    return () => {
      cancelled = true;
    };
  }, [decisionKey]);

  if (loading) {
    return <Loading label="Loading decision" />;
  }
  if (!decision) {
    return <EmptyState header={error || NO_DECISION_RECORDED} description="Choose another decision in the macro configuration." headingLevel={3} />;
  }
  return <RecordBody decision={decision} />;
}
