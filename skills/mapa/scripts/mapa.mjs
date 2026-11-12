#!/usr/bin/env node
// mapa.mjs: command line helper for the map (mapa) HTML file.
// It never edits an existing map; agents edit the DADOS block with their own edit tool.
//
// Commands:
//   init <file> [--name <project>] [--lang pt|en] [--reviewer <name>] [--empty]
//        Create a new map from the template. Refuses to overwrite.
//   summary                         Topics with group and progress.
//   validate                        Check ids, dependencies, cycles and required fields.
//   tasks <out-dir> <selection...>  Write <id>.txt with the Claude prompt of each selected task
//                                   and print JSON with the pending tasks and the waves.
//        selection = topic id or part of its title | range "A1..A9" | task ids "A1 A3".
//   identify <prompt-file>          Find the task whose prompt matches the pasted text.
//   check <id> [id...]              Exit 0 when every id is done (feita) or no longer in the map.
//
// Map location (first that exists): --map <file>, env MAPA_FILE, "map" in .claude/mapa.json
// (searched from the current folder upwards; relative paths are relative to the project root).
// Exit codes: 0 = ok, 1 = pending / not found / ambiguous / invalid, 2 = error.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(AQUI, '..', 'assets', 'mapa-template.html');

function erro(msg) { console.log(`ERROR: ${msg}`); process.exit(2); }

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opcoes = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const k = a.slice(2);
    if (k === 'empty') opcoes.empty = true;
    else { opcoes[k] = argv[i + 1]; i++; }
  } else pos.push(a);
}

// ---------- config and map path ----------
function acharConfig() {
  let d = process.cwd();
  for (;;) {
    const f = join(d, '.claude', 'mapa.json');
    if (existsSync(f)) {
      try { return { raiz: d, config: JSON.parse(readFileSync(f, 'utf8')) }; }
      catch (e) { erro(`invalid JSON in ${f} (${e.message})`); }
    }
    const pai = dirname(d);
    if (pai === d) return null;
    d = pai;
  }
}
function caminhoMapa() {
  if (opcoes.map) return resolve(opcoes.map);
  if (process.env.MAPA_FILE) return resolve(process.env.MAPA_FILE);
  const c = acharConfig();
  if (c && c.config.map) return isAbsolute(c.config.map) ? c.config.map : join(c.raiz, c.config.map);
  erro('map not found: pass --map <file>, set MAPA_FILE or create .claude/mapa.json with {"map": "<path>"}');
}

// ---------- reading the DADOS block ----------
// Takes the <script> that contains "const DADOS", from its start to the "};" that closes DADOS,
// so constants declared before DADOS (FIM, NB...) are resolved inside the prompts.
function lerDados(arquivo) {
  let html;
  try { html = readFileSync(arquivo, 'utf8'); } catch (e) { erro(`cannot read the map at ${arquivo} (${e.code || e.message})`); }
  const iDados = html.indexOf('const DADOS');
  if (iDados < 0) erro('"const DADOS" not found in the map');
  const marca = html.lastIndexOf('// <mapa-dados>', iDados);
  const inicio = marca >= 0 ? marca : html.lastIndexOf('<script>', iDados) + '<script>'.length;
  const resto = html.slice(inicio);
  const fim = resto.slice(iDados - inicio).search(/^\};[ \t]*$/m);
  if (fim < 0) erro('the "};" that closes DADOS was not found (it must be alone on its line)');
  const codigo = resto.slice(0, iDados - inicio + fim + 2);
  try { return new Function(codigo + '\nreturn DADOS;')(); }
  catch (e) { erro(`the DADOS block is not valid JavaScript (${e.message})`); }
}
function indexar(dados) {
  const porId = new Map();
  const repetidos = [];
  for (const assunto of dados.assuntos || []) {
    for (const tarefa of assunto.tarefas || []) {
      if (porId.has(tarefa.id)) repetidos.push(tarefa.id);
      porId.set(tarefa.id, { tarefa, assunto });
    }
  }
  return { porId, repetidos };
}
function carregar() {
  const arquivo = caminhoMapa();
  const dados = lerDados(arquivo);
  const { porId, repetidos } = indexar(dados);
  if (repetidos.length) erro(`repeated task ids in the map: ${[...new Set(repetidos)].join(', ')}`);
  return { arquivo, dados, porId };
}
const sem = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const normalizar = (s) => String(s).replace(/\s+/g, ' ').trim();
function grupoDe(a) {
  if (a.pausa) return 'paused';
  if (a.revisado) return 'reviewed';
  const n = (a.tarefas || []).filter((t) => t.feita === true).length;
  if (n === 0) return (a.tarefas || []).some((t) => t.trabalhando || t.pr) ? 'in-progress' : 'not-started';
  return n < a.tarefas.length ? 'in-progress' : 'awaiting-review';
}

