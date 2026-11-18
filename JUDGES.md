# Ten-minute pass

Built and developed by Saddam Malik.

This is a manual path for a site where Precedent is installed on Jira, Confluence, and Bitbucket, and Rovo is available. Replace the placeholder `app.id` and deploy before you start. Wait until `forge storage entities indexes list` shows the decision indexes as active.

## 1. Decision Register (about 2 minutes)

Open Jira, then Apps, then Decision Register.

Search before loading anything. The register should explain that nothing is recorded yet.

Choose **Load demo decisions** with the issue key left empty. You should see eight decisions, DEC-1 through DEC-8.

Search for `PostgreSQL`. DEC-2, PostgreSQL for the billing service, should be the one that opens. Its status is Accepted, the chosen option is PostgreSQL, and the rationale is about the ledger.

Filter status to Superseded. DEC-5, Friday production deploys, remains. Open it. The record says it was superseded by DEC-6 and that it can no longer be changed. There is no control to edit the rationale.

Filter to Deprecated. DEC-7, In-memory session store, remains.

## 2. Issue panel and capture (about 3 minutes)

Open a Jira issue you can edit. Open the Precedents panel. If this issue was not part of the demo load, the panel says **No decision recorded**.

Choose **Load demo on this work**. DEC-2, DEC-5, and DEC-6 are the ones tied to a Jira issue. DEC-6 (Weekday deploy window at 10:00 UTC) should appear above DEC-5.

From the issue's more actions menu, choose **Capture as decision**. Record a small decision of your own, with two options and a rationale, and leave the owners empty so you are the owner. Close the dialog and confirm the new key appears on the panel. Open the record and check the status lozenge, the chosen option, and your avatar.

In the Decision Register, open that new decision and mark it superseded by DEC-2, with a reason. The new record should become read-only and name DEC-2.

## 3. Confluence and Bitbucket (about 2 minutes)

On a page you can edit, the byline item Precedents lists decisions linked to that page. Select a sentence and choose **Capture as decision**. The problem field should start with the sentence you selected.

Insert the Decision macro and choose DEC-2. The page should show the key, the status, the chosen option, and the rationale. A viewer who cannot see a decision's only linked work sees **No decision recorded** instead of the title.

Open a pull request. The Precedents card uses the pull request and any issue keys in the title, description, or branch. **Load demo on this work** links DEC-8, Two reviewers on payment changes.

## 4. Rovo (about 3 minutes)

Open the Precedent agent.

Ask: "Why did we choose PostgreSQL for billing?"

The answer should cite DEC-2 by key and title, and the rationale should match the record. It should not add a reason that is not in the decision.

Ask: "Why did we choose Kafka for notifications?"

The answer should be exactly: **No decision recorded**.

Ask why Friday production deploys were replaced. The answer should cite DEC-6 as the current decision and DEC-5 as history.

If you use a client that can call the app's MCP tools, `searchDecisions`, `getDecision`, `recordDecision`, `linkDecision`, `supersedeDecision`, and `precedentsForIssue` are the same actions the agent uses. A search for Kafka returns the same empty message.

## If something is empty

- The panel icon has to be added once per issue view. Use the issue's app buttons if the panel is not on the page yet.
- A demo load from the register, with no issue key, does not attach Jira links. Load again from the issue so DEC-2, DEC-5, and DEC-6 are linked. DEC-5 cannot gain a link after it has been superseded, so load from the issue before you care about seeing DEC-5 on that issue.
- The agent will not invent an answer when the action result is empty. That is the gap in the demo set.
