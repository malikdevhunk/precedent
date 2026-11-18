import React from 'react';
import {
  Box,
  Button,
  Heading,
  Inline,
  Link,
  Lozenge,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  User,
  UserGroup,
} from '@forge/react';
import type { Decision, DecisionStatus } from '../core/types';

export function statusAppearance(status: DecisionStatus): 'success' | 'inprogress' | 'moved' | 'removed' {
  switch (status) {
    case 'accepted':
      return 'success';
    case 'proposed':
      return 'inprogress';
    case 'superseded':
      return 'moved';
    case 'deprecated':
      return 'removed';
  }
}

export function statusLabel(status: DecisionStatus): string {
  switch (status) {
    case 'accepted':
      return 'Accepted';
    case 'proposed':
      return 'Proposed';
    case 'superseded':
      return 'Superseded';
    case 'deprecated':
      return 'Deprecated';
  }
}

export function StatusLozenge({ status }: { status: DecisionStatus }) {
  return <Lozenge appearance={statusAppearance(status)}>{statusLabel(status)}</Lozenge>;
}

export function Loading({ label }: { label: string }) {
  return (
    <Inline space="space.100" alignBlock="center">
      <Spinner size="medium" label={label} />
      <Text>{label}</Text>
    </Inline>
  );
}

export function Notice({
  appearance,
  title,
  children,
}: {
  appearance: 'information' | 'warning' | 'error' | 'success';
  title?: string;
  children: string;
}) {
  return (
    <SectionMessage appearance={appearance} title={title}>
      <Text>{children}</Text>
    </SectionMessage>
  );
}

export function OwnerRow({ accountIds }: { accountIds: string[] }) {
  if (accountIds.length === 0) {
    return <Text>No owner on record</Text>;
  }
  return (
    <UserGroup>
      {accountIds.map((accountId) => (
        <User key={accountId} accountId={accountId} />
      ))}
    </UserGroup>
  );
}

export function linkLabel(link: Decision['links'][number]): string {
  if (link.type === 'jiraIssue') {
    return link.id;
  }
  if (link.type === 'confluencePage') {
    return `Page ${link.id}`;
  }
  return `Pull request ${link.id}`;
}

export function DecisionCard({ decision, onOpen }: { decision: Decision; onOpen: () => void }) {
  return (
    <Box
      backgroundColor="color.background.neutral"
      padding="space.150"
      xcss={{ borderRadius: 'radius.medium' }}
    >
      <Stack space="space.100">
        <Inline space="space.100" alignBlock="center">
          <StatusLozenge status={decision.status} />
          <Heading as="h3" size="xsmall">
            {decision.title}
          </Heading>
        </Inline>
        <Text>
          {decision.key} · {decision.chosenOption}
        </Text>
        <OwnerRow accountIds={decision.ownerAccountIds} />
        <Button appearance="subtle" onClick={onOpen}>
          Open record
        </Button>
      </Stack>
    </Box>
  );
}

export function RecordBody({ decision }: { decision: Decision }) {
  return (
    <Stack space="space.150">
      <Inline space="space.100" alignBlock="center">
        <StatusLozenge status={decision.status} />
        <Heading as="h2" size="small">
          {decision.key} {decision.title}
        </Heading>
      </Inline>
      {decision.status === 'superseded' ? (
        <Notice appearance="warning" title="Read only">
          {`Superseded by ${decision.supersededBy}. ${decision.supersedeReason ?? ''} This record can no longer be changed.`}
        </Notice>
      ) : null}
      {decision.status === 'deprecated' ? (
        <Notice appearance="information" title="Deprecated">
          This decision is kept as history. You can still mark it superseded by a later record.
        </Notice>
      ) : null}
      <Stack space="space.050">
        <Heading as="h3" size="xxsmall">
          Chosen option
        </Heading>
        <Text>{decision.chosenOption}</Text>
      </Stack>
      <Stack space="space.050">
        <Heading as="h3" size="xxsmall">
          Problem
        </Heading>
        <Text>{decision.problem}</Text>
      </Stack>
      <Stack space="space.050">
        <Heading as="h3" size="xxsmall">
          Options considered
        </Heading>
        {decision.optionsConsidered.map((option) => (
          <Text key={option}>{option}</Text>
        ))}
      </Stack>
      <Stack space="space.050">
        <Heading as="h3" size="xxsmall">
          Rationale
        </Heading>
        <Text>{decision.rationale}</Text>
      </Stack>
      {decision.consequences ? (
        <Stack space="space.050">
          <Heading as="h3" size="xxsmall">
            Consequences
          </Heading>
          <Text>{decision.consequences}</Text>
        </Stack>
      ) : null}
      <Stack space="space.050">
        <Heading as="h3" size="xxsmall">
          Owners
        </Heading>
        <OwnerRow accountIds={decision.ownerAccountIds} />
      </Stack>
      <Stack space="space.050">
        <Heading as="h3" size="xxsmall">
          Links
        </Heading>
        {decision.links.length === 0 ? <Text>No linked work. This decision is visible across the app.</Text> : null}
        {decision.links.map((link) => (
          <Text key={`${link.type}:${link.id}`}>
            <Link href={link.url} openNewTab>
              {linkLabel(link)}
            </Link>
          </Text>
        ))}
      </Stack>
      {decision.statusHistory.length > 0 ? (
        <Stack space="space.050">
          <Heading as="h3" size="xxsmall">
            Status history
          </Heading>
          {decision.statusHistory.map((entry) => (
            <Text key={`${entry.at}:${entry.to}`}>
              {`${entry.to} · ${entry.reason ?? 'Updated'} · ${entry.at}`}
            </Text>
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
