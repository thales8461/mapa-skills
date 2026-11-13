---
name: pos
description: Use when the user sends /pos <task ids> (ex.: /pos A1, /pos A1 A3) before pasting the prompt of a task from the project map (mapa HTML). The session waits until the named tasks are marked done (merged), even when the pasted task does not depend on them, then runs the prompt. It also respects the pasted task's own depende.
---

# /pos: run the task only after another one finishes

Typical use: A1 and A2 could run in parallel, but the user wants one after the other (same files, a busy machine, reviewing one first). In the A1 session the user pastes the prompt as usual. In the A2 session the user sends `/pos A1` and pastes the A2 prompt. A2 starts only when A1 is `feita: true` in the map, that is, merged.

It is `/fila` with ids chosen by the user. Reply in the user's language. Helper: `node <mapa skill folder>/scripts/mapa.mjs` (below: `mapa.mjs`); the `mapa` skill folder is the sibling of this one (`../mapa`).

## Step 1: receive the ids and the prompt
- `/pos` with no id: ask "Wait for which task? (e.g. /pos A1)" and stop.
- `/pos <ids>` with no prompt: keep the ids (space or comma separated, written as in the map) and reply only "Pos on: waiting for <ids>. Paste the task prompt." The next message is the prompt.
- `/pos <ids> <prompt>`: the first tokens that look like task ids (letters + digits, optional `-`, e.g. `A1`, `VS-5`) are the ids; the rest is the prompt.

Run nothing from the prompt (worktree, file reads, code) before step 3 releases it.

## Step 2: identify
1. Save the pasted prompt, unchanged, to `pos-prompt.txt` in the session scratchpad (or a temp folder).
2. `mapa.mjs identify "<file>"`:
   - `NOT IDENTIFIED` or `AMBIGUOUS`: ask the user which task it is. Do not guess. (A prompt that is not in the map can go on without the `fila` mark if the user confirms.)
   - `WARNING: ... already marked as done`: ask whether to run it anyway.
   - `PROMPT:` with an `ia` other than `claude`: say so and ask whether to go on.
3. Wait list = the `/pos` ids + the task's own `WAIT:` ids (no repeats). If a `/pos` id is the task itself, drop it and say so.
4. `mapa.mjs check <list>`. A `/pos` id reported as "not in the map, counts as done": ask the user whether the id is right before going on (a typo would release the task at once).

## Step 3: release or wait
- Exit 0: "Task X released (<ids> already done)." and run the prompt.
- Exit 1: write `fila: '<dd/mm hh:mm>'` on the task (same rules as `/fila`: re-read the lines before the edit, touch only this field, do not change `atualizado`), say "Task X waiting for <list>. I check the map every 5 min." and start in the background (`run_in_background: true`):

  ```bash
  until node <mapa skill folder>/scripts/mapa.mjs check <list>; do s=$?; [ $s -eq 2 ] && exit 2; sleep 300; done
  ```

  End the turn with one short line. Do nothing else while waiting; the notification arrives when the loop ends.

## Step 4: when the loop ends
- Exit 0: run `check` once more. Confirmed: remove `fila`, say "<ids> done. Starting task X." and run the saved prompt from the start. If the project uses worktrees, create it now from an updated `origin/main` (`git fetch` first), so it already has the merge of the task it waited for.
- Exit 2: show the `ERROR:` line and ask the user. Do not run the task.
- A user message during the wait: answer and keep the loop, unless the user asks to stop (TaskStop). When stopping, remove `fila`.

## When the task ends
Same as `/fila`: mark `feita: true` only after the merge (remove `trabalhando`, `pr`, `fila`) and use the `prompt-revisao` skill. That releases any other session in `/pos` of this task.

## Limits
- The wait is for `feita` in the map (the merge), not for the other session to end. An open PR without merge still holds.
- Works only while the session stays open. A dead session leaves `fila` behind; the next `/pos` or `/fila` of the same task overwrites it.
- Chains work: a third session with `/pos A2` waits for A2, which waits for A1.
