// Fichas (variáveis), rótulos triple-barrier e o modelo de regressão logística.
// Regra do relógio: a ficha do candle i só usa candles 0..i.
import { SYMBOLS } from './market.js';
import { clamp } from './util.js';

export const FEATURES = [
  { key: 'forca', label: 'Força da tendência', help: 'Inclinação da média de 50 candles, medida em ATR.' },
  { key: 'varreu_favor', label: 'Varreu liquidez a favor', help: 'Nos últimos 3 candles o preço passou do fundo (na alta) ou do topo (na baixa) dos 20 anteriores e voltou.' },
  { key: 'varreu_contra', label: 'Varreu liquidez contra', help: 'O preço passou do topo (na alta) ou do fundo (na baixa) dos 20 anteriores.' },
  { key: 'momento', label: 'Momento a favor', help: 'Quanto o preço andou nos últimos 3 candles, na direção da tendência, em ATR.' },
  { key: 'recuo', label: 'Candles de recuo', help: 'Quantos candles seguidos foram contra a tendência (máximo 5).' },
  { key: 'redondo', label: 'Distância do número redondo', help: 'Distância até o número redondo mais próximo (10 no ouro, 100 no HK50), em ATR.' },
  { key: 'londres', label: 'Sessão de Londres', help: '1 se for entre 07h e 12h (UTC).' },
  { key: 'ny', label: 'Sessão de Nova York', help: '1 se for entre 12h e 17h (UTC).' },
  { key: 'vol', label: 'Volatilidade relativa', help: 'ATR atual dividido pela média dos últimos 100 ATRs.' },
];

export function indicators(bars) {
  const n = bars.length, ema = new Array(n), atr = new Array(n), atrAvg = new Array(n);
  const k = 2 / 51;
  let sumAtr = 0;
  for (let i = 0; i < n; i++) {
    const b = bars[i];
    ema[i] = i === 0 ? b.close : ema[i - 1] + k * (b.close - ema[i - 1]);
    const tr = i === 0 ? b.high - b.low : Math.max(b.high - b.low, Math.abs(b.high - bars[i - 1].close), Math.abs(b.low - bars[i - 1].close));
    atr[i] = i < 14 ? (i === 0 ? tr : (atr[i - 1] * i + tr) / (i + 1)) : (atr[i - 1] * 13 + tr) / 14;
    sumAtr += atr[i];
    if (i >= 100) sumAtr -= atr[i - 100];
    atrAvg[i] = sumAtr / Math.min(i + 1, 100);
  }
  return { ema, atr, atrAvg };
}

export function regimeOf(slope) {
  return slope > 0.45 ? 'alta' : slope < -0.45 ? 'baixa' : 'lateral';
}

function sweptWithin(bars, i, kind) {
  // kind 'low': algum dos 3 últimos candles furou o menor fundo dos 20 anteriores e o fechamento atual voltou acima
  for (let k = i - 2; k <= i; k++) {
    let ref = kind === 'low' ? Infinity : -Infinity;
    for (let j = k - 20; j < k; j++) ref = kind === 'low' ? Math.min(ref, bars[j].low) : Math.max(ref, bars[j].high);
    if (kind === 'low' && bars[k].low < ref && bars[i].close > ref) return 1;
    if (kind === 'high' && bars[k].high > ref && bars[i].close < ref) return 1;
  }
  return 0;
}

