// Corretora simulada com a mesma "cara" da API Python do MetaTrader 5.
// No app real, cada método aqui vira uma chamada da biblioteca MetaTrader5:
//   account_info() -> mt5.account_info()
//   symbol_info_tick(s) -> mt5.symbol_info_tick(s)
//   order_send(req) -> mt5.order_send(req)
//   positions_get() -> mt5.positions_get()
//   history_deals_get() -> mt5.history_deals_get(...)
import { SYMBOLS } from './market.js';

export const RETCODE = { DONE: 10009, INVALID_VOLUME: 10014, INVALID_STOPS: 10016, NO_MONEY: 10019, MARKET_CLOSED: 10018 };
export const RETCODE_TEXT = {
  10009: 'TRADE_RETCODE_DONE · ordem executada',
  10014: 'TRADE_RETCODE_INVALID_VOLUME · volume inválido',
  10016: 'TRADE_RETCODE_INVALID_STOPS · stop ou alvo do lado errado',
  10019: 'TRADE_RETCODE_NO_MONEY · margem insuficiente',
  10018: 'TRADE_RETCODE_MARKET_CLOSED · mercado fechado',
};

export class MockMT5 {
  constructor(bus, startBalance = 32000) {
    this.bus = bus;
    this.account = {
      login: 5823190, server: 'HantecMarkets-Demo', name: 'Elton Silva', currency: 'USD',
      leverage: 100, trade_mode: 'DEMO', balance: startBalance, company: 'Hantec Markets (simulado)',
    };
    this.peak = startBalance;
    this.positions = [];
    this.deals = [];
    this.nextTicket = 7341200;
    this.prices = {};
    this.connected = true;
    this.log = [];
  }

  _log(kind, text) {
    const e = { t: Date.now(), kind, text };
    this.log.push(e);
    if (this.log.length > 300) this.log.shift();
    this.bus.emit('mt5log', e);
  }

  symbol_info_tick(sym) { return this.prices[sym]; }

  floating() {
    return this.positions.reduce((s, p) => s + this.profitOf(p), 0);
  }
  profitOf(p) {
    const t = this.prices[p.symbol];
    if (!t) return 0;
    const exit = p.type === 'BUY' ? t.bid : t.ask;
    return (exit - p.price_open) * (p.type === 'BUY' ? 1 : -1) * SYMBOLS[p.symbol].valuePerPoint * p.volume;
  }
  margin() {
    return this.positions.reduce((s, p) => s + (p.price_open * SYMBOLS[p.symbol].valuePerPoint * p.volume) / this.account.leverage, 0);
  }
  account_info() {
    const eq = this.account.balance + this.floating();
    const m = this.margin();
    return { ...this.account, equity: eq, profit: this.floating(), margin: m, margin_free: eq - m, margin_level: m ? (eq / m) * 100 : 0 };
  }

  order_check(req) {
    const t = this.prices[req.symbol];
    if (!t) return { retcode: RETCODE.MARKET_CLOSED };
    if (!(req.volume >= 0.01) || Math.abs(req.volume * 100 - Math.round(req.volume * 100)) > 1e-6) return { retcode: RETCODE.INVALID_VOLUME };
    const price = req.type === 'BUY' ? t.ask : t.bid;
    if (req.sl && (req.type === 'BUY' ? req.sl >= price : req.sl <= price)) return { retcode: RETCODE.INVALID_STOPS };
    if (req.tp && (req.type === 'BUY' ? req.tp <= price : req.tp >= price)) return { retcode: RETCODE.INVALID_STOPS };
    const need = (price * SYMBOLS[req.symbol].valuePerPoint * req.volume) / this.account.leverage;
    if (need > this.account_info().margin_free) return { retcode: RETCODE.NO_MONEY };
    return { retcode: 0, price, margin: need };
  }

  // Envia a ordem. Devolve uma Promise porque, no real, há atraso de rede até a corretora.
  order_send(req) {
    this._log('req', `order_send(${JSON.stringify({ action: 'TRADE_ACTION_DEAL', symbol: req.symbol, volume: req.volume, type: 'ORDER_TYPE_' + req.type, sl: req.sl, tp: req.tp, comment: req.comment || '' })})`);
    const latency = 80 + Math.round(Math.random() * 220);
    return new Promise((resolve) => {
      setTimeout(() => {
        const chk = this.order_check(req);
        if (chk.retcode) {
          const res = { retcode: chk.retcode, comment: RETCODE_TEXT[chk.retcode], latency };
          this._log('err', `retcode ${chk.retcode} · ${RETCODE_TEXT[chk.retcode]}`);
          resolve(res);
          return;
        }
        const pos = {
          ticket: this.nextTicket++, symbol: req.symbol, type: req.type, volume: req.volume,
          price_open: chk.price, sl: req.sl, tp: req.tp, time: req.time, comment: req.comment || '',
          signalId: req.signalId || null, riskUsd: req.riskUsd || 0, R: req.R || null,
        };
        this.positions.push(pos);
        const res = { retcode: RETCODE.DONE, order: pos.ticket, price: pos.price_open, volume: pos.volume, comment: RETCODE_TEXT[10009], latency };
        this._log('ok', `retcode 10009 · ticket ${pos.ticket} · ${pos.type} ${pos.volume} ${pos.symbol} a ${pos.price_open.toFixed(SYMBOLS[pos.symbol].digits)} · ${latency} ms`);
        this.bus.emit('positions', this.positions);
        this.bus.emit('opened', { pos, res });
        resolve(res);
      }, latency);
    });
  }

  close(ticket, reason = 'manual', time) {
    const i = this.positions.findIndex((p) => p.ticket === ticket);
    if (i < 0) return null;
    const p = this.positions[i];
    const t = this.prices[p.symbol];
    let exit = p.type === 'BUY' ? t.bid : t.ask;
    if (reason === 'stop') exit = p.sl;
    if (reason === 'alvo') exit = p.tp;
    const profit = (exit - p.price_open) * (p.type === 'BUY' ? 1 : -1) * SYMBOLS[p.symbol].valuePerPoint * p.volume;
    this.positions.splice(i, 1);
    this.account.balance += profit;
    this.peak = Math.max(this.peak, this.account.balance);
    const deal = { ...p, price_close: exit, profit, reason, time_close: time, r: p.riskUsd ? profit / p.riskUsd : null };
    this.deals.push(deal);
    this._log(reason === 'manual' ? 'req' : 'ok', `${reason === 'manual' ? 'Fechamento manual' : reason === 'stop' ? 'Stop Loss atingido' : 'Take Profit atingido'} · ticket ${p.ticket} · ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} USD`);
    this.bus.emit('positions', this.positions);
    this.bus.emit('closed', deal);
    return deal;
  }

  // Chamado a cada tick: a corretora vigia stop e alvo sozinha.
  onTick(sym, bid, ask, time) {
    this.prices[sym] = { bid, ask, time };
    for (const p of [...this.positions]) {
      if (p.symbol !== sym) continue;
      if (p.type === 'BUY') {
        if (p.sl && bid <= p.sl) this.close(p.ticket, 'stop', time);
        else if (p.tp && bid >= p.tp) this.close(p.ticket, 'alvo', time);
      } else {
        if (p.sl && ask >= p.sl) this.close(p.ticket, 'stop', time);
        else if (p.tp && ask <= p.tp) this.close(p.ticket, 'alvo', time);
      }
    }
  }
}
