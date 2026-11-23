// Laboratório: monta fichas e rótulos no histórico, treina e testa com Walk Forward,
// guarda um cofre, mede a calibração e faz o teste contra a sorte (rótulos embaralhados).
import { generateHistory, aggregate } from './market.js';
import { indicators, featureAt, labelAt, trainLogit, predict } from './features.js';
import { rng, mean } from './util.js';

// A "regra" de um momento: a combinação de condições que o laboratório usa para agrupar os resultados.
export const RULE_MIN = 20; // abaixo disso, poucos casos para confiar
export function ruleParts(regime, x) {
  const sess = x[9] ? 'abertura da Ásia' : x[6] ? 'Londres' : x[7] ? 'Nova York' : 'fora das sessões';
  return [regime === 'alta' ? 'Tendência de alta' : 'Tendência de baixa', x[1] ? 'varreu liquidez a favor' : 'sem varrida', x[11] ? 'divergência RSI a favor' : 'sem divergência', sess];
}

export const LAB_DEFAULTS = { limiar: 0.5, R: 3, stopAtr: 1, maxBars: 36, minutes: 90000, perms: 20 };

// Uma operação por vez: ignora entradas enquanto a anterior ainda está aberta.
function nonOverlap(list) {
  const out = []; let end = -1;
  for (const s of list) if (s.i > end) { out.push(s); end = s.i + s.bars; }
  return out;
}

function evaluate(model, set, limiar) {
  const t = nonOverlap(set.filter((s) => predict(model, s.x) >= limiar));
  const wins = t.filter((s) => s.y === 1).length;
  let worst = 0, run = 0;
  for (const s of t) { if (s.y === 1) run = 0; else { run++; worst = Math.max(worst, run); } }
  return { n: t.length, acerto: t.length ? wins / t.length : 0, exp: mean(t.map((s) => s.r)), total: t.reduce((a, s) => a + s.r, 0), worst };
}
function evalAll(all) {
  const set = nonOverlap(all);
  return { n: set.length, acerto: set.length ? set.filter((s) => s.y === 1).length / set.length : 0, exp: mean(set.map((s) => s.r)) };
}

export function buildDataset(symId, o, seed) {
  const start = Math.floor(Date.UTC(2021, 0, 4, 0, 0) / 1000);
  const m1 = generateHistory(symId, seed, o.minutes, start);
  const bars = aggregate(m1, 5);
  const ind = indicators(bars);
  const samples = [], lateral = [];
  for (let i = 110; i < bars.length - o.maxBars - 1; i++) {
    const f = featureAt(bars, ind, i, symId);
    if (!f) continue;
    if (f.side === 0) {
      // lateral: mede o que aconteceria comprando a favor da inclinação, só para comparar
      const lab = labelAt(bars, i, f.slope >= 0 ? 1 : -1, f.atr, symId, o);
      lateral.push({ ...lab });
      continue;
    }
    const lab = labelAt(bars, i, f.side, f.atr, symId, o);
    samples.push({ ...f, ...lab });
  }
  return { bars, samples, lateral, m1count: m1.length };
}

