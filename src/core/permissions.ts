import { linkIdentity } from './links';
import type { Decision, DecisionLink } from './types';

/**
 * Drop links the viewer cannot see. If every link on a decision is hidden,
 * drop the decision as well so its title cannot leak a private work item.
 * A decision with no links is site-level app data and stays visible.
 */
export function applyVisibility(
  decision: Decision,
  visibleLinkKeys: ReadonlySet<string>,
): Decision | null {
  if (decision.links.length === 0) {
    return decision;
  }
  const links = decision.links.filter((link) => visibleLinkKeys.has(linkIdentity(link)));
  if (links.length === 0) {
    return null;
  }
  return { ...decision, links };
}

export function visibleLinkKeySet(
  links: DecisionLink[],
  canView: (link: DecisionLink) => boolean,
): Set<string> {
  const visible = new Set<string>();
  for (const link of links) {
    if (canView(link)) {
      visible.add(linkIdentity(link));
    }
  }
  return visible;
}

export function filterVisibleDecisions(
  decisions: Decision[],
  visibleLinkKeys: ReadonlySet<string>,
): Decision[] {
  return decisions.flatMap((decision) => {
    const visible = applyVisibility(decision, visibleLinkKeys);
    return visible ? [visible] : [];
  });
}
