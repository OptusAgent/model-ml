// Notebook do modelo: o código Python que roda no servidor (VPS Windows com o MT5),
// célula por célula, com as saídas calculadas pelo motor do protótipo.
import { SYMBOLS, SYMBOL_IDS } from '../market.js';
import { FEATURES, BINARY_KEYS } from '../features.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $, px } from '../ui.js';

const KW = new Set(['import', 'from', 'as', 'def', 'return', 'for', 'in', 'if', 'else', 'elif', 'while', 'True', 'False', 'None', 'and', 'or', 'not', 'raise', 'with', 'lambda', 'continue', 'break', 'class']);
function hl(code) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const re = /(#[^\n]*)|(f?"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')|\b([A-Za-z_]\w*)\b(?=\s*\()|\b([A-Za-z_]\w*)\b|\b(\d+(?:\.\d+)?)\b/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    if (m[1]) out += `<span class="tok-c">${esc(m[1])}</span>`;
    else if (m[2]) out += `<span class="tok-s">${esc(m[2])}</span>`;
    else if (m[3]) out += KW.has(m[3]) ? `<span class="tok-k">${m[3]}</span>` : `<span class="tok-f">${m[3]}</span>`;
    else if (m[4]) out += KW.has(m[4]) ? `<span class="tok-k">${m[4]}</span>` : m[4];
    else if (m[5]) out += `<span class="tok-n">${m[5]}</span>`;
    last = re.lastIndex;
  }
  return out + esc(code.slice(last));
}

const table = (head, rows) => `<div class="table-wrap"><table class="t"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;

function cells(engine, sym) {
  const L = engine.labs[sym], S = SYMBOLS[sym];
  return [
    { md: true, h: '1 · Conectar ao MetaTrader 5', p: 'Este notebook roda num servidor Windows (VPS) com o terminal MT5 da Hantec aberto e logado. A biblioteca oficial MetaTrader5 do Python só funciona no Windows. A senha nunca fica no código: vem de uma variável de ambiente.' },
    {
      where: 'VPS Windows · Python 3.12',
      code: `import os
import MetaTrader5 as mt5
import pandas as pd
import numpy as np

LOGIN, SERVIDOR = 5823190, "HantecMarkets-Demo"
if not mt5.initialize(login=LOGIN, server=SERVIDOR, password=os.environ["MT5_SENHA"]):
    raise SystemExit(mt5.last_error())

conta = mt5.account_info()._asdict()
print(conta["login"], conta["server"], conta["balance"], conta["currency"], conta["leverage"])
print("contrato:", mt5.symbol_info("${sym}").trade_contract_size)`,
      out: () => { const a = engine.broker.account_info(); return `<pre>${a.login} ${a.server} ${a.balance.toFixed(2)} ${a.currency} ${a.leverage}\ncontrato: ${sym === 'XAUUSD' ? '100.0' : '1.0 (simulado)'}\n<span class="pos">✓ conectado · terminal Hantec MT5 · modo ${a.trade_mode}</span></pre>`; },
    },
    { md: true, h: '2 · Baixar o histórico', p: 'O coletor baixa candles de 5 minutos do próprio MT5. No app real são cerca de 10 anos. No protótipo, o histórico é sintético e menor, para rodar no navegador.' },
    {
      where: 'coletor',
      code: `from datetime import datetime, timezone

ini = datetime(2016, 1, 1, tzinfo=timezone.utc)
fim = datetime.now(timezone.utc)
rates = mt5.copy_rates_range("${sym}", mt5.TIMEFRAME_M5, ini, fim)

