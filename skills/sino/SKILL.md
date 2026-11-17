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

## When to remove
As soon as the user answers (approved, adjusted or refused). When a task is marked `feita`, remove the items that name it in `tarefa`. An item with no answer for days: mention it in the next conversation and ask if it still applies.

## How to write
The map is edited by many sessions.
1. Read only the `aprovacoes:` lines right before the edit (for example `grep -n -A 12 "aprovacoes:"`), not the whole file.
2. Change only the `aprovacoes` array. Do not touch `atualizado` (the bell is not a map change).
3. If the edit fails because the file changed, read the lines again and retry.
4. Put no personal or client data in `titulo` or `detalhe`.
5. `node <mapa skill>/scripts/mapa.mjs validate` after editing; `summary` prints the `BELL:` lines.

After writing, say in one line: "Bell: <titulo>."
