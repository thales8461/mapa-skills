---
name: sino
description: Use whenever something in the project depends on the user's approval or answer (report, mockup, question page, plan, PR to merge, deploy, decision) and the session may end or move on without it, and when the user answers it. Adds or removes an item in `aprovacoes` of the project map, the bell at the top of the page.
---

# sino: tell the user, in the map, what waits for them

The map has a bell at the top (counter, panel, and the tab title gets `(n)`). It lists everything that waits for the user's approval or answer, so they see it in one place. Items live in `aprovacoes` of the `DADOS` block. Only agents write it. Empty list = bell without number.

Reply in the user's language. Find the map as the `mapa` skill does (`--map`, `MAPA_FILE` or `.claude/mapa.json`).

## When to add an item
When you leave something waiting for the user and move on, or end the turn:
- a report for the board, a mockup, a page of questions;
- a plan (`planejamento`, `revisao`) waiting for "approved";
- a PR ready for the merge, a deploy, a release tag;
- a decision that blocks a task of the map.

Do not add what the user answers right now in the same conversation (a direct question).

## Format
Inside `aprovacoes: [ ... ]`, one object per item:

```js
{ id: 'ex1-report', titulo: 'Report for the board', detalhe: 'Approve or adjust D1 to D3.', desde: '17/11 14:30', tarefa: 'EX1', link: 'https://...' },
```

- `id`: short and unique. If it exists, update `detalhe` and `desde` instead of adding a second one.
- `titulo`: one line, what the user must decide. `detalhe`: one sentence. `tarefa` and `link`: optional.
- `desde`: `dd/mm hh:mm`.
- `tipo`: leave it out for a real wait. `tipo: 'resposta'` is only for the notice that a subject of a question page was answered (see below).

## Questions go to a question page
When the map has `paginas` (fixed question pages, `references/perguntas.md` of the `mapa` skill), do not publish a new artifact for questions. Add a **subject** to the page of the person who must answer, with `ArtifactData` (`assuntos/<id>` and one `perguntas/<id>` per question, with options and the recommended one), and fill on the subject:
- `prioridade`: `baixa` (new module with only a study, or less), `media` (can wait, or phase 2), `alta` (needed for the next task, but other work can go first) or `urgente` (development blocked by these pending items);
- `sino`: the id of the bell item you add for it;
- `libera`: `[{ tarefa: '<id>', perguntas: ['<question ids>'] }]` for each task that waits for these answers (the task also gets `aguarda` with the page name and url).

Then add the bell item with `link` = the page url. `/ler-artifact` reads the answers, frees the tasks, and swaps the item for the notice below.

## Notice of an answered subject
`/ler-artifact` replaces the subject's bell item with:

```js
{ id: 'resp-<subject id>', tipo: 'resposta', titulo: 'Answered: <title> (<page>)', detalhe: 'Answers in memory (<file>). Freed: <tasks>.', desde: '26/11 09:00', link: 'https://...' },
```

The map shows an ✕ on it that hides it only in that browser, and the "Question pages" shortcut in the sidebar counts the notices not dismissed. Agents remove old notices when cleaning the map.

## Badge on the task that waits for an artifact
When the item names a `tarefa` and the wait is for an artifact (question page, report, mockup), also write on that task:

```js
aguarda: [{ nome: 'Questions to the tax team (Q11 to Q13)', url: 'https://...' }],
```

The map shows "Depends on artifact <nome>" with the name as a link (opens in a new tab) and blocks the task like `depende`. When you remove the bell item, remove the answered part of `aguarda` too (the whole field when it gets empty). This is a task change, so update `atualizado`.

## When to remove
As soon as the user answers (approved, adjusted or refused). When a task is marked `feita`, remove the items that name it in `tarefa`. An item with no answer for days: mention it in the next conversation and ask if it still applies.

## How to write
The map is edited by many sessions.
1. Read only the `aprovacoes:` lines right before the edit (for example `grep -n -A 12 "aprovacoes:"`), not the whole file.
2. Change only the `aprovacoes` array (and the task's `aguarda`, see above). The bell alone does not touch `atualizado`; `aguarda` does.
3. If the edit fails because the file changed, read the lines again and retry.
4. Put no personal or client data in `titulo` or `detalhe`.
5. `node <mapa skill>/scripts/mapa.mjs validate` after editing; `summary` prints the `BELL:` lines.

After writing, say in one line: "Bell: <titulo>."