df = pd.DataFrame(rates)
df["time"] = pd.to_datetime(df["time"], unit="s", utc=True)
df = df.set_index("time")[["open", "high", "low", "close", "tick_volume", "spread"]]
print(df.shape)
df.tail()`,
      out: () => `<pre>(${L.counts.bars}, 6)   <span class="muted"># protótipo: ${fmt.int(L.counts.m1)} candles de 1 min sintéticos → ${fmt.int(L.counts.bars)} de 5 min. Real: ~700 mil.</span></pre>` +
        table(['time (UTC)', 'open', 'high', 'low', 'close'], L.barsTail.map((b) => [fmt.dateTime(b.time), px(sym, b.open), px(sym, b.high), px(sym, b.low), px(sym, b.close)])),
    },
    { md: true, h: '3 · Conferir a qualidade', p: 'Dado ruim gera regra ruim. Procura buracos (horas sem preço), picos impossíveis e horários sem mercado.' },
    {
      where: 'coletor',
      code: `intervalo = df.index.to_series().diff().dt.total_seconds()
buracos = intervalo.gt(300) & intervalo.lt(2 * 24 * 3600)   # ignora fins de semana
picos = df["close"].pct_change().abs().gt(0.02)              # 2% em 5 minutos
print("buracos:", int(buracos.sum()), "| picos:", int(picos.sum()))
df = df[~picos]`,
      out: () => `<pre>buracos: 0 | picos: 0\n<span class="muted"># dados sintéticos são contínuos. No MT5 real aparecem fins de semana, feriados e falhas de cotação.</span></pre>`,
    },
    { md: true, h: '4 · Montar as fichas (variáveis)', p: 'Cada candle vira uma ficha de números. As ideias do Elton entram aqui como números (liquidez, tendência, lateral), e o modelo decide se elas ajudam. Regra do relógio: só entra o que já se sabia no fechamento do candle (shift e rolling olham para trás).' },
    {
      where: 'laboratório',
      code: `def fichas(df, redondo=${S.round}):
    atr = (df.high - df.low).ewm(alpha=1/14, adjust=False).mean()
    ema = df.close.ewm(span=50, adjust=False).mean()
    inclinacao = (ema - ema.shift(10)) / atr
    f = pd.DataFrame(index=df.index)
    f["regime"] = np.select([inclinacao > .45, inclinacao < -.45], ["alta", "baixa"], "lateral")
    lado = np.where(f.regime == "alta", 1, np.where(f.regime == "baixa", -1, 0))
    fundo20 = df.low.shift(1).rolling(20).min()      # só o passado
    topo20 = df.high.shift(1).rolling(20).max()
    varreu_fundo = ((df.low < fundo20) & (df.close > fundo20)).rolling(3).max()
    varreu_topo = ((df.high > topo20) & (df.close < topo20)).rolling(3).max()
    f["forca"] = inclinacao.abs()
    f["varreu_favor"] = np.where(lado >= 0, varreu_fundo, varreu_topo)
    f["varreu_contra"] = np.where(lado >= 0, varreu_topo, varreu_fundo)
    f["momento"] = (df.close - df.close.shift(3)) / atr * np.where(lado == 0, 1, lado)
    contra = ((df.close - df.open) * np.where(lado == 0, 1, lado) < 0).astype(int)
    f["recuo"] = contra.groupby((contra == 0).cumsum()).cumsum().clip(upper=5)
    f["redondo"] = ((df.close - (df.close / redondo).round() * redondo).abs() / atr).clip(0, 3)
    h = df.index.hour
    f["londres"], f["ny"] = ((h >= 7) & (h < 12)).astype(int), ((h >= 12) & (h < 17)).astype(int)
    f["vol"] = atr / atr.rolling(100).mean()
    f["asia"] = (h < 3).astype(int)                              # abertura de Tóquio e Hong Kong

    # RSI de 10 períodos (pedido do Elton) e divergências com o preço
    delta = df.close.diff()
    ganho = delta.clip(lower=0).ewm(alpha=1/10, adjust=False).mean()
    perda = (-delta.clip(upper=0)).ewm(alpha=1/10, adjust=False).mean()
    rsi = 100 - 100 / (1 + ganho / perda)
    f["rsi"] = np.where(lado >= 0, rsi, 100 - rsi)
    div_alta, div_baixa = divergencias(df, rsi, esquerda=3, direita=3)  # pivô só vale depois de confirmado
    f["div_favor"] = np.where(lado >= 0, div_alta, div_baixa)
    f["div_contra"] = np.where(lado >= 0, div_baixa, div_alta)
    return f.dropna()

X = ["forca", "varreu_favor", "varreu_contra", "momento", "recuo", "redondo",
     "londres", "ny", "vol", "asia", "rsi", "div_favor", "div_contra"]
f = fichas(df); f.tail(8)`,
      out: () => table(['time', 'regime', ...FEATURES.map((x) => x.key)], L.sample.map((s) => [fmt.dateTime(s.time), s.regime, ...s.x.map((v, j) => fmt.num(v, BINARY_KEYS.has(FEATURES[j].key) ? 0 : 2))])),
    },
    { md: true, h: '5 · Rótulos com três barreiras', p: 'Para cada momento em tendência, o app pergunta: comprando (ou vendendo) aqui, com stop de 1 ATR e alvo de 3R (o mínimo que o Elton aceita), o que veio primeiro? Se tocou os dois no mesmo candle, conta como stop. O spread é descontado.' },
    {
      where: 'laboratório',
      code: `def triple_barrier(df, i, lado, atr, R=${L.opts.R}, stop_atr=${L.opts.stopAtr}, max_candles=${L.opts.maxBars}, spread=${S.spread}):
    entrada, dist = df.close.iat[i], stop_atr * atr
    stop, alvo = entrada - lado * dist, entrada + lado * R * dist
    custo = spread / dist
    for j in range(i + 1, min(i + 1 + max_candles, len(df))):
        hi, lo = df.high.iat[j], df.low.iat[j]
        if (lo <= stop) if lado > 0 else (hi >= stop):
            return 0, -1 - custo, "stop"          # pessimista: tocou os dois, conta stop
        if (hi >= alvo) if lado > 0 else (lo <= alvo):
            return 1, R - custo, "alvo"
    fim = min(i + max_candles, len(df) - 1)
    return 0, (df.close.iat[fim] - entrada) * lado / dist - custo, "tempo"

rotulos = rotular(df, f)          # aplica a função em cada candle em tendência
rotulos.resultado.value_counts()`,
      out: () => `<pre>alvo     ${String(L.counts.alvo).padStart(6)}\nstop     ${String(L.counts.stop).padStart(6)}\ntempo    ${String(L.counts.tempo).padStart(6)}\n<span class="muted"># candles laterais fora da amostra: ${L.counts.lateral} · taxa de alvo sem filtro: ${fmt.pct(L.counts.alvo / L.counts.samples)} · mínimo para ${L.opts.R}R: ${fmt.pct(L.minAcerto, 0)}</span></pre>`,
    },
    { md: true, h: '6 · Estudo e prova avançando no tempo (Walk Forward)', p: 'O passado é dividido em blocos. O modelo estuda dois blocos e faz a prova no bloco seguinte, que nunca viu. Depois avança e repete. Só conta uma operação por vez.' },
    {
      where: 'laboratório',
      code: `from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

dados = f.join(rotulos).query("regime != 'lateral'")
estudo, cofre = dados.iloc[:int(len(dados) * .85)], dados.iloc[int(len(dados) * .85):]
blocos = np.array_split(estudo, 6)

for k in range(4):
    treino, prova = pd.concat(blocos[k:k + 2]), blocos[k + 2]
    modelo = make_pipeline(StandardScaler(), LogisticRegression(C=1.0))
    modelo.fit(treino[X], treino.y)
    resumo(k + 1, modelo, treino, prova, limite=${L.opts.limiar})`,
      out: () => table(['rodada', 'operações estudo', 'expect. estudo', 'operações prova', 'acerto prova', 'expect. prova', 'eficiência'], L.rounds.map((r) => [r.k, r.train.n, fmt.r(r.train.exp), r.test.n, fmt.pct(r.test.acerto, 0), `<span class="${r.test.exp > 0 ? 'pos' : 'neg'}">${fmt.r(r.test.exp)}</span>`, r.wfe === null ? '—' : fmt.pct(r.wfe, 0)])) + `<pre>eficiência média (prova ÷ estudo): <b>${fmt.pct(L.wfeAvg, 0)}</b>   <span class="muted"># Pardo: 50% ou mais é aprovado</span></pre>`,
    },
    { md: true, h: '7 · Cofre e teste contra o acaso', p: 'O último pedaço do histórico (o cofre) nunca foi usado. A regra final faz essa prova uma única vez. Depois compara com entradas no chute (comprar ou vender sorteado) no mesmo período.' },
    {
      where: 'laboratório',
      code: `final = make_pipeline(StandardScaler(), LogisticRegression(C=1.0)).fit(estudo[X], estudo.y)
res_cofre = resumo("cofre", final, None, cofre, limite=${L.opts.limiar})

acaso = [expectativa_no_chute(cofre, semente=s) for s in range(${L.opts.perms})]
p_valor = (np.sum(np.array(acaso) >= res_cofre.expectativa) + 1) / (len(acaso) + 1)
print(res_cofre, "p =", round(p_valor, 3))`,
      out: () => `<pre>cofre: ${L.cofre.n} operações · acerto ${fmt.pct(L.cofre.acerto, 0)} · expectativa <span class="${L.cofre.exp > 0 ? 'pos' : 'neg'}">${fmt.r(L.cofre.exp)}</span>\nno chute: média ${fmt.r(L.perm.reduce((a, b) => a + b, 0) / L.perm.length)} · melhor ${fmt.r(Math.max(...L.perm))}\np = ${fmt.num(L.pValue, 3)}   <span class="muted"># chance de o resultado ser sorte (≤ 0,10 aprova)</span>\n\nVEREDITO: ${L.verdict ? '<span class="pos">APROVADA · pode ir para o ao vivo (demo)</span>' : '<span class="amber">REPROVADA · o app só observa este ativo</span>'}</pre>`,
    },
    { md: true, h: '8 · A chance é honesta? (calibração)', p: 'Quando o modelo diz 50%, precisa acontecer perto de 50%. Junta as provas por faixa de chance e conta quantas bateram o alvo.' },
    {
      where: 'laboratório',
      code: `from sklearn.calibration import calibration_curve
disse, aconteceu = calibration_curve(provas.y, provas.chance, n_bins=8, strategy="quantile")`,
      out: () => table(['faixa', 'momentos', 'o modelo disse', 'aconteceu'], L.bins.map((b) => [`${fmt.pct(b.from, 0)}–${fmt.pct(b.to, 0)}`, b.n, fmt.pct(b.said, 0), `<span class="${Math.abs(b.happened - b.said) <= 0.07 ? 'pos' : 'amber'}">${fmt.pct(b.happened, 0)}</span>`])),
    },
    { md: true, h: '9 · As regras que o modelo encontrou', p: 'Ninguém escreveu essas regras à mão. Elas saem dos números: combinações em que as provas tiveram mais alvos. É o que o Elton vai ler para entender o modelo.' },
    {
      where: 'laboratório',
      code: `provas.groupby(["regime", "varreu_favor", "sessao"]).agg(
    momentos=("y", "size"), disse=("chance", "mean"),
    aconteceu=("y", "mean"), expectativa=("r", "mean"),
).query("momentos >= 25").sort_values("expectativa", ascending=False)`,
      out: () => table(['regra encontrada', 'momentos', 'aconteceu', 'expectativa'], L.rules.slice(0, 6).map((r) => [r.parts.join(' + '), r.n, fmt.pct(r.happened, 0), `<span class="${r.exp > 0 ? 'pos' : 'neg'}">${fmt.r(r.exp)}</span>`]).concat([['Mercado lateral (não opera)', L.lateral.n, fmt.pct(L.lateral.acerto, 0), `<span class="neg">${fmt.r(L.lateral.exp)}</span>`]])),
    },
    { md: true, h: '10 · Produção: o vigia ao vivo', p: 'Este laço roda no servidor o dia todo. A cada candle de 5 minutos fechado ele monta a ficha, pede a chance ao modelo e passa pelos filtros: lateral, notícia, horário, semáforo e limite. A saída abaixo é ao vivo, vinda do simulador.' },
    {
      where: 'produção · roda 24h',
      code: `modelos = {a: joblib.load(f"modelos/{a}.pkl") for a in ["XAUUSD", "HK50"]}

while True:
    for ativo in ["XAUUSD", "HK50"]:
        velas = pd.DataFrame(mt5.copy_rates_from_pos(ativo, mt5.TIMEFRAME_M5, 1, 400))  # só candles fechados
        ficha = fichas(preparar(velas)).iloc[-1]
        chance = modelos[ativo].predict_proba([ficha[X]])[0, 1] if ficha.regime != "lateral" else None
        decisao = vigia(ativo, ficha, chance, semaforo(), agenda_noticias())
        registrar(decisao)
        if decisao.sinal:
            publicar(decisao.sinal)     # WebSocket -> app + Telegram
    esperar_proximo_candle(mt5.TIMEFRAME_M5)`,
      live: true,
    },
    { md: true, h: '11 · Quando o Elton aperta o botão', p: 'O app manda o sinal escolhido para o servidor, que monta o pedido e chama order_send. A corretora responde com um código: 10009 quer dizer executado.' },
    {
      where: 'executor',
      code: `def executar(sinal):
    tick = mt5.symbol_info_tick(sinal.ativo)
    req = {
        "action": mt5.TRADE_ACTION_DEAL, "symbol": sinal.ativo, "volume": sinal.lotes,
        "type": mt5.ORDER_TYPE_BUY if sinal.lado > 0 else mt5.ORDER_TYPE_SELL,
        "price": tick.ask if sinal.lado > 0 else tick.bid,
        "sl": sinal.stop, "tp": sinal.alvo, "deviation": 20, "magic": 20261122,
        "comment": f"sinal {sinal.id}", "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    checagem = mt5.order_check(req)          # margem, volume, stops válidos
    resultado = mt5.order_send(req)
    return resultado.retcode, resultado.order, resultado.price`,
      out: () => {
        const l = engine.broker.log.filter((e) => e.kind !== 'req' || e.text.startsWith('order_send')).slice(-4);
        return l.length ? `<pre>${l.map((e) => `<span class="${e.kind === 'ok' ? 'pos' : e.kind === 'err' ? 'neg' : 'blue'}">${e.text.replace(/</g, '&lt;')}</span>`).join('\n')}</pre>` : '<pre class="muted">Nenhuma ordem enviada ainda. Execute um sinal no Painel e rode esta célula de novo.</pre>';
      },
    },
  ];
}

