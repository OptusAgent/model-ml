// Componentes visuais reaproveitados pelas telas: gráfico de candles, minigráfico, semáforo e cartão de sinal.
import { SYMBOLS } from './market.js';
import { fmt } from './util.js';
import { icon } from './icons.js';
import { rsiOf, divergencesOf, RSI_PERIOD, BINARY_KEYS } from './features.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const px = (sym, v) => fmt.num(v, SYMBOLS[sym].digits);

export const REGIME_PILL = {
  alta: '<span class="pill green">' + icon('up', 12) + 'Alta</span>',
  baixa: '<span class="pill red">' + icon('down', 12) + 'Baixa</span>',
  lateral: '<span class="pill gray">Lateral</span>',
};

export function symIcon(sym) {
  return sym === 'XAUUSD' ? '<span class="sym-ic gold">Au</span>' : '<span class="sym-ic hk">HK</span>';
}

export function sparkline(values, w = 160, h = 38) {
  if (!values.length) return '';
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 3 - ((v - lo) / span) * (h - 6)]);
  const up = values[values.length - 1] >= values[0];
  const col = up ? 'var(--green)' : 'var(--red)';
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".35"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${w} ${h} L0 ${h} Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${col}" stroke-width="1.8"/></svg>`;
}

export function lightsHTML(state, big = false) {
  return `<div class="lights">${['verde', 'amarelo', 'vermelho'].map((c) => `<span class="light ${big ? 'big' : ''} ${c} ${state === c ? 'on' : ''}" title="${c}"></span>`).join('')}</div>`;
}

export function chanceBar(p, limiar) {
  return `<div class="chance"><div class="bar"><i style="width:${Math.min(100, p * 100)}%"></i><u style="left:${limiar * 100}%" title="limite ${(limiar * 100).toFixed(0)}%"></u></div><b>${(p * 100).toFixed(0)}%</b></div>`;
}

export function contribHTML(contrib) {
  const max = Math.max(0.01, ...contrib.map((c) => Math.abs(c.c)));
  return `<div class="contrib">${[...contrib].sort((a, b) => Math.abs(b.c) - Math.abs(a.c)).slice(0, 6).map((c) => {
    const w = (Math.abs(c.c) / max) * 50;
    const col = c.c >= 0 ? 'var(--green)' : 'var(--red)';
    const style = c.c >= 0 ? `left:50%;width:${w}%;background:${col}` : `right:50%;width:${w}%;background:${col}`;
    return `<div class="c-row"><span title="${c.help}">${c.label} <span class="muted num">(${fmt.num(c.value, BINARY_KEYS.has(c.key) ? 0 : 2)})</span></span><div class="c-bar"><i style="${style}"></i></div></div>`;
  }).join('')}</div>`;
}