export function featureAt(bars, ind, i, symId) {
  if (i < 110) return null;
  const sym = SYMBOLS[symId];
  const atr = ind.atr[i];
  const slope = (ind.ema[i] - ind.ema[i - 10]) / atr;
  const regime = regimeOf(slope);
  const side = regime === 'alta' ? 1 : regime === 'baixa' ? -1 : 0;
  const sLow = sweptWithin(bars, i, 'low'), sHigh = sweptWithin(bars, i, 'high');
  const dir = side || 1;
  const favor = dir > 0 ? sLow : sHigh, contra = dir > 0 ? sHigh : sLow;
  const mom = ((bars[i].close - bars[i - 3].close) / atr) * dir;
  let recuo = 0;
  for (let k = i; k > i - 5; k--) { if ((bars[k].close - bars[k].open) * dir < 0) recuo++; else break; }
  const c = bars[i].close, rd = sym.round;
  const redondo = clamp(Math.abs(c - Math.round(c / rd) * rd) / atr, 0, 3);
  const h = new Date(bars[i].time * 1000).getUTCHours();
  const londres = h >= 7 && h < 12 ? 1 : 0, ny = h >= 12 && h < 17 ? 1 : 0;
  const vol = atr / ind.atrAvg[i];
  return {
    i, time: bars[i].time, close: c, atr, slope, regime, side,
    x: [Math.abs(slope), favor, contra, clamp(mom, -4, 4), recuo, redondo, londres, ny, vol],
  };
}

// Rótulo triple-barrier: stop, alvo e tempo. Se tocar os dois no mesmo candle, conta como stop.
export function labelAt(bars, i, side, atr, symId, o) {
  const sym = SYMBOLS[symId];
  const entry = bars[i].close, dist = o.stopAtr * atr;
  const sl = entry - side * dist, tp = entry + side * o.R * dist;
  const cost = sym.spread / dist;
  const end = Math.min(bars.length - 1, i + o.maxBars);
  for (let j = i + 1; j <= end; j++) {
    const b = bars[j];
    const hitS = side > 0 ? b.low <= sl : b.high >= sl;
    const hitT = side > 0 ? b.high >= tp : b.low <= tp;
    if (hitS) return { y: 0, r: -1 - cost, out: 'stop', bars: j - i };
    if (hitT) return { y: 1, r: o.R - cost, out: 'alvo', bars: j - i };
  }
  const r = ((bars[end].close - entry) * side) / dist;
  return { y: 0, r: r - cost, out: 'tempo', bars: end - i };
}

// Regressão logística com padronização e penalidade L2.
export function trainLogit(X, y, { iters = 220, lr = 0.35, l2 = 0.02 } = {}) {
  const n = X.length, d = X[0].length;
  const mu = new Array(d).fill(0), sd = new Array(d).fill(0);
  for (const x of X) for (let j = 0; j < d; j++) mu[j] += x[j] / n;
  for (const x of X) for (let j = 0; j < d; j++) sd[j] += (x[j] - mu[j]) ** 2 / n;
  for (let j = 0; j < d; j++) sd[j] = Math.sqrt(sd[j]) || 1;
  const Z = X.map((x) => x.map((v, j) => (v - mu[j]) / sd[j]));
  const w = new Array(d).fill(0);
  const base = y.reduce((s, v) => s + v, 0) / n;
  let b = Math.log((base + 1e-6) / (1 - base + 1e-6));
  const gw = new Array(d);
  for (let it = 0; it < iters; it++) {
    gw.fill(0); let gb = 0;
    for (let k = 0; k < n; k++) {
      const z = Z[k];
      let s = b;
      for (let j = 0; j < d; j++) s += w[j] * z[j];
      const e = 1 / (1 + Math.exp(-s)) - y[k];
      gb += e;
      for (let j = 0; j < d; j++) gw[j] += e * z[j];
    }
    b -= (lr * gb) / n;
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
  }
  return { w, b, mu, sd, base };
}

export function predict(m, x) {
  let s = m.b;
  for (let j = 0; j < x.length; j++) s += m.w[j] * ((x[j] - m.mu[j]) / m.sd[j]);
  return 1 / (1 + Math.exp(-s));
}

// Quanto cada variável empurrou a chance para cima ou para baixo (em "log-chances").
export function contributions(m, x) {
  return x.map((v, j) => ({ ...FEATURES[j], value: v, c: m.w[j] * ((v - m.mu[j]) / m.sd[j]) }));
}
