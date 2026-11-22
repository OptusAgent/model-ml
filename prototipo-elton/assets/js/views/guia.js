// Guia: como testar sozinho antes da reunião e o roteiro para apresentar ao Elton.
import { icon } from '../icons.js';

const TEST = [
  ['painel', 'Painel', ['Os preços do ouro e do HK50 mudam sozinhos (mercado simulado). O relógio começa 15 minutos antes de Nova York.', 'Os sinais só saem na abertura da Ásia e em Nova York, até 3 por dia. Use 300× para chegar rápido nesses horários e o botão de pausa para congelar.', '"O que o vigia está pensando" ganha uma linha a cada 5 minutos simulados.', 'Embaixo do gráfico está o RSI(10). As divergências aparecem como traços verdes (de alta) e vermelhos (de baixa), no preço e no RSI.']],
  ['operar', 'Operar', ['Clique em "Comprar no MT5" num sinal: a posição abre com stop e alvo no gráfico.', 'Abra "Por que o modelo deu esse sinal?" e veja as barras de cada número da ficha.', 'Na boleta, digite um stop, clique em "Calcular o volume pelo risco" e compre à mão.', 'Ponha um stop do lado errado e veja a corretora recusar (código 10016).']],
  ['posicoes', 'Posições e histórico', ['A posição aberta mostra o lucro mudando a cada tick.', 'Quando bate o stop ou o alvo, ela vai sozinha para o histórico.', 'O relatório usa os nomes do MT5: Profit Trades, Profit Factor, Expected Payoff.']],
  ['risco', 'Risco e semáforo', ['Clique em "Injetar 10 stops seguidos": o semáforo fica vermelho e os sinais param.', 'Clique em "Reiniciar a conta demo" para voltar ao verde.', 'Mude o risco por operação e veja a tabela de quanto a conta cai.']],
  ['notebook', 'Notebook do modelo', ['Clique em "Executar tudo" e acompanhe as 11 células.', 'A célula 10 fica ao vivo: cada linha é uma decisão do vigia.', 'Troque para HK50 no topo e veja o veredito "reprovada".']],
  ['laboratorio', 'Laboratório', ['Compare as barras de estudo e prova de cada rodada.', 'Mude o alvo para 4R e clique em "Retreinar": veja o que acontece com o veredito.', 'Volte para 3R e retreine antes da apresentação.']],
  ['conexoes', 'MT5 e conectores', ['Siga o desenho: azul são dados e sinais, amarelo é a ordem.', 'Leia as 4 opções de execução e marque o checklist com o que já tem.']],
  ['config', 'Configurações', ['Desligue o HK50, troque o limite de chance e os horários.', 'Teste o modo automático (só demo) e depois volte para "Sinal + botão".']],
];

const SCRIPT = [
  { r: 'painel', t: 'Abrir pelo que ele pediu', d: 'Comece pelo Painel com o mercado em 60×. Deixe um sinal aparecer na frente dele.', say: '"Você pediu algo que te avise e você aperta o botão. É isso: o app vigia o ouro e o HK50 o dia todo e só te chama quando a chance passa do limite."', do: ['Mostre o aviso de sinal com o botão "Comprar no MT5".', 'Aperte o botão e mostre a posição aparecendo no gráfico com stop e alvo.'] },
  { r: 'operar', t: 'Mostrar por que o sinal apareceu', d: 'Abra o sinal em Operar e a explicação do modelo.', say: '"Não é opinião minha nem do modelo: cada sinal vem com os números que o justificaram. Liquidez varrida, força da tendência, sessão de Londres."', do: ['Abra "Por que o modelo deu esse sinal?".', 'Mostre a chance (ex.: 54%) e o limite de 50% (traço amarelo), e o RSI(10) com as divergências no gráfico.'] },
  { r: 'laboratorio', t: 'Simons: o processo descobre as regras', d: 'Vá ao Laboratório e mostre a tabela "Regras que o modelo encontrou".', say: '"Como na Renaissance, ninguém escreveu essas regras. Elas saíram dos dados. Os seus conceitos de liquidez e tendência entram como números, e o modelo diz se funcionam."', do: ['Aponte a linha "Mercado lateral": acerto baixo, expectativa negativa. É a sua regra de não operar o lateral, confirmada pelos números.'] },
  { r: 'laboratorio', t: 'Pardo: provar que aprendeu e não decorou', d: 'Mostre o gráfico de rodadas (estudo × prova), a eficiência e o cofre.', say: '"Esse é o Walk Forward do post. O modelo estuda, faz a prova num período que nunca viu, avança e repete. O ouro passou em todas. O HK50 reprovou, então o app só observa o HK50."', do: ['Troque para HK50 e mostre "Reprovada".', 'Mostre o teste contra o acaso: o modelo contra entradas no chute.'] },
  { r: 'risco', t: 'Mostrar a proteção da conta', d: 'Vá em Risco e semáforo e injete 10 stops.', say: '"Mesmo uma regra boa tem sequências ruins. Quando passa da pior sequência das provas, o app para sozinho e pede para refazer o estudo."', do: ['Injete 10 stops: semáforo vermelho.', 'Reinicie a conta.'] },
  { r: 'notebook', t: 'Mostrar o que há por trás', d: 'Abra o Notebook e execute tudo.', say: '"Isso é o que roda no servidor, ligado ao seu MT5 da Hantec: baixa o histórico, monta as fichas, treina, prova e vigia ao vivo."', do: ['Mostre a célula 1 (conexão com o MT5) e a 11 (order_send).', 'Deixe a célula 10 rodando ao vivo.'] },
  { r: 'conexoes', t: 'Combinar os próximos passos', d: 'Feche em MT5 e conectores, com o checklist.', say: '"Para sair do simulado preciso de: conta demo da Hantec, os ativos com nome exato, a permissão de Algo Trading e os seus setups para virar números da ficha."', do: ['Mostre que dá para comprar direto do app pela ponte Python.', 'Combine a Fase 1: laboratório com dados reais da Hantec, sem dinheiro em risco.'] },
];

