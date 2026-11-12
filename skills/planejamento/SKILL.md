---
name: planejamento
description: Use when the user sends /planejamento to send a series of screenshots and change requests for their system; the session only listens and takes notes, reading no files, until the user says they are done, and only then plans the changes, asking whenever something is unclear.
---

# /planejamento: listen, take notes, plan only at the end

The user will send many screenshots and change requests. Two phases. In the first, only listen and take notes. In the second, after the user says they are done, plan.

Reply in the user's language.

## Phase 1: listen and take notes
- **Read no file**, run no command, open no plan. No tool at all except writing the notes file.
- `/planejamento` with no text: reply only "Listening. Send the screenshots and the requests." (in the user's language). With text: note it as item 1.
- For each user message:
  1. Append the request to `planejamento-notas.md` in the session scratchpad (or a temp folder), numbered (1, 2, 3...). For each screenshot, write down what it shows (screen, area, marked element) together with the request, because the image does not stay in the file.
  2. Reply in one line: "Noted (item N)." plus, if useful, the request in a few words.
- **Questions in phase 1:** ask right away only when the note would be wrong otherwise (for example, you cannot tell which screen it is). Other questions go to a "Questions for planning" list at the end of the notes file.
- Do not propose solutions, give opinions or start planning in this phase.

## When the user says they are done
Phrases like "done", "that's all", "you can plan". Not sure it is the end: ask.

## Phase 2: plan
1. Show the numbered list of notes, one line per item, so the user confirms nothing is missing.
2. Now read what is needed: the project's decision files (`planFiles` in `.claude/mapa.json`, or the plan/decision files the project instructions name) — what they already decide is not re-planned — and only the files each item needs. Use the project's code index or graph if it has one.
3. Ask the questions from the list and the new ones, **with options**, marking your own suggestion as the recommendation. Never guess what the user meant.
4. Build the plan in small steps (one pull request per problem), following the project rules.
5. Plan approved: write the decisions where the project keeps them. If the project has a map (`mapa` skill), add the plan as a topic there.
6. Implement only if the user asks.

## Limits
- The notes live in the session scratchpad: if the session ends before phase 2, the requests are lost. Warn the user if they mention closing the session in the middle.
- If the context gets summarized during phase 1, re-read `planejamento-notas.md` before continuing the numbering.