// ---------- commands ----------
// Portuguese version of the example topic in the template.
const EXEMPLO_PT = [
  ["titulo: 'Example: export report'", "titulo: 'Exemplo: exportar relatório'"],
  ["'Delete this assunto and add your own. Three tasks: EX2 and EX3 depend on EX1 and can run in parallel.'", "'Apague este assunto e acrescente os seus. Três tarefas: EX2 e EX3 dependem da EX1 e podem rodar em paralelo.'"],
  ["'API: report endpoint'", "'API: rota do relatório'"],
  ["'Web: export button'", "'Web: botão Exportar'"],
  ["'Docs: export section'", "'Documentação: seção de exportação'"],
  ["'Task EX1 of the map. Create a branch ex1-report-api. Add GET /reports/{id}/export returning CSV, with tests.'", "'Tarefa EX1 do mapa. Criar a branch ex1-relatorio-api. Acrescentar GET /reports/{id}/export devolvendo CSV, com testes.'"],
  ["'Task EX2 of the map. Create a branch ex2-export-button. Add an Export button on the report page that calls the EX1 endpoint.'", "'Tarefa EX2 do mapa. Criar a branch ex2-botao-exportar. Acrescentar o botão Exportar na página do relatório, chamando a rota da EX1.'"],
  ["'Task EX3 of the map. Create a branch ex3-export-docs. Document the EX1 endpoint in the README.'", "'Tarefa EX3 do mapa. Criar a branch ex3-docs-exportar. Documentar a rota da EX1 no README.'"],
  ["esforco: 'medium'", "esforco: 'médio'"], ["esforco: 'low'", "esforco: 'baixo'"],
];

function init(arquivo) {
  if (!arquivo) erro('usage: init <file> [--name <project>] [--lang pt|en] [--reviewer <name>] [--empty]');
  const destino = resolve(arquivo);
  if (existsSync(destino)) erro(`${destino} already exists; not overwriting`);
  let html = readFileSync(TEMPLATE, 'utf8');
  const lit = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const trocar = (campo, valor) => {
    const re = new RegExp(`^(\\s*${campo}: )'[^']*'`, 'm');
    if (!re.test(html)) erro(`template without the field ${campo}`);
    html = html.replace(re, `$1${lit(valor)}`);
  };
  const lang = opcoes.lang === 'pt' ? 'pt' : opcoes.lang === 'en' ? 'en' : 'pt';
  trocar('projeto', opcoes.name || 'Projeto');
  trocar('idioma', lang);
  trocar('revisor', opcoes.reviewer || 'Codex');
  trocar('caminho', destino);
  trocar('atualizado', new Date().toISOString().slice(0, 10));
  if (lang === 'pt') html = html.replace("const FIM = ' When done, open the PR and report the PR number, the tests you ran and what is left.';",
    "const FIM = ' Ao terminar, abrir a PR e informar o número dela, os testes rodados e o que ficou de fora.';");
  if (lang === 'pt') for (const [de, para] of EXEMPLO_PT) html = html.split(de).join(para);
  if (opcoes.empty) {
    const i = html.indexOf('  assuntos: [');
    const j = html.indexOf('\n};\n// </mapa-dados>');
    if (i < 0 || j < 0) erro('template markers not found');
    html = html.slice(0, i) + '  assuntos: []' + html.slice(j);
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, html, 'utf8');
  lerDados(destino);
  console.log(`CREATED: ${destino}`);
}

function summary() {
  const { arquivo, dados } = carregar();
  console.log(`MAP: ${arquivo} (updated ${dados.atualizado || '-'})`);
  for (const a of dados.assuntos || []) {
    const t = a.tarefas || [];
    const feitas = t.filter((x) => x.feita === true).length;
    const trab = t.filter((x) => !x.feita && (x.trabalhando || x.pr)).map((x) => x.id);
    console.log(`${a.id} | ${grupoDe(a)} | ${feitas}/${t.length} | ${a.titulo}` +
      (trab.length ? ` | working: ${trab.join(' ')}` : '') + (a.revisado ? ` | reviewed ${a.revisado}` : '') + (a.pausa ? ` | paused: ${a.pausa}` : ''));
  }
}