const FAQ = [
  ['Qual o acerto?', 'O acerto não é a meta. Com o alvo de 3R que ele pediu, empatar exige só 25%. O que importa é a expectativa por operação depois dos custos. O Medallion, segundo relatos, acertava pouco mais de 50%.'],
  ['Funciona em dia de notícia?', 'Por padrão, o app não manda sinal 15 minutos antes e depois de notícia de alto impacto. Dá para desligar o filtro, mas o laboratório precisa provar que opera bem nesses dias.'],
  ['É tempo real? E a velocidade?', 'O sinal sai quando o candle de 5 minutos fecha. A latência até a corretora fica em dezenas de milissegundos. Como é o Elton quem clica, a vantagem não está na velocidade, e sim no padrão.'],
  ['E se o mercado mudar?', 'O semáforo compara o ao vivo com as provas. Se cair, pausa e retreina com os dados mais novos. O retreino de rotina também roda a cada período combinado.'],
  ['Os dados aqui são reais?', 'Não. Mercado, conta e modelo são simulados no navegador. O caminho e as telas são os do app real. Na Fase 1 os dados passam a vir do MT5 da Hantec.'],
  ['O app compra sozinho?', 'Pode, mas o Elton pediu para apertar o botão. O modo automático existe só na conta demo para testar.'],
];

const MAP = [
  ['Mercado (preços)', 'Simulador no navegador (market.js)', 'Terminal MT5 da Hantec → copy_rates_from_pos'],
  ['Histórico de 10 anos', '30 mil candles sintéticos de 1 minuto', 'mt5.copy_rates_range, guardado em Parquet'],
  ['Modelo', 'Regressão logística em JavaScript (features.js)', 'scikit-learn / LightGBM em Python, versionado com joblib'],
  ['Walk Forward e cofre', 'lab.js, roda ao abrir o app', 'Notebook e job agendado no servidor'],
  ['Corretora', 'MockMT5 com os mesmos métodos (broker.js)', 'Biblioteca MetaTrader5: order_send, positions_get'],
  ['Sinal no app', 'Evento interno do navegador', 'FastAPI + WebSocket; app em Next.js na Vercel'],
  ['Avisos', 'Aviso na tela', 'Bot do Telegram; WhatsApp pela API oficial'],
];

