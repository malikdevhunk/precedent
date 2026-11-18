import React, { useEffect, useState } from 'react';
import {
  Button,
  EmptyState,
  ErrorMessage,
  HelperMessage,
  Inline,
  Label,
  Select,
  Stack,
  TextArea,
  Textfield,
} from '@forge/react';
import type { Decision } from '../core/types';
import { NO_DECISION_RECORDED } from '../core/types';
import { loadDemo, searchDecisions, supersedeDecision } from './api';
import { DecisionCard, Loading, Notice, RecordBody } from './components';

const FILTERS = [
  { label: 'Any status', value: 'any' },
  { label: 'Proposed', value: 'proposed' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Superseded', value: 'superseded' },
  { label: 'Deprecated', value: 'deprecated' },
];

export function DecisionRegister() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('any');
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emptyMessage, setEmptyMessage] = useState('');
  const [openKey, setOpenKey] = useState('');
  const [issueKey, setIssueKey] = useState('');
  const [demoMessage, setDemoMessage] = useState('');
  const [successorKey, setSuccessorKey] = useState('');
  const [reason, setReason] = useState('');
  const [supersedeError, setSupersedeError] = useState('');

  async function refresh(nextQuery = query, nextStatus = status) {
    setLoading(true);
    const result = await searchDecisions(nextQuery, nextStatus);
    setLoading(false);
    if (!result.ok) {
      setError(result.message);
      setDecisions([]);
      return;
    }
    setError('');
    setDecisions(result.decisions);
    setEmptyMessage(result.message ?? '');
  }

  useEffect(() => {
    void refresh('', 'any');
  }, []);

  const open = decisions.find((decision) => decision.key === openKey);
  const successors = decisions.filter(
    (decision) => decision.key !== openKey && (decision.status === 'proposed' || decision.status === 'accepted'),
  );
  const successorOptions = successors.map((decision) => ({
    label: `${decision.key} ${decision.title}`,
    value: decision.key,
  }));

  async function onDemo() {
    setDemoMessage('');
    setError('');
    const result = await loadDemo(issueKey.trim() ? { jiraIssueKey: issueKey.trim() } : {});
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDemoMessage(
      `Created ${result.created}, updated ${result.updated}, left ${result.skipped} unchanged. ${result.note}`.trim(),
    );
    await refresh();
  }

  async function onSupersede() {
    if (!open) {
      return;
    }
    setSupersedeError('');
    const result = await supersedeDecision(open.key, successorKey, reason);
    if (!result.ok) {
      setSupersedeError(result.message);
      return;
    }
    setReason('');
    setSuccessorKey('');
    await refresh();
    setOpenKey(result.decision.key);
  }

  return (
    <Stack space="space.200">
      <HelperMessage>
        Search recorded decisions. A decision with no links is visible here to everyone who can open the app. Linked decisions follow Jira, Confluence, and Bitbucket permissions.
      </HelperMessage>
      {error ? (
        <Notice appearance="error" title="Could not load the register">
          {error}
        </Notice>
      ) : null}
      {demoMessage ? (
        <Notice appearance="success" title="Demo decisions">
          {demoMessage}
        </Notice>
      ) : null}
      <Inline space="space.100" alignBlock="end">
        <Stack space="space.050">
          <Label labelFor="register-search">Search</Label>
          <Textfield
            id="register-search"
            value={query}
            onChange={(event) => setQuery(String(event.target.value ?? ''))}
            placeholder="PostgreSQL, deploy window, REST"
          />
        </Stack>
        <Stack space="space.050">
          <Label labelFor="register-status">Status</Label>
          <Select
            inputId="register-status"
            options={FILTERS}
            value={FILTERS.find((option) => option.value === status)}
            onChange={(option) => {
              const selected = option as { value?: string } | null;
              const next = selected?.value ?? 'any';
              setStatus(next);
              void refresh(query, next);
            }}
          />
        </Stack>
        <Button appearance="primary" onClick={() => void refresh()}>
          Search
        </Button>
      </Inline>
      <Inline space="space.100" alignBlock="end">
        <Stack space="space.050">
          <Label labelFor="demo-issue">Demo issue key</Label>
          <Textfield
            id="demo-issue"
            value={issueKey}
            onChange={(event) => setIssueKey(String(event.target.value ?? ''))}
            placeholder="PAY-42"
          />
        </Stack>
        <Button appearance="default" onClick={() => void onDemo()}>
          Load demo decisions
        </Button>
      </Inline>
      <HelperMessage>Leave the issue key empty to load the eight demo decisions without product links.</HelperMessage>
      {loading ? <Loading label="Loading decisions" /> : null}
      {!loading && open ? (
        <Stack space="space.150">
          <Button appearance="subtle" onClick={() => setOpenKey('')}>
            Back to the register
          </Button>
          <RecordBody decision={open} />
          {open.status !== 'superseded' ? (
            <Stack space="space.100">
              <Label labelFor="successor">Mark superseded</Label>
              <Select
                inputId="successor"
                options={successorOptions}
                placeholder="Successor decision"
                value={successorOptions.find((option) => option.value === successorKey) ?? null}
                onChange={(option) => {
                  const selected = option as { value?: string } | null;
                  setSuccessorKey(selected?.value ?? '');
                }}
              />
              <TextArea
                id="supersede-reason"
                value={reason}
                onChange={(event) => setReason(String(event.target.value ?? ''))}
                placeholder="Why is the earlier decision no longer in force?"
                minimumRows={2}
              />
              {supersedeError ? <ErrorMessage>{supersedeError}</ErrorMessage> : null}
              <Button appearance="warning" isDisabled={!successorKey || !reason.trim()} onClick={() => void onSupersede()}>
                {`Mark ${open.key} superseded`}
              </Button>
              <HelperMessage>
                The successor must already be proposed or accepted, and the chain cannot loop.
              </HelperMessage>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
      {!loading && !open && decisions.length === 0 ? (
        <EmptyState
          header={emptyMessage || NO_DECISION_RECORDED}
          description="Record a decision from a Jira issue, or load the demo set. Asking about a topic with no record returns no decision."
          headingLevel={3}
        />
      ) : null}
      {!loading && !open && decisions.length > 0 ? (
        <Stack space="space.100">
          {decisions.map((decision) => (
            <DecisionCard key={decision.id} decision={decision} onOpen={() => setOpenKey(decision.key)} />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
