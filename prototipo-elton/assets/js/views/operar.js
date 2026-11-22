// Operar: o gráfico no centro. Em cima, o dinheiro (saldo, operação aberta com a régua do stop ao alvo,
// resultado de hoje) e o vigia. Do lado, o sinal e a ordem manual. Embaixo, a conversa com o MT5 recolhida.
import { SYMBOLS, SYMBOL_IDS } from '../market.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $, px, REGIME_PILL, symIcon, createCandleChart, signalCardHTML, bindSignalActions } from '../ui.js';

const TFS = [[1, 'M1'], [2, 'M2'], [5, 'M5'], [15, 'M15'], [60, 'H1']];
const SEM = { verde: ['green', 'Semáforo verde'], amarelo: ['amber', 'Semáforo amarelo'], vermelho: ['red', 'Semáforo vermelho'] };

export default {
  title: 'Operar',
  render(root, { engine, toast, params, go }) {
    let sym = SYMBOLS[params.sym] ? params.sym : 'XAUUSD', tf = 5, raf = 0, lastBal = null;
    root.innerHTML = `
      <div class="op">
        <section class="op-strip" aria-label="Sua conta">
          <div class="tile" id="kBal"></div>
          <div class="tile tile-pos" id="kPos"></div>
          <div class="tile" id="kDay"></div>
          <div class="tile" id="kVig"></div>
        </section>
        <div id="oAttn"></div>
        <section class="op-main">
          <div class="card op-chart">
            <div class="op-chart-h">
              <div class="op-sym"><span id="oIc"></span><div><span class="op-name" id="oName"></span><div class="op-px"><b class="num" id="oPx"></b><span id="oReg"></span></div></div></div>
              <div class="op-ctrl"><div class="seg" id="oSym">${SYMBOL_IDS.map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div><div class="seg" id="oTf">${TFS.map(([v, l]) => `<button data-tf="${v}">${l}</button>`).join('')}</div></div>
            </div>
            <div class="chart-box op-chart-box" id="oChart"></div>
          </div>
          <aside class="op-rail">
            <div id="oSig"></div>
            <div class="card op-order">
              <div class="op-order-h"><b>Ordem manual</b><span class="muted" id="tSum"></span></div>
              <div class="op-bs">
                <button class="btn btn-sell" id="tSell"><span>Vender</span><span class="num" id="tBid"></span></button>
                <button class="btn btn-buy" id="tBuy"><span>Comprar</span><span class="num" id="tAsk"></span></button>
              </div>
              <details class="op-adj">
                <summary>Ajustar volume, stop e alvo</summary>
                <div class="fields">
                  <div class="field"><label for="tVol">Volume (lotes)</label><input class="input" id="tVol" inputmode="decimal" value="0,10"></div>
                  <div class="field"><label for="tRisk">Arriscar (% da conta)</label><input class="input" id="tRisk" inputmode="decimal" value="0,5"></div>
                  <div class="field"><label for="tSl">Stop Loss</label><input class="input" id="tSl" inputmode="decimal"></div>
                  <div class="field"><label for="tTp">Take Profit</label><input class="input" id="tTp" inputmode="decimal"></div>
                </div>
                <button class="btn btn-ghost btn-sm" id="tCalc">${icon('target', 14)} Calcular o volume pelo risco</button>
                <div class="muted op-info" id="tInfo"></div>
              </details>
            </div>
          </aside>
        </section>
        <details class="card op-log">
          <summary>${icon('plug', 15)}<b>Conversa com o MT5</b><span class="muted" id="oLogLast"></span></summary>
          <div class="log" id="oLog"></div>
        </details>
      </div>`;

    const chart = createCandleChart($('#oChart', root), engine, { sym, tf });
    bindSignalActions(root, engine, toast);
    const parse = (v) => parseFloat(String(v).replace(/\./g, '').replace(',', '.'));

    // ---------- Faixa de cima ----------
    function tileHTML(label, value, sub, cls = '', extra = '') {
      return `<span class="tile-l">${label}</span><b class="tile-v num ${cls}">${value}</b>${extra}<span class="tile-s">${sub}</span>`;
    }
    function balance() {
      const a = engine.broker.account_info();
      const el = $('#kBal', root);
      el.innerHTML = tileHTML(`${icon('wallet', 13)} Saldo`, fmt.usd(a.balance), 'conta demo · começou com US$ 32.000');
      if (lastBal !== null && Math.abs(a.balance - lastBal) > 0.005) {
        el.classList.remove('flash-up', 'flash-down');
        void el.offsetWidth;
        el.classList.add(a.balance > lastBal ? 'flash-up' : 'flash-down');
      }
      lastBal = a.balance;
    }
    function position() {
      const el = $('#kPos', root);
      const p = engine.broker.positions.find((x) => x.symbol === sym) || engine.broker.positions[0];
      if (!p) {
        el.classList.remove('up', 'down');
        el.innerHTML = tileHTML(`${icon('layers', 13)} Operação aberta`, 'Nenhuma', 'o resultado aparece aqui ao vivo', 'muted-v');
        return;
      }
      const pr = engine.priceOf(p.symbol), buy = p.type === 'BUY';
      const now = buy ? pr.bid : pr.ask, vpp = SYMBOLS[p.symbol].valuePerPoint;
      const profit = (now - p.price_open) * (buy ? 1 : -1) * vpp * p.volume;
      const r = p.riskUsd ? profit / p.riskUsd : null;
      const span = p.sl && p.tp ? (buy ? p.tp - p.sl : p.sl - p.tp) : 0;
      const at = (x) => Math.min(100, Math.max(0, ((buy ? x - p.sl : p.sl - x) / span) * 100));
      const Rt = p.R ? fmt.num(p.R, 0) : '?';
      el.classList.toggle('up', profit >= 0);
      el.classList.toggle('down', profit < 0);
      const ruler = span > 0 ? `<div class="ruler" title="Onde o preço está entre o stop e o alvo">
          <div class="ruler-track"><i class="ruler-fill" style="left:${Math.min(at(now), at(p.price_open))}%;width:${Math.abs(at(now) - at(p.price_open))}%"></i><u style="left:${at(p.price_open)}%"></u><s style="left:${at(now)}%"></s></div>
          <div class="ruler-l"><span class="neg">stop −1R</span><span>entrada</span><span class="pos">alvo +${Rt}R</span></div></div>` : '';
      el.innerHTML = tileHTML(`${icon('layers', 13)} ${buy ? 'Compra' : 'Venda'} ${fmt.lots(p.volume)} lote · ${p.symbol}`, fmt.usdSigned(profit), `${r !== null ? `<b class="num ${profit >= 0 ? 'pos' : 'neg'}">${r >= 0 ? '+' : ''}${fmt.num(r, 2)}R</b> · ` : ''}entrou a ${px(p.symbol, p.price_open)} <button class="link-btn" data-close="${p.ticket}">Fechar</button>`, profit >= 0 ? 'pos' : 'neg', ruler);
    }
    function today() {
      const day = Math.floor(engine.now() / 86400);
      const d = engine.broker.deals.filter((x) => Math.floor((x.time_close || x.time) / 86400) === day);
      const net = d.reduce((s, x) => s + x.profit, 0);
      const w = d.filter((x) => x.profit > 0).length;
      $('#kDay', root).innerHTML = tileHTML(`${icon('chart', 13)} Hoje`, d.length ? fmt.usdSigned(net) : fmt.usd(0), d.length ? `${d.length} ${d.length > 1 ? 'operações' : 'operação'} · ${w} no alvo · ${d.length - w} no stop` : 'nenhuma operação fechada hoje', d.length ? (net >= 0 ? 'pos' : 'neg') : 'muted-v');
    }
    function vigia() {
      const t = engine.now(), left = 300 - (Math.floor(t) % 300);
      const m = engine.semaphore(), [col, txt] = SEM[m.state];
      $('#kVig', root).innerHTML = tileHTML(`${icon('eye', 13)} Vigia do modelo <span class="sem-dot ${col}" title="${txt}"></span>`, `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, `próxima leitura do M5 · sinais hoje ${engine.signalsToday(t)} de ${engine.settings.maxPerDay}`);
    }
    function attention() {
      const m = engine.semaphore();
      $('#oAttn', root).innerHTML = m.state === 'verde' ? '' : `<div class="op-attn ${m.state}">${icon('alert', 16)}<div><b>${m.state === 'vermelho' ? 'Sinais pausados: o modelo precisa ser estudado de novo' : 'O modelo precisa de atenção'}</b><span>${m.reasons[0] || ''}</span></div><a class="btn btn-sm btn-ghost" href="#/risco">Ver o semáforo</a></div>`;
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-close]');
      if (!b) return;
      const d = engine.broker.close(+b.dataset.close, 'manual', engine.now());
      if (d) toast(`Posição fechada · ${fmt.usdSigned(d.profit)}`, d.profit >= 0 ? 'ok' : 'err');
    });

    // ---------- Gráfico ----------
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
    root.querySelector('#oSym').onclick = (e) => { const b = e.target.closest('button'); if (b) { sym = b.dataset.s; chart.setSymbol(sym); seg(); sig(); live(); position(); } };
    root.querySelector('#oTf').onclick = (e) => { const b = e.target.closest('button'); if (b) { tf = +b.dataset.tf; chart.setTf(tf); seg(); } };

    // ---------- Ordem manual ----------
    function info() {
      const p = engine.priceOf(sym), vol = parse($('#tVol', root).value), sl = parse($('#tSl', root).value), tp = parse($('#tTp', root).value);
      const vpp = SYMBOLS[sym].valuePerPoint;
      const buy = sl < p.ask;
      const entry = buy ? p.ask : p.bid;
      const risk = Math.abs(entry - sl) * vpp * vol, gain = Math.abs(tp - entry) * vpp * vol, R = gain / risk;
      $('#tSum', root).textContent = `${fmt.num(vol || 0, 2)} lote · stop ${fmt.num(sl, SYMBOLS[sym].digits)} · alvo ${fmt.num(tp, SYMBOLS[sym].digits)}`;
      $('#tInfo', root).innerHTML = isFinite(R) && vol > 0 ? `Se for <b>${buy ? 'compra' : 'venda'}</b>: arrisca <b>${fmt.usd(risk)}</b> (1R) para ganhar <b class="pos">${fmt.usd(gain)}</b> · alvo de <b>${fmt.num(R, 2)}R</b> · acerto mínimo <b>${fmt.pct(1 / (1 + R), 0)}</b>` : 'Preencha volume, stop e alvo.';
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

    // ---------- Sinal e conversa com o MT5 ----------
    function live() {
      const p = engine.priceOf(sym), d = engine.live[sym];
      $('#oPx', root).textContent = px(sym, p.bid);
      $('#oReg', root).innerHTML = d ? REGIME_PILL[d.regime] : '';
      $('#tBid', root).textContent = px(sym, p.bid);
      $('#tAsk', root).textContent = px(sym, p.ask);
    }
    function sig() {
      const open = engine.signals.find((x) => x.sym === sym && (x.status === 'novo' || x.status === 'enviando'));
      if (open) { $('#oSig', root).innerHTML = signalCardHTML(open, engine, false); return; }
      const last = engine.signals.find((x) => x.sym === sym);
      const note = !last ? '' : `<span class="rail-last">Último sinal ${last.id}: ${last.status === 'executado' ? `<b class="pos">executado</b> · ticket ${last.result?.order || ''}` : last.status === 'recusado' ? 'recusado pela corretora' : last.status === 'expirado' ? 'expirou sem execução' : 'ignorado'}</span>`;
      $('#oSig', root).innerHTML = `<div class="card rail-idle"><div class="rail-idle-h"><span class="pulse"></span><b>Nenhum sinal agora</b></div><span class="muted">O modelo avisa aqui quando a chance de bater o alvo passa de ${fmt.pct(engine.settings.limiar, 0)}.</span>${note}</div>`;
    }
    function log() {
      const L = engine.broker.log;
      const cls = (e) => (e.kind === 'ok' ? 'pos' : e.kind === 'err' ? 'neg' : 'blue');
      $('#oLog', root).innerHTML = L.slice(-14).reverse().map((e) => `<div><span class="muted">${new Date(e.t).toLocaleTimeString('pt-BR')}</span><span class="${cls(e)}">${e.text}</span></div>`).join('') || '<div class="muted">Nenhuma ordem enviada ainda.</div>';
      const last = L[L.length - 1];
      $('#oLogLast', root).innerHTML = last ? `<span class="${cls(last)}">${last.text.length > 90 ? last.text.slice(0, 90) + '…' : last.text}</span>` : 'nenhuma ordem enviada ainda';
    }

    function money() { balance(); position(); today(); vigia(); attention(); }
    seg(); live(); sig(); log(); money();
    let n = 0;
    const offs = [
      engine.bus.on('tick', (t) => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; live(); position(); vigia(); if (++n % 6 === 0) sig(); }); }),
      engine.bus.on('signal', sig), engine.bus.on('signalUpdate', sig), engine.bus.on('decision', live), engine.bus.on('mt5log', log),
      engine.bus.on('positions', money), engine.bus.on('closed', money), engine.bus.on('attention', money), engine.bus.on('lab', money),
    ];
    return () => { offs.forEach((o) => o()); chart.destroy(); cancelAnimationFrame(raf); };
  },
};