export default {
  title: 'Guia de apresentação',
  render(root, { engine }) {
    root.innerHTML = `
      <div class="page-head"><div><h1>Guia de apresentação</h1><p>Primeiro teste tudo sozinho com a lista abaixo. Depois siga o roteiro na frente do Elton. Cada passo tem o que fazer, o que falar e um botão para ir à tela.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-ghost btn-sm" id="gReset">${icon('refresh', 14)} Reiniciar conta antes de apresentar</button><button class="btn btn-ghost btn-sm" id="gFast">${icon('zap', 14)} Mercado em 60×</button><button class="btn btn-primary btn-sm" id="gDemo">${icon('zap', 14)} Gerar sinal de demonstração</button></div></div>
      <div class="note" style="border:1px solid var(--line);border-radius:12px;padding:12px 14px;color:var(--ink-2)">Com as regras do Elton (alvo de 3R, chance mínima de 50%, só abertura da Ásia e Nova York, até 3 por dia) os sinais são raros, de propósito. Na apresentação, fique na tela <b>Operar</b> e use os <b>cenários prontos</b>: tecla <kbd>1</kbd> cria uma compra que bate o alvo de 3R; tecla <kbd>2</kbd> cria uma compra que bate o stop e acende o aviso "o modelo precisa de atenção"; tecla <kbd>0</kbd> reinicia a conta. No celular, use o botão ▷ no topo. Cada cenário leva uns 30 segundos depois que você aperta "Comprar no MT5", em qualquer velocidade.</div>

      <section class="card"><div class="card-h"><h3>${icon('check', 16)} Parte 1 · Testar sozinho (15 minutos)</h3></div>
        <div class="grid g-2">${TEST.map(([r, t, items]) => `<div class="opt"><div class="card-h"><h4>${t}</h4><a class="btn btn-sm btn-ghost" href="#/${r}">Abrir</a></div><ul>${items.map((x) => `<li>${x}</li>`).join('')}</ul></div>`).join('')}</div></section>

      <section class="card"><div class="card-h"><h3>${icon('play', 16)} Parte 2 · Roteiro para o Elton (20 a 30 minutos)</h3><span class="sub">a ordem conta uma história: pedido → explicação → Simons → Pardo → proteção → bastidores → próximos passos</span></div>
        <div class="steps">${SCRIPT.map((s, i) => `<div class="step"><div class="n">${i + 1}</div><div><h3>${s.t}</h3><p>${s.d}</p><div class="say">${s.say}</div><ul>${s.do.map((x) => `<li>${x}</li>`).join('')}</ul><a class="btn btn-sm btn-primary" href="#/${s.r}">${icon('play', 12)} Ir para a tela</a></div></div>`).join('')}</div></section>

      <section class="grid g-2">
        <div class="card"><div class="card-h"><h3>${icon('info', 16)} Perguntas que o Elton pode fazer</h3></div><div style="display:flex;flex-direction:column;gap:8px">${FAQ.map(([q, a]) => `<details class="faq"><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>${icon('layers', 16)} O que é simulado e o que vira real</h3></div><div class="table-wrap"><table class="t"><thead><tr><th>Peça</th><th>No protótipo</th><th>No app real</th></tr></thead><tbody>${MAP.map((r) => `<tr><td><b>${r[0]}</b></td><td class="wrap muted">${r[1]}</td><td class="wrap">${r[2]}</td></tr>`).join('')}</tbody></table></div></div>
      </section>

      <section class="card"><div class="card-h"><h3>${icon('book', 16)} Glossário rápido</h3></div>
        <div class="grid g-3">${[
          ['1R', 'o quanto se arrisca numa operação: entrada menos stop, vezes as cotas.'],
          ['Expectativa', 'quanto sobra, em média, por operação, em R ou em dinheiro.'],
          ['Ficha', 'os números de um momento do mercado que o modelo lê.'],
          ['Triple-barrier', 'stop, alvo e tempo: o que vier primeiro decide o resultado.'],
          ['Walk Forward', 'estuda um pedaço, faz a prova no seguinte, avança e repete.'],
          ['Cofre', 'último pedaço do histórico, usado uma única vez no fim.'],
          ['Eficiência', 'resultado na prova dividido pelo do estudo. 50% ou mais aprova.'],
          ['Calibração', 'quando o modelo diz 45%, acontece perto de 45%.'],
          ['order_send', 'a função do MT5 que envia a ordem. Código 10009 = executada.'],
        ].map(([k, v]) => `<div class="opt"><h4>${k}</h4><span class="muted" style="font-size:.84rem">${v}</span></div>`).join('')}</div></section>`;
    root.querySelector('#gReset').onclick = () => engine.resetAccount();
    root.querySelector('#gFast').onclick = () => engine.setSpeed(60);
    root.querySelector('#gDemo').onclick = () => { const s = engine.demoSignal('XAUUSD'); if (!s) location.hash = '#/operar'; else location.hash = '#/operar?sym=XAUUSD'; };
  },
};
