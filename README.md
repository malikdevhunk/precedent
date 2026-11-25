# Precedent

Precedent turns an engineering decision into a record the team can find again. A developer captures the problem, the options, the choice, and the rationale. Precedent then shows the decisions that relate to the Jira issue or Confluence page in front of them.

The Rovo agent **Precedent — decision memory** answers "why did we decide this?" only from those records. It cites the decision key, such as DEC-12. When nothing was recorded, it says **No decision recorded**. The same actions are available to custom Rovo agents through the `rovo:mcp` module.

Built and developed by Saddam Malik.

## Screenshots

Screenshots belong here after the app is installed on a demonstration site. The surfaces to capture:

| Surface | What to show |
| --- | --- |
| Jira issue panel | Precedents on an issue, with status lozenge, chosen option, and owners |
| Capture as decision | The issue action form |
| Decision Register | Search, a status filter, and a superseded record |
| Confluence | The byline, the selection menu, and the Decision macro |
| Rovo | A cited answer, and a question that returns "No decision recorded" |

## Install

The manifest carries the registered app id. To run your own copy, register a new app with `forge register` (it replaces `app.id`), then deploy and install it on a site where you can administer Jira and Confluence. Rovo needs to be available on that site for the agent. Forge does not allow Bitbucket workspace scopes in the same app as Jira and Confluence site scopes, so the Bitbucket pull request card is not part of this manifest. The code stays in `src/` for a separate Bitbucket app.

```bash
npm install
# Replace app.id in manifest.yml with the id this command writes.
forge register
forge deploy
# Indexing of the decision store can take a few minutes on a new app.
forge storage entities indexes list
forge install --product jira --site example.atlassian.net --non-interactive
forge install --product confluence --site example.atlassian.net --non-interactive
```

Upgrade an existing installation after a manifest change with `forge install --upgrade`.

Local UI development uses the Forge tunnel:

```bash
forge deploy
forge tunnel
```

Node.js 22 is the runtime declared in `manifest.yml` (`nodejs22.x`). Use the same major version locally. `npm run lint`, `npm run typecheck`, and `npm test` match the checks in GitHub Actions.

Load the demo decisions from the Decision Register, or from an issue, page, or pull request with **Load demo on this work**. The set is eight decisions. DEC-5 is superseded by DEC-6. DEC-7 is deprecated. Nothing in the set answers "Why did we choose Kafka for notifications?" Check the data without a site:

```bash
npm run seed:check
```

## Where it shows up

| Module | What the user sees |
| --- | --- |
| `jira:issuePanel` | Precedents on the issue |
| `jira:issueAction` | Capture as decision |
| `jira:globalPage` | Decision Register, under Apps |
| `confluence:contentBylineItem` | Precedents under the page title |
| `confluence:contextMenu` | Capture as decision from selected text |
| `macro` | A Decision body macro |
| `rovo:agent` | The **Precedent — decision memory** agent and its six actions |
| `rovo:mcp` | Those actions as MCP tools, exposed as **Precedent decision tools** |
| `scheduledTrigger` | Weekly account-id privacy report |

## Architecture

```
Jira, Confluence, Rovo
        |
        v
UI Kit screens and action handlers
        |
        v
Decision service  ----  permission filter
        |                    |
        v                    v
Pure rules in src/core     asUser() product requests
        |
        v
Forge KVS custom entities (decision, decision-link)
```

`src/core` has no Forge imports. It validates a decision, ranks related decisions, enforces supersede rules, and drops links the current user cannot view. Vitest covers that behavior. The resolver and the Rovo actions call the same service.

A related decision scores higher when it shares a Jira issue, Confluence page, or pull request with the work in front of the user, when a pull request names a linked issue, when the title or problem overlaps the question, and when it is recent. Accepted ranks above proposed, then deprecated, then superseded. A superseded decision is kept below its successor.

Supersede rules: the successor must already exist, it must be proposed or accepted, and the chain cannot loop. The superseded record stays as history. Its rationale cannot be edited, and further links cannot be added. Status history records the transition.

Storage is two custom entities plus a sequence key, all through `@forge/kvs`. Decisions are queried by key, by status, and by update time. Link rows point back at the decision so an issue, page, or pull request can find its records. The list used for search is capped at 500 decisions.

## Permissions

The app asks for three scopes:

| Scope | Why |
| --- | --- |
| `storage:app` | Read and write the decision store |
| `read:jira-work` | See whether the current user can view a linked issue, and read the summary used only to rank records |
| `read:page:confluence` | See whether the current user can view a linked page |

There is no egress permission. Names and avatars are not stored. The UI Kit `User` component resolves an owner from the account id at render time, under that person's privacy settings.

A decision with no links is visible to anyone who can open Precedent. A decision with links is shown only when the viewer can open at least one of them. Hidden links are removed. If every link is hidden, the decision is omitted, including its title. A missing decision and a hidden decision look the same: **No decision recorded**.

Details of account-id handling are in [PRIVACY.md](PRIVACY.md). A ten-minute pass for a reviewer is in [JUDGES.md](JUDGES.md).

## What a real site still has to prove

Deploy, indexing, install, and the Rovo conversation all need a developer site. Product permission checks are real `asUser()` requests, so they are covered here by the pure filter and by the request each resolver makes, not by an automated call to Jira.
