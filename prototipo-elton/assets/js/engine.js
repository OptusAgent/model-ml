// Motor do app: liga o mercado (coletor), o modelo (vigia), a corretora (executor) e o semáforo.
// No app real este motor roda num servidor (VPS Windows com o MT5) e conversa com o app por WebSocket.
import { Feed, SYMBOLS, SYMBOL_IDS, aggregate } from './market.js';
import { indicators, featureAt, predict, contributions } from './features.js';
import { runLab } from './lab.js';
import { MockMT5, RETCODE } from './broker.js';
import { createBus, mean } from './util.js';

export const SPEEDS = [
  { v: 1, label: 'Tempo real' },
  { v: 10, label: '10×' },
  { v: 60, label: '60×' },
  { v: 300, label: '300×' },
];

// Padrões definidos pelas respostas do Elton (22/11/2026): sinais no M5, alvo mínimo de 3R,
// nada abaixo de 50% de chance, até 3 sinais por dia, abertura da Ásia e Nova York.
export const DEFAULT_SETTINGS = {
  riskPct: 0.5, limiar: 0.5, R: 3, stopAtr: 1, maxBars: 36, maxPerDay: 3,
  newsFilter: true, newsWindow: 15, execMode: 'sinal', speed: 60, maxDD: 15,
  requireApproved: true, signalLife: 3,
  active: { XAUUSD: true, HK50: true },
  notify: { app: true, telegram: true, whatsapp: false, email: false },
  sessions: { asia: true, londres: false, ny: true },
};

const NEWS_LIST = [
  { name: 'China · PMI industrial', syms: ['HK50'], impact: 'Alto' },
  { name: 'EUA · Payroll (empregos)', syms: ['XAUUSD', 'HK50'], impact: 'Alto' },
  { name: 'EUA · Inflação (CPI)', syms: ['XAUUSD'], impact: 'Alto' },
  { name: 'Fed · Discurso do presidente', syms: ['XAUUSD', 'HK50'], impact: 'Alto' },
  { name: 'Hong Kong · PIB trimestral', syms: ['HK50'], impact: 'Médio' },
  { name: 'EUA · Pedidos de seguro-desemprego', syms: ['XAUUSD'], impact: 'Médio' },
];

