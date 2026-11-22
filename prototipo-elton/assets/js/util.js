// Utilidades compartilhadas: números em pt-BR, sorteio com semente e um barramento de eventos.
// Este arquivo não usa o DOM, para que o motor possa ser testado no Node.

export const nf = (n, min = 2, max = min) =>
  Number(n).toLocaleString('pt-BR', { minimumFractionDigits: min, maximumFractionDigits: max });

export const fmt = {
  num: (n, d = 2) => nf(n, d, d),
  int: (n) => nf(Math.round(n), 0, 0),
  usd: (n) => (n < 0 ? '−' : '') + 'US$ ' + nf(Math.abs(n), 2, 2),
  usdSigned: (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + 'US$ ' + nf(Math.abs(n), 2, 2),
  signed: (n, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf(Math.abs(n), d, d),
  r: (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf(Math.abs(n), 2, 2) + 'R',
  pct: (n, d = 1) => nf(n * 100, d, d) + '%',
  pctSigned: (n, d = 2) => (n > 0 ? '+' : n < 0 ? '−' : '') + nf(Math.abs(n) * 100, d, d) + '%',
  lots: (n) => nf(n, 2, 2),
  time: (t) => {
    const d = new Date(t * 1000);
    return String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0');
  },
  dateTime: (t) => {
    const d = new Date(t * 1000);
    return String(d.getUTCDate()).padStart(2, '0') + '/' + String(d.getUTCMonth() + 1).padStart(2, '0') + ' ' + fmt.time(t);
  },
};

// Sorteio reproduzível (mesma semente = mesma sequência).
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r) {
  let u = 0, v = 0;
  while (!u) u = r();
  while (!v) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function createBus() {
  const map = new Map();
  return {
    on(ev, fn) {
      if (!map.has(ev)) map.set(ev, new Set());
      map.get(ev).add(fn);
      return () => map.get(ev).delete(fn);
    },
    emit(ev, data) {
      const s = map.get(ev);
      if (s) for (const fn of [...s]) fn(data);
    },
  };
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
