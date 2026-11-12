---
name: fila
description: Use when the user sends /fila before pasting the prompt of a task from the project map (mapa HTML), so the session waits until every task it depends on is marked done before running it.
---

# /fila: wait for the map dependencies, then run the task

The user opens one session per task, picks model and effort, sends `/fila` and pastes the prompt of a map task. Many sessions can wait at the same time. Each one starts only when every task in its `depende` list is `feita: true` in the map.

Reply in the user's language. Helper: `node <mapa skill folder>/scripts/mapa.mjs` (below: `mapa.mjs`). The `mapa` skill folder is the sibling of this one (`../mapa`). It finds the map through `.claude/mapa.json` or `MAPA_FILE` (see the `mapa` skill).

## Step 1: receive the prompt
- `/fila` with no text: reply only "Queue on. Paste the task prompt." (in the user's language) and wait. The next message is the prompt.
- `/fila <prompt>`: go to step 2 with that text.

Run nothing from the prompt (worktree, file reads, code) before step 3 releases it.

## Step 2: identify the task
1. Save the pasted prompt, unchanged, to `fila-prompt.txt` in the session scratchpad (or a temp folder).
2. Run `mapa.mjs identify "<file>"`.
3. Read the output:
   - `NOT IDENTIFIED` or `AMBIGUOUS`: ask the user which task it is, with the quoted ids as options. Do not guess.
   - `WARNING: ... already marked as done`: ask whether to run it anyway.
   - `PROMPT:` with an `ia` other than `claude`: say the prompt was written for another AI and ask whether to go on.

## Queue mark in the map
While waiting, the task carries `fila: 'dd/mm hh:mm'` (when it entered the queue). The map shows "Queued · waits for ...".
- Write: add `fila: '<dd/mm hh:mm>'` right after the task's `feita: false,`. Replace an old value if there is one.
- Remove: delete only the ` fila: '...',` of the task.
- Both: re-read the lines right before the edit and touch only this field. Do not change `atualizado`.

## Step 3: release or wait
- `READY`: say "Task X released (dependencies done)." and run the prompt. Remove a leftover `fila` first.
- `WAIT: <ids>`: write the `fila` mark, say "Task X queued, waiting for <ids>. I check the map every 15 min." and start in the background (`run_in_background: true`), with the ids:

  ```bash
  until node <mapa skill folder>/scripts/mapa.mjs check <ids>; do s=$?; [ $s -eq 2 ] && exit 2; sleep 900; done
  ```

  End the turn with one short line. Do nothing else while waiting; the notification arrives when the loop ends, at no token cost.

## Step 4: when the loop ends
- Exit 0: run `check` once more to confirm. Confirmed: remove `fila`, say "Dependencies done. Starting task X." and run the saved prompt from the start. If the project uses worktrees, create it now from an updated `origin/main` (`git fetch` first) so it includes the merged dependency.
- Exit 2 (map error): show the `ERROR:` line and ask the user. Do not run the task. Remove `fila` if the map still opens.
- A user message during the wait: answer it and keep the loop running, unless the user asks to stop (TaskStop). When stopping, remove `fila`.

## When the task ends
The prompt usually says to mark the task `feita: true` after the merge. That mark is what releases the other queued sessions. Re-read before the edit, touch only `feita` (remove `trabalhando`, `pr`, `fila`) and `atualizado`. Mark only after the merge.

## Limits
- Works only while the session stays open (editor open, computer on, not sleeping). A dead session leaves `fila` behind; the date in the badge shows it is old, and the next `/fila` of the same task overwrites it.
- A dependency no longer in the map counts as done.
