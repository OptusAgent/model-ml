// Posições abertas (lucro ao vivo), histórico de operações e o relatório no formato do MT5.
import { SYMBOLS } from '../market.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $, px } from '../ui.js';

function equitySVG(points) {
  if (points.length < 2) return '<div class="empty">A curva da conta aparece depois da primeira operação fechada.</div>';
  const W = 640, H = 180, X0 = 60, X1 = 630, Y0 = 14, Y1 = 160;
  const vals = points.map((p) => p.balance), lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const X = (i) => X0 + (i / (points.length - 1)) * (X1 - X0), Y = (v) => Y1 - ((v - lo) / span) * (Y1 - Y0);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(p.balance).toFixed(1)}`).join(' ');
  const up = vals[vals.length - 1] >= vals[0], col = up ? 'var(--green)' : 'var(--red)';
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Curva da conta">
    <line x1="${X0}" x2="${X1}" y1="${Y(hi)}" y2="${Y(hi)}" stroke="rgba(148,170,210,.12)"/><line x1="${X0}" x2="${X1}" y1="${Y(lo)}" y2="${Y(lo)}" stroke="rgba(148,170,210,.12)"/>
    <text x="${X0 - 6}" y="${Y(hi) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt.int(hi)}</text><text x="${X0 - 6}" y="${Y(lo) + 4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt.int(lo)}</text>
    <path d="${d} L${X1} ${Y1} L${X0} ${Y1} Z" fill="${col}" opacity=".1"/><path d="${d}" fill="none" stroke="${col}" stroke-width="2"/>
    <circle cx="${X(points.length - 1)}" cy="${Y(vals[vals.length - 1])}" r="4" fill="${col}"/></svg>`;
}

