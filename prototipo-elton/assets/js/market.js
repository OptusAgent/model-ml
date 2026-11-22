// Mercado simulado. No app real, estes preços chegam do MT5 (Hantec) pela ponte Python.
// O simulador cria fases de alta, baixa e lateral e um efeito de "captura de liquidez":
// quando o preço varre o fundo (na alta) ou o topo (na baixa), ele tende a voltar.
import { rng, gauss } from './util.js';

export const SYMBOLS = {
  XAUUSD: {
    id: 'XAUUSD', name: 'Ouro', desc: 'XAU/USD · onça troy', digits: 2,
    start: 4158.4, vol: 1.15, spread: 0.3, round: 10,
    valuePerPoint: 100, // US$ por 1,00 de movimento por lote (1 lote = 100 onças)
    edge: { drift: 0.05, boost: 0.55, boostMin: 25, switchP: 1 / 480 }, // simulação com vantagem real
    contractText: '1 lote = 100 onças',
  },
  HK50: {
    id: 'HK50', name: 'Hang Seng', desc: 'HK50 · índice de Hong Kong', digits: 1,
    start: 25480, vol: 7.5, spread: 8, round: 100,
    valuePerPoint: 1, // simplificação do protótipo: US$ 1 por ponto por lote (confirmar na Hantec)
    edge: { drift: 0.02, boost: 0.08, boostMin: 15, switchP: 1 / 260 }, // simulação quase sem vantagem
    contractText: '1 lote = US$ 1 por ponto (simulado)',
  },
};

export const SYMBOL_IDS = Object.keys(SYMBOLS);
const SUBSTEPS = 6; // cada candle de 1 minuto é formado por 6 "ticks" de 10 segundos

export class Feed {
  constructor(symId, seed, startTime, histMinutes = 0, keep = 6000) {
    this.keep = keep;
    this.sym = SYMBOLS[symId];
    this.r = rng(seed);
    this.p = this.sym.start;
    this.regime = 'alta';
    this.anchor = this.p;
    this.boost = 0;
    this.boostLeft = 0;
    this.volMult = 1;
    this.m1 = [];
    this.minLow = Infinity;
    this.maxHigh = -Infinity;
    this.time = startTime;
    for (let k = 0; k < histMinutes; k++) this._fullCandle();
    this._newCurrent();
  }

  get bid() { return this.p; }
  get ask() { return this.p + this.sym.spread; }

  _newCurrent() {
    this.cur = { time: this.time, open: this.p, high: this.p, low: this.p, close: this.p };
    this.sub = 0;
  }

  _maybeSwitchRegime() {
    if (this.r() < this.sym.edge.switchP) {
      const others = ['alta', 'baixa', 'lateral'].filter((x) => x !== this.regime);
      this.regime = others[this.r() < 0.5 ? 0 : 1];
      if (this.regime === 'lateral') this.anchor = this.p;
    }
    this.volMult = Math.min(1.6, Math.max(0.65, this.volMult + (this.r() - 0.5) * 0.04));
  }

  _advance() {
    const v = this.sym.vol * this.volMult;
    let drift = 0;
    const E = this.sym.edge;
    if (this.regime === 'alta') drift = E.drift * v;
    else if (this.regime === 'baixa') drift = -E.drift * v;
    else drift = -(this.p - this.anchor) * 0.02;
    if (this.boostLeft > 0) { drift += this.boost * v; }
    const dt = 1 / SUBSTEPS;
    this.p += drift * dt + v * gauss(this.r) * Math.sqrt(dt);
    // captura de liquidez: varreu o fundo na alta (ou o topo na baixa) e tende a voltar
    if (this.boostLeft <= 0) {
      if (this.regime === 'alta' && this.p < this.minLow) { this.boost = this.sym.edge.boost; this.boostLeft = this.sym.edge.boostMin * SUBSTEPS; }
      if (this.regime === 'baixa' && this.p > this.maxHigh) { this.boost = -this.sym.edge.boost; this.boostLeft = this.sym.edge.boostMin * SUBSTEPS; }
    } else this.boostLeft--;
  }

  _closeCurrent() {
    this.m1.push(this.cur);
    if (this.m1.length > this.keep) this.m1.splice(0, this.m1.length - this.keep);
    const last = this.m1.slice(-100);
    this.minLow = Math.min(...last.map((c) => c.low));
    this.maxHigh = Math.max(...last.map((c) => c.high));
    this.time += 60;
    this._maybeSwitchRegime();
    const closed = this.cur;
    this._newCurrent();
    return closed;
  }

  _fullCandle() {
    if (!this.cur) this._newCurrent();
    for (let s = 0; s < SUBSTEPS; s++) this._tickOnly();
    this._closeCurrent();
  }

  _tickOnly() {
    this._advance();
    const c = this.cur;
    c.high = Math.max(c.high, this.p);
    c.low = Math.min(c.low, this.p);
    c.close = this.p;
    this.sub++;
  }

  // Um tick ao vivo. Devolve o candle de 1 minuto que fechou, se fechou.
  step() {
    this._tickOnly();
    if (this.sub >= SUBSTEPS) return this._closeCurrent();
    return null;
  }

  // Tempo simulado do tick atual (segundos UTC)
  get now() { return this.cur.time + this.sub * (60 / SUBSTEPS); }
}

// Junta candles de 1 minuto em candles maiores (5, 15 ou 60 minutos).
export function aggregate(m1, tfMin, extra) {
  const src = extra ? m1.concat([extra]) : m1;
  if (tfMin === 1) return src.map((c) => ({ ...c }));
  const span = tfMin * 60;
  const out = [];
  let cur = null;
  for (const c of src) {
    const b = Math.floor(c.time / span) * span;
    if (!cur || cur.time !== b) {
      cur = { time: b, open: c.open, high: c.high, low: c.low, close: c.close };
      out.push(cur);
    } else {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
    }
  }
  return out;
}

// Histórico longo para o laboratório (no app real: mt5.copy_rates_range).
export function generateHistory(symId, seed, minutes, startTime) {
  const f = new Feed(symId, seed, startTime, minutes, Infinity);
  return f.m1;
}
