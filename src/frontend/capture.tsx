import React, { useState } from 'react';
import { view } from '@forge/bridge';
import {
  Button,
  ErrorMessage,
  Heading,
  HelperMessage,
  Label,
  Select,
  Stack,
  TextArea,
  Textfield,
  UserPicker,
} from '@forge/react';
import type { UserPickerValue } from '@forge/react';
import { validateDraft } from '../core/validate';
import type { DecisionLink } from '../core/types';
import { recordDecision } from './api';
import { Notice } from './components';
import type { CaptureSeed } from './surface';

const STATUS_OPTIONS = [
  { label: 'Proposed', value: 'proposed' },
  { label: 'Accepted', value: 'accepted' },
];

function lines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function ownerIds(value: UserPickerValue | UserPickerValue[]): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries.map((entry) => entry.id).filter((id) => id.length > 0);
}

export function CaptureForm({ seed }: { seed: CaptureSeed }) {
  const [title, setTitle] = useState('');
  const [problem, setProblem] = useState(seed.problem);
  const [optionsText, setOptionsText] = useState('');
  const [chosenOption, setChosenOption] = useState('');
  const [rationale, setRationale] = useState('');
  const [consequences, setConsequences] = useState('');
  const [status, setStatus] = useState<'proposed' | 'accepted'>('proposed');
  const [owners, setOwners] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const optionList = lines(optionsText);
  const chosenChoices = optionList.map((option) => ({ label: option, value: option }));

  async function onSubmit() {
    setMessage('');
    const links: DecisionLink[] = seed.links;
    const draft = validateDraft({
      title,
      problem,
      optionsConsidered: optionList,
      chosenOption,
      rationale,
      consequences,
      status,
      ownerAccountIds: owners.length > 0 ? owners : ['712020:current-user'],
      links,
    });
    if (!draft.ok) {
      const { ownerAccountIds: _owner, ...rest } = draft.errors;
      setErrors(rest);
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await recordDecision({
      ...draft.value,
      ownerAccountIds: owners,
    });
    setSubmitting(false);
    if (!result.ok) {
      setErrors(result.fieldErrors ?? {});
      setMessage(result.message);
      return;
    }
    setSavedKey(result.decision.key);
  }

  if (savedKey) {
    return (
      <Stack space="space.150">
        <Notice appearance="success" title="Decision recorded">
          {`${savedKey} is in the register. Precedent will cite that key and no other source.`}
        </Notice>
        {seed.closable ? (
          <Button appearance="primary" onClick={() => view.close()}>
            Close
          </Button>
        ) : null}
      </Stack>
    );
  }

  return (
    <Stack space="space.150">
      <Heading as="h2" size="small">
        Capture as decision
      </Heading>
      <HelperMessage>{seed.hint}</HelperMessage>
      {message ? (
        <Notice appearance="error" title="Could not record">
          {message}
        </Notice>
      ) : null}
      <Label labelFor="decision-title">Title</Label>
      <Textfield
        id="decision-title"
        value={title}
        onChange={(event) => setTitle(String(event.target.value ?? ''))}
        isRequired
        isInvalid={Boolean(errors.title)}
      />
      {errors.title ? <ErrorMessage>{errors.title}</ErrorMessage> : <HelperMessage>A short name, such as the option you picked.</HelperMessage>}
      <Label labelFor="decision-problem">Problem</Label>
      <TextArea
        id="decision-problem"
        value={problem}
        onChange={(event) => setProblem(String(event.target.value ?? ''))}
        minimumRows={3}
        isRequired
        isInvalid={Boolean(errors.problem)}
      />
      {errors.problem ? <ErrorMessage>{errors.problem}</ErrorMessage> : null}
      <Label labelFor="decision-options">Options considered</Label>
      <TextArea
        id="decision-options"
        value={optionsText}
        onChange={(event) => setOptionsText(String(event.target.value ?? ''))}
        minimumRows={4}
        isRequired
        isInvalid={Boolean(errors.optionsConsidered)}
      />
      {errors.optionsConsidered ? <ErrorMessage>{errors.optionsConsidered}</ErrorMessage> : <HelperMessage>One option on each line.</HelperMessage>}
      <Label labelFor="decision-chosen">Chosen option</Label>
      <Select
        inputId="decision-chosen"
        options={chosenChoices}
        placeholder="Choose one of the options above"
        value={chosenChoices.find((option) => option.value === chosenOption) ?? null}
        onChange={(option) => {
          const selected = option as { value?: string } | null;
          setChosenOption(selected?.value ?? '');
        }}
        isInvalid={Boolean(errors.chosenOption)}
      />
      {errors.chosenOption ? <ErrorMessage>{errors.chosenOption}</ErrorMessage> : null}
      <Label labelFor="decision-rationale">Rationale</Label>
      <TextArea
        id="decision-rationale"
        value={rationale}
        onChange={(event) => setRationale(String(event.target.value ?? ''))}
        minimumRows={3}
        isRequired
        isInvalid={Boolean(errors.rationale)}
      />
      {errors.rationale ? <ErrorMessage>{errors.rationale}</ErrorMessage> : null}
      <Label labelFor="decision-consequences">Consequences</Label>
      <TextArea
        id="decision-consequences"
        value={consequences}
        onChange={(event) => setConsequences(String(event.target.value ?? ''))}
        minimumRows={2}
      />
      <HelperMessage>Optional. What follows from this choice?</HelperMessage>
      <Label labelFor="decision-status">Status</Label>
      <Select
        inputId="decision-status"
        options={STATUS_OPTIONS}
        value={STATUS_OPTIONS.find((option) => option.value === status)}
        onChange={(option) => {
          const selected = option as { value?: 'proposed' | 'accepted' } | null;
          setStatus(selected?.value === 'accepted' ? 'accepted' : 'proposed');
        }}
      />
      <UserPicker
        label="Owners"
        name="owners"
        isMulti
        placeholder="Defaults to you if left empty"
        onChange={(value) => setOwners(ownerIds(value as UserPickerValue | UserPickerValue[]))}
      />
      {errors.ownerAccountIds ? <ErrorMessage>{errors.ownerAccountIds}</ErrorMessage> : null}
      <Button appearance="primary" isDisabled={submitting} onClick={onSubmit}>
        {submitting ? 'Recording…' : 'Record decision'}
      </Button>
    </Stack>
  );
}
