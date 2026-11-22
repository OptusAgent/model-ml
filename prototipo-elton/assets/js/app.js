// Casca do app: menu, barra superior, rotas, notificações e avisos de sinal.
import { createEngine, SPEEDS } from './engine.js';
import { icon } from './icons.js';
import { fmt } from './util.js';
import { $, $$ } from './ui.js';
import painel from './views/painel.js';
import operar from './views/operar.js';
import posicoes from './views/posicoes.js';
import risco from './views/risco.js';
import notebook from './views/notebook.js';
import laboratorio from './views/laboratorio.js';
import conexoes from './views/conexoes.js';
import config from './views/config.js';
import guia from './views/guia.js';

const VIEWS = { painel, operar, posicoes, risco, notebook, laboratorio, conexoes, config, guia };
const NAV = [
  { sec: 'Operação', items: [['painel', 'Painel', 'home'], ['operar', 'Operar', 'candles'], ['posicoes', 'Posições e histórico', 'layers'], ['risco', 'Risco e semáforo', 'shield']] },
  { sec: 'Modelo', items: [['notebook', 'Notebook do modelo', 'code'], ['laboratorio', 'Laboratório', 'flask']] },
  { sec: 'Conexão', items: [['conexoes', 'MT5 e conectores', 'plug'], ['config', 'Configurações', 'settings']] },
  { sec: 'Ajuda', items: [['guia', 'Guia de apresentação', 'book']] },
];
const TABS = [['painel', 'Painel', 'home'], ['operar', 'Operar', 'candles'], ['posicoes', 'Posições', 'layers'], ['notebook', 'Modelo', 'code']];

const engine = createEngine();
let cleanup = null, current = null;
const seen = new Set();

function toast(text, kind = 'info', actions = []) {
  const box = $('#toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + (kind === 'buy' ? 'buy' : kind === 'sell' ? 'sell' : '');
  const ic = kind === 'ok' ? icon('check', 16) : kind === 'err' ? icon('alert', 16) : kind === 'buy' || kind === 'sell' ? icon('zap', 16) : icon('info', 16);
  t.innerHTML = `<div class="t-h"><span class="${kind === 'err' || kind === 'sell' ? 'neg' : kind === 'ok' || kind === 'buy' ? 'pos' : 'blue'}">${ic}</span><b style="flex:1">${text}</b><button class="icon-btn" style="width:28px;height:28px" aria-label="Fechar">${icon('x', 14)}</button></div>${actions.length ? `<div style="display:flex;gap:8px">${actions.map((a, i) => `<button class="btn btn-sm ${a.cls || 'btn-ghost'}" data-i="${i}">${a.label}</button>`).join('')}</div>` : ''}`;
  const close = () => t.remove();
  t.querySelector('.icon-btn').onclick = close;
  t.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { actions[+b.dataset.i].fn(); close(); }));
  box.appendChild(t);
  setTimeout(close, actions.length ? 14000 : 5000);
  while (box.children.length > 3) box.firstChild.remove();
}

function go(id) { location.hash = '#/' + id; }