// Gráfico de candles ao vivo (biblioteca Lightweight Charts, da TradingView).
export function createCandleChart(container, engine, opts = {}) {
  const LC = window.LightweightCharts;
  let sym = opts.sym || 'XAUUSD', tf = opts.tf || 5;
  if (!LC) {
    container.innerHTML = '<div class="empty">Não foi possível carregar a biblioteca de gráficos. Verifique a internet.</div>';
    return { setSymbol() {}, setTf() {}, destroy() {}, refreshLines() {} };
  }
  const chart = LC.createChart(container, {
    autoSize: true,
    layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#2f2f36', fontFamily: 'Manrope, sans-serif', fontSize: 11 },
    grid: { vertLines: { color: 'rgba(24,24,32,0.06)' }, horzLines: { color: 'rgba(24,24,32,0.06)' } },
    rightPriceScale: { borderColor: 'rgba(24,24,32,0.15)' },
    timeScale: { borderColor: 'rgba(24,24,32,0.15)', timeVisible: true, secondsVisible: false, rightOffset: 6 },
    crosshair: { mode: 0 },
    localization: { locale: 'pt-BR' },
  });
  const series = chart.addCandlestickSeries({
    upColor: '#0B8043', downColor: '#C81E2D', borderVisible: false, wickUpColor: '#0B8043', wickDownColor: '#C81E2D',
  });
  series.priceScale().applyOptions({ scaleMargins: { top: 0.05, bottom: 0.3 } });
  // RSI(10) num painel embaixo, com as linhas de 70 e 30, como pediu o Elton.
  // Fica na escala da esquerda, sempre de 0 a 100, para não se misturar com os números do preço.
  const RSI_SCALE = () => ({ priceRange: { minValue: 0, maxValue: 100 } });
  const rsiSeries = chart.addLineSeries({
    priceScaleId: 'left', color: '#7C3AED', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true,
    crosshairMarkerVisible: false, title: `RSI(${RSI_PERIOD})`, priceFormat: { type: 'custom', minMove: 1, formatter: (v) => String(Math.round(v)) },
    autoscaleInfoProvider: RSI_SCALE,
  });
  chart.applyOptions({ leftPriceScale: { visible: true, borderColor: 'rgba(24,24,32,0.15)', scaleMargins: { top: 0.76, bottom: 0.03 } } });
  rsiSeries.createPriceLine({ price: 100, color: 'rgba(24,24,32,.28)', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '' });
  rsiSeries.createPriceLine({ price: 70, color: 'rgba(200,30,45,.75)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
  rsiSeries.createPriceLine({ price: 30, color: 'rgba(11,128,67,.75)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '' });
  rsiSeries.createPriceLine({ price: 0, color: 'rgba(24,24,32,.28)', lineWidth: 1, lineStyle: 0, axisLabelVisible: true, title: '' });
  // Cobre os números do preço na faixa do RSI (eles não valem para a linha roxa).
  // E cobre os números do RSI que a escala da esquerda repete na faixa do preço.
  const mask = document.createElement('div'), maskL = document.createElement('div');
  mask.className = 'rsi-mask';
  maskL.className = 'rsi-mask left';
  container.append(mask, maskL);
  function placeMask() {
    const paneH = container.clientHeight - chart.timeScale().height();
    Object.assign(mask.style, { top: `${paneH * 0.72}px`, height: `${paneH * 0.28}px`, width: `${chart.priceScale('right').width()}px` });
    Object.assign(maskL.style, { top: '0px', height: `${paneH * 0.755}px`, width: `${chart.priceScale('left').width()}px` });
  }
  const ro = new ResizeObserver(() => requestAnimationFrame(placeMask));
  ro.observe(container);
  let lines = [], divSeries = [], divMarks = [], data = [];

  function drawDivergences() {
    for (const s of divSeries) chart.removeSeries(s);
    divSeries = []; divMarks = [];
    const rsi = rsiOf(data);
    const divs = divergencesOf(data, rsi).filter((d) => d.at < data.length).slice(-8);
    for (const d of divs) {
      const col = d.type === 'alta' ? '#0B8043' : '#C81E2D';
      const key = d.type === 'alta' ? 'low' : 'high';
      const opts = { color: col, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
      const ps = chart.addLineSeries(opts);
      ps.setData([{ time: data[d.i1].time, value: data[d.i1][key] }, { time: data[d.i2].time, value: data[d.i2][key] }]);
      const rs = chart.addLineSeries({ ...opts, priceScaleId: 'left', autoscaleInfoProvider: RSI_SCALE });
      rs.setData([{ time: data[d.i1].time, value: rsi[d.i1] }, { time: data[d.i2].time, value: rsi[d.i2] }]);
      divSeries.push(ps, rs);
      divMarks.push({ time: data[d.i2].time, position: d.type === 'alta' ? 'belowBar' : 'aboveBar', color: col, shape: 'circle', text: d.type === 'alta' ? 'Div. alta' : 'Div. baixa' });
    }
  }
  function updateRsi() {
    const rsi = rsiOf(data);
    rsiSeries.setData(data.map((b, i) => ({ time: b.time, value: rsi[i] })));
  }

  function load() {
    data = engine.getBars(sym, tf).slice(-600);
    series.setData(data);
    series.applyOptions({ priceFormat: { type: 'custom', minMove: 1 / 10 ** SYMBOLS[sym].digits, formatter: (p) => fmt.num(p, SYMBOLS[sym].digits) } });
    updateRsi();
    drawDivergences();
    markers();
    refreshLines();
    requestAnimationFrame(placeMask);
  }
  function lastBar() {
    const bars = engine.getBars(sym, tf);
    return bars[bars.length - 1];
  }
  function onTick() {
    const b = lastBar();
    if (!b) return;
    series.update(b);
    if (data.length && data[data.length - 1].time === b.time) data[data.length - 1] = b;
    else { data.push(b); if (data.length > 600) data.shift(); }
    const rsi = rsiOf(data.slice(-200));
    rsiSeries.update({ time: b.time, value: rsi[rsi.length - 1] });
  }
  function markers() {
    const span = tf * 60;
    const ms = [...divMarks];
    for (const s of engine.signals) {
      if (s.sym !== sym) continue;
      ms.push({ time: Math.floor((s.time - 300) / span) * span, position: s.side > 0 ? 'belowBar' : 'aboveBar', color: s.side > 0 ? '#0B8043' : '#C81E2D', shape: s.side > 0 ? 'arrowUp' : 'arrowDown', text: s.id });
    }
    for (const d of engine.broker.deals) {
      if (d.symbol !== sym || !d.time_close || d.comment === 'cenário de estresse') continue;
      ms.push({ time: Math.floor(d.time_close / span) * span, position: 'inBar', color: d.profit > 0 ? '#0B8043' : '#C81E2D', shape: 'circle', text: d.profit > 0 ? 'alvo' : 'stop' });
    }
    ms.sort((a, b) => a.time - b.time);
    try { series.setMarkers(ms); } catch (e) { /* marcadores fora do intervalo */ }
  }
  function refreshLines() {
    for (const l of lines) series.removePriceLine(l);
    lines = [];
    const add = (price, color, title, style = 2) => lines.push(series.createPriceLine({ price, color, lineWidth: 1, lineStyle: style, axisLabelVisible: true, title }));
    for (const p of engine.broker.positions.filter((x) => x.symbol === sym)) {
      add(p.price_open, '#1D4ED8', `${p.type === 'BUY' ? 'Compra' : 'Venda'} ${fmt.lots(p.volume)}`, 0);
      if (p.sl) add(p.sl, '#C81E2D', 'Stop');
      if (p.tp) add(p.tp, '#0B8043', 'Alvo');
    }
    const sig = engine.signals.find((s) => s.sym === sym && s.status === 'novo');
    if (sig) {
      add(sig.entry, '#B45309', `Sinal ${sig.id}`, 1);
      add(sig.sl, 'rgba(200,30,45,.7)', 'Stop sugerido');
      add(sig.tp, 'rgba(11,128,67,.7)', 'Alvo sugerido');
    }
  }
  const offs = [
    engine.bus.on('tick', (t) => { if (t.sym === sym) onTick(); }),
    engine.bus.on('candle', (c) => { if (c.sym === sym && (c.candle.time + 60) % (tf * 60) === 0) { drawDivergences(); markers(); placeMask(); } }),
    engine.bus.on('signal', () => { markers(); refreshLines(); }),
    engine.bus.on('signalUpdate', () => { markers(); refreshLines(); }),
    engine.bus.on('positions', refreshLines),
    engine.bus.on('closed', () => { markers(); refreshLines(); }),
  ];
  load();
  chart.timeScale().scrollToRealTime();
  return {
    setSymbol(s) { sym = s; load(); chart.timeScale().scrollToRealTime(); },
    setTf(v) { tf = v; load(); chart.timeScale().scrollToRealTime(); },
    get sym() { return sym; },
    refreshLines,
    destroy() { offs.forEach((o) => o()); ro.disconnect(); chart.remove(); },
  };
}

// Linha da regra no cartão do sinal: a combinação de condições daquele momento e como ela foi nas provas.
const RULE_SHORT = { 'Tendência de alta': 'alta', 'Tendência de baixa': 'baixa', 'varreu liquidez a favor': 'varreu liquidez', 'divergência RSI a favor': 'com divergência' };
export function ruleLineHTML(sig) {
  if (!sig.ruleParts) return '';
  const chips = sig.ruleParts.map((p, i) => `<span class="rule-chip ${i === 0 ? (p.includes('alta') ? 'g' : 'r') : p.startsWith('sem ') ? 'n' : i === 3 ? 'b' : 'v'}">${RULE_SHORT[p] || p}</span>`).join('');
  const r = sig.rule;
  const stats = !r ? '<span class="amber">combinação que não apareceu nas provas</span>'
    : r.n < 20 ? `<span class="amber">só ${r.n} casos nas provas: pouca prova</span>`
    : `nas provas: <b>${r.n}</b> casos · acerto <b>${fmt.pct(r.happened, 0)}</b> · <b class="${r.exp > 0 ? 'pos' : 'neg'}">${fmt.r(r.exp)}</b> por operação`;
  return `<div class="rule-line" title="A regra é a combinação de condições deste momento. Os números mostram como ela se saiu nos testes do laboratório."><span class="rule-l">Regra</span><div class="rule-chips">${chips}</div><span class="rule-s">${stats}</span></div>`;
}

export function signalCardHTML(sig, engine, compact = false) {
  // Depois de comprado, ignorado ou expirado, o aviso sai e fica só uma linha dizendo o que aconteceu.
  if (!sig || (sig.status !== 'novo' && sig.status !== 'enviando')) {
    const what = sig ? `${sig.side > 0 ? 'compra' : 'venda'} de ${sig.sym}` : '';
    const last = !sig ? '' : sig.status === 'executado'
      ? `<div class="calc" style="font-size:.84rem">Último sinal ${sig.id} (${what}): <b class="pos">executado</b> · ticket ${sig.result?.order || ''}. Acompanhe o lucro em <a href="#/posicoes">Posições e histórico</a>.</div>`
      : `<div class="calc" style="font-size:.84rem">Último sinal ${sig.id} (${what}): ${sig.status === 'recusado' ? 'recusado pela corretora' : sig.status === 'expirado' ? 'expirou sem execução' : 'ignorado'}.</div>`;
    return `<div class="card"><div class="card-h"><h3>${icon('zap', 16)} Sinal agora</h3></div>
      <div class="empty">Nenhum sinal aberto. O modelo avalia o mercado a cada candle de 5 minutos e só avisa quando a chance passa do limite.</div>${last}</div>`;
  }
  const s = engine.settings;
  const life = Math.max(0, (sig.expiresAt - engine.now()) / (s.signalLife * 300));
  const side = sig.side > 0 ? 'buy' : 'sell';
  return `<div class="signal-card ${side}" data-sig="${sig.id}">
    <div class="card-h"><span style="display:flex;gap:6px;flex-wrap:wrap"><span class="pill ${sig.side > 0 ? 'green' : 'red'}">${icon('zap', 12)} Sinal ${sig.id}</span>${sig.scenario ? '<span class="pill violet">cenário de apresentação</span>' : sig.demo ? '<span class="pill amber">demonstração · ignora os filtros</span>' : ''}</span><span class="muted" style="font-size:.78rem">${fmt.time(sig.time)} · modelo ${sig.modelVersion}</span></div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">${symIcon(sig.sym)}<div><div class="side ${sig.side > 0 ? 'pos' : 'neg'}">${sig.side > 0 ? 'COMPRAR' : 'VENDER'} ${sig.sym}</div><span class="muted" style="font-size:.8rem">Tendência de ${sig.regime} · ${fmt.lots(sig.lots)} lote</span></div></div>
    <div>
      <div class="muted" style="font-size:.76rem;font-weight:600;margin-bottom:6px">Chance de bater o alvo (o traço amarelo é o limite)</div>
      ${chanceBar(sig.p, s.limiar)}
    </div>
    <div class="kv">
      <div><small>Entrada</small><b>${px(sig.sym, sig.entry)}</b></div>
      <div><small>Stop</small><b class="neg">${px(sig.sym, sig.sl)}</b></div>
      <div><small>Alvo</small><b class="pos">${px(sig.sym, sig.tp)}</b></div>
      <div><small>Arrisca (1R)</small><b>${fmt.usd(sig.riskUsd)}</b></div>
      <div><small>Ganha no alvo</small><b class="pos">${fmt.usd(sig.targetUsd)}</b></div>
      <div><small>Expectativa</small><b class="${sig.exp > 0 ? 'pos' : 'neg'}">${fmt.r(sig.exp)}</b></div>
    </div>
    ${ruleLineHTML(sig)}
    ${sig.status === 'novo' ? `${isFinite(sig.expiresAt) ? `<div><div class="muted" style="font-size:.74rem;margin-bottom:4px">Válido por mais ${Math.max(0, Math.ceil((sig.expiresAt - engine.now()) / 60))} min</div><div class="countdown"><i style="width:${life * 100}%"></i></div></div>` : ''}
    <div style="display:grid;grid-template-columns:1fr auto;gap:8px">
      <button class="btn ${sig.side > 0 ? 'btn-buy' : 'btn-sell'} btn-block" data-act="exec" data-id="${sig.id}">${icon('send', 16)} ${sig.side > 0 ? 'Comprar' : 'Vender'} no MT5</button>
      <button class="btn btn-ghost" data-act="dismiss" data-id="${sig.id}">Ignorar</button>
    </div>` : `<div><span class="pill ${sig.status === 'executado' ? 'green' : sig.status === 'enviando' ? 'blue' : 'gray'}">${sig.status === 'executado' ? 'Executado · ticket ' + (sig.result?.order || '') : sig.status === 'enviando' ? 'Enviando ao MT5…' : sig.status === 'recusado' ? 'Recusado: ' + (sig.result?.comment || '') : sig.status === 'expirado' ? 'Expirou sem execução' : 'Ignorado'}</span></div>`}
    ${compact ? '' : `<details><summary class="muted" style="cursor:pointer;font-size:.82rem">Por que o modelo deu esse sinal?</summary><div style="margin-top:10px">${contribHTML(sig.contrib)}<p class="muted" style="font-size:.76rem;margin:8px 0 0">Verde empurrou a chance para cima; vermelho, para baixo. Cada linha é um número da ficha deste momento.</p></div></details>`}
  </div>`;
}

export function bindSignalActions(root, engine, toast) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'exec') {
      b.disabled = true;
      const res = await engine.execute(b.dataset.id);
      if (res) toast(res.retcode === 10009 ? `Ordem executada no MT5 · ticket ${res.order} · ${res.latency} ms` : `MT5 recusou: ${res.comment}`, res.retcode === 10009 ? 'ok' : 'err');
    }
    if (b.dataset.act === 'dismiss') engine.dismiss(b.dataset.id);
  });
}