function validate() {
  const arquivo = caminhoMapa();
  const dados = lerDados(arquivo);
  const { porId, repetidos } = indexar(dados);
  const problemas = [];
  const avisos = [];
  if (repetidos.length) problemas.push(`repeated task ids: ${[...new Set(repetidos)].join(', ')}`);
  const idsAssunto = new Set();
  for (const a of dados.assuntos || []) {
    if (!a.id || !a.titulo) problemas.push(`topic without id or titulo: ${a.id || a.titulo || '?'}`);
    if (idsAssunto.has(a.id)) problemas.push(`repeated topic id: ${a.id}`);
    idsAssunto.add(a.id);
    if (!Array.isArray(a.tarefas) || !a.tarefas.length) problemas.push(`topic ${a.id} without tarefas`);
    for (const t of a.tarefas || []) {
      if (!t.id || !t.titulo) problemas.push(`task without id or titulo in ${a.id}`);
      for (const d of t.depende || []) if (!porId.has(d)) avisos.push(`${t.id} depends on ${d}, which is not in the map (counts as done)`);
      for (const p of t.prompts || []) {
        if (!p.ia || !p.texto) problemas.push(`${t.id}: prompt without ia or texto`);
        if (p.gasto != null && p.gasto !== 'extremo' && !(Number(p.gasto) >= 1 && Number(p.gasto) <= 10)) problemas.push(`${t.id}: gasto must be 1..10 or 'extremo'`);
      }
      if (t.feita && (t.trabalhando || t.pr || t.fila)) problemas.push(`${t.id}: feita together with trabalhando/pr/fila`);
    }
  }
  // cycles
  const estado = new Map();
  const ciclo = (id, pilha) => {
    if (estado.get(id) === 'feito') return;
    if (estado.get(id) === 'visitando') { problemas.push(`dependency cycle: ${[...pilha, id].join(' -> ')}`); return; }
    estado.set(id, 'visitando');
    for (const d of porId.get(id)?.tarefa.depende || []) if (porId.has(d)) ciclo(d, [...pilha, id]);
    estado.set(id, 'feito');
  };
  for (const id of porId.keys()) ciclo(id, []);
  if (avisos.length) console.log(`WARNINGS (${avisos.length}):\n- ` + avisos.join('\n- '));
  if (problemas.length) { console.log(`INVALID (${problemas.length}):\n- ` + problemas.join('\n- ')); process.exit(1); }
  console.log(`VALID: ${arquivo} (${idsAssunto.size} topics, ${porId.size} tasks)`);
}

function selecionar(dados, porId, args) {
  const texto = args.join(' ').trim();
  const m = texto.match(/^(\S+)\s*\.\.\s*(\S+)$/);
  if (m) {
    const [a, b] = [porId.get(m[1]), porId.get(m[2])];
    if (!a || !b) { console.log(`NOT FOUND: task id ${!a ? m[1] : m[2]} is not in the map`); process.exit(1); }
    if (a.assunto !== b.assunto) { console.log(`NOT FOUND: ${m[1]} and ${m[2]} are in different topics`); process.exit(1); }
    const lista = a.assunto.tarefas;
    const [i, j] = [lista.indexOf(a.tarefa), lista.indexOf(b.tarefa)].sort((x, y) => x - y);
    return lista.slice(i, j + 1).map((t) => ({ tarefa: t, assunto: a.assunto }));
  }
  if (args.every((x) => porId.has(x))) return args.map((x) => porId.get(x));
  const alvo = sem(texto);
  const exatos = (dados.assuntos || []).filter((s) => sem(s.id) === alvo || sem(s.titulo) === alvo);
  const achados = exatos.length ? exatos : (dados.assuntos || []).filter((s) => sem(s.titulo).includes(alvo));
  if (achados.length === 1) return achados[0].tarefas.map((t) => ({ tarefa: t, assunto: achados[0] }));
  if (achados.length > 1) {
    console.log(`AMBIGUOUS: "${texto}" matches: ${achados.map((s) => `${s.id} ("${s.titulo}")`).join('; ')}`);
    process.exit(1);
  }
  console.log(`NOT FOUND: "${texto}" is not a topic, a range or a list of task ids`);
  process.exit(1);
}