export default {
  title: 'Posições e histórico',
  render(root, { engine, toast }) {
    let raf = 0;
    root.innerHTML = `
      <div class="page-head"><div><h1>Posições e histórico</h1><p>As posições abertas mostram o lucro ao vivo. A corretora fecha sozinha no stop ou no alvo. O relatório usa os mesmos nomes do relatório do MT5.</p></div></div>
      <section class="card"><div class="card-h"><h3>${icon('layers', 16)} Posições abertas</h3><span class="sub" id="posSub"></span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Ticket</th><th>Ativo</th><th>Tipo</th><th class="r">Volume</th><th class="r">Preço</th><th class="r">Stop</th><th class="r">Alvo</th><th class="r">Atual</th><th class="r">Lucro</th><th class="r">Em R</th><th></th></tr></thead><tbody id="pos"></tbody></table></div></section>
      <section class="grid g-2">
        <div class="card"><div class="card-h"><h3>${icon('chart', 16)} Relatório (como no MT5)</h3><span class="sub">todas as operações fechadas</span></div><div class="table-wrap"><table class="t" id="rep"></table></div></div>
        <div class="card"><div class="card-h"><h3>${icon('wallet', 16)} Curva da conta</h3></div><div id="eq"></div></div>
      </section>
      <section class="card"><div class="card-h"><h3>${icon('clock', 16)} Histórico</h3></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Fechou</th><th>Ticket</th><th>Ativo</th><th>Tipo</th><th class="r">Volume</th><th class="r">Abertura</th><th class="r">Fechamento</th><th>Motivo</th><th class="r">Lucro</th><th class="r">Em R</th><th>Origem</th></tr></thead><tbody id="hist"></tbody></table></div></section>`;

    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-close]');
      if (!b) return;
      const d = engine.broker.close(+b.dataset.close, 'manual', engine.now());
      if (d) toast(`Posição ${d.ticket} fechada · ${fmt.usdSigned(d.profit)}`, d.profit > 0 ? 'ok' : 'err');
    });

    function positions() {
      const ps = engine.broker.positions;
      $('#posSub', root).textContent = ps.length ? `${ps.length} aberta(s) · flutuante ${fmt.usdSigned(engine.broker.floating())}` : 'nenhuma aberta';
      $('#pos', root).innerHTML = ps.length ? ps.map((p) => {
        const pr = engine.priceOf(p.symbol), cur = p.type === 'BUY' ? pr.bid : pr.ask, pf = engine.broker.profitOf(p);
        return `<tr><td class="num">${p.ticket}</td><td><b>${p.symbol}</b></td><td><span class="pill ${p.type === 'BUY' ? 'green' : 'red'}">${p.type === 'BUY' ? 'buy' : 'sell'}</span></td><td class="num">${fmt.lots(p.volume)}</td><td class="num">${px(p.symbol, p.price_open)}</td><td class="num neg">${p.sl ? px(p.symbol, p.sl) : '—'}</td><td class="num pos">${p.tp ? px(p.symbol, p.tp) : '—'}</td><td class="num">${px(p.symbol, cur)}</td><td class="num ${pf >= 0 ? 'pos' : 'neg'}">${fmt.signed(pf)}</td><td class="num">${p.riskUsd ? fmt.r(pf / p.riskUsd) : '—'}</td><td><button class="btn btn-sm btn-ghost" data-close="${p.ticket}">Fechar</button></td></tr>`;
      }).join('') : '<tr><td colspan="11"><div class="empty">Nenhuma posição aberta.</div></td></tr>';
    }
    function rest() {
      const r = engine.report();
      $('#rep', root).innerHTML = `<tbody>
        <tr><td>Total Trades</td><td class="num">${r.total}</td><td class="muted">operações fechadas</td></tr>
        <tr><td>Profit Trades (% of total)</td><td class="num">${r.wins} (${fmt.pct(r.acerto)})</td><td class="muted">taxa de acerto</td></tr>
        <tr><td>Loss Trades</td><td class="num">${r.losses}</td><td></td></tr>
        <tr><td>Gross Profit</td><td class="num pos">${fmt.num(r.gp)}</td><td></td></tr>
        <tr><td>Gross Loss</td><td class="num neg">−${fmt.num(r.gl)}</td><td></td></tr>
        <tr><td>Total Net Profit</td><td class="num ${r.net >= 0 ? 'pos' : 'neg'}">${fmt.signed(r.net)}</td><td></td></tr>
        <tr><td>Profit Factor</td><td class="num">${isFinite(r.pf) ? fmt.num(r.pf) : '—'}</td><td class="muted">ganhos ÷ perdas</td></tr>
        <tr class="hi"><td>Expected Payoff</td><td class="num">${fmt.signed(r.payoff)}</td><td class="muted">expectativa = ${fmt.r(r.expR)} por operação</td></tr></tbody>`;
      $('#eq', root).innerHTML = equitySVG(engine.equity);
      const ds = [...engine.broker.deals].reverse().slice(0, 60);
      $('#hist', root).innerHTML = ds.length ? ds.map((d) => `<tr><td class="num">${fmt.dateTime(d.time_close)}</td><td class="num">${d.ticket}</td><td><b>${d.symbol}</b></td><td><span class="pill ${d.type === 'BUY' ? 'green' : 'red'}">${d.type === 'BUY' ? 'buy' : 'sell'}</span></td><td class="num">${fmt.lots(d.volume)}</td><td class="num">${px(d.symbol, d.price_open)}</td><td class="num">${px(d.symbol, d.price_close)}</td><td>${d.reason === 'alvo' ? '<span class="pill green">alvo</span>' : d.reason === 'stop' ? '<span class="pill red">stop</span>' : '<span class="pill gray">manual</span>'}</td><td class="num ${d.profit > 0 ? 'pos' : 'neg'}">${fmt.signed(d.profit)}</td><td class="num">${d.r !== null ? fmt.r(d.r) : '—'}</td><td class="muted">${d.comment}</td></tr>`).join('') : '<tr><td colspan="11"><div class="empty">Nenhuma operação fechada ainda.</div></td></tr>';
    }
    positions(); rest();
    const offs = [
      engine.bus.on('tick', () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; positions(); }); }),
      engine.bus.on('closed', () => { positions(); rest(); }),
      engine.bus.on('positions', positions),
    ];
    return () => { offs.forEach((o) => o()); cancelAnimationFrame(raf); };
  },
};
