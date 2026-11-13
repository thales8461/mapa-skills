---
name: revisao
description: Use when the user sends /revisao or asks to triage the review reports of the project. Reads every review report not handled yet (new ones in the inbox folder and the ones in progress), confirms each finding against main, plans the fixes as tasks in the map after the user approves, and moves to the done folder every report with nothing left to fix.
---

# /revisao: triage of the review reports

The reviewers write their reports (from the `revisao` prompts written by the `prompt-revisao` skill) into the inbox folder. This skill reads them, confirms each finding on main, plans the fixes and keeps the folders in order.

Folders and files (`reviews` in `.claude/mapa.json`, all optional):

| Key | Default | Meaning |
|---|---|---|
| `folder` | `docs/reviews` | Inbox: reports not triaged yet. |
| `inProgress` | `docs/reviews/in-progress` | Triaged, with fix tasks still open. |
| `done` | `docs/reviews/done` | Nothing left to fix. |
| `tracking` | `docs/reviews/TRACKING.md` | One section per report with the status of each finding. |
| `fixPrefix` | `K` | Prefix of the fix task ids (`K1`, `K2`...). |
| `cleanup` | (none) | Optional commands to run when a report goes to done (e.g. drop the reviewer's test database). `{report}` = file name. |

Helper: `node <revisao skill folder>/scripts/reviews.mjs` (read-only; needs the `mapa` skill folder next to it). Exit 0 = ok, 1 = nothing, 2 = error.

**Read-only until step 4.** Nothing is written, moved or deleted before the user approves, except what step 6 does on its own (reports with nothing to fix).

## Tracking file format
```markdown
## Round of <date> (<n> reports, against main <reviewer commit>; checked on main <current commit>)
<one paragraph with the user's decisions>

### <report file name>
- [ ] (K12) P2 `path/file.ts:120`: problem in one sentence.
- [x] (PR #345, K11) P3 `docs/x.md:10`: ...
- [-] (dismissed by the user on <date>: reason) P2 ...
- Tests run by the reviewer: ...

### No findings (in done since <date>)
- `<report>`: ...
```
A report that reaches done gets ` — in done since <date>` in its heading.

## Step 1: what is there
1. Main up to date (`git fetch`; `git pull` in the main folder when behind).
2. `node <revisao>/scripts/reviews.mjs list`:
   - **NEW**: triage. `NEW VERSION`: same name already in progress (the reviewer ran again): triage the new one, compare with the old one, add a ` (dd-mm)` suffix when moving it.
   - `READY FOR DONE (n fixed, n dismissed)`: step 6.
   - `READY FOR DONE: K.. done or out of the map`: find each PR (`git log origin/main --first-parent --oneline -200`), mark the items `[x] (PR #n, Kn)` and go to step 6.
   - `fix tasks pending in the map`: nothing to do now; mention it in the summary.
   - `WITHOUT fix task`, `NOT TRACKED`, `SECTION WITHOUT ITEMS`: triage like a new one, without repeating items that already have a fix task.
3. Nothing listed (exit 1): reply "No review report to triage." and stop.

## Step 2: confirm each finding on main
1. Read the whole report, including "Doubts" and "No findings". Note the topic it reviews, the main commit it used, the tests and results, anything the reviewer created (test databases).
2. For each finding open the file:line on the current main. When it gives a short test or command, run it. Classify:
   - **confirmed**: the defect exists on main today;
   - **already fixed**: a newer PR solved it (quote it);
   - **not a defect**: accepted decision (quote the plan) or the reviewer misread (say why);
   - **doubt**: needs the user's decision.
3. The same finding in two reports (general × sensitive, new × old version): handle once, quote both.
4. Many large reports: one read-only search subagent per report may locate the code; the classification is always yours.

## Step 3: plan the fixes
1. Group the confirmed findings into tasks `<fixPrefix><n>`: one PR per problem; small findings in the same file or docs-only can go together. Ids: `reviews.mjs next-fix`.
2. Each task: short title, IA/model/effort, `depende` only when two tasks touch the same file, and whether it is a sensitive part.
3. Show the user one short message: per report, confirmed (with the proposed task), already fixed, not a defect (one-line reason) and doubts. Then ask the doubts (recommended option first) and the approval of the plan. Do not guess.

## Step 4: approved — write the fix topic in the map
1. Re-read the map lines right before the edit. Add the topic `{ id: "review-fixes-<date>", titulo: "Fixes from the reviews of <date>", descricao: "<findings checked on main <commit> and approved by the user on <date>; reports in <inProgress>; dismissed: ...>", tarefas: [...] }`.
2. Each task prompt: `Task <id> of the topic \"<title>\" in the map. Source report: <inProgress>\\<file> (<severity>, confirmed on main <commit>). Create the worktree <branch>. Problem: <file:line, concrete scenario>. Do: <fix decided, with the user's decision when there is one>. Test that fails first: <which>. Run <suites>.` + the project's standard task ending (the map constants the other tasks use, or the worktree/PR/merge/mark-done steps from the config).
3. On the topics the reports reviewed: `revisado: '<date>'`. Topics already `revisado` on an earlier day leave the map now (the `mapa` skill "Clean" rule; their history goes to the progress files).
4. Update `atualizado`. Run `mapa.mjs validate`.

## Step 5: tracking and folders
1. Tracking file: a new "Round" section at the top with every report triaged.
2. Report with open fix tasks: move from the inbox to `inProgress` (same name there = ` (dd-mm)` suffix). Attachments (a folder of screenshots of that report) go with it.
3. Report with nothing to fix: step 6.

## Step 6: move to done
For: a new report where every finding is "already fixed" or "not a defect" (no open doubt; dismissals only after the user answers), a report without findings, and a report in progress with every item `[x]`/`[-]` and the PRs merged.
1. Move the file (and attachments) to `done`. Same name there = ` (dd-mm)` suffix.
2. Run the `cleanup` commands from the config for that report, if any. Never delete anything the report did not create.
3. Tracking: ` — in done since <date>` on the report heading.
4. The topic it reviewed, with no open fix task: `revisado: '<date>'` (step 4.3), re-reading before and validating after.

## Step 7: summary
One short message: new fix topic (tasks, with IA/model), reports moved to each folder, cleanup done, topics marked reviewed or removed, open doubts. When the fix topic finishes, `prompt-revisao` writes its review prompt and the cycle repeats.

## Common mistakes
| Mistake | Right |
|---|---|
| Creating a fix task without opening the code on main | Confirm every finding first; many reviewer findings do not hold |
| Moving a report with an open doubt | Wait for the user's answer |
| Overwriting a report with the same name | ` (dd-mm)` suffix on the new one |
| Editing the map outside DADOS / `atualizado` | Only those |
