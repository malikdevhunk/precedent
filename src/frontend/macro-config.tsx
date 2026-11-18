import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, HelperMessage, Label, SectionMessage, Select, Stack, Text, Textfield } from '@forge/react';
import { view } from '@forge/bridge';
import { searchDecisions } from './api';

function Config() {
  const [decisionKey, setDecisionKey] = useState('');
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const context = await view.getContext();
      const existing = context.extension?.config as { decisionKey?: string } | undefined;
      if (existing?.decisionKey) {
        setDecisionKey(existing.decisionKey);
      }
      const result = await searchDecisions('', 'any');
      if (result.ok) {
        setOptions(result.decisions.map((decision) => ({ label: `${decision.key} ${decision.title}`, value: decision.key })));
      }
      setLoading(false);
    })();
  }, []);

  async function onSubmit() {
    const key = decisionKey.trim().toUpperCase();
    if (!/^DEC-[1-9]\d*$/.test(key)) {
      setError('Enter a decision key such as DEC-2.');
      return;
    }
    setError('');
    try {
      await view.submit({ config: { decisionKey: key } });
      setMessage(`This macro will show ${key}.`);
    } catch (submitError) {
      const text = submitError instanceof Error ? submitError.message : 'The configuration was not saved.';
      setError(text);
    }
  }

  return (
    <Stack space="space.150">
      <HelperMessage>Choose a recorded decision. Viewers who cannot see its linked work will see no decision.</HelperMessage>
      {loading ? <Text>Loading decisions…</Text> : null}
      <Label labelFor="macro-decision">Decision</Label>
      <Select
        inputId="macro-decision"
        options={options}
        placeholder="Select a decision"
        value={options.find((option) => option.value === decisionKey) ?? null}
        onChange={(option) => {
          const selected = option as { value?: string } | null;
          setDecisionKey(selected?.value ?? '');
        }}
      />
      <Label labelFor="macro-key">Decision key</Label>
      <Textfield
        id="macro-key"
        value={decisionKey}
        onChange={(event) => setDecisionKey(String(event.target.value ?? ''))}
        placeholder="DEC-2"
      />
      {error ? (
        <SectionMessage appearance="error">
          <Text>{error}</Text>
        </SectionMessage>
      ) : null}
      {message ? (
        <SectionMessage appearance="success">
          <Text>{message}</Text>
        </SectionMessage>
      ) : null}
      <Button appearance="primary" onClick={() => void onSubmit()}>
        Save
      </Button>
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <Config />
  </React.StrictMode>,
);