function renderSidebar() {
  $('#sidebar').innerHTML = `
    <div class="brand"><div class="brand-logo">${icon('chart', 18, 'stroke="#fff"')}</div><div><b>Sinal Lab</b><small>protótipo · dados simulados</small></div></div>
    ${NAV.map((g) => `<div class="nav-sec">${g.sec}</div><nav class="nav">${g.items.map(([id, label, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic, 18)}<span>${label}</span>${id === 'painel' ? '<span class="badge" data-sigbadge hidden>0</span>' : ''}</a>`).join('')}</nav>`).join('')}
    <div class="side-card">
      <div class="ic-box">${icon('book', 16, 'stroke="#fff"')}</div>
      <b>Modo apresentação</b>
      <p>Conta DEMO simulada, mercado simulado e modelo treinado em dados sintéticos.</p>
      <a class="btn btn-glass btn-block btn-sm" href="#/guia">${icon('play', 14)} Abrir o roteiro</a>
    </div>`;
}

function renderTabbar() {
  $('#tabbar').innerHTML = TABS.map(([id, label, ic]) => `<a href="#/${id}" data-nav="${id}">${icon(ic, 20)}<span>${label}</span>${id === 'painel' ? '<span class="badge" data-sigbadge hidden>0</span>' : ''}</a>`).join('') +
    `<button type="button" id="moreBtn">${icon('menu', 20)}<span>Mais</span></button>`;
  $('#moreBtn').onclick = openMore;
}

function openMore() {
  const ov = $('#overlay');
  ov.innerHTML = `<div class="sheet-bg"></div><div class="sheet" role="dialog" aria-label="Todas as telas"><div class="grab"></div>
    ${NAV.map((g) => `<div class="nav-sec">${g.sec}</div><nav class="nav">${g.items.map(([id, label, ic]) => `<a href="#/${id}" class="${current === id ? 'on' : ''}">${icon(ic, 18)}<span>${label}</span></a>`).join('')}</nav>`).join('')}
    <div class="nav-sec">Velocidade do simulador</div>
    <div class="speed" style="width:max-content">${SPEEDS.map((s) => `<button data-speed="${s.v}" class="${engine.settings.speed === s.v ? 'on' : ''}">${s.label}</button>`).join('')}</div>
  </div>`;
  const close = () => (ov.innerHTML = '');
  ov.querySelector('.sheet-bg').onclick = close;
  ov.querySelectorAll('a').forEach((a) => (a.onclick = close));
  ov.querySelectorAll('[data-speed]').forEach((b) => (b.onclick = () => { engine.setSpeed(+b.dataset.speed); close(); }));
}

function renderTopbar() {
  $('#topbar').innerHTML = `
    <div class="title" id="pageTitle">Painel</div>
    <span class="mt5-chip hide-m" title="Conexão simulada com o MetaTrader 5"><span class="pulse"></span>MT5 · Hantec Demo</span>
    <div class="spacer"></div>
    <div class="clock" title="Relógio do mercado simulado (UTC)">${icon('clock', 14)}<span class="num" id="simClock">--:--</span><span class="muted hide-m">UTC</span></div>
    <button class="icon-btn" id="pauseBtn" aria-label="Pausar ou continuar o mercado">${icon('pause', 16)}</button>
    <div class="speed hide-m" id="speedSeg">${SPEEDS.map((s) => `<button data-speed="${s.v}">${s.label}</button>`).join('')}</div>
    <button class="icon-btn" id="bellBtn" aria-label="Notificações">${icon('bell', 17)}<span class="dot" id="bellDot" hidden></span></button>
    <div class="user hide-m"><div class="avatar">ES</div><div><b>Elton Silva</b><small>conta 5823190 · demo</small></div></div>`;
  $('#pauseBtn').onclick = () => engine.pause(!engine.paused);
  $$('#speedSeg [data-speed]').forEach((b) => (b.onclick = () => engine.setSpeed(+b.dataset.speed)));
  $('#bellBtn').onclick = toggleBell;
  syncSpeed();
}

function syncSpeed() {
  $$('#speedSeg [data-speed]').forEach((b) => b.classList.toggle('on', +b.dataset.speed === engine.settings.speed));
}

function toggleBell() {
  const ov = $('#overlay');
  if (ov.querySelector('.popover')) { ov.innerHTML = ''; return; }
  const items = engine.signals.slice(0, 12);
  items.forEach((s) => seen.add(s.id));
  updateBadges();
  ov.innerHTML = `<div class="sheet-bg" style="background:transparent;backdrop-filter:none"></div><div class="popover"><div class="card-h" style="margin-bottom:8px"><h3>${icon('bell', 16)} Notificações</h3><span class="muted" style="font-size:.76rem">app · Telegram (simulado)</span></div>
    <div class="list">${items.length ? items.map((s) => `<div class="li"><div class="ic ${s.side > 0 ? 'pos' : 'neg'}">${icon(s.side > 0 ? 'up' : 'down', 16)}</div><div class="txt"><b>${s.side > 0 ? 'Comprar' : 'Vender'} ${s.sym} · chance ${(s.p * 100).toFixed(0)}%</b><small>${fmt.time(s.time)} · ${s.id} · ${s.status}</small></div><a class="btn btn-sm btn-ghost" href="#/operar?sym=${s.sym}">Ver</a></div>`).join('') : '<div class="empty">Sem sinais ainda. Deixe o mercado rodar.</div>'}</div></div>`;
  ov.querySelector('.sheet-bg').onclick = () => (ov.innerHTML = '');
  ov.querySelectorAll('a').forEach((a) => (a.onclick = () => (ov.innerHTML = '')));
}

function updateBadges() {
  const n = engine.signals.filter((s) => s.status === 'novo' && !seen.has(s.id)).length;
  $$('[data-sigbadge]').forEach((b) => { b.hidden = !n; b.textContent = n; });
  const dot = $('#bellDot');
  if (dot) dot.hidden = !n;
}

function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [id, q] = raw.split('?');
  const name = VIEWS[id] ? id : 'painel';
  const params = Object.fromEntries(new URLSearchParams(q || ''));
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  current = name;
  const view = VIEWS[name];
  $('#pageTitle').textContent = view.title;
  document.title = view.title + ' · Sinal Lab';
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
  const root = $('#view');
  root.innerHTML = '';
  cleanup = view.render(root, { engine, toast, go, params }) || null;
  window.scrollTo({ top: 0 });
  $('#overlay').innerHTML = '';
}

function boot() {
  renderSidebar();
  renderTopbar();
  renderTabbar();
  engine.bus.on('clock', (t) => { const c = $('#simClock'); if (c) c.textContent = fmt.time(t); });
  engine.bus.on('paused', (p) => { $('#pauseBtn').innerHTML = icon(p ? 'play' : 'pause', 16); toast(p ? 'Mercado pausado' : 'Mercado rodando'); });
  engine.bus.on('settings', syncSpeed);
  engine.bus.on('signal', (s) => {
    updateBadges();
    if (!s) return;
    if (engine.settings.notify.app) {
      toast(`${s.side > 0 ? 'COMPRAR' : 'VENDER'} ${s.sym} · chance ${(s.p * 100).toFixed(0)}% · ${fmt.lots(s.lots)} lote`, s.side > 0 ? 'buy' : 'sell', [
        { label: (s.side > 0 ? 'Comprar' : 'Vender') + ' no MT5', cls: s.side > 0 ? 'btn-buy' : 'btn-sell', fn: async () => { const r = await engine.execute(s.id); if (r) toast(r.retcode === 10009 ? `Executado · ticket ${r.order}` : `Recusado: ${r.comment}`, r.retcode === 10009 ? 'ok' : 'err'); } },
        { label: 'Ver no gráfico', fn: () => go('operar?sym=' + s.sym) },
      ]);
    }
  });
  engine.bus.on('signalUpdate', updateBadges);
  engine.bus.on('closed', (d) => { if (d && d.comment !== 'cenário de estresse') toast(`${d.reason === 'alvo' ? 'Alvo atingido' : d.reason === 'stop' ? 'Stop atingido' : 'Posição fechada'} · ${d.symbol} · ${fmt.usdSigned(d.profit)}`, d.profit > 0 ? 'ok' : 'err'); });
  window.addEventListener('hashchange', route);
  route();
}

// O laboratório treina o modelo antes de o mercado começar (leva menos de 1 segundo).
setTimeout(() => {
  engine.trainAll();
  $('#loading').remove();
  $('#app').hidden = false;
  boot();
  engine.start();
}, 60);

window.__engine = engine; // para inspecionar no console do navegador
