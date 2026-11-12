---
name: mapa
description: Use when the user sends /mapa, asks to create a project map (roadmap HTML with topics, tasks, prompts and dependencies), to add an approved step-by-step plan to the map, to mark a map task as working or done, to pause or finish a topic, or to clean reviewed topics out of the map.
---

# /mapa: one HTML map for every plan in steps

The map is a single HTML file per project. Each **topic** (`assunto`) is one plan made of steps; each **task** (`tarefa`) is one pull request with a ready-to-copy prompt, the AI, the model, the effort and its dependencies. People open it in the browser; agents edit only its `DADOS` block. The skills `fila` and `orquestrador` read it.

Reply to the user in their language. The helper is `node <this skill folder>/scripts/mapa.mjs` (below: `mapa.mjs`). It never edits an existing map.

## Find the map
`mapa.mjs` looks for `--map <file>`, then `MAPA_FILE`, then `"map"` in `.claude/mapa.json` (searched upwards from the current folder; relative to the project root). All config keys: `references/config.md`.

No map yet: go to **Create**.

## Create
1. Ask: project name, language (`pt` or `en`), where to save, reviewer name for finished topics (default `Codex`), keep the example topic or start empty.
2. `mapa.mjs init <file> --name <project> --lang <pt|en> [--reviewer <name>] [--empty]`.
3. Offer to write `.claude/mapa.json` with `{"map": "<path>"}` so the other skills find it.

## Add a topic (after the user approves a plan)
1. Read `references/schema.md`.
2. One task per PR. Ids unique in the whole map (a short prefix per topic: `EX1`, `EX2`). `depende` only on real dependencies, so independent tasks show "Can run in parallel".
3. Each prompt is self-contained: task id and topic, branch name, what to read first, what to do, tests, how to finish. Put text repeated across prompts in a constant above `DADOS` and concatenate it.
4. Pick `modelo` and `esforco` per task (small or mechanical: Haiku/Sonnet low; normal feature: Sonnet medium; design-heavy or risky: Opus). Fill `gasto` 1–10.
5. Insert the topic into `assuntos`, update `atualizado`, run `mapa.mjs validate`.

## Update state
Edit only the field you own, after re-reading the lines:

| Event | Change |
|---|---|
| Agent starts a task | `trabalhando: true` |
| Non-Claude agent opens a PR | `pr: <number>` |
| PR merged (confirmed `MERGED`) | `feita: true`; remove `trabalhando`, `pr`, `fila` |
| Topic blocked by something external | `pausa: '<reason>'` on the topic |
| Last task of a topic merged | `revisao: [<review prompts>]` on the topic |
| Final review done | `revisado: '<date>'` on the topic |

Update `atualizado` on every change except `fila`.

## Clean
`mapa.mjs summary` lists topics with their group. Topics with `revisado` leave the map: show the list, confirm with the user, remove them. Record their history where the project keeps it (changelog, progress file), not in the map.

## Rules
- Only the `DADOS` block and `atualizado` change. The page layout changes only on the user's request.
- Re-read right before each edit; other sessions write to the same file. Never rewrite the block from an old copy.
- Never mark `feita` before the merge is confirmed.
