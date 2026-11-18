import React, { useEffect, useState } from 'react';
import ForgeReconciler, { EmptyState, useConfig, useProductContext } from '@forge/react';
import { view } from '@forge/bridge';
import { NO_DECISION_RECORDED } from '../core/types';
import { CaptureForm } from './capture';
import { Loading } from './components';
import { IssuePrecedents, MacroDecision, PagePrecedents, PullRequestPrecedents } from './lists';
import { DecisionRegister } from './register';
import { screenFor } from './surface';

function MacroScreen() {
  const config = useConfig() as { decisionKey?: string } | undefined;
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void view.getContext().then(() => setReady(true));
  }, []);

  if (!ready && !config) {
    return <Loading label="Loading decision" />;
  }
  const decisionKey = config?.decisionKey?.trim() ?? '';
  if (!decisionKey) {
    return (
      <EmptyState
        header={NO_DECISION_RECORDED}
        description="Edit this macro and choose a decision key."
        headingLevel={3}
      />
    );
  }
  return <MacroDecision decisionKey={decisionKey} />;
}

function App() {
  const context = useProductContext();
  if (!context) {
    return <Loading label="Loading Precedent" />;
  }
  const screen = screenFor(context);
  switch (screen.name) {
    case 'panel':
      return <IssuePrecedents issueKey={screen.issueKey} />;
    case 'capture':
      return <CaptureForm seed={screen.seed} />;
    case 'register':
      return <DecisionRegister />;
    case 'page':
      return <PagePrecedents pageId={screen.pageId} pageUrl={screen.pageUrl} />;
    case 'pullRequest':
      return (
        <PullRequestPrecedents pullRequestId={screen.pullRequestId} pullRequestUrl={screen.pullRequestUrl} />
      );
    case 'macro':
      return <MacroScreen />;
    default:
      return (
        <EmptyState header="Precedent" description="This surface is not one of the Precedent modules." headingLevel={3} />
      );
  }
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
