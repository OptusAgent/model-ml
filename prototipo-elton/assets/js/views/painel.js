// Painel: visão geral da conta, dos ativos, do sinal atual e do que o vigia está pensando.
import { SYMBOLS, SYMBOL_IDS } from '../market.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $, px, REGIME_PILL, symIcon, sparkline, lightsHTML, createCandleChart, signalCardHTML, bindSignalActions } from '../ui.js';

const TFS = [[1, 'M1'], [5, 'M5'], [15, 'M15'], [60, 'H1']];

export default {
  title: 'Painel',
  render(root, { engine, toast, go }) {
    let sym = 'XAUUSD', tf = 5, raf = 0;
    root.innerHTML = `
      <div class="page-head"><div><h1>Olá, Elton</h1><p>O modelo vigia o ouro e o HK50. Quando a chance de bater o alvo passa do limite, o sinal aparece aqui e você decide se aperta o botão.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn-ghost btn-sm" href="#/guia">${icon('book', 14)} Roteiro</a><a class="btn btn-ghost btn-sm" href="#/notebook">${icon('code', 14)} Ver o modelo por trás</a></div></div>

      <section class="grid g-hero">
        <div class="balance-card">
          <div class="lbl">${icon('wallet', 16)} Conta MT5 · Hantec Demo <span class="pill" style="background:rgba(255,255,255,.16);color:#fff;margin-left:auto">simulada</span></div>
          <div><div class="big" id="pBal"></div><div style="margin-top:6px;font-size:.82rem;color:rgba(255,255,255,.85)" id="pDay"></div></div>
          <div class="meta" id="pMeta"></div>
          <div class="btns"><a class="btn btn-glass" href="#/posicoes">${icon('layers', 16)} Posições</a><a class="btn btn-glass" href="#/conexoes">${icon('plug', 16)} Conexão MT5</a></div>
        </div>
        <div class="g-mini">
          ${SYMBOL_IDS.map((s) => `<div class="mini" data-sym="${s}" role="button" tabindex="0" aria-label="Mostrar ${s} no gráfico">
            <div class="row">${symIcon(s)}<div class="name"><b>${SYMBOLS[s].name}</b><small>${s}</small></div><div class="px"><b data-px="${s}"></b><small data-chg="${s}"></small></div></div>
            <div data-spark="${s}"></div>
            <div class="foot"><span data-reg="${s}"></span><span class="muted num" style="font-size:.74rem" data-chance="${s}"></span></div></div>`).join('')}
          <div class="mini" data-go="risco" role="button" tabindex="0">
            <div class="row"><div class="name"><b>Semáforo</b><small>proteção da conta</small></div><div class="px" id="pLights"></div></div>
            <div class="muted" style="font-size:.78rem" id="pSemTxt"></div>
          </div>
          <div class="mini" data-go="laboratorio" role="button" tabindex="0">
            <div class="row"><div class="name"><b>Modelo em produção</b><small id="pVer"></small></div><span class="pill violet" style="margin-left:auto">${icon('flask', 12)} Walk Forward</span></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap" id="pLab"></div>
          </div>
        </div>
      </section>

      <section class="grid g-main">
        <div class="card">
          <div class="card-h">
            <div style="display:flex;align-items:center;gap:12px;min-width:0">${'<span id="cIc"></span>'}<div><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><b id="cName"></b><span id="cReg"></span></div><div class="chart-big-price" id="cPx"></div></div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <div class="seg" id="symSeg">${SYMBOL_IDS.map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div>
              <div class="seg" id="tfSeg">${TFS.map(([v, l]) => `<button data-tf="${v}">${l}</button>`).join('')}</div>
            </div>
          </div>
          <div class="chart-box" id="chart"><div class="chart-legend"><span>Setas = sinais do modelo</span><span>Bolinhas = stop/alvo atingido</span><span>Linhas = posição aberta</span></div></div>
          <div class="muted" style="font-size:.78rem" id="cChance"></div>
        </div>
        <div class="col">
          <div id="sigSlot"></div>
          <div class="card">
            <div class="card-h"><h3>${icon('eye', 16)} O que o vigia está pensando</h3><span class="sub">a cada 5 min</span></div>
            <div class="list" id="vigia"></div>
          </div>
        </div>
      </section>

      <section class="grid g-main">
        <div class="card">
          <div class="card-h"><h3>${icon('chart', 16)} Visão do mercado</h3><a class="btn btn-sm btn-ghost" href="#/laboratorio">Ver o laboratório</a></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>Ativo</th><th class="r">Preço</th><th class="r">Variação 24h</th><th>Tendência</th><th class="r">Chance agora</th><th>Regra no laboratório</th><th>Tendência 4h</th></tr></thead><tbody id="mkt"></tbody></table></div>
        </div>
        <div class="col">
          <div class="card">
            <div class="card-h"><h3>${icon('news', 16)} Agenda de notícias</h3><span class="sub" id="newsSub"></span></div>
            <div class="list" id="news"></div>
          </div>
          <div class="card">
            <div class="card-h"><h3>${icon('layers', 16)} Atividade</h3><a class="btn btn-sm btn-ghost" href="#/posicoes">Tudo</a></div>
            <div class="list" id="act"></div>
          </div>
        </div>
      </section>`;

    const chart = createCandleChart($('#chart', root), engine, { sym, tf });
    bindSignalActions(root, engine, toast);

    function syncSeg() {
      root.querySelectorAll('#symSeg button').forEach((b) => b.classList.toggle('on', b.dataset.s === sym));
      root.querySelectorAll('#tfSeg button').forEach((b) => b.classList.toggle('on', +b.dataset.tf === tf));
      root.querySelectorAll('.mini[data-sym]').forEach((m) => m.classList.toggle('sel', m.dataset.sym === sym));
      $('#cIc', root).innerHTML = symIcon(sym);
      $('#cName', root).textContent = `${SYMBOLS[sym].name} · ${sym}`;
    }
    root.querySelector('#symSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { sym = b.dataset.s; chart.setSymbol(sym); syncSeg(); prices(); vigia(); } };
    root.querySelector('#tfSeg').onclick = (e) => { const b = e.target.closest('button'); if (b) { tf = +b.dataset.tf; chart.setTf(tf); syncSeg(); } };
    root.querySelectorAll('.mini[data-sym]').forEach((m) => (m.onclick = () => { sym = m.dataset.sym; chart.setSymbol(sym); syncSeg(); prices(); vigia(); }));
    root.querySelectorAll('.mini[data-go]').forEach((m) => (m.onclick = () => go(m.dataset.go)));

    function account() {
      const a = engine.broker.account_info();
      const dayPnl = a.balance - 32000;
      $('#pBal', root).innerHTML = 'US$ ' + fmt.num(a.equity) .replace(/,(\d\d)$/, '<small>,$1</small>');
      $('#pDay', root).innerHTML = `Resultado da sessão: <b>${fmt.usdSigned(dayPnl)}</b> (${fmt.pctSigned(dayPnl / 32000)})`;
      $('#pMeta', root).innerHTML = `<span>Saldo <b>${fmt.usd(a.balance)}</b></span><span>Flutuante <b>${fmt.usdSigned(a.profit)}</b></span><span>Margem livre <b>${fmt.usd(a.margin_free)}</b></span><span>Alavancagem <b>1:${a.leverage}</b></span>`;
    }
    function prices() {
      for (const s of SYMBOL_IDS) {
        const p = engine.priceOf(s), chg = engine.dayChange(s);
        const e1 = root.querySelector(`[data-px="${s}"]`); if (e1) e1.textContent = px(s, p.bid);
        const e2 = root.querySelector(`[data-chg="${s}"]`); if (e2) { e2.textContent = fmt.pctSigned(chg); e2.className = chg >= 0 ? 'pos' : 'neg'; }
      }
      const p = engine.priceOf(sym), chg = engine.dayChange(sym);
      $('#cPx', root).innerHTML = `${px(sym, p.bid)} <span class="pill ${chg >= 0 ? 'green' : 'red'}" style="font-size:.74rem;vertical-align:middle">${fmt.pctSigned(chg)}</span>`;
      const rows = SYMBOL_IDS.map((s) => {
        const pr = engine.priceOf(s), c = engine.dayChange(s), d = engine.live[s], lab = engine.labs[s];
        return `<tr class="${s === sym ? 'hi' : ''}"><td><div style="display:flex;align-items:center;gap:10px">${symIcon(s)}<div><b>${SYMBOLS[s].name}</b><div class="muted" style="font-size:.74rem">${s}</div></div></div></td>
          <td class="num">${px(s, pr.bid)}</td><td class="num ${c >= 0 ? 'pos' : 'neg'}">${fmt.pctSigned(c)}</td>
          <td>${d ? REGIME_PILL[d.regime] : '<span class="muted">aguardando</span>'}</td>
          <td class="num">${d && d.p !== null ? (d.p * 100).toFixed(0) + '%' : '—'}</td>
          <td>${lab.verdict ? '<span class="pill green">aprovada</span>' : '<span class="pill amber">reprovada · só observa</span>'}</td>
          <td style="width:130px">${sparkline(engine.getBars(s, 5).slice(-48).map((b) => b.close), 130, 30)}</td></tr>`;
      }).join('');
      $('#mkt', root).innerHTML = rows;
    }
    function sparks() {
      for (const s of SYMBOL_IDS) {
        const el = root.querySelector(`[data-spark="${s}"]`);
        if (el) el.innerHTML = sparkline(engine.getBars(s, 5).slice(-60).map((b) => b.close));
      }
    }
    function vigia() {
      for (const s of SYMBOL_IDS) {
        const d = engine.live[s];
        const r = root.querySelector(`[data-reg="${s}"]`); if (r) r.innerHTML = d ? REGIME_PILL[d.regime] : '<span class="pill gray">aguardando</span>';
        const c = root.querySelector(`[data-chance="${s}"]`); if (c) c.textContent = d && d.p !== null ? `chance ${(d.p * 100).toFixed(0)}%` : '';
      }
      const d = engine.live[sym];
      $('#cReg', root).innerHTML = d ? REGIME_PILL[d.regime] : '';
      $('#cChance', root).innerHTML = d ? `Última leitura do modelo (${fmt.time(d.time)}): ${d.p !== null ? `chance de <b>${(d.p * 100).toFixed(0)}%</b> · ` : ''}${d.reason}` : 'O modelo lê o mercado a cada candle de 5 minutos fechado.';
      const last = engine.decisions.slice(-7).reverse();
      $('#vigia', root).innerHTML = last.length ? last.map((x) => `<div class="li"><div class="ic">${x.action === 'sinal' ? `<span class="${x.regime === 'alta' ? 'pos' : 'neg'}">${icon('zap', 16)}</span>` : `<span class="muted">${icon('eye', 16)}</span>`}</div><div class="txt"><b>${x.sym} · ${x.action === 'sinal' ? 'mandou sinal' : 'não opera'}</b><small>${x.reason}</small></div><div class="val">${fmt.time(x.time)}<small>${x.p !== null ? (x.p * 100).toFixed(0) + '%' : x.regime}</small></div></div>`).join('') : '<div class="empty">Aguardando o primeiro candle de 5 minutos fechar…</div>';
    }
    function signal() {
      const sig = engine.signals.find((s) => s.status === 'novo') || engine.signals.find((s) => s.status === 'enviando') || engine.signals[0];
      $('#sigSlot', root).innerHTML = signalCardHTML(sig && (sig.status === 'novo' || sig.status === 'enviando' || engine.now() - sig.time < 900) ? sig : null, engine, true);
    }
    function semaforo() {
      const s = engine.semaphore();
      $('#pLights', root).innerHTML = lightsHTML(s.state);
      $('#pSemTxt', root).textContent = s.state === 'verde' ? `Tudo normal · ${s.n} operações ao vivo` : s.reasons[0];
    }
    function lab() {
      const L = engine.labs;
      $('#pVer', root).textContent = L.XAUUSD.version.replace('-xauusd', '');
      $('#pLab', root).innerHTML = SYMBOL_IDS.map((s) => `<span class="pill ${L[s].verdict ? 'green' : 'amber'}">${s} ${L[s].verdict ? 'aprovado' : 'reprovado'}</span>`).join('') + `<span class="pill gray">prova ${(L.XAUUSD.provaAcerto * 100).toFixed(0)}% acerto</span>`;
    }
    function activity() {
      const items = [
        ...engine.broker.positions.map((p) => ({ t: p.time, html: `<div class="li"><div class="ic blue">${icon('layers', 16)}</div><div class="txt"><b>${p.type === 'BUY' ? 'Compra' : 'Venda'} aberta · ${p.symbol}</b><small>${fmt.lots(p.volume)} lote a ${px(p.symbol, p.price_open)}</small></div><div class="val ${engine.broker.profitOf(p) >= 0 ? 'pos' : 'neg'}">${fmt.usdSigned(engine.broker.profitOf(p))}<small>flutuante</small></div></div>` })),
        ...engine.broker.deals.slice(-6).map((d) => ({ t: d.time_close, html: `<div class="li"><div class="ic ${d.profit > 0 ? 'pos' : 'neg'}">${icon(d.profit > 0 ? 'target' : 'x', 16)}</div><div class="txt"><b>${d.reason === 'alvo' ? 'Alvo' : d.reason === 'stop' ? 'Stop' : 'Fechada'} · ${d.symbol}</b><small>${fmt.time(d.time_close)} · ${d.comment}</small></div><div class="val ${d.profit > 0 ? 'pos' : 'neg'}">${fmt.usdSigned(d.profit)}<small>${d.r !== null ? fmt.r(d.r) : ''}</small></div></div>` })),
      ].sort((a, b) => b.t - a.t).slice(0, 6);
      $('#act', root).innerHTML = items.length ? items.map((x) => x.html).join('') : '<div class="empty">Nenhuma operação ainda. Quando um sinal aparecer, aperte "Comprar/Vender no MT5".</div>';
    }
    function news() {
      const list = engine.upcomingNews(4), t = engine.now();
      $('#newsSub', root).textContent = engine.settings.newsFilter ? `sem sinais ${engine.settings.newsWindow} min antes e depois` : 'filtro desligado';
      $('#news', root).innerHTML = list.map((n) => { const active = Math.abs(n.time - t) <= engine.settings.newsWindow * 60; return `<div class="li"><div class="ic ${active ? 'amber' : ''}">${icon('news', 16)}</div><div class="txt"><b>${n.name}</b><small>${n.syms.join(' · ')} · impacto ${n.impact}</small></div><div class="val">${fmt.time(n.time)}<small>${active ? '<span class="amber">agora</span>' : 'em ' + Math.max(0, Math.round((n.time - t) / 60)) + ' min'}</small></div></div>`; }).join('');
    }

    syncSeg(); account(); prices(); sparks(); vigia(); signal(); semaforo(); lab(); activity(); news();
    let tickN = 0;
    const offs = [
      engine.bus.on('tick', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => { raf = 0; account(); prices(); if (++tickN % 6 === 0) { activity(); signal(); } });
      }),
      engine.bus.on('candle', () => { sparks(); news(); }),
      engine.bus.on('decision', vigia),
      engine.bus.on('signal', signal),
      engine.bus.on('signalUpdate', signal),
      engine.bus.on('closed', () => { semaforo(); activity(); account(); }),
      engine.bus.on('positions', activity),
      engine.bus.on('lab', lab),
      engine.bus.on('settings', news),
    ];
    return () => { offs.forEach((o) => o()); chart.destroy(); cancelAnimationFrame(raf); };
  },
};