function tasks(saida, args) {
  if (!saida || !args.length) erro('usage: tasks <out-dir> <selection...>');
  const { dados, porId } = carregar();
  const escolhidas = selecionar(dados, porId, args);
  mkdirSync(saida, { recursive: true });
  const ids = new Set(escolhidas.map((e) => e.tarefa.id));
  const feitas = new Set([...porId.values()].filter((x) => x.tarefa.feita === true).map((x) => x.tarefa.id));
  const linhas = [];
  for (const { tarefa, assunto } of escolhidas) {
    const prompts = tarefa.prompts || [];
    const claude = prompts.filter((p) => p.ia === 'claude');
    const principal = claude.find((p) => !/revis|review/i.test(p.rotulo || '')) || claude[0];
    if (principal) writeFileSync(join(saida, `${tarefa.id}.txt`), principal.texto || '', 'utf8');
    const deps = tarefa.depende || [];
    linhas.push({
      id: tarefa.id, titulo: tarefa.titulo, assunto: assunto.id,
      feita: tarefa.feita === true, trabalhando: tarefa.trabalhando === true, pr: tarefa.pr ?? null, fila: tarefa.fila ?? null,
      depende: deps,
      dependsOutsideSelectionPending: deps.filter((d) => !ids.has(d) && porId.has(d) && !feitas.has(d)),
      promptFile: principal ? join(saida, `${tarefa.id}.txt`) : null,
      ia: principal ? 'claude' : (prompts.map((p) => p.ia).join('+') || 'none'),
      modelo: principal?.modelo ?? null, esforco: principal?.esforco ?? null, gasto: principal?.gasto ?? null,
      subagentes: principal?.subagentes ?? null,
      otherPrompts: prompts.filter((p) => p !== principal).map((p) => `${p.ia}: ${p.rotulo || '-'}`),
    });
  }
  // Waves: only dependencies inside the selection hold a task back (outside ones are reported above).
  const pendentes = linhas.filter((l) => !l.feita);
  const pronto = new Set(feitas);
  const ondas = [];
  let resto = pendentes;
  while (resto.length) {
    const livres = resto.filter((l) => l.depende.every((d) => pronto.has(d) || !ids.has(d)));
    if (!livres.length) { ondas.push({ blocked: resto.map((l) => l.id) }); break; }
    ondas.push(livres.map((l) => l.id));
    livres.forEach((l) => pronto.add(l.id));
    resto = resto.filter((l) => !livres.includes(l));
  }
  console.log(JSON.stringify({ alreadyDone: linhas.filter((l) => l.feita).map((l) => l.id), tasks: pendentes, waves: ondas }, null, 2));
}

function estados(porId, ids) {
  return ids.map((id) => ({ id, feita: porId.has(id) ? porId.get(id).tarefa.feita === true : null }));
}
const descrever = (es) => es.map((e) => `${e.id} (${e.feita === null ? 'not in the map, counts as done' : e.feita ? 'done' : 'PENDING'})`).join(', ');

function identify(arquivo) {
  if (!arquivo) erro('usage: identify <prompt-file>');
  let colado;
  try { colado = normalizar(readFileSync(arquivo, 'utf8')); } catch (e) { erro(`cannot read ${arquivo} (${e.code || e.message})`); }
  if (!colado) erro('the prompt file is empty');
  const { porId } = carregar();
  const achadas = [];
  for (const { tarefa, assunto } of porId.values()) {
    for (const p of tarefa.prompts || []) {
      const texto = normalizar(p.texto || '');
      if (!texto) continue;
      if (colado.includes(texto) || (colado.length >= 80 && texto.includes(colado))) { achadas.push({ tarefa, assunto, prompt: p }); break; }
    }
  }
  if (achadas.length !== 1) {
    if (achadas.length > 1) console.log(`AMBIGUOUS: the prompt matches ${achadas.map((a) => a.tarefa.id).join(', ')}. Ask the user which one.`);
    else {
      const citados = [...porId.keys()].filter((id) => new RegExp(`(^|[^\\w-])${id.replace(/[-]/g, '\\-')}($|[^\\w-])`).test(colado));
      console.log('NOT IDENTIFIED: the prompt does not match any prompt in the map.');
      if (citados.length) console.log(`Ids quoted in the text: ${citados.join(', ')}. Confirm the task with the user.`);
    }
    process.exit(1);
  }
  const { tarefa, assunto, prompt } = achadas[0];
  const es = estados(porId, tarefa.depende || []);
  console.log(`TASK: ${tarefa.id} — ${tarefa.titulo}`);
  console.log(`TOPIC: ${assunto.id} — ${assunto.titulo}`);
  console.log(`PROMPT: ${prompt.rotulo || '-'} (${prompt.ia}, ${prompt.modelo}, effort ${prompt.esforco})`);
  if (tarefa.feita) console.log('WARNING: this task is already marked as done.');
  console.log(`DEPENDS: ${es.length ? descrever(es) : 'nothing'}`);
  const pend = es.filter((e) => e.feita === false).map((e) => e.id);
  console.log(pend.length ? `WAIT: ${pend.join(' ')}` : 'READY');
}

function check(ids) {
  if (!ids.length) erro('usage: check <id> [id...]');
  const { porId } = carregar();
  const es = estados(porId, ids);
  const pend = es.filter((e) => e.feita === false);
  console.log(`${new Date().toISOString()} ${pend.length ? 'PENDING' : 'ALL DONE'}: ${descrever(es)}`);
  process.exit(pend.length ? 1 : 0);
}

const [comando, ...resto] = pos;
switch (comando) {
  case 'init': init(resto[0]); break;
  case 'summary': summary(); break;
  case 'validate': validate(); break;
  case 'tasks': tasks(resto[0], resto.slice(1)); break;
  case 'identify': identify(resto[0]); break;
  case 'check': check(resto); break;
  default: erro('commands: init | summary | validate | tasks | identify | check (see the header of mapa.mjs)');
}
