# Question pages

Instead of publishing a new artifact for every round of questions, the project keeps a few **fixed question pages**, one per person or team (for example `Finance`, `Product`, `Me`). Each page is an artifact made from `assets/perguntas-template.html` that reads its questions from the artifact database, so asking something new is only a database write; the page is never republished for it.

The map lists the pages in `DADOS.paginas` (`{ nome, url, descricao? }`). `/ler-artifact` reads every page listed there.

## Create a page
1. Copy `assets/perguntas-template.html` and replace the placeholders:
   - `__TITULO__`: page title, 2 to 4 words (`Finance questions`);
   - `__SETOR__`: small label above the title (`Finance`);
   - `__IDIOMA__`: `pt` or `en`;
   - `__PAGINA__`: JSON of this page, `{ "id": "finance", "nome": "Finance" }`;
   - `__DESTINOS__`: JSON list of every page, `[{ "id": "finance", "nome": "Finance" }, { "id": "product", "nome": "Product" }, { "id": "me", "nome": "Me" }]` (the option "I don't know, forward to" lists all but the current one).
2. Publish it with the Artifact tool and these capabilities (load the `artifact-capabilities` skill first):

```json
{"db":{"rules":[{"path":"assuntos","read":"view","write":"admin"},{"path":"perguntas","read":"view","write":"admin"},{"path":"respostas","read":"view","write":"interact"}]},"user":{"scopes":["profile"]}}
```

   Viewers only read subjects and questions and write answers; only the owner (the agent, through `ArtifactData`) writes subjects and questions.
3. Share the page with the people who answer it, and add `{ nome, url, descricao }` to `DADOS.paginas` of the map.

When a new page is added, update `__DESTINOS__` on the other pages and republish them, so they can forward to it.

## Database

Three collections. Ids are free strings (short and unique: `export-format`, `export-format-q1`).

### `assuntos/<id>`: a subject (one collapsible menu on the page)

| Field | Meaning |
|---|---|
| `titulo` | Title of the subject. |
| `descricao` | Optional. One paragraph shown when the menu opens. |
| `prioridade` | `urgente`, `alta`, `media` or `baixa` (no value counts as `media`). Subjects are sorted by priority, then by `ordem`. See below. |
| `ordem` | Optional number to sort subjects of the same priority. |
| `criado` | Optional text shown as "since ..." (`'26/11'`). |
| `contexto` | Optional list of blocks shown by the "See the context" button, in a dialog about 80% of the screen. Blocks: `{ t: 'h', texto }`, `{ t: 'p', texto }`, `{ t: 'nota', texto }`, `{ t: 'codigo', texto }`, `{ t: 'lista', itens: [..] }`, `{ t: 'tabela', cabecalho: [..], linhas: [[..]] }`, `{ t: 'link', texto, url }`. Everything is shown as text; links only when `https://`. |
| `sino` | Optional. Id of the bell item (`DADOS.aprovacoes`) that waits for this subject. `/ler-artifact` replaces it with a `tipo: 'resposta'` notice when the subject is answered. |
| `libera` | Optional. Tasks this subject frees: `[{ tarefa: 'EX4', perguntas: ['q1', 'q2'] }]`. When those questions are answered, `/ler-artifact` removes the matching `aguarda` entry from the task. |
| `oculto` | Optional `true` hides the subject without deleting it. |

### `perguntas/<id>`: a question

| Field | Meaning |
|---|---|
| `assunto` | Id of the subject. |
| `codigo` | Short code shown before the text (`Q1`). |
| `texto` | The question. |
| `contexto` | Optional short paragraph under the question. |
| `link`, `link_texto` | Optional `https://` link to more material. |
| `opcoes` | `[{ id, texto, detalhe?, recomendado? }]`. The page always adds two fixed options after them: "I don't know, forward to: [page]" and, last, "Other" (free text). |
| `ordem` | Optional number to sort the questions of a subject. |

### `respostas/<id of the question>`: the answer (written by the page)

| Field | Meaning |
|---|---|
| `opcao` | Id of the chosen option, `'outro'` or `'nao_sei'`. |
| `outro` | Free text when `opcao` is `'outro'`. |
| `encaminhar` | Page id when `opcao` is `'nao_sei'` (forwarded). |
| `obs` | Optional note. |
| `por` | User id of who answered (names through `ArtifactData` `profiles`). |
| `em` | ISO date and time. |
| `pergunta` | Copy of the question text at the time of the answer. |

A question is **answered** when it has an answer whose `opcao` is not `'nao_sei'`. `'nao_sei'` is a **forward**: the map owner decides whether the question moves to the other page.

## Priority

| Value | When |
|---|---|
| `baixa` | A new module with only a study done, or not even that. |
| `media` | Can wait without getting in the way now, or belongs to a phase 2. |
| `alta` | Needed to run the next task, but other work can still go first. |
| `urgente` | Shown as "Urgent: development blocked by these pending items": it blocks a task or a topic and nothing else can go first. |

Fill `prioridade` on every subject, and put in `descricao` or `contexto` everything the person needs to answer without opening other files.
