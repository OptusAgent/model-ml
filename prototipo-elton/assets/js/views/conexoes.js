// MT5 e conectores: como os dados entram, onde o modelo roda, como a ordem chega à corretora
// e as opções pesquisadas para executar a compra a partir do app.
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $ } from '../ui.js';

function archSVG() {
  const box = (x, y, w, h, title, sub, col, ic) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#FFFFFF" stroke="${col}" stroke-width="1.5"/>
    <text x="${x + 16}" y="${y + 28}" font-size="14" font-weight="700" fill="#0C0C0E">${title}</text>
    ${sub.map((s, i) => `<text x="${x + 16}" y="${y + 48 + i * 17}" font-size="11.5" fill="#55555E">${s}</text>`).join('')}
    <circle cx="${x + w - 18}" cy="${y + 22}" r="5" fill="${ic}"/></g>`;
  const arrow = (d, col, dash = '6 6', cls = 'flow-dot') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="2" stroke-dasharray="${dash}" class="${cls}" marker-end="url(#ah-${col === '#B45309' ? 'a' : 'b'})"/>`;
  return `<svg class="arch" viewBox="0 0 980 400" role="img" aria-label="Arquitetura: corretora, MT5, ponte Python, modelo, API e app">
    <defs>
      <marker id="ah-b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#1D4ED8"/></marker>
      <marker id="ah-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 10 5 0 10z" fill="#B45309"/></marker>
    </defs>
    <text x="20" y="24" font-size="11" font-weight="700" letter-spacing="1.5" fill="#55555E">SERVIDOR (VPS WINDOWS, 24H)</text>
    <rect x="200" y="36" width="560" height="168" rx="18" fill="none" stroke="rgba(24,24,32,.18)" stroke-dasharray="4 5"/>
    ${box(20, 60, 160, 120, 'Hantec', ['servidor da corretora', 'preços em tempo real', 'executa as ordens'], '#B45309', '#0B8043')}
    ${box(220, 60, 160, 120, 'Terminal MT5', ['logado na conta', 'recebe os ticks', 'Algo Trading ligado'], '#1D4ED8', '#0B8043')}
    ${box(410, 60, 160, 120, 'Ponte Python', ['biblioteca', 'MetaTrader5', 'copy_rates / order_send'], '#1D4ED8', '#0B8043')}
    ${box(600, 60, 150, 120, 'Modelo', ['coletor + vigia', 'laboratório', 'semáforo'], '#7C3AED', '#0B8043')}
    ${box(800, 60, 160, 120, 'API + WebSocket', ['FastAPI', 'manda sinais', 'recebe o clique'], '#1D4ED8', '#0B8043')}
    ${box(560, 260, 180, 120, 'App (Vercel)', ['este painel', 'notebook e celular', 'Elton aperta o botão'], '#0B8043', '#0B8043')}
    ${box(800, 260, 160, 120, 'Avisos', ['Telegram / WhatsApp', 'notificação no', 'celular'], '#0B8043', '#0B8043')}
    ${box(20, 260, 400, 120, 'Dados guardados', ['histórico de 10 anos (Parquet)', 'fichas, rótulos, decisões do vigia', 'modelos versionados (joblib) e relatórios'], 'rgba(24,24,32,.35)', '#55555E')}
    ${arrow('M180 108 H218', '#1D4ED8')}${arrow('M380 108 H408', '#1D4ED8')}${arrow('M570 108 H598', '#1D4ED8')}${arrow('M750 108 H798', '#1D4ED8')}
    ${arrow('M880 180 V258', '#1D4ED8')}${arrow('M860 180 C 860 220, 700 220, 680 258', '#1D4ED8')}
    ${arrow('M600 300 C 520 300, 500 140, 500 182', '#B45309', '4 6')}
    ${arrow('M490 182 V 220 H 300 V 182', '#B45309', '4 6')}
    ${arrow('M260 182 C 260 230, 100 230, 100 182', '#B45309', '4 6')}
    ${arrow('M620 180 V 230 H 420 V 258', 'rgba(24,24,32,.6)', '3 5', '')}
    <text x="186" y="98" font-size="10.5" fill="#1D4ED8">ticks</text>
    <text x="590" y="236" font-size="10.5" fill="#B45309">clique: comprar</text>
    <text x="110" y="238" font-size="10.5" fill="#B45309">ordem chega à Hantec</text>
    <text x="760" y="98" font-size="10.5" fill="#1D4ED8">sinal</text>
  </svg>`;
}

