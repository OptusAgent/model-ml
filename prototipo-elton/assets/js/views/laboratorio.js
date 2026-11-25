// Laboratório: resultado do Walk Forward em gráficos, cofre, teste contra o acaso, calibração
// e as regras encontradas. Os botões refazem o estudo com outros parâmetros e trocam o modelo ao vivo.
import { SYMBOL_IDS } from '../market.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $ } from '../ui.js';

function roundsSVG(L) {
  const W = 640, H = 220, X0 = 50, X1 = 630, Y0 = 16, Y1 = 180;
  const vals = L.rounds.flatMap((r) => [r.train.exp, r.test.exp]).concat([L.cofre.exp, 0]);
  const lo = Math.min(-0.3, ...vals), hi = Math.max(0.6, ...vals);
  const Y = (v) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
  const groups = [...L.rounds.map((r) => ({ lbl: 'Rodada ' + r.k, a: r.train.exp, b: r.test.exp })), { lbl: 'Cofre', a: null, b: L.cofre.exp }];
  const gw = (X1 - X0) / groups.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Expectativa no estudo e na prova por rodada">`;
  [lo, 0, hi].forEach((t) => (s += `<line x1="${X0}" x2="${X1}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? 'rgba(var(--tint),.35)' : 'rgba(var(--tint),.1)'}"/><text x="${X0 - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt.r(t)}</text>`));
  groups.forEach((g, i) => {
    const cx = X0 + gw * i + gw / 2, bw = Math.min(34, gw * 0.3);
    const bar = (v, x, col) => { const y = Math.min(Y(v), Y(0)), h = Math.abs(Y(v) - Y(0)); return `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1, h)}" rx="5" fill="${col}"/><text x="${x + bw / 2}" y="${v >= 0 ? y - 5 : y + h + 13}" text-anchor="middle" font-size="10.5" fill="var(--ink-2)">${fmt.r(v)}</text>`; };
    if (g.a !== null) s += bar(g.a, cx - bw - 3, 'var(--blue-soft-2)');
    s += bar(g.b, g.a !== null ? cx + 3 : cx - bw / 2, g.b > 0 ? 'var(--green)' : 'var(--red)');
    s += `<text x="${cx}" y="${H - 14}" text-anchor="middle" font-size="11.5" fill="var(--muted)">${g.lbl}</text>`;
  });
  return s + '</svg>';
}

function permSVG(L) {
  const W = 640, H = 150, X0 = 20, X1 = 620, Y1 = 110;
  const all = L.perm.concat([L.cofre.exp]);
  const lo = Math.min(...all) - 0.1, hi = Math.max(...all) + 0.1;
  const X = (v) => X0 + ((v - lo) / (hi - lo)) * (X1 - X0);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Resultado no chute contra o resultado do modelo">`;
  s += `<line x1="${X0}" x2="${X1}" y1="${Y1}" y2="${Y1}" stroke="rgba(var(--tint),.25)"/>`;
  s += `<line x1="${X(0)}" x2="${X(0)}" y1="20" y2="${Y1}" stroke="rgba(var(--tint),.25)" stroke-dasharray="3 3"/><text x="${X(0)}" y="${Y1 + 16}" text-anchor="middle" font-size="11" fill="var(--muted)">0R</text>`;
  const counts = {};
  L.perm.forEach((v) => { const k = Math.round(v * 20); counts[k] = (counts[k] || 0) + 1; s += `<circle cx="${X(v)}" cy="${Y1 - 8 - (counts[k] - 1) * 13}" r="5.5" fill="rgba(var(--tint),.45)"/>`; });
  s += `<line x1="${X(L.cofre.exp)}" x2="${X(L.cofre.exp)}" y1="16" y2="${Y1}" stroke="var(--blue-2)" stroke-width="2.5"/><text x="${X(L.cofre.exp)}" y="12" text-anchor="middle" font-size="11.5" font-weight="600" fill="var(--blue-2)">modelo ${fmt.r(L.cofre.exp)}</text>`;
  s += `<text x="${X0}" y="${H - 6}" font-size="11" fill="var(--muted)">cinza: ${L.perm.length} tentativas no chute (comprar ou vender sorteado) no período do cofre</text>`;
  return s + '</svg>';
}

