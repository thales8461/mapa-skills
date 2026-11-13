# Project config: `.claude/mapa.json`

Optional file in the project root. All keys are optional except `map`. The skills read it with the Read tool; `mapa.mjs` reads only `map`.

```json
{
  "map": "docs/mapa.html",
  "language": "pt",
  "planFiles": ["PLAN.md"],
  "progressFiles": ["CHANGELOG.md"],
  "worktree": {
    "create": "git worktree add ../{repo}-{branch} -b {branch} origin/main",
    "path": "../{repo}-{branch}",
    "remove": "git worktree remove ../{repo}-{branch} && git branch -D {branch}"
  },
  "parallel": { "max": 4, "maxHeavy": 2, "heavyHint": "tasks that start a server, a database or a browser" },
  "mergeWaitSeconds": 120,
  "mergeCommand": "gh pr merge {pr} --merge",
  "afterMerge": ["git pull"],
  "subagentNotes": "",
  "reviewer": "Codex",
  "reviews": {
    "folder": "docs/reviews",
    "inProgress": "docs/reviews/in-progress",
    "done": "docs/reviews/done",
    "tracking": "docs/reviews/TRACKING.md",
    "fixPrefix": "K",
    "sensitiveReviewer": "",
    "sensitiveAreas": ["login", "session", "2FA", "permissions and roles", "row-level security", "data deletion"],
    "promptTail": [],
    "cleanup": []
  }
}
```

| Key | Used by | Meaning |
|---|---|---|
| `map` | all | Path of the map HTML (absolute, or relative to the project root). |
| `language` | all | Language for replies and new maps (`pt` or `en`). |
| `planFiles` | planejamento, mapa | Files with decisions already made. Read before planning; never re-plan what they decide. |
| `progressFiles` | orquestrador | Files the task must update (the orchestrator checks the diff). |
| `worktree.create` / `path` / `remove` | orquestrador, fila | Commands with `{repo}` (folder name of the project) and `{branch}`. Without them, the orchestrator uses the defaults above. |
| `parallel.max` | orquestrador | Maximum tasks running at once. |
| `parallel.maxHeavy` | orquestrador | Maximum heavy tasks at once (see `heavyHint`). |
| `mergeWaitSeconds` | orquestrador | How long to wait for "can I merge?" before deferring the merge to the end. |
| `mergeCommand` | orquestrador | Merge command with `{pr}`. |
| `afterMerge` | orquestrador | Commands to run in the main folder after each merge. |
| `subagentNotes` | orquestrador | Extra text added to every subagent brief (ports, test database, local rules). |
| `reviewer` | mapa, prompt-revisao | Name shown for the final review of a finished topic; the reviewer of the review prompt. |
| `reviews.folder` / `inProgress` / `done` | revisao, prompt-revisao | Review report folders: inbox (not triaged), triaged with open fixes, nothing left to fix. |
| `reviews.tracking` | revisao | Markdown file with one section per report and the status of each finding. |
| `reviews.fixPrefix` | revisao | Prefix of the fix task ids (default `K`). |
| `reviews.sensitiveReviewer` | prompt-revisao | Second reviewer only for the sensitive part (empty = one prompt). |
| `reviews.sensitiveAreas` | prompt-revisao | What counts as sensitive. |
| `reviews.promptTail` | prompt-revisao | Names of map constants appended to every review prompt (e.g. `["REVIEW_RULES"]`); empty = the default rules are written in the text. |
| `reviews.cleanup` | revisao | Commands run when a report goes to done (`{report}` = file name). |