const OPTIONS = [
  { t: 'Ponte Python no VPS (recomendado)', cost: 'Grátis + VPS Windows', pill: 'green', pros: ['Biblioteca oficial MetaTrader5: copy_rates, order_send, positions_get', 'Preços em tempo real vêm do próprio terminal, sem API paga', 'Controle total do código e dos dados'], cons: ['Só roda no Windows (ou com Wine)', 'O terminal MT5 precisa ficar aberto e logado 24h'] },
  { t: 'Botão dentro do MT5 (Expert Advisor em MQL5)', cost: 'Grátis', pill: 'green', pros: ['O Elton aperta o botão no próprio MT5, como falou na reunião', 'O EA lê o sinal do servidor e mostra um painel com Comprar/Vender'], cons: ['Exige programar em MQL5, outra linguagem', 'O painel fica só no MT5, não no celular'] },
  { t: 'MetaApi (API paga na nuvem)', cost: 'Assinaturas a partir de US$ 30/mês (confirmar)', pill: 'amber', pros: ['REST e streaming em tempo real, sem Windows', 'Bom para o app no celular executar de qualquer lugar'], cons: ['Custo mensal e cobrança por uso das chamadas REST', 'Uma empresa terceira guarda o acesso à conta'] },
  { t: 'Servidor MCP para MT5 (assistente de IA)', cost: 'Código aberto', pill: 'violet', pros: ['Deixa um assistente (Claude) consultar conta, posições e histórico', 'Pode explicar sinais e gerar relatórios em linguagem natural'], cons: ['Projetos da comunidade, sem auditoria de segurança', 'Usar só para consulta; ordem real passa pelo executor com as travas'] },
];

const CHECK = [
  'Login e servidor da conta demo da Hantec (depois, a real)',
  'Nome exato dos ativos na Hantec (XAUUSD, HK50 ou com sufixo)',
  'Tamanho do contrato e valor do ponto do HK50',
  'A Hantec permite Algo Trading/EA na conta do Elton?',
  'VPS Windows perto do servidor da Hantec (Londres)',
  'Horários em que o Elton opera e notícias que ele evita',
  'Risco por operação e limite de queda da conta',
  'Canal de aviso: Telegram (bot) ou WhatsApp (API paga)',
];

