# Map schema (DADOS block)

The map is one HTML file. All data lives in the `DADOS` object, between the lines `// <mapa-dados>` and `// </mapa-dados>`. Constants declared above `DADOS` in the same block (for example `FIM`) can be concatenated into prompt texts.

Field names are in Portuguese. The table gives the English meaning.

## Top level

| Field | Meaning |
|---|---|
| `projeto` | Project name (title and logo letter). |
| `idioma` | Page language: `'pt'` or `'en'`. |
| `revisor` | Who runs the final review of a finished topic (default `Codex`). |
| `caminho` | Absolute path of the map file. It goes into copied prompts so any agent can find the map. |
| `atualizado` | Date of the last agent edit. Update it on every edit. A trailing `//` comment with a short change log is allowed. |
| `fixos` | Loose prompts pinned to the top: `{ titulo, descricao, ia, modelo, esforco, rotulo, texto }`. |
| `assuntos` | List of topics. |

## Topic (`assuntos[]`)

| Field | Meaning |
|---|---|
| `id` | Short unique slug (`'export-report'`). |
| `titulo` | Title. |
| `descricao` | One paragraph: the decision, where the plan is written. |
| `tarefas` | List of tasks, in execution order. |
| `pausa` | Optional. Reason the topic is on hold. Moves it to the "Paused" group. |
| `revisao` | Optional. Prompts for the final review (same shape as `prompts`). Added when all tasks are done. |
| `revisado` | Optional. Date of the final review. Moves the topic to "Done"; remove the topic in a later update. |

## Task (`tarefas[]`)

One task = one pull request.

| Field | Meaning |
|---|---|
| `id` | Unique in the whole map (`'EX1'`, `'K71'`). |
| `titulo` | Title. |
| `depende` | Ids that must be done first. An id no longer in the map counts as done. |
| `feita` | `true` only after the PR is merged. |
| `trabalhando` | `true` while an agent works on it. Remove when `feita` is set. |
| `pr` | PR number opened by a non-Claude agent, waiting for review. Remove when `feita` is set. |
| `fila` | `'dd/mm hh:mm'` while a `/fila` session waits for the dependencies. |
| `prompts` | List of prompts (usually one). |

## Prompt (`prompts[]`)

| Field | Meaning |
|---|---|
| `ia` | `'claude'`, `'gemini'`, `'gpt'` (other values show as plain text). |
| `modelo` | `Opus`, `Sonnet`, `Haiku`, `Fable`... |
| `esforco` | Effort level, free text (`low`, `medium`, `high`). |
| `rotulo` | Optional label (`'After /clear'`, `'Review of the Gemini PR'`). |
| `gasto` | Optional cost estimate 1–10 (level N ≈ 3·N % of the 5-hour usage window) or `'extremo'` (above 30 %). |
| `tempo` | Optional duration range (`'20–40 min'`). Without it, the page derives it from `gasto`. |
| `subagentes` | Optional short note on which subagents the prompt uses. Shows a badge. |
| `texto` | The prompt. A good prompt names the task id, the branch, what to read first, what to do, the tests, and how to finish. |

## Groups (computed)

- Not started: no task done (and none working / with PR).
- In progress: some done, or some working / with PR.
- In review: all done, `revisado` missing.
- Done: `revisado` set.
- Paused: `pausa` set.

## Editing rules for agents

1. Re-read the exact lines right before each edit; other sessions edit the same file.
2. Change only the fields you own. Never rewrite the block from an old copy.
3. Keep `};` that closes `DADOS` alone on its line.
4. Run `node <mapa skill>/scripts/mapa.mjs validate` after structural edits.