export function createEngine() {
  const bus = createBus();
  const settings = structuredClone(DEFAULT_SETTINGS);
  const today = new Date();
  // O mercado simulado começa 15 minutos antes de Nova York (12h UTC), para a demonstração.
  const t0 = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 11, 45) / 1000);
  const feeds = {
    XAUUSD: new Feed('XAUUSD', 11, t0 - 3000 * 60, 3000),
    HK50: new Feed('HK50', 22, t0 - 3000 * 60, 3000),
  };
  const broker = new MockMT5(bus, 32000);
  const labs = {};
  const signals = [];
  const decisions = [];
  const live = {}; // última leitura do vigia por ativo
  const equity = [{ time: t0, balance: broker.account.balance }];
  const news = [];
  for (let k = 0; k < 40; k++) {
    const ev = NEWS_LIST[k % NEWS_LIST.length];
    news.push({ ...ev, id: 'n' + k, time: t0 + (35 + k * 95) * 60 });
  }
  let timer = null, paused = false, sigSeq = 1;
  let scen = null, attention = null; // cenário de apresentação em andamento e aviso de atenção
  let startBalance = broker.account.balance;

  const now = () => feeds.XAUUSD.now;

  function priceOf(sym) {
    const f = feeds[sym];
    return { bid: f.bid, ask: f.ask, time: f.now };
  }

  function getBars(sym, tf) {
    const f = feeds[sym];
    return aggregate(f.m1, tf, f.cur);
  }

  function dayChange(sym) {
    const f = feeds[sym];
    const ref = f.m1[Math.max(0, f.m1.length - 1440)];
    return (f.bid - ref.open) / ref.open;
  }

  function newsAt(sym, t) {
    if (!settings.newsFilter) return null;
    return news.find((n) => n.syms.includes(sym) && Math.abs(n.time - t) <= settings.newsWindow * 60) || null;
  }

  function upcomingNews(limit = 5) {
    const t = now();
    return news.filter((n) => n.time >= t - settings.newsWindow * 60).slice(0, limit);
  }

  function sessionOf(t) {
    const h = new Date(t * 1000).getUTCHours();
    if (h >= 0 && h < 3) return 'asia';
    if (h >= 7 && h < 12) return 'londres';
    if (h >= 12 && h < 17) return 'ny';
    return null;
  }
  function sessionOk(t) {
    const s = sessionOf(t);
    return s ? settings.sessions[s] : false;
  }
  function signalsToday(t) {
    const day = Math.floor(t / 86400);
    return signals.filter((s) => !s.demo && Math.floor(s.time / 86400) === day).length;
  }

  // ---------- Semáforo ----------
  function semaphore() {
    const deals = broker.deals;
    const last = deals.slice(-100);
    const n = last.length;
    const acerto = n ? last.filter((d) => d.profit > 0).length / n : 0;
    let seqNow = 0;
    for (let i = deals.length - 1; i >= 0 && deals[i].profit <= 0; i--) seqNow++;
    let seqMax = 0, run = 0;
    for (const d of deals) { if (d.profit <= 0) { run++; seqMax = Math.max(seqMax, run); } else run = 0; }
    const dd = broker.peak ? (broker.peak - broker.account.balance) / broker.peak : 0;
    const lab = labs.XAUUSD;
    const provaAcerto = lab ? lab.provaAcerto : 0.45;
    const worst = lab ? lab.worstStreak : 8;
    const minAcerto = 1 / (1 + settings.R);
    const reasons = [];
    let state = 'verde';
    if (dd * 100 >= settings.maxDD) reasons.push(`a conta caiu ${(dd * 100).toFixed(1)}% desde o maior valor (limite ${settings.maxDD}%)`);
    if (seqNow > worst) reasons.push(`${seqNow} stops seguidos, mais que a pior sequência das provas (${worst})`);
    if (n >= 30 && acerto < minAcerto) reasons.push(`acerto das últimas ${n} operações (${(acerto * 100).toFixed(0)}%) abaixo do mínimo (${(minAcerto * 100).toFixed(0)}%)`);
    if (reasons.length) state = 'vermelho';
    else {
      if (attention) reasons.push(attention);
      if (dd * 100 >= settings.maxDD * 0.5) reasons.push(`a conta caiu ${(dd * 100).toFixed(1)}%, metade do limite`);
      if (seqNow >= Math.ceil(worst * 0.6)) reasons.push(`${seqNow} stops seguidos (atenção a partir de ${Math.ceil(worst * 0.6)})`);
      if (n >= 20 && acerto < provaAcerto - 0.05) reasons.push(`acerto ao vivo (${(acerto * 100).toFixed(0)}%) abaixo das provas (${(provaAcerto * 100).toFixed(0)}%)`);
      if (reasons.length) state = 'amarelo';
    }
    return { state, reasons, n, acerto, provaAcerto, minAcerto, seqNow, seqMax, worst, dd, maxDD: settings.maxDD };
  }

  function report() {
    const d = broker.deals;
    const wins = d.filter((x) => x.profit > 0), losses = d.filter((x) => x.profit <= 0);
    const gp = wins.reduce((s, x) => s + x.profit, 0), gl = -losses.reduce((s, x) => s + x.profit, 0);
    const rs = d.filter((x) => x.r !== null).map((x) => x.r);
    return {
      total: d.length, wins: wins.length, losses: losses.length, acerto: d.length ? wins.length / d.length : 0,
      gp, gl, net: gp - gl, pf: gl ? gp / gl : gp ? Infinity : 0, payoff: d.length ? (gp - gl) / d.length : 0,
      expR: rs.length ? mean(rs) : 0,
    };
  }

  // ---------- Vigia: roda a cada candle de 5 minutos fechado ----------
  function onM5Close(sym) {
    const f = feeds[sym];
    const m5 = aggregate(f.m1, 5);
    const ind = indicators(m5);
    const i = m5.length - 1;
    const ft = featureAt(m5, ind, i, sym);
    if (!ft) return;
    const lab = labs[sym];
    const p = ft.side && lab ? predict(lab.model, ft.x) : null;
    const t = m5[i].time + 300;
    const d = { id: decisions.length + 1, sym, time: t, regime: ft.regime, p, x: ft.x, atr: ft.atr, close: ft.close, rsi: ft.rsi, action: 'observa', reason: '' };
    const sem = semaphore();
    const ev = newsAt(sym, t);
    const busy = broker.positions.some((x) => x.symbol === sym) || signals.some((s) => s.sym === sym && s.status === 'novo');
    if (!settings.active[sym]) d.reason = 'ativo desligado nas configurações';
    else if (ft.side === 0) d.reason = 'mercado lateral: não opera';
    else if (settings.requireApproved && lab && !lab.verdict) d.reason = 'regra reprovada no laboratório: só observa';
    else if (!sessionOk(t)) d.reason = 'fora do horário (abertura da Ásia e Nova York)';
    else if (signalsToday(t) >= settings.maxPerDay) d.reason = `limite de ${settings.maxPerDay} sinais por dia atingido`;
    else if (ev) d.reason = `notícia: ${ev.name}`;
    else if (sem.state === 'vermelho') d.reason = 'semáforo vermelho: pausado';
    else if (busy) d.reason = 'já existe operação ou sinal neste ativo';
    else if (p < settings.limiar) d.reason = `chance ${(p * 100).toFixed(0)}% abaixo do limite de ${(settings.limiar * 100).toFixed(0)}%`;
    else { d.action = 'sinal'; d.reason = `chance ${(p * 100).toFixed(0)}% passou do limite`; createSignal(sym, ft, p, t); }
    live[sym] = d;
    decisions.push(d);
    if (decisions.length > 400) decisions.shift();
    bus.emit('decision', d);
  }

  function sizing(sym, dist) {
    const riskUsd = (broker.account.balance * settings.riskPct) / 100;
    const vpp = SYMBOLS[sym].valuePerPoint;
    let lots = Math.floor((riskUsd / (dist * vpp)) * 100) / 100;
    if (lots < 0.01) lots = 0.01;
    return { riskUsd, lots, realRisk: lots * dist * vpp };
  }

  function createSignal(sym, ft, p, t, demo = false) {
    const side = ft.side;
    const pr = priceOf(sym);
    const entry = side > 0 ? pr.ask : pr.bid;
    const dist = settings.stopAtr * ft.atr;
    const sl = entry - side * dist, tp = entry + side * settings.R * dist;
    const sz = sizing(sym, dist);
    const cost = SYMBOLS[sym].spread / dist;
    const sig = {
      id: 'S' + String(sigSeq++).padStart(3, '0'), sym, side, type: side > 0 ? 'BUY' : 'SELL',
      time: t, expiresAt: t + settings.signalLife * 300, entry, sl, tp, dist, R: settings.R,
      lots: sz.lots, riskUsd: sz.realRisk, targetUsd: sz.realRisk * settings.R, p,
      exp: p * settings.R - (1 - p) - cost, cost, regime: ft.regime, atr: ft.atr,
      contrib: contributions(labs[sym].model, ft.x), status: 'novo', modelVersion: labs[sym].version, demo,
    };
    signals.unshift(sig);
    if (signals.length > 100) signals.pop();
    bus.emit('signal', sig);
    if (settings.execMode === 'auto' && broker.account.trade_mode === 'DEMO' && !demo) execute(sig.id, true);
    return sig;
  }

  // Para a apresentação: cria um sinal agora com a leitura atual do modelo, ignorando os filtros.
  function demoSignal(sym = 'XAUUSD') {
    if (signals.some((s) => s.sym === sym && s.status === 'novo')) return null;
    const f = feeds[sym];
    const m5 = aggregate(f.m1, 5);
    const ft = featureAt(m5, indicators(m5), m5.length - 1, sym);
    if (!ft) return null;
    const p = predict(labs[sym].model, ft.x);
    createSignal(sym, { ...ft, side: ft.side || 1 }, p, now(), true);
    return signals[0];
  }

  async function execute(id, auto = false) {
    const sig = signals.find((s) => s.id === id);
    if (!sig || sig.status !== 'novo') return null;
    sig.status = 'enviando';
    bus.emit('signalUpdate', sig);
    const pr = priceOf(sig.sym);
    const entry = sig.side > 0 ? pr.ask : pr.bid;
    const sl = entry - sig.side * sig.dist, tp = entry + sig.side * sig.R * sig.dist;
    const res = await broker.order_send({
      symbol: sig.sym, type: sig.type, volume: sig.lots, sl, tp, comment: `${auto ? 'auto' : 'sinal'} ${sig.id}`,
      signalId: sig.id, riskUsd: sig.riskUsd, R: sig.R, time: now(),
    });
    sig.status = res.retcode === RETCODE.DONE ? 'executado' : 'recusado';
    sig.result = res;
    bus.emit('signalUpdate', sig);
    if (scen && scen.sigId === sig.id) {
      if (res.retcode === RETCODE.DONE) scenarioMove(sig, res.price);
      else endScenario();
    }
    return res;
  }

  // ---------- Cenários de apresentação ----------
  // Criam um sinal de compra no ouro e, depois que o Elton aperta o botão, levam o preço até o
  // alvo (kind 'win') ou até o stop (kind 'loss'). Sempre levam uns 30 segundos, em qualquer velocidade.
  function scenario(kind) {
    const sym = 'XAUUSD', f = feeds[sym];
    if (scen || broker.positions.some((x) => x.symbol === sym) || signals.some((s) => s.sym === sym && (s.status === 'novo' || s.status === 'enviando'))) return null;
    const m5 = aggregate(f.m1, 5);
    const ft = featureAt(m5, indicators(m5), m5.length - 1, sym);
    if (!ft) return null;
    f.setGuide({ hold: f.bid });
    const sig = createSignal(sym, { ...ft, side: 1, regime: 'alta' }, kind === 'win' ? 0.62 : 0.56, now(), true);
    sig.scenario = kind;
    sig.expiresAt = Infinity;
    scen = { kind, sym, sigId: sig.id, prevSpeed: settings.speed };
    if (settings.speed !== 60) setSpeed(60);
    bus.emit('signalUpdate', sig);
    return sig;
  }
  function scenarioMove(sig, entry) {
    const d = sig.dist, pos = broker.positions.find((x) => x.signalId === sig.id);
    const tp = pos ? pos.tp : entry + sig.R * d, sl = pos ? pos.sl : entry - d;
    const legs = scen.kind === 'win'
      ? [{ to: entry - 0.4 * d, left: 36 }, { to: entry + 1.1 * d, left: 50 }, { to: entry + 0.7 * d, left: 20 }, { to: tp + 0.25 * d, left: 80 }]
      : [{ to: entry + 0.9 * d, left: 45 }, { to: entry + 0.4 * d, left: 22 }, { to: entry + 1.0 * d, left: 22 }, { to: sl - 0.3 * d, left: 80 }];
    feeds[sig.sym].setGuide({ legs });
  }
  function endScenario() {
    if (!scen) return;
    feeds[scen.sym].setGuide(null);
    if (settings.speed !== scen.prevSpeed) setSpeed(scen.prevSpeed);
    scen = null;
  }
  bus.on('closed', (d) => {
    if (!scen || !d || d.signalId !== scen.sigId) return;
    const kind = scen.kind;
    endScenario();
    if (kind === 'loss') {
      attention = 'os últimos sinais acertaram menos do que o laboratório provou (cenário de apresentação)';
      bus.emit('attention', attention);
    }
  });
  bus.on('signalUpdate', (s) => { if (scen && s && s.id === scen.sigId && (s.status === 'ignorado' || s.status === 'expirado')) endScenario(); });

  function dismiss(id) {
    const sig = signals.find((s) => s.id === id);
    if (sig && sig.status === 'novo') { sig.status = 'ignorado'; bus.emit('signalUpdate', sig); }
  }

  async function placeOrder({ symbol, type, volume, sl, tp }) {
    const pr = priceOf(symbol);
    const price = type === 'BUY' ? pr.ask : pr.bid;
    const riskUsd = sl ? Math.abs(price - sl) * SYMBOLS[symbol].valuePerPoint * volume : 0;
    const R = sl && tp ? Math.abs(tp - price) / Math.abs(price - sl) : null;
    return broker.order_send({ symbol, type, volume, sl: sl || null, tp: tp || null, comment: 'boleta manual', riskUsd, R, time: now() });
  }

  // ---------- Relógio ----------
  function loop() {
    if (paused) return;
    for (const sym of SYMBOL_IDS) {
      const f = feeds[sym];
      const closed = f.step();
      broker.onTick(sym, f.bid, f.ask, f.now);
      bus.emit('tick', { sym, bid: f.bid, ask: f.ask, time: f.now });
      if (closed) {
        bus.emit('candle', { sym, candle: closed });
        if ((closed.time + 60) % 300 === 0) onM5Close(sym);
      }
    }
    const t = now();
    for (const s of signals) if (s.status === 'novo' && t >= s.expiresAt) { s.status = 'expirado'; bus.emit('signalUpdate', s); }
    bus.emit('clock', t);
  }

  function setSpeed(v) {
    settings.speed = v;
    if (timer) clearInterval(timer);
    timer = setInterval(loop, 10000 / v);
    bus.emit('settings', settings);
  }

  bus.on('closed', (d) => { equity.push({ time: d.time_close || now(), balance: broker.account.balance }); });

  function trainAll(opts = {}) {
    for (const sym of SYMBOL_IDS) labs[sym] = runLab(sym, { limiar: settings.limiar, R: settings.R, stopAtr: settings.stopAtr, maxBars: settings.maxBars, ...opts });
    bus.emit('lab', labs);
  }

  function retrain(sym, opts = {}) {
    labs[sym] = runLab(sym, { limiar: settings.limiar, R: settings.R, stopAtr: settings.stopAtr, maxBars: settings.maxBars, ...opts });
    bus.emit('lab', labs);
    return labs[sym];
  }

  function setSettings(patch) {
    Object.assign(settings, patch);
    if (patch.speed) setSpeed(patch.speed);
    bus.emit('settings', settings);
  }

  // Cenário de estresse para a apresentação: injeta uma sequência de stops.
  function stressLosses(k = 8) {
    for (let j = 0; j < k; j++) {
      const risk = (broker.account.balance * settings.riskPct) / 100;
      broker.account.balance -= risk;
      const deal = { ticket: broker.nextTicket++, symbol: 'XAUUSD', type: 'BUY', volume: 0.1, price_open: feeds.XAUUSD.bid, price_close: feeds.XAUUSD.bid, profit: -risk, reason: 'stop', time: now(), time_close: now(), r: -1, riskUsd: risk, comment: 'cenário de estresse' };
      broker.deals.push(deal);
      equity.push({ time: now(), balance: broker.account.balance });
    }
    broker._log('err', `Cenário de estresse: ${k} stops seguidos injetados`);
    bus.emit('closed', broker.deals[broker.deals.length - 1]);
  }
  function stressBigLoss() {
    const loss = broker.account.balance * (settings.maxDD / 100 + 0.01);
    broker.account.balance -= loss;
    broker.deals.push({ ticket: broker.nextTicket++, symbol: 'HK50', type: 'SELL', volume: 1, price_open: feeds.HK50.bid, price_close: feeds.HK50.bid, profit: -loss, reason: 'stop', time: now(), time_close: now(), r: null, riskUsd: 0, comment: 'cenário de estresse' });
    equity.push({ time: now(), balance: broker.account.balance });
    broker._log('err', 'Cenário de estresse: queda grande da conta');
    bus.emit('closed', broker.deals[broker.deals.length - 1]);
  }
  function resetAccount() {
    broker.positions.length = 0;
    broker.deals.length = 0;
    broker.account.balance = startBalance;
    broker.peak = startBalance;
    equity.length = 0;
    equity.push({ time: now(), balance: startBalance });
    signals.length = 0;
    endScenario();
    attention = null;
    bus.emit('attention', null);
    broker._log('req', 'Conta demo reiniciada em US$ 32.000,00');
    bus.emit('positions', broker.positions);
    bus.emit('closed', null);
    bus.emit('signal', null);
  }

  return {
    bus, settings, feeds, broker, labs, signals, decisions, live, equity, news, t0,
    now, priceOf, sessionOf, signalsToday, getBars, dayChange, upcomingNews, newsAt, semaphore, report,
    execute, dismiss, placeOrder, demoSignal, setSpeed, setSettings, trainAll, retrain,
    stressLosses, stressBigLoss, resetAccount, scenario,
    get scenarioOn() { return scen; },
    get attention() { return attention; },
    pause(v) { paused = v; bus.emit('paused', paused); },
    get paused() { return paused; },
    start() { setSpeed(settings.speed); },
  };
}
