# Privacy

Built and developed by Saddam Malik.

Precedent stores engineering decisions in the Forge app storage of the site where it is installed. Nothing in the app is sent to a service outside Atlassian. The manifest declares no external fetch domains and no remote backend.

## What is stored

A decision stores its key, title, status, problem, options, chosen option, rationale, optional consequences, links, supersede fields, timestamps, and status history. Links are a type (`jiraIssue`, `confluencePage`, or `bitbucketPr`), an id, and an https URL.

Owners are stored as Atlassian account ids only. Precedent does not store display names, email addresses, or avatars. The issue panel and the register pass the account id to the UI Kit `User` component, which resolves the name and avatar for the current viewer and follows that person's privacy settings.

## Who can see a decision

Every product read uses `asUser()`, so Jira and Confluence apply the viewer's own permissions.

- The app can read an issue only with `read:jira-work`, and a page only with `read:page:confluence`.
- If a request does not succeed, the link is treated as not visible.
- Links the viewer cannot open are removed from the decision before it is returned.
- If the viewer cannot open any of the decision's links, the whole decision is omitted. The title is not returned. The UI, the Rovo agent, and the MCP actions all use that filtered result, and a hidden decision is indistinguishable from a missing one: "No decision recorded".
- A decision with no links is not tied to a private issue, page, or pull request. Anyone who can open Precedent on the site can see it. Link the decision when it should follow the permissions of a piece of work.

Issue summaries and pull request text are read only to rank records that are already stored. They are not written into the decision store, and they are not returned as the answer to a question.

## Account ids

Atlassian does not treat an account id by itself as personal data. Precedent still reports the account ids it stores, because those ids are the only handle it keeps for a person.

Once a week, the `privacy-report` scheduled trigger:

1. Collects each stored account id and the latest decision time it appears on.
2. Calls `privacy.reportPersonalData` from `@forge/api`.
3. When the report says an account is `closed`, removes that account id from every decision, including superseded records. The rationale and the rest of the decision stay. Removing the id is the erasure step, not an edit of the decision.
4. When the report says an account is `updated`, Precedent does not refresh a stored profile, because it has no stored name, email, or avatar to refresh.

The scheduled function returns HTTP 204 on success. It does not log account ids. The trigger runs without a user, which matches the Forge scheduled trigger contract, and it only talks to the app store and the Forge privacy API.

If a later version stores anything beyond the account id, that version has to report it on the same cycle and erase or refresh it from the report result.

## What this document does not replace

Installing the app still shows the site admin the three scopes in the manifest: `storage:app`, `read:jira-work`, and `read:page:confluence`. A production listing would also answer Atlassian's privacy questionnaire from this behavior.
