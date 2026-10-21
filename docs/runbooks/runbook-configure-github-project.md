---
name: runbook-configure-github-project
trigger: activity-init recommended a GitHub Project for a repository that has none, or a repository's issues should appear on a board that GitHub's own automations keep current.
owner: product-engineer
last_verified: 2026-10-21
related: ["docs/requirements/prd-projects-tracking.md"]
---

# Configure a GitHub Project for a repository

Create one GitHub Project per repository so the PRD, wave and story issues
that `activity-publish-github` publishes show up on a board without any agent
writing to it. The procedure keeps the template's Status options and GitHub's
default workflows, narrows auto-add to issues, and names three views to create
by hand. It is a one-time human step:
no agent runs it, and no agent ever writes Project Status afterwards —
GitHub's own workflows are the only writer (projects-tracking D-22, D-23).
This is the wrong tool for migrating a repository's existing issues onto the
board, which is a later wave of the same PRD.

## Preconditions

- You are an owner of the user or organization account that will own the
  Project. A collaborator with write access can edit items but cannot create a
  Project or delete its fields.
- The repository has Projects available: **Settings → General → Features →
  Projects** is checked. A repository with that box unchecked shows no
  Projects tab, and auto-add cannot select it.
- `gh` is installed and authenticated: `gh auth status`. The token needs the
  `project` scope, which the default login does not grant; step 1 adds it.
- Decide the owner. `--owner <login>` names a user account or an organization;
  both work the same way below. Use the account that owns the repository, so
  the Project and the issues share one permission boundary.
- Decide the title. One Project per repository, titled after the repository
  (for `llipe/dev-tasks`, `dev-tasks`).

## Steps

1. Add the `project` scope to your `gh` token. Reversible (`gh auth logout`
   and log in again drops it).

   ```bash
   gh auth refresh -s project
   ```

2. Create the Project from a template in the browser: on the owner's
   **Projects** tab choose **New project**, pick either the **Board**
   template or the **Team planning** template, set the title, and create it.
   Note the Project number from the URL (`/users/<owner>/projects/<number>`
   or `/orgs/<owner>/projects/<number>`); every command below takes it. A
   template is what brings the Status field with its options and the default
   workflows; `gh project create` makes a blank Project without them, so the
   CLI is not used for this step. Either template works (D-46): the native
   model needs only the three workflows that move Status on an issue event,
   and both templates ship them. Reversible (rollback below).

3. Keep the template's Status options as they are: Todo, In Progress, Done
   on the Board template; Backlog, Ready, In progress, In review, Done on the
   Team planning template. Do not rename, reorder or add an option. Nothing
   in dev-tasks reads a Status value; GitHub's own workflows are the only
   thing that sets one.

4. Open the Project's **Workflows** page (the `…` menu → **Workflows**) and
   keep every default workflow as shipped. The shipped set, read from a fresh
   Project (`llipe/dev-tasks` Project 5, 2026-10-21, D-47; the same seven on
   `llipe/riel` Project 4) is:

   - **Auto-add to project** (step 5 narrows its filter)
   - **Auto-add sub-issues to project**
   - **Auto-close issue**
   - **Item added to project** → Todo (Backlog on Team planning)
   - **Item closed** → Done
   - **Pull request linked to issue** → In Progress (In progress on Team planning)
   - **Pull request merged** → Done

   No default workflow fires on a reopened item. The three issue-event
   workflows are why no agent needs to write Status: a story PR carrying `Closes #N` links
   the issue, and the consolidated PR merging to the default branch closes
   it. **Auto-close issue** ships enabled (D-45); leave it as shipped. Since
   no agent writes Status, it can only fire on a human's Status change
   (PRD AC-5). Before leaving this page, record for every workflow both its
   name and whether it is active, so the exercise captures the shipped
   state; if a label differs from the list above, update the list, not the
   Project.

5. On the same page open **Auto-add to project**, choose this repository, and
   set the filter to `is:issue` (the template's filter also matches pull
   requests, which would put every PR on the board as its own item). Save.
   The three-level hierarchy only needs the issues; pull requests reach the
   board through the issue they link.