function calibSVG(L) {
  const W = 300, H = 260, X0 = 44, X1 = 290, Y0 = 12, Y1 = 214, m = 0.8;
  const X = (v) => X0 + (v / m) * (X1 - X0), Y = (v) => Y1 - (v / m) * (Y1 - Y0);
  let s = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:420px;height:auto" role="img" aria-label="O modelo disse contra o que aconteceu">`;
  [0, 0.2, 0.4, 0.6, 0.8].forEach((t) => (s += `<line x1="${X0}" x2="${X1}" y1="${Y(t)}" y2="${Y(t)}" stroke="rgba(var(--tint),.1)"/><text x="${X0 - 6}" y="${Y(t) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${t * 100}%</text><text x="${X(t)}" y="${Y1 + 15}" text-anchor="middle" font-size="10" fill="var(--muted)">${t * 100}%</text>`));
  s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(m)}" y2="${Y(m)}" stroke="var(--amber)" stroke-width="1.5" stroke-dasharray="6 4"/>`;
  L.bins.forEach((b) => { const ok = Math.abs(b.happened - b.said) <= 0.07; s += `<circle cx="${X(b.said)}" cy="${Y(b.happened)}" r="${4 + Math.min(6, b.n / 80)}" fill="${ok ? 'var(--green)' : 'var(--red)'}" opacity=".85"/>`; });
  s += `<text x="${(X0 + X1) / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">o modelo disse</text><text x="12" y="${(Y0 + Y1) / 2}" text-anchor="middle" font-size="11" fill="var(--muted)" transform="rotate(-90 12 ${(Y0 + Y1) / 2})">aconteceu</text>`;
  return s + '</svg>';
}