export default {
  title: 'MT5 e conectores',
  render(root, { engine }) {
    root.innerHTML = `
      <div class="page-head"><div><h1>MT5 e conectores</h1><p>Como os preços entram, onde o modelo roda e como a ordem chega à corretora quando o Elton aperta o botão. Tudo aqui está simulado; o caminho é o mesmo do app real.</p></div></div>
      <section class="card"><div class="card-h"><h3>${icon('plug', 16)} Caminho dos dados e da ordem</h3><span class="sub">azul: dados e sinais · laranja: a ordem</span></div><div class="table-wrap"><div style="min-width:760px">${archSVG()}</div></div></section>
      <section class="grid g-4" id="cStatus"></section>
      <section class="card">
        <div class="card-h"><h3>${icon('send', 16)} Dá para comprar direto do app?</h3><span class="pill green">Sim</span></div>
        <p style="margin:0;color:var(--ink-2);max-width:80ch">O botão do app manda o pedido para o servidor, que chama <span class="num">mt5.order_send</span> no terminal logado. Para isso, o Algo Trading precisa estar ligado no MT5 (Ferramentas → Opções → Expert Advisors). Para o Elton, que quer apertar o botão, a opção mais simples é a ponte Python. As alternativas:</p>
        <div class="grid g-2">${OPTIONS.map((o) => `<div class="opt"><div class="card-h"><h4>${o.t}</h4><span class="pill ${o.pill}">${o.cost}</span></div><ul>${o.pros.map((p) => `<li><span class="pos">+</span> ${p}</li>`).join('')}${o.cons.map((p) => `<li><span class="neg">−</span> ${p}</li>`).join('')}</ul></div>`).join('')}</div>
        <p class="muted" style="margin:0;font-size:.8rem">Preços do MT5 vêm de graça pelo terminal. API paga só é necessária se o app for executar sem o terminal Windows (MetaApi e similares). Valores pesquisados em nov/2026; confirmar antes de contratar.</p>
      </section>
      <section class="grid g-2">
        <div class="card"><div class="card-h"><h3>${icon('check', 16)} O que precisamos do Elton</h3></div><div>${CHECK.map((c, i) => `<label class="check"><input type="checkbox" id="ck${i}"><span>${c}</span></label>`).join('')}</div></div>
        <div class="card"><div class="card-h"><h3>${icon('code', 16)} Conversa com o MT5 (ao vivo)</h3><span class="sub">pedidos e respostas</span></div><div class="log" id="cLog"></div></div>
      </section>`;

    try { const saved = JSON.parse(localStorage.getItem('checklist') || '[]'); saved.forEach((v, i) => { const el = $('#ck' + i, root); if (el) el.checked = v; }); } catch (e) { /* sem armazenamento */ }
    root.querySelectorAll('.check input').forEach((el) => (el.onchange = () => { try { localStorage.setItem('checklist', JSON.stringify(CHECK.map((_, i) => $('#ck' + i, root).checked))); } catch (e) { /* ignora */ } }));

    function status() {
      const L = engine.labs.XAUUSD, lat = 38 + Math.round(Math.random() * 30);
      const card = (t, v, sub, ok = true) => `<div class="card" style="gap:6px"><div class="card-h"><span class="muted" style="font-size:.78rem;font-weight:600">${t}</span><span class="pill ${ok ? 'green' : 'amber'}">${ok ? 'ok' : 'atenção'}</span></div><b class="num" style="font-size:1.15rem">${v}</b><span class="muted" style="font-size:.76rem">${sub}</span></div>`;
      $('#cStatus', root).innerHTML = [
        card('Hantec → MT5', lat + ' ms', 'latência até o servidor (simulada)'),
        card('Último preço', fmt.time(engine.now()), `XAUUSD ${fmt.num(engine.priceOf('XAUUSD').bid)} · HK50 ${fmt.num(engine.priceOf('HK50').bid, 1)}`),
        card('Modelo em produção', L.version.replace('-xauusd', ''), `XAUUSD ${L.verdict ? 'aprovado' : 'reprovado'} · HK50 ${engine.labs.HK50.verdict ? 'aprovado' : 'reprovado'}`, L.verdict),
        card('Avisos', engine.settings.notify.telegram ? 'Telegram ligado' : 'só no app', engine.settings.notify.whatsapp ? 'WhatsApp ligado' : 'WhatsApp desligado'),
      ].join('');
    }
    function log() {
      $('#cLog', root).innerHTML = engine.broker.log.slice(-18).reverse().map((e) => `<div><span class="muted">${new Date(e.t).toLocaleTimeString('pt-BR')}</span><span class="${e.kind === 'ok' ? 'pos' : e.kind === 'err' ? 'neg' : 'blue'}">${e.text.replace(/</g, '&lt;')}</span></div>`).join('') || '<div class="muted">Nenhuma ordem ainda. Execute um sinal ou use a boleta em Operar.</div>';
    }
    status(); log();
    const offs = [engine.bus.on('candle', status), engine.bus.on('mt5log', log)];
    return () => offs.forEach((o) => o());
  },
};
