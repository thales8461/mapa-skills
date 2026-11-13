#!/usr/bin/env node
// reviews.mjs: read-only helper for the revisao skill. Never moves or edits files.
//
// Commands:
//   list        Review reports in the inbox and in the in-progress folder, with their status
//               in the tracking file (untriaged items, fix tasks still open in the map, ready for done).
//   next-fix    Next free fix task id (prefix from "reviews.fixPrefix", default K).
//
// Config: "reviews" in .claude/mapa.json (all optional):
//   { "folder": "docs/reviews", "inProgress": "docs/reviews/in-progress",
//     "done": "docs/reviews/done", "tracking": "docs/reviews/TRACKING.md", "fixPrefix": "K" }
// Exit codes: 0 = ok, 1 = nothing to list, 2 = error.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MAPA_MJS = join(AQUI, '..', '..', 'mapa', 'scripts', 'mapa.mjs');

function erro(msg) { console.log(`ERROR: ${msg}`); process.exit(2); }

function acharConfig() {
  let d = process.cwd();
  for (;;) {
    const f = join(d, '.claude', 'mapa.json');
    if (existsSync(f)) {
      try { return { raiz: d, config: JSON.parse(readFileSync(f, 'utf8')) }; }
      catch (e) { erro(`invalid JSON in ${f} (${e.message})`); }
    }
    const pai = dirname(d);
    if (pai === d) return { raiz: process.cwd(), config: {} };
    d = pai;
  }
}

const { raiz, config } = acharConfig();
const r = config.reviews || {};
const abs = (p) => (isAbsolute(p) ? p : join(raiz, p));
const PASTA = abs(r.folder || 'docs/reviews');
const ANDAMENTO = abs(r.inProgress || join(r.folder || 'docs/reviews', 'in-progress'));
const CONCLUIDOS = abs(r.done || join(r.folder || 'docs/reviews', 'done'));
const TRACKING = abs(r.tracking || join(r.folder || 'docs/reviews', 'TRACKING.md'));
const PREFIXO = r.fixPrefix || 'K';
const reFix = new RegExp(`\\b${PREFIXO}\\d+\\b`, 'g');

function arquivos(pasta) {
  if (!existsSync(pasta)) return [];
  const fora = new Set([ANDAMENTO, CONCLUIDOS, TRACKING].map((p) => p.toLowerCase()));
  return readdirSync(pasta)
    .filter((n) => n.toLowerCase().endsWith('.md') && !fora.has(join(pasta, n).toLowerCase()))
    .filter((n) => statSync(join(pasta, n)).isFile());
}

// Tracking section: a "##" or "###" heading that quotes the report file name (or its base name
// without parentheses, plus a "(dd-mm)" suffix when the file has one).
function secao(linhas, nome) {
  const semExt = nome.replace(/\.md$/i, '');
  const titulo = (l) => /^#{2,3} /.test(l);
  let i = linhas.findIndex((l) => titulo(l) && l.includes(semExt));
  if (i < 0) {
    const sufixo = (semExt.match(/\((\d{2}-\d{2})\)$/) || [])[1];
    const base = semExt.replace(/\s*\([^)]*\)/g, '').trim();
    i = linhas.findIndex((l) => titulo(l) && l.includes(base) && (sufixo ? l.includes(`(${sufixo})`) : true));
  }
  if (i < 0) return null;
  const nivel = linhas[i].match(/^#+/)[0].length;
  let j = i + 1;
  while (j < linhas.length) {
    const m = linhas[j].match(/^(#{2,3}) /);
    if (m && m[1].length <= Math.max(nivel, 3)) break;
    j++;
  }
  const corpo = linhas.slice(i, j);
  const abertas = corpo.filter((l) => /^\s*- \[ \]/.test(l));
  return {
    abertos: abertas.length,
    semFix: abertas.filter((l) => !new RegExp(`^\\s*- \\[ \\]\\s*\\(${PREFIXO}\\d+`).test(l)).length,
    feitos: corpo.filter((l) => /^\s*- \[x\]/i.test(l)).length,
    descartados: corpo.filter((l) => /^\s*- \[-\]/.test(l)).length,
    fixes: [...new Set(abertas.flatMap((l) => l.match(reFix) || []))],
  };
}

function pendentesNoMapa(ids) {
  if (!ids.length) return [];
  const p = spawnSync(process.execPath, [MAPA_MJS, 'check', ...ids], { encoding: 'utf8' });
  if (p.status === 2) erro(`mapa.mjs check failed: ${(p.stdout || p.stderr).trim()}`);
  const linha = p.stdout || '';
  return ids.filter((id) => new RegExp(`\\b${id} \\(PENDING\\)`).test(linha));
}

function list() {
  const linhas = existsSync(TRACKING) ? readFileSync(TRACKING, 'utf8').split(/\r?\n/) : [];
  const novos = arquivos(PASTA);
  const andamento = arquivos(ANDAMENTO);
  console.log(`TRACKING: ${TRACKING}${existsSync(TRACKING) ? '' : ' (not created yet)'}`);
  console.log('== NEW (inbox) ==');
  for (const n of novos) {
    const s = secao(linhas, n);
    const versao = andamento.includes(n) ? ' | NEW VERSION of a report already in progress' : '';
    console.log(`- ${n}${versao}${s ? ` | tracked: ${s.abertos} open (${s.semFix} without fix task)` : ''}`);
  }
  if (!novos.length) console.log('(none)');
  console.log('\n== IN PROGRESS ==');
  for (const n of andamento) {
    const s = secao(linhas, n);
    let estado;
    if (!s) estado = 'NOT TRACKED (triage it)';
    else if (s.abertos + s.feitos + s.descartados === 0) estado = 'SECTION WITHOUT ITEMS (read it and decide)';
    else if (s.abertos === 0) estado = `READY FOR DONE (${s.feitos} fixed, ${s.descartados} dismissed)`;
    else if (s.semFix) estado = `${s.semFix} open item(s) WITHOUT fix task (not triaged) of ${s.abertos}`;
    else {
      const faltam = pendentesNoMapa(s.fixes);
      estado = faltam.length
        ? `${s.abertos} open, fix tasks pending in the map: ${faltam.join(', ')}`
        : `READY FOR DONE: ${s.fixes.join(', ')} done or out of the map (mark the items [x] with the PR)`;
    }
    console.log(`- ${n} | ${estado}`);
  }
  if (!andamento.length) console.log('(none)');
  process.exit(novos.length + andamento.length ? 0 : 1);
}

function nextFix() {
  const textos = [TRACKING].filter(existsSync).map((f) => readFileSync(f, 'utf8'));
  const p = spawnSync(process.execPath, [MAPA_MJS, 'summary'], { encoding: 'utf8' });
  const mapaArq = (p.stdout || '').match(/^MAP: (.+) \(updated/m);
  if (mapaArq && existsSync(mapaArq[1])) textos.push(readFileSync(mapaArq[1], 'utf8'));
  let maior = 0;
  for (const t of textos) for (const m of t.matchAll(new RegExp(`\\b${PREFIXO}(\\d{1,4})\\b`, 'g'))) maior = Math.max(maior, Number(m[1]));
  console.log(`NEXT: ${PREFIXO}${maior + 1} (highest seen: ${maior ? PREFIXO + maior : 'none'}; also check recent branch names)`);
}

const [comando] = process.argv.slice(2);
if (comando === 'list') list();
else if (comando === 'next-fix') nextFix();
else erro('commands: list | next-fix (see the header of reviews.mjs)');
