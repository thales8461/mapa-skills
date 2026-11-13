---
name: orquestrador
description: Use when the user sends /orquestrador with a topic of the project map (mapa HTML), a range of task ids (for example A10 to A20) or a list of ids to run; the session becomes the orchestrator that runs those tasks with subagents until they are done.
---

# /orquestrador: run many map tasks with subagents

This session becomes the **orchestrator**. It does not implement tasks. It creates the worktrees, launches one subagent per task, reviews, asks before merging and merges. The user often leaves the computer on and follows from the phone.

Reply in the user's language. Helper: `node <mapa skill folder>/scripts/mapa.mjs` (below: `mapa.mjs`); the `mapa` skill is the sibling folder `../mapa`. Project settings: `.claude/mapa.json` (keys in `../mapa/references/config.md`); read it at the start. Missing keys use the defaults there.

## Step 0: Remote Control and phone alerts
- The model cannot turn on Remote Control. In the first reply, if Remote Control is not on, ask: "Type `/rc` (or `/remote-control`) to follow from your phone." Go on without waiting. It can also be on for every session (`remoteControlAtStartup: true` in `~/.claude/settings.json`, or "Enable Remote Control for all sessions").
- Load `PushNotification` if available (ToolSearch `select:PushNotification`). Use it for every question to the user and when a task is ready.

## Step 1: read the request
The text after `/orquestrador` can be:
- a topic (id or part of the title): `mapa.mjs tasks <dir> <topic>`;
- a range: "from A10 to A20" becomes `mapa.mjs tasks <dir> A10..A20`;
- loose ids: `mapa.mjs tasks <dir> A3 A7 K71`;
- "priority on X": note X as the priority.

`<dir>` = `<scratchpad>/orquestrador/prompts`. The helper writes one `<id>.txt` per task with the Claude prompt (constants resolved) and prints JSON with the pending `tasks`, `alreadyDone` and `waves`.

`AMBIGUOUS`, `NOT FOUND` or `ERROR`: ask the user with options. Do not guess.

Before starting, show the plan in a few lines: waves, model and effort of each task, what runs in parallel. Then start without waiting. Ask first only when:
- a task has `trabalhando: true` or `pr` (another session may be on it);
- a task has no Claude prompt (only another AI);
- `dependsOutsideSelectionPending` is not empty;
- `waves` ends with `blocked`.

## Step 2: execution order
- A task is **ready** when each dependency is done in the map **or** has its PR ready (reviewed and approved by you), even if not merged yet.
- Ready tasks with no dependency between them run in parallel.
- **Priority on X:** run only X (and its missing dependencies) until X is ready. Only then release the others.
- Machine limits: at most `parallel.max` tasks at once (default 4) and `parallel.maxHeavy` heavy ones (default 2; `heavyHint` says what is heavy).
- Tasks that change the same generated file (PDF, screenshot, lock file) run one after the other.

## Step 3: launch each task
For each ready task, in this order:
1. **Worktree, one at a time:** `worktree.create` with the branch named in the prompt. Never create two at the same time.
2. **Dependency not merged yet:** in the new worktree, `git merge origin/<dependency branch>` for each missing one. Write in the PR description: "Depends on #N; merge after it."
3. **Map:** write `trabalhando: true` on the task (re-read the lines right before the edit; touch only this field).
4. **Subagent** (Agent tool, in the background). Model from the prompt: Opus → `opus`, Sonnet → `sonnet`, Haiku → `haiku`. Brief, in this order:
   - the whole text of `<id>.txt`;
   - the worktree absolute path, and `subagentNotes` from the config;
   - what the other parallel tasks are changing;
   - **new ending:** "Open the PR and stop. Do not merge, do not remove the worktree, do not mark `feita` in the map. Actually write the files the prompt asks to update.";
   - **questions:** "Do not ask the user. If a question changes the result, stop and end the report with one line `QUESTION: <question> | options: ... | suggestion: ...`.";
   - final report: PR number, tests run with results, what was left out.

## Step 4: questions (fixed chain)
1. The orchestrator answers when the answer is in the plan files, the project instructions, the prompt or the code.
2. Otherwise consult **Fable** (Agent, `model: fable`, read-only) with the question, the context and the options. Check its recommendation against the real environment before using it.
3. When neither the orchestrator nor Fable is sure: **do nothing on that task.** Ask the user (text + PushNotification, options with the suggestion marked) and keep the other tasks running. Questions have no timeout: the task waits for the answer.

After the answer, continue the same subagent with SendMessage (do not start a new one).

## Step 5: review when a subagent finishes
- Read the real diff (`gh pr diff <N>`): the prompt was followed, tests cover the change, `progressFiles` updated, no secrets or private data.
- Run the tests of the changed area if the subagent did not show the results.
- Problem: send it back to the same subagent with SendMessage. A subagent with a background process that repeats its report: TaskStop once the PR exists.
- Approved: the PR is **ready**. Tasks that depend on it can start (step 2).

## Step 6: ask to merge (timed wait)
For each ready PR:
1. Send in the chat and by PushNotification: "Task X ready (PR #N: summary). Can I merge? (no answer in 2 min: I leave it for the end)" — use `mergeWaitSeconds` (default 120).
2. Start `sleep <mergeWaitSeconds>` in the background (Bash, `run_in_background: true`) and end the turn. The other tasks keep running.
3. "Yes" before the sleep notification: merge (step 7). "No": leave it for the end.
4. Sleep notification with no answer: put X in the **"merge at the end"** list and go on. A late answer applies to that list.

## Step 7: merge (one PR at a time)
1. In the worktree: `git fetch` and `git merge origin/main`. Resolve conflicts in progress/doc files by keeping main first and re-adding the branch's part. Run the tests of the changed area again.
2. `mergeCommand` (default `gh pr merge {pr} --merge`) and confirm it merged (`gh pr view <N> --json state` = `MERGED`). Only then `worktree.remove`.
3. Map: `feita: true` (remove `trabalhando`, `pr`, `fila`) and update `atualizado`.
4. Main folder: `afterMerge` commands (default `git pull`).
5. A PR that depends on an unmerged one: merge only after it, already with `git merge origin/main`.

## Step 8: end
- Nothing left running: list the "merge at the end" PRs in dependency order and ask once (no timeout). Merge the approved ones with step 7.
- A topic finished completely: `prompt-revisao` skill (writes the topic's `revisao`).
- Final summary: merged, still open, unanswered questions, warnings.

## Long runs and usage limits
- Keep `<scratchpad>/orquestrador/ESTADO.md`: tasks, subagent of each, worktree, PR, status (running, ready, merge at the end, merged, question), next step.
- At the start, create a `/loop 30m` (Skill `loop`): "Continue the orchestration of this session from the orchestrator ESTADO.md; if everything is done, stop the loop."

## Common mistakes
| Mistake | Right |
|---|---|
| Subagent merges because the map prompt says so | The brief replaces the ending: open the PR and stop |
| Two worktrees created at the same time | One at a time, before launching the subagents |
| More heavy tasks than `maxHeavy` | Respect the limit |
| Waiting for the dependency merge to start the next task | A ready PR already releases it (merge its branch into the new worktree) |
| Blocking everything while waiting for "can I merge?" | Background `sleep` and go on |
| Picking the most likely option when unsure | Orchestrator → Fable → user; without certainty, the task stops |
| Writing the map from an old copy | Re-read right before each edit (other sessions write too) |
| Marking `feita` before the merge | Only after `state: MERGED` |
