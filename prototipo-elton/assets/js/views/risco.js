// Risco e semáforo: quanto arriscar, limites calculados nas provas e cenários de estresse para a apresentação.
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $, lightsHTML } from '../ui.js';

export default {
  title: 'Risco e semáforo',
  render(root, { engine, toast }) {
    const s = engine.settings;
    root.innerHTML = `
      <div class="page-head"><div><h1>Risco e semáforo</h1><p>Os limites são definidos antes do ao vivo, a partir das provas do laboratório. Verde: continua. Amarelo: avisa. Vermelho: pausa os sinais e pede para refazer estudo e prova.</p></div></div>
      <section class="grid g-2">
        <div class="card">
          <div class="card-h"><h3>${icon('shield', 16)} Semáforo agora</h3></div>
          <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><div id="rLights"></div><div id="rTxt" style="flex:1;min-width:220px"></div></div>
          <div id="rMeters" style="display:flex;flex-direction:column;gap:14px"></div>
        </div>
        <div class="card">
          <div class="card-h"><h3>${icon('target', 16)} Quanto arriscar</h3><span class="sub">vale para todos os sinais</span></div>
          <div class="range-row"><div class="top"><label for="rRisk">Risco por operação</label><b id="rRiskV"></b></div><input type="range" id="rRisk" min="0.25" max="3" step="0.25" value="${s.riskPct}"></div>
          <div class="range-row"><div class="top"><label for="rDD">Limite de queda da conta (pausa tudo)</label><b id="rDDV"></b></div><input type="range" id="rDD" min="5" max="30" step="1" value="${s.maxDD}"></div>
          <div class="calc" id="rCalc" style="font-size:.84rem"></div>
          <div class="table-wrap"><table class="t" id="rTbl"></table></div>
        </div>
      </section>
      <section class="card">
        <div class="card-h"><h3>${icon('alert', 16)} Cenários de estresse para a apresentação</h3><span class="sub">mexem só na conta demo simulada</span></div>
        <p class="muted" style="margin:0">Use para mostrar ao Elton o semáforo funcionando sem esperar o mercado.</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-ghost" id="st5">${icon('x', 14)} Injetar 5 stops seguidos</button>
          <button class="btn btn-ghost" id="st10">${icon('x', 14)} Injetar 10 stops seguidos</button>
          <button class="btn btn-ghost" id="stBig">${icon('alert', 14)} Queda grande da conta</button>
          <button class="btn btn-primary" id="stReset">${icon('refresh', 14)} Reiniciar a conta demo</button>
        </div>
      </section>`;

    function meter(label, val, txt, pct, mark, col) {
      return `<div class="meter"><div class="top"><span>${label}</span><b class="num">${val}</b></div><div class="track"><i style="width:${Math.min(100, pct * 100)}%;background:${col}"></i>${mark !== null ? `<u style="left:${Math.min(100, mark * 100)}%"></u>` : ''}</div><span class="muted" style="font-size:.76rem">${txt}</span></div>`;
    }
    function render() {
      const m = engine.semaphore();
      $('#rLights', root).innerHTML = lightsHTML(m.state, true);
      $('#rTxt', root).innerHTML = `<b style="font-size:1.05rem" class="${m.state === 'verde' ? 'pos' : m.state === 'amarelo' ? 'amber' : 'neg'}">${m.state === 'verde' ? 'Verde · o app continua operando' : m.state === 'amarelo' ? 'Amarelo · o app avisa e continua' : 'Vermelho · sinais pausados'}</b><ul style="margin:6px 0 0;padding-left:18px;color:var(--ink-2);font-size:.86rem">${m.reasons.length ? m.reasons.map((r) => `<li>${r}</li>`).join('') : '<li>todos os números dentro dos limites</li>'}</ul>`;
      $('#rMeters', root).innerHTML = [
        meter('Acerto das últimas 100 operações', m.n ? fmt.pct(m.acerto, 0) + ` (${m.n})` : 'sem operações', `nas provas: ${fmt.pct(m.provaAcerto, 0)} · mínimo para empatar: ${fmt.pct(m.minAcerto, 0)} (o traço)`, m.acerto, m.minAcerto, m.acerto >= m.provaAcerto - 0.05 ? 'var(--green)' : m.acerto >= m.minAcerto ? 'var(--amber)' : 'var(--red)'),
        meter('Stops seguidos agora', String(m.seqNow), `pior sequência nas provas: ${m.worst} (o traço) · maior ao vivo: ${m.seqMax}`, m.seqNow / (m.worst * 1.5), m.worst / (m.worst * 1.5), m.seqNow > m.worst ? 'var(--red)' : m.seqNow >= Math.ceil(m.worst * 0.6) ? 'var(--amber)' : 'var(--green)'),
        meter('Queda da conta desde o maior valor', fmt.pct(m.dd, 1), `limite: ${m.maxDD}% (o traço)`, m.dd / (m.maxDD / 100 * 1.5), 1 / 1.5, m.dd * 100 >= m.maxDD ? 'var(--red)' : m.dd * 100 >= m.maxDD / 2 ? 'var(--amber)' : 'var(--green)'),
      ].join('');
      const bal = engine.broker.account.balance, risk = bal * s.riskPct / 100;
      $('#rRiskV', root).textContent = fmt.num(s.riskPct, 2) + '%';
      $('#rDDV', root).textContent = s.maxDD + '%';
      $('#rCalc', root).innerHTML = `<div>Conta ${fmt.usd(bal)} × ${fmt.num(s.riskPct, 2)}% = <b>${fmt.usd(risk)}</b> por operação (1R).</div><div class="muted">Ouro com stop de 4,00: ${fmt.usd(risk)} ÷ (4,00 × 100) = <b>${fmt.num(Math.max(0.01, Math.floor(risk / 400 * 100) / 100), 2)} lote</b>.</div>`;
      const worst = m.worst;
      $('#rTbl', root).innerHTML = `<thead><tr><th>Arrisca</th><th class="r">Depois de ${worst} stops seguidos</th><th class="r">Perdeu</th><th class="r">Para recuperar</th></tr></thead><tbody>${[0.5, 1, 2, 5].map((q) => { const f = Math.pow(1 - q / 100, worst); return `<tr class="${q === s.riskPct ? 'hi' : ''}"><td>${fmt.num(q, 1)}%</td><td class="num">${fmt.usd(bal * f)}</td><td class="num neg">−${fmt.pct(1 - f)}</td><td class="num">+${fmt.pct(1 / f - 1)}</td></tr>`; }).join('')}</tbody>`;
    }
    $('#rRisk', root).oninput = (e) => { engine.setSettings({ riskPct: +e.target.value }); render(); };
    $('#rDD', root).oninput = (e) => { engine.setSettings({ maxDD: +e.target.value }); render(); };
    $('#st5', root).onclick = () => { engine.stressLosses(5); toast('5 stops seguidos injetados'); };
    $('#st10', root).onclick = () => { engine.stressLosses(10); toast('10 stops seguidos injetados'); };
    $('#stBig', root).onclick = () => { engine.stressBigLoss(); toast('Queda grande injetada'); };
    $('#stReset', root).onclick = () => { engine.resetAccount(); toast('Conta demo reiniciada', 'ok'); render(); };
    render();
    const offs = [engine.bus.on('closed', render), engine.bus.on('lab', render)];
    return () => offs.forEach((o) => o());
  },
};
