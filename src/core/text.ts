const STOPWORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'of',
  'to',
  'for',
  'in',
  'on',
  'with',
  'by',
  'from',
  'into',
  'about',
  'this',
  'that',
  'these',
  'those',
  'we',
  'our',
  'you',
  'your',
  'they',
  'their',
  'did',
  'do',
  'does',
  'was',
  'were',
  'is',
  'are',
  'be',
  'been',
  'being',
  'why',
  'how',
  'what',
  'when',
  'where',
  'who',
  'which',
  'it',
  'its',
  'as',
  'at',
  'if',
  'then',
  'than',
  'not',
  'no',
  'yes',
  'have',
  'has',
  'had',
  'will',
  'would',
  'should',
  'could',
  'can',
  'just',
  'only',
  'also',
  'new',
  'old',
  'use',
  'using',
  'used',
  'choose',
  'chose',
  'chosen',
  'decide',
  'decided',
  'decision',
]);

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

const ISSUE_KEY = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;

export function extractIssueKeys(value: string): string[] {
  const matches = value.toUpperCase().match(ISSUE_KEY) ?? [];
  const unique: string[] = [];
  for (const match of matches) {
    if (match.startsWith('DEC-') || unique.includes(match)) {
      continue;
    }
    unique.push(match);
    if (unique.length >= 20) {
      break;
    }
  }
  return unique;
}
