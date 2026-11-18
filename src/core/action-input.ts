export function actionFields(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object') {
    return {};
  }
  const record = payload as Record<string, unknown>;
  if (record.inputs && typeof record.inputs === 'object') {
    return record.inputs as Record<string, unknown>;
  }
  return record;
}

export function readString(payload: unknown, key: string): string {
  const value = actionFields(payload)[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function readLines(payload: unknown, key: string): string[] {
  return readString(payload, key)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function readAccountIds(payload: unknown, key: string): string[] {
  return readString(payload, key)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function actorAccountId(context: unknown): string | undefined {
  if (!context || typeof context !== 'object') {
    return undefined;
  }
  const record = context as {
    accountId?: unknown;
    principal?: { accountId?: unknown };
  };
  if (typeof record.principal?.accountId === 'string' && record.principal.accountId) {
    return record.principal.accountId;
  }
  if (typeof record.accountId === 'string' && record.accountId) {
    return record.accountId;
  }
  return undefined;
}
