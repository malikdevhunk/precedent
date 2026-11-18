import { buildSeedDecisions, GAP_QUESTION } from '../src/demo/seed-data';
import { validateDecision } from '../src/core/validate';

const decisions = buildSeedDecisions('712020:demo-owner');
const failures = decisions.flatMap((decision) => {
  const result = validateDecision(decision);
  return result.ok ? [] : [`${decision.key}: ${Object.values(result.errors).join(' ')}`];
});

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exit(1);
}

const superseded = decisions.find((decision) => decision.status === 'superseded');
console.log(`Precedent demo seed: ${decisions.length} decisions (${decisions[0]?.key} to ${decisions.at(-1)?.key}).`);
console.log(`Superseded: ${superseded?.key} -> ${superseded?.supersededBy}`);
console.log(`Deprecated: ${decisions.filter((decision) => decision.status === 'deprecated').map((decision) => decision.key).join(', ')}`);
console.log(`Deliberate gap: ${GAP_QUESTION}`);
console.log('Load them from the Decision Register or from an issue panel on a site where the app is installed.');