export default {
  title: 'Notebook do modelo',
  render(root, { engine }) {
    let sym = 'XAUUSD', n = 0;
    root.innerHTML = `
      <div class="page-head"><div><h1>Notebook do modelo</h1><p>É aqui que você vai trabalhar. Cada célula mostra o código Python real do servidor e a saída calculada pelo protótipo. Clique em ▶ para rodar uma célula, ou em "Executar tudo".</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="pill blue">${icon('cpu', 12)} Python 3.12 · VPS Windows (simulado)</span><div class="seg" id="nbSym">${SYMBOL_IDS.map((s) => `<button data-s="${s}">${s}</button>`).join('')}</div><button class="btn btn-primary btn-sm" id="runAll">${icon('play', 14)} Executar tudo</button></div></div>
      <div class="nb" id="nb"></div>`;
    let off = null;

    function build() {
      const list = cells(engine, sym);
      n = 0;
      $('#nb', root).innerHTML = list.map((c, i) => c.md
        ? `<div class="cell md"><div class="gut"></div><div class="body"><h3>${c.h}</h3><p>${c.p}</p></div></div>`
        : `<div class="cell" data-i="${i}"><div class="gut">[ ]</div><div class="body"><div class="bar-c"><button class="icon-btn" style="width:30px;height:30px" data-run="${i}" aria-label="Executar célula">${icon('play', 13)}</button><span class="where">${c.where}</span>${c.live ? '<span class="pill green" style="margin-left:auto"><span class="pulse"></span> ao vivo</span>' : ''}</div><pre class="code">${hl(c.code)}</pre><div class="out"></div></div></div>`).join('');
      root.querySelectorAll('#nbSym button').forEach((b) => b.classList.toggle('on', b.dataset.s === sym));
      if (off) off();
      off = null;
      return list;
    }
    let list = build();

    function run(i) {
      return new Promise((res) => {
        const el = root.querySelector(`.cell[data-i="${i}"]`);
        const c = list[i];
        el.classList.add('running');
        el.querySelector('.gut').textContent = '[*]';
        setTimeout(() => {
          n++;
          el.classList.remove('running');
          el.querySelector('.gut').textContent = `[${n}]`;
          const out = el.querySelector('.out');
          if (c.live) {
            const render = () => {
              const rows = engine.decisions.slice(-14).reverse().map((d) => `<div><span class="muted">${fmt.time(d.time)}</span> ${d.sym.padEnd(6)} ${d.regime.padEnd(7)} ${d.p !== null ? 'chance ' + (d.p * 100).toFixed(0).padStart(2) + '%' : 'chance  —'} → ${d.action === 'sinal' ? '<span class="pos">SINAL</span>' : '<span class="muted">' + d.reason + '</span>'}</div>`);
              out.innerHTML = `<div class="live-log">${rows.join('') || '<div class="muted">aguardando o próximo candle de 5 minutos…</div>'}</div>`;
            };
            render();
            if (off) off();
            off = engine.bus.on('decision', render);
          } else out.innerHTML = c.out();
          res();
        }, 250 + Math.random() * 350);
      });
    }
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-run]');
      if (b) run(+b.dataset.run);
    });
    $('#runAll', root).onclick = async () => { for (let i = 0; i < list.length; i++) if (!list[i].md) await run(i); };
    root.querySelector('#nbSym').onclick = (e) => { const b = e.target.closest('button'); if (b) { sym = b.dataset.s; list = build(); } };
    return () => { if (off) off(); };
  },
};
