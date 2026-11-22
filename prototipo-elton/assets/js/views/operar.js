// Operar: gráfico grande, o sinal com a explicação do modelo e uma boleta igual à do MT5.
import { SYMBOLS, SYMBOL_IDS } from '../market.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $, px, REGIME_PILL, symIcon, createCandleChart, signalCardHTML, bindSignalActions } from '../ui.js';

const TFS = [[1, 'M1'], [2, 'M2'], [5, 'M5'], [15, 'M15'], [60, 'H1']];

export default {
  title: 'Operar',
  render(root, { engine, toast, params }) {
    let sym = SYMBOLS[params.sym] ? params.sym : 'XAUUSD', tf = 5, raf = 0;
    root.innerHTML = `
      <div class="page-head"><div><h1>Operar</h1><p>O sinal chega pronto: lado, entrada, stop, alvo e cotas. Você confere e aperta o botão. A boleta serve para operar à mão, como no MT5.</p></div></div>
      <section class="grid g-main">
        <div class="card">
          <div class="card-h">
            <div style="display:flex;align-items:center;gap:12px"><span id="oIc"></span><div><b id="oName"></b> <span id="oReg"></span><div class="chart-big-price" id="oPx"></div></div></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg" id="oSym">${SYMBOL_IDS.map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div><div class="seg" id="oTf">${TFS.map(([v, l]) => `<button data-tf="${v}">${l}</button>`).join('')}</div></div>
          </div>
          <div class="chart-box tall" id="oChart"></div>
        </div>
        <div class="col">
          <div id="oSig"></div>
          <div class="card" id="ticket">
            <div class="card-h"><h3>${icon('candles', 16)} Boleta · ordem a mercado</h3><span class="pill gray">igual ao MT5</span></div>
            <div class="fields">
              <div class="field"><label for="tVol">Volume (lotes)</label><input class="input" id="tVol" inputmode="decimal" value="0,10"></div>
              <div class="field"><label for="tRisk">Arriscar (% da conta)</label><input class="input" id="tRisk" inputmode="decimal" value="0,5"></div>
              <div class="field"><label for="tSl">Stop Loss</label><input class="input" id="tSl" inputmode="decimal"></div>
              <div class="field"><label for="tTp">Take Profit</label><input class="input" id="tTp" inputmode="decimal"></div>
            </div>
            <button class="btn btn-ghost btn-sm" id="tCalc">${icon('target', 14)} Calcular o volume pelo risco</button>
            <div class="calc muted" style="font-size:.8rem" id="tInfo"></div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <button class="btn btn-sell" id="tSell">Vender<br><span class="num" id="tBid"></span></button>
              <button class="btn btn-buy" id="tBuy">Comprar<br><span class="num" id="tAsk"></span></button>
            </div>
          </div>
        </div>
      </section>
      <section class="card">
        <div class="card-h"><h3>${icon('plug', 16)} Conversa com o MT5</h3><span class="sub">o que o app envia e o que a corretora responde</span></div>
        <div class="log" id="oLog"></div>
      </section>`;

    const chart = createCandleChart($('#oChart', root), engine, { sym, tf });
    bindSignalActions(root, engine, toast);
    const parse = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.'));

    function seg() {
      root.querySelectorAll('#oSym button').forEach((b) => b.classList.toggle('on', b.dataset.s === sym));
      root.querySelectorAll('#oTf button').forEach((b) => b.classList.toggle('on', +b.dataset.tf === tf));
      $('#oIc', root).innerHTML = symIcon(sym);
      $('#oName', root).textContent = `${SYMBOLS[sym].name} · ${sym}`;
      const p = engine.priceOf(sym), atr = engine.live[sym]?.atr || SYMBOLS[sym].vol * 3.6;
      $('#tSl', root).value = fmt.num(p.ask - atr, SYMBOLS[sym].digits);
      $('#tTp', root).value = fmt.num(p.ask + engine.settings.R * atr, SYMBOLS[sym].digits);
      info();
    }
    root.querySelector('#oSym').onclick = (e) => { const b = e.target.closest('button'); if (b) { sym = b.dataset.s; chart.setSymbol(sym); seg(); sig(); live(); } };
    root.querySelector('#oTf').onclick = (e) => { const b = e.target.closest('button'); if (b) { tf = +b.dataset.tf; chart.setTf(tf); seg(); } };

    function info() {
      const p = engine.priceOf(sym), vol = parse($('#tVol', root).value), sl = parse($('#tSl', root).value), tp = parse($('#tTp', root).value);
      const vpp = SYMBOLS[sym].valuePerPoint;
      const buy = sl < p.ask;
      const entry = buy ? p.ask : p.bid;
      const risk = Math.abs(entry - sl) * vpp * vol, gain = Math.abs(tp - entry) * vpp * vol, R = gain / risk;
      $('#tInfo', root).innerHTML = isFinite(R) && vol > 0 ? `Se for <b>${buy ? 'compra' : 'venda'}</b>: arrisca <b>${fmt.usd(risk)}</b> (1R) para ganhar <b class="pos">${fmt.usd(gain)}</b> · alvo de <b>${fmt.num(R, 2)}R</b> · acerto mínimo <b>${fmt.pct(1 / (1 + R), 0)}</b> · ${SYMBOLS[sym].contractText}` : 'Preencha volume, stop e alvo.';
    }
    ['tVol', 'tSl', 'tTp', 'tRisk'].forEach((id) => $('#' + id, root).addEventListener('input', info));
    $('#tCalc', root).onclick = () => {
      const p = engine.priceOf(sym), sl = parse($('#tSl', root).value), riskPct = parse($('#tRisk', root).value);
      const entry = sl < p.ask ? p.ask : p.bid;
      const riskUsd = engine.broker.account.balance * riskPct / 100;
      const vol = Math.max(0.01, Math.floor(riskUsd / (Math.abs(entry - sl) * SYMBOLS[sym].valuePerPoint) * 100) / 100);
      $('#tVol', root).value = fmt.num(vol, 2);
      info();
      toast(`${fmt.usd(riskUsd)} ÷ (${fmt.num(Math.abs(entry - sl), SYMBOLS[sym].digits)} × ${SYMBOLS[sym].valuePerPoint}) = ${fmt.num(vol, 2)} lote`);
    };
    async function send(type) {
      const res = await engine.placeOrder({ symbol: sym, type, volume: parse($('#tVol', root).value), sl: parse($('#tSl', root).value), tp: parse($('#tTp', root).value) });
      toast(res.retcode === 10009 ? `Ordem executada · ticket ${res.order} · ${res.latency} ms` : `MT5 recusou: ${res.comment}`, res.retcode === 10009 ? 'ok' : 'err');
    }
    $('#tBuy', root).onclick = () => send('BUY');
    $('#tSell', root).onclick = () => send('SELL');

    function live() {
      const p = engine.priceOf(sym), d = engine.live[sym];
      $('#oPx', root).textContent = px(sym, p.bid);
      $('#oReg', root).innerHTML = d ? REGIME_PILL[d.regime] : '';
      $('#tBid', root).textContent = px(sym, p.bid);
      $('#tAsk', root).textContent = px(sym, p.ask);
    }
    function sig() {
      const s = engine.signals.find((x) => x.sym === sym && (x.status === 'novo' || x.status === 'enviando')) || engine.signals.find((x) => x.sym === sym);
      $('#oSig', root).innerHTML = signalCardHTML(s, engine, false);
    }
    function log() {
      $('#oLog', root).innerHTML = engine.broker.log.slice(-14).reverse().map((e) => `<div><span class="muted">${new Date(e.t).toLocaleTimeString('pt-BR')}</span><span class="${e.kind === 'ok' ? 'pos' : e.kind === 'err' ? 'neg' : 'blue'}">${e.text}</span></div>`).join('') || '<div class="muted">Nenhuma ordem enviada ainda.</div>';
    }
    seg(); live(); sig(); log();
    let n = 0;
    const offs = [
      engine.bus.on('tick', (t) => { if (t.sym !== sym || raf) return; raf = requestAnimationFrame(() => { raf = 0; live(); if (++n % 6 === 0) sig(); }); }),
      engine.bus.on('signal', sig), engine.bus.on('signalUpdate', sig), engine.bus.on('decision', live), engine.bus.on('mt5log', log),
    ];
    return () => { offs.forEach((o) => o()); chart.destroy(); cancelAnimationFrame(raf); };
  },
};