6. Optional: the Team planning template's extra fields (**Priority**,
   **Size**, **Estimate**, **Start date**, **Target date**) do no harm, and
   nothing in dev-tasks reads or writes them; Project 5 keeps them (D-48).
   Delete them only if you want a leaner Project. List the field ids first,
   then delete each one. **Not reversible**: a deleted field and every value
   in it are gone; recreating the field by hand gives an empty one.

   ```bash
   gh project field-list <number> --owner <owner> --format json \
     --jq '.fields[] | select(.name == "Priority" or .name == "Size" or .name == "Estimate" or .name == "Start date" or .name == "Target date") | "\(.id) \(.name)"'
   ```

   Then, once per id printed:

   ```bash
   gh project field-delete --id <field-id>
   ```

   Title, Assignees, Status, Labels, Linked pull requests, Milestone,
   Repository, Reviewers and Parent issue stay: they are built in, cannot be
   deleted, and the views below use them.

7. Create three views in the browser. Views cannot be created through the
   API or `gh`, so each is added with the **+ New view** tab, renamed, given
   the layout and filter below, and saved. Reversible (a view can be deleted
   from its tab menu).

   | View        | Layout | Settings                                                                                                                                                                                              |
   | ----------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | **Roadmap** | Table  | **Group by: Parent issue**. Filter: `is:open`. Shows each wave's stories under their wave and each wave under its PRD issue.                                                                          |
   | **Wave**    | Board  | **Column field: Status**. Filter: `label:"level: story" <wave title words>`, one wave per saved view — the free-text term matches the issue title, the label keeps PRD and wave issues off the board. |
   | **Blocked** | Table  | Filter: `label:"status: blocked"`. The `status: blocked` label is a flag the agents set and clear on the issue; nothing on the Project itself records a block.                                        |

   When a PRD has several waves whose story titles share the same words, add
   `parent-issue:<owner>/<repo>#<wave-issue>` to the Wave view's filter
   instead of a title term.

## Verification

```bash
gh project view <number> --owner <owner> --format json \
  --jq '{number, title, public, closed, items: .items.totalCount}'
```

Expect the title you chose, `closed: false`, and an item count equal to the
repository's open issues once auto-add has run (it fires on the next issue
event, not retroactively; use the Project's **Add item** search to pull in
existing issues if the board must be complete today).

```bash
gh project field-list <number> --owner <owner> --format json --jq '[.fields[].name]'
```

Expect `Status` and `Parent issue` present, and the five optional fields
absent only if step 6 deleted them. Then open the Workflows page once more
and confirm the seven default workflows are as shipped and **Auto-add to
project** shows this repository with the filter `is:issue`.

Finally, open the three views: Roadmap groups by Parent issue, Wave shows the
Status columns, Blocked lists only issues labeled `status: blocked`.

Exercise record: `llipe/dev-tasks` Project 5 ("Dev-tasks",
<https://github.com/users/llipe/projects/5>), created by the owner on
2026-10-21 from the Team planning template; all seven shipped workflows
enabled, auto-add filter `is:issue`, template fields kept (D-45 to D-48).

## Rollback

```bash
gh project delete <number> --owner <owner>
```

Deleting the Project removes its views, fields and workflow settings in one
step; the issues themselves are untouched, since the Project only references
them. A deleted field cannot be restored on its own — if step 6 removed the
wrong one, recreate it by hand under **Settings → Fields** and accept that its
values are gone. A view or workflow setting is reverted from the same page
that set it.

## Escalation

The owner of this runbook is `product-engineer`. Escalate with the Project
number, the owner login, and the output of the two verification commands.

- A 403 on `gh project field-delete` or `gh project delete` means the token
  lacks the `project` scope or you are not an owner: re-run step 1, then ask
  an owner.
- A Workflows page that does not show one of the seven default workflows
  named in step 4, or shows it under a different label, is a documentation
  drift against PRD FR-6 and D-47, not a reason to add a workflow: record the
  exact labels in the PR body and route the finding to `product-engineer`.
- A repository that is missing from the auto-add picker has Projects turned
  off in its settings; see Preconditions.