export function runLab(symId, opts = {}) {
  const o = { ...LAB_DEFAULTS, ...opts };
  const seed = symId === 'XAUUSD' ? 1101 : 2207;
  const ds = buildDataset(symId, o, seed);
  const S = ds.samples;
  const cofreStart = Math.floor(S.length * 0.85);
  const main = S.slice(0, cofreStart), cofre = S.slice(cofreStart);
  const B = 6, bs = Math.floor(main.length / B);
  const blocks = Array.from({ length: B }, (_, k) => main.slice(k * bs, k === B - 1 ? main.length : (k + 1) * bs));
  const rounds = [];
  const calib = [];
  for (let k = 0; k + 2 < B; k++) {
    const train = blocks[k].concat(blocks[k + 1]), test = blocks[k + 2];
    const m = trainLogit(train.map((s) => s.x), train.map((s) => s.y));
    const tr = evaluate(m, train, o.limiar), te = evaluate(m, test, o.limiar);
    for (const s of test) calib.push({ p: predict(m, s.x), y: s.y, s });
    rounds.push({
      k: k + 1, trainRange: [train[0].time, train[train.length - 1].time], testRange: [test[0].time, test[test.length - 1].time],
      train: tr, test: te, base: evalAll(test), wfe: tr.exp > 0.05 && tr.n >= 20 ? te.exp / tr.exp : null,
    });
  }
  const model = trainLogit(main.map((s) => s.x), main.map((s) => s.y));
  const cofreRes = evaluate(model, cofre, o.limiar);
  const cofreBase = evalAll(cofre);

  // Teste contra o acaso: no mesmo período do cofre, entra nos mesmos momentos
  // mas escolhe comprar ou vender no chute. Repete várias vezes.
  const r = rng(77);
  const perm = [];
  for (let p = 0; p < o.perms; p++) {
    const picks = nonOverlap(cofre.filter(() => r() < 0.5));
    const rs = picks.map((s) => labelAt(ds.bars, s.i, r() < 0.5 ? 1 : -1, s.atr, symId, o).r);
    perm.push(mean(rs));
  }
  const pValue = (perm.filter((v) => v >= cofreRes.exp).length + 1) / (perm.length + 1);

  // Calibração: o modelo disse X%, aconteceu quanto?
  const edges = [0, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6, 1];
  const bins = [];
  for (let b = 0; b < edges.length - 1; b++) {
    const g = calib.filter((c) => c.p >= edges[b] && c.p < edges[b + 1]);
    if (g.length >= 15) bins.push({ from: edges[b], to: edges[b + 1], n: g.length, said: mean(g.map((c) => c.p)), happened: mean(g.map((c) => c.y)) });
  }

  // Regras encontradas: combinações que o modelo favorece, medidas nas provas.
  const groups = new Map();
  for (const c of calib) {
    const key = ruleParts(c.s.regime, c.s.x).join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  const allRules = [...groups.entries()]
    .map(([key, g]) => ({ key, parts: key.split('|'), n: g.length, said: mean(g.map((c) => c.p)), happened: mean(g.map((c) => c.y)), exp: mean(g.map((c) => c.s.r)) }));
  // Índice de todas as combinações, para cada sinal ao vivo mostrar a regra dele e como ela foi nas provas.
  const ruleIndex = Object.fromEntries(allRules.map((r) => [r.key, r]));
  const rules = allRules.filter((g) => g.n >= RULE_MIN).sort((a, b) => b.exp - a.exp);
  const lateralRes = { n: ds.lateral.length, acerto: mean(ds.lateral.map((l) => l.y)), exp: mean(ds.lateral.map((l) => l.r)) };

  const allTest = rounds.reduce((a, x) => a + x.test.n, 0);
  const provaAcerto = allTest ? rounds.reduce((a, x) => a + x.test.acerto * x.test.n, 0) / allTest : 0;
  const worstStreak = Math.max(...rounds.map((x) => x.test.worst), cofreRes.worst);
  const passRounds = rounds.filter((x) => x.test.exp > 0).length;
  const wfeVals = rounds.map((x) => x.wfe).filter((v) => v !== null);
  const wfeAvg = wfeVals.length === rounds.length ? mean(wfeVals) : (wfeVals.length ? Math.min(mean(wfeVals), 0) : 0);
  const verdict = passRounds === rounds.length && cofreRes.exp > 0 && pValue <= 0.1 && wfeAvg >= 0.5;

  return {
    symId, opts: o, model, rounds, cofre: cofreRes, cofreBase, cofreRange: [cofre[0].time, cofre[cofre.length - 1].time],
    perm, pValue, bins, rules, ruleIndex, lateral: lateralRes,
    counts: {
      bars: ds.bars.length, m1: ds.m1count, samples: S.length, lateral: ds.lateral.length,
      alvo: S.filter((s) => s.out === 'alvo').length, stop: S.filter((s) => s.out === 'stop').length, tempo: S.filter((s) => s.out === 'tempo').length,
    },
    sample: S.slice(-8), barsTail: ds.bars.slice(-6), firstBar: ds.bars[0], lastBar: ds.bars[ds.bars.length - 1],
    provaAcerto, worstStreak, passRounds, wfeAvg, verdict, minAcerto: 1 / (1 + o.R),
    trainedAt: Date.now(), version: 'v' + new Date().toISOString().slice(0, 10).replace(/-/g, '.') + '-' + symId.toLowerCase(),
  };
}
