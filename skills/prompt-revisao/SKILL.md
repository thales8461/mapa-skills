---
name: prompt-revisao
description: Use right after marking a map task as done (feita) when that merge may have finished its topic (at the end of any map task, also inside /fila and /orquestrador), or when the user asks for the review prompt of a topic. Writes the final review prompt (plus an optional separate prompt for the sensitive part) into the topic's revisao field of the map.
---

# prompt-revisao: review prompt for a finished topic

When the last task of a topic becomes `feita: true`, the topic moves to "In review" and needs `revisao`: the prompt for an independent reviewer (another model or agent) that reads the code, runs the tests and writes a report. This skill writes that prompt. The `revisao` skill later triages the report.

Helper: `node <mapa skill folder>/scripts/mapa.mjs` (read-only). Config: `.claude/mapa.json` (see `skills/mapa/references/config.md`).

Reply in the project language (`language` in the config, default the user's).

## Step 1: did the topic finish?
Right after writing `feita: true` (always after the merge):

```bash
node <mapa>/scripts/mapa.mjs finished <task id>
```

- `PENDING` or `NOT FOUND`: nothing to do. Stop.
- `FINISHED ... revisao ALREADY FILLED`: do not overwrite. Tell the user the prompt already exists.
- `FINISHED ... paused`: do not write; tell the user.
- `FINISHED ... revisao EMPTY`: go on.

## Step 2: gather the material (do not read the whole code)
1. Task ids and titles: `mapa.mjs summary` and the topic in the map.
2. PR of each task: `git log origin/main --first-parent --oneline -200` (merge commits name the branch). The last one is "main after PR #N".
3. `planFiles` and `progressFiles` from the config: the plan section of the topic, the decisions that look like defects but are accepted, and what each PR changed. If needed, `gh pr view <N> --json files --jq '.files[].path'`.
4. Tests of the changed parts, and failures already known on main (outside this topic).

## Step 3: general × sensitive
`reviews.sensitiveAreas` in the config (default: login, session, 2FA, permissions and roles, row-level security, signing and certificates, data deletion).
- No sensitive part: one prompt, for `reviewer`.
- With a sensitive part and `reviews.sensitiveReviewer` set: two prompts. Part 1 (general) for `reviewer`; part 2 (sensitive) for `sensitiveReviewer`, smaller, only the sensitive PRs or routes. Part 1 says part 2 belongs to the other reviewer.

## Step 4: write the text
One JS string in double quotes, inner quotes as `\"`, Windows paths always with `\\`. Fixed order:

1. `Review of the topic \"<title>\" (repository <owner/repo>, main after PR #<last>).`
2. `PRs: #N (<id>, what it did, main file), ...` — every PR of the topic.
3. `Read first: <plan section>, <progress/doc sections>.`
4. `Check: (1) ...; (2) ...` — the real risks per area, concrete (function, route, rule decided in the plan, edge cases, permissions of each route, audit, UI states).
5. `Accepted decisions that are not defects: ...`
6. `Tests to run: ...` (only what applies).
7. `Failures already known on main, outside this topic: ...` (if any).
8. `Save the report at <reviews.folder>\\<yyyy-mm-dd> - <topic title>.md` (`, part 1 (general).md` / `, part 2 (sensitive).md` when split), `with the findings by severity (P1, P2, P3), file and line, and the checks without findings.`
9. The review rules: if the map defines constants for them (`reviews.promptTail`, e.g. `["TEST_DB", "REVIEW_RULES"]`), append `+ <CONST> + <CONST>` outside the quotes. Otherwise end the text with: `Rules: only read the code and run tests; do not edit files, commit, open PRs or touch the map; the report is the only file written. Each finding with severity (P1 = wrong data, data exposed, undue access or breakage; P2 = decided rule not followed or case not handled; P3 = minor), confidence (high, medium, low), file:line, the concrete scenario and, when possible, the failing test or command. No style, naming, formatting or refactoring. Before reporting, check it is not an accepted decision nor already fixed on a newer main. Low-confidence items go to a "Doubts" section at the end. Finish with what was checked without findings and the tests run, with results.`

Prompt object: `{ ia: "<gemini|gpt|claude>", modelo: "<model>", esforco: "alto", rotulo: "Review (<reviewer>)", texto: "..." }` — `ia` and `modelo` from `reviewer` / `sensitiveReviewer`; add `gasto` only for reviewers that share the user's own usage limit.

## Step 5: write it in the map
1. Re-read the topic lines right before the edit (another session may have changed them).
2. Add `revisao: [ ... ],` after the closing of the topic's `tarefas` array. Change only that field and `atualizado`.
3. `mapa.mjs validate`. An error means fixing your own edit before anything else.

## Step 6: tell the user
One line at the end of the task message: `Topic "<title>" finished. Review prompt in the map (<reviewer>[ + <sensitiveReviewer> for the sensitive part]). The report goes to <reviews.folder>; then run /revisao.` Do not paste the whole prompt unless asked (the map has a Copy button).

## Special cases
- **Fix topic (from /revisao):** same format; in "Check", each fix task with its original finding (report and item) and what the fix must guarantee, and ask the reviewer to confirm the original finding does not come back.
- **Task marked done outside a task session** (the user merged by hand): run step 1 the same way.