export default {
  title: 'Laboratório',
  render(root, { engine, toast }) {
    let sym = 'XAUUSD';
    const s = engine.settings;
    root.innerHTML = `
      <div class="page-head"><div><h1>Laboratório</h1><p>Aqui as regras são descobertas e provadas. O modelo estuda um pedaço do passado, faz a prova num período que nunca viu, avança e repete (Walk Forward). Depois enfrenta o cofre e o teste contra o acaso.</p></div>
        <div class="seg" id="lSym">${SYMBOL_IDS.map((x) => `<button data-s="${x}">${x}</button>`).join('')}</div></div>
      <section class="grid g-4" id="lKpi"></section>
      <section class="grid g-main">
        <div class="card"><div class="card-h"><h3>${icon('flask', 16)} Estudo × prova em cada rodada</h3><span class="sub">azul: estudo · verde/vermelho: prova (expectativa em R)</span></div><div id="lRounds"></div><div class="table-wrap"><table class="t" id="lRoundsT"></table></div></div>
        <div class="card"><div class="card-h"><h3>${icon('settings', 16)} Refazer o estudo</h3></div>
          <p class="muted" style="margin:0;font-size:.84rem">Mude os parâmetros e retreine. O modelo novo passa a ser usado ao vivo na hora.</p>
          <div class="range-row"><div class="top"><label for="lLim">Limite de chance para sinal</label><b id="lLimV"></b></div><input type="range" id="lLim" min="0.35" max="0.6" step="0.01" value="${s.limiar}"></div>
          <div class="range-row"><div class="top"><label for="lR">Alvo em R</label><b id="lRV"></b></div><input type="range" id="lR" min="1" max="4" step="0.5" value="${s.R}"></div>
          <div class="range-row"><div class="top"><label for="lStop">Stop em ATR</label><b id="lStopV"></b></div><input type="range" id="lStop" min="0.5" max="2" step="0.25" value="${s.stopAtr}"></div>
          <div class="range-row"><div class="top"><label for="lMax">Barreira do tempo (candles de 5 min)</label><b id="lMaxV"></b></div><input type="range" id="lMax" min="6" max="48" step="6" value="${s.maxBars}"></div>
          <button class="btn btn-primary" id="lRun">${icon('refresh', 15)} Retreinar os dois ativos</button>
          <div class="muted" style="font-size:.78rem" id="lMeta"></div>
        </div>
      </section>
      <section class="grid g-2">
        <div class="card"><div class="card-h"><h3>${icon('shield', 16)} Cofre e teste contra o acaso</h3></div><div id="lPerm"></div><div id="lPermTxt" class="muted" style="font-size:.84rem"></div></div>
        <div class="card"><div class="card-h"><h3>${icon('target', 16)} A chance é honesta?</h3><span class="sub">pontos na linha tracejada = honesto</span></div><div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center"><div id="lCal" style="flex:1;min-width:240px"></div></div></div>
      </section>
      <section class="card"><div class="card-h"><h3>${icon('zap', 16)} Regras que o modelo encontrou</h3><span class="sub">medidas nas provas, não no estudo</span></div><div class="table-wrap"><table class="t" id="lRules"></table></div>
        <p class="muted" style="margin:0;font-size:.82rem">Ninguém escreveu essas regras. Elas aparecem porque, nas provas, esses momentos tiveram mais alvos. Os conceitos do Elton (liquidez, tendência, lateral) entram como números da ficha; se forem bons, aparecem aqui.</p></section>`;

    function kpi(label, val, sub, cls = '') { return `<div class="card" style="gap:6px"><span class="muted" style="font-size:.78rem;font-weight:600">${label}</span><b class="num ${cls}" style="font-size:1.35rem">${val}</b><span class="muted" style="font-size:.76rem">${sub}</span></div>`; }
    function sliders() {
      $('#lLimV', root).textContent = fmt.pct(+$('#lLim', root).value, 0);
      $('#lRV', root).textContent = fmt.num(+$('#lR', root).value, 1) + 'R';
      $('#lStopV', root).textContent = fmt.num(+$('#lStop', root).value, 2) + ' ATR';
      $('#lMaxV', root).textContent = `${$('#lMax', root).value} (${$('#lMax', root).value * 5} min)`;
    }
    function render() {
      root.querySelectorAll('#lSym button').forEach((b) => b.classList.toggle('on', b.dataset.s === sym));
      const L = engine.labs[sym];
      $('#lKpi', root).innerHTML = [
        kpi('Veredito', L.verdict ? 'Aprovada' : 'Reprovada', L.verdict ? 'pode operar na conta demo' : 'o app só observa este ativo', L.verdict ? 'pos' : 'amber'),
        kpi('Eficiência do Walk Forward', fmt.pct(L.wfeAvg, 0), 'prova ÷ estudo · aprova com 50% ou mais', L.wfeAvg >= 0.5 ? 'pos' : 'neg'),
        kpi('Rodadas com lucro na prova', `${L.passRounds} de ${L.rounds.length}`, 'precisa passar em todas', L.passRounds === L.rounds.length ? 'pos' : 'neg'),
        kpi('Chance de ser sorte', fmt.num(L.pValue, 2), 'aprova com 0,10 ou menos', L.pValue <= 0.1 ? 'pos' : 'neg'),
      ].join('');
      $('#lRounds', root).innerHTML = roundsSVG(L);
      $('#lRoundsT', root).innerHTML = `<thead><tr><th>Rodada</th><th>Estudo</th><th>Prova</th><th class="r">Operações</th><th class="r">Acerto</th><th class="r">Expectativa</th><th class="r">Sem o modelo</th><th class="r">Eficiência</th></tr></thead><tbody>${L.rounds.map((r) => `<tr><td>${r.k}</td><td class="muted">${fmt.dateTime(r.trainRange[0]).slice(0, 5)} → ${fmt.dateTime(r.trainRange[1]).slice(0, 5)}</td><td class="muted">${fmt.dateTime(r.testRange[0]).slice(0, 5)} → ${fmt.dateTime(r.testRange[1]).slice(0, 5)}</td><td class="num">${r.test.n}</td><td class="num">${fmt.pct(r.test.acerto, 0)}</td><td class="num ${r.test.exp > 0 ? 'pos' : 'neg'}">${fmt.r(r.test.exp)}</td><td class="num muted">${fmt.r(r.base.exp)}</td><td class="num">${r.wfe === null ? '—' : fmt.pct(r.wfe, 0)}</td></tr>`).join('')}</tbody>`;
      $('#lPerm', root).innerHTML = permSVG(L);
      $('#lPermTxt', root).innerHTML = `No cofre (${fmt.dateTime(L.cofreRange[0]).slice(0, 5)} → ${fmt.dateTime(L.cofreRange[1]).slice(0, 5)}), o modelo fez <b class="${L.cofre.exp > 0 ? 'pos' : 'neg'}">${fmt.r(L.cofre.exp)}</b> por operação em ${L.cofre.n} operações (acerto ${fmt.pct(L.cofre.acerto, 0)}). Entrando no chute, ${L.perm.filter((v) => v >= L.cofre.exp).length} de ${L.perm.length} tentativas igualaram ou superaram. Chance de ser sorte: <b>${fmt.num(L.pValue, 2)}</b>.`;
      $('#lCal', root).innerHTML = calibSVG(L);
      $('#lRules', root).innerHTML = `<thead><tr><th>Regra encontrada</th><th class="r">Momentos</th><th class="r">O modelo disse</th><th class="r">Aconteceu</th><th class="r">Expectativa</th></tr></thead><tbody>${L.rules.slice(0, 8).map((r) => `<tr><td class="wrap">${r.parts.map((p, i) => `<span class="pill ${i === 0 ? (p.includes('alta') ? 'green' : 'red') : i === 1 || i === 2 ? (p.includes('sem ') ? 'gray' : 'violet') : 'blue'}">${p}</span>`).join(' ')}</td><td class="num">${r.n}</td><td class="num">${fmt.pct(r.said, 0)}</td><td class="num">${fmt.pct(r.happened, 0)}</td><td class="num ${r.exp > 0 ? 'pos' : 'neg'}">${fmt.r(r.exp)}</td></tr>`).join('')}<tr><td class="wrap"><span class="pill gray">Mercado lateral</span> <span class="muted">não opera</span></td><td class="num">${L.lateral.n}</td><td class="num">—</td><td class="num">${fmt.pct(L.lateral.acerto, 0)}</td><td class="num neg">${fmt.r(L.lateral.exp)}</td></tr></tbody>`;
      $('#lMeta', root).textContent = `Modelo ${L.version} · ${fmt.int(L.counts.samples)} momentos em tendência · ${fmt.int(L.counts.bars)} candles de 5 min (sintéticos)`;
      sliders();
    }
    ['lLim', 'lR', 'lStop', 'lMax'].forEach((id) => ($('#' + id, root).oninput = sliders));
    $('#lRun', root).onclick = () => {
      const btn = $('#lRun', root);
      btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span> Treinando…';
      setTimeout(() => {
        engine.setSettings({ limiar: +$('#lLim', root).value, R: +$('#lR', root).value, stopAtr: +$('#lStop', root).value, maxBars: +$('#lMax', root).value });
        engine.trainAll();
        btn.disabled = false; btn.innerHTML = `${icon('refresh', 15)} Retreinar os dois ativos`;
        const v = engine.labs;
        toast(`Retreinado · XAUUSD ${v.XAUUSD.verdict ? 'aprovado' : 'reprovado'} · HK50 ${v.HK50.verdict ? 'aprovado' : 'reprovado'}`, 'ok');
      }, 50);
    };
    root.querySelector('#lSym').onclick = (e) => { const b = e.target.closest('button'); if (b) { sym = b.dataset.s; render(); } };
    render();
    const off = engine.bus.on('lab', render);
    return () => off();
  },
};
