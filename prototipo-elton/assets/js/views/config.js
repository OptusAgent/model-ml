// Configurações: o que o Elton pode mexer. Cada mudança vale na hora para o vigia e o executor.
import { SPEEDS } from '../engine.js';
import { fmt } from '../util.js';
import { icon } from '../icons.js';
import { $ } from '../ui.js';

export default {
  title: 'Configurações',
  render(root, { engine, toast }) {
    const s = engine.settings;
    const sw = (id, on, title, sub) => `<div class="switch-row"><div><b>${title}</b><small>${sub}</small></div><label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} aria-label="${title}"><span></span></label></div>`;
    root.innerHTML = `
      <div class="page-head"><div><h1>Configurações</h1><p>O que o Elton pode ajustar sem mexer no modelo. Mudanças de alvo e stop pedem um novo estudo no Laboratório, porque mudam o que o modelo aprendeu.</p></div></div>
      <section class="card"><div class="card-h"><h3>${icon('check', 16)} Padrões definidos pelas respostas do Elton (22/11)</h3></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span class="pill blue">XAUUSD e HK50 primeiro</span><span class="pill blue">sinais no M5 (opera no M1 e M2)</span><span class="pill blue">abertura da Ásia e Nova York</span>
          <span class="pill blue">alvo mínimo 3:1</span><span class="pill blue">até 3 sinais por dia</span><span class="pill blue">nada abaixo de 50%</span><span class="pill blue">RSI(10) com divergência</span><span class="pill gray">histórico manual não entra no modelo</span><span class="pill amber">risco por operação: falta responder</span>
        </div></section>
      <section class="grid g-2">
        <div class="card"><div class="card-h"><h3>${icon('zap', 16)} Sinais</h3></div>
          <div class="range-row"><div class="top"><label for="cLim">Limite de chance para mandar sinal</label><b id="cLimV"></b></div><input type="range" id="cLim" min="0.35" max="0.65" step="0.01" value="${s.limiar}"></div>
          <div class="range-row"><div class="top"><label for="cLife">Validade do sinal</label><b id="cLifeV"></b></div><input type="range" id="cLife" min="1" max="6" step="1" value="${s.signalLife}"></div>
          <div class="range-row"><div class="top"><label for="cMax">Máximo de sinais por dia</label><b id="cMaxV"></b></div><input type="range" id="cMax" min="1" max="10" step="1" value="${s.maxPerDay}"></div>
          ${sw('cXAU', s.active.XAUUSD, 'Ouro (XAUUSD)', 'o vigia avalia este ativo')}
          ${sw('cHK', s.active.HK50, 'Hang Seng (HK50)', 'o vigia avalia este ativo')}
          ${sw('cReq', s.requireApproved, 'Só operar regra aprovada', 'ativo reprovado no laboratório fica só observando')}
        </div>
        <div class="card"><div class="card-h"><h3>${icon('send', 16)} Execução</h3></div>
          <div class="field"><span class="lbl">Modo</span><div class="seg" id="cMode"><button data-m="sinal">Sinal + botão (o Elton decide)</button><button data-m="auto">Automático (só demo)</button></div></div>
          <p class="muted" style="margin:0;font-size:.82rem" id="cModeTxt"></p>
          <div class="range-row"><div class="top"><label for="cRisk">Risco por operação</label><b id="cRiskV"></b></div><input type="range" id="cRisk" min="0.25" max="3" step="0.25" value="${s.riskPct}"></div>
          <div class="range-row"><div class="top"><label for="cDD">Limite de queda da conta</label><b id="cDDV"></b></div><input type="range" id="cDD" min="5" max="30" step="1" value="${s.maxDD}"></div>
        </div>
        <div class="card"><div class="card-h"><h3>${icon('clock', 16)} Horários e notícias</h3></div>
          ${sw('cAsia', s.sessions.asia, 'Abertura da Ásia (00h–03h UTC)', '21h–00h em Brasília · Tóquio e Hong Kong')}
          ${sw('cLon', s.sessions.londres, 'Londres (07h–12h UTC)', '04h–09h em Brasília')}
          ${sw('cNy', s.sessions.ny, 'Nova York (12h–17h UTC)', '09h–14h em Brasília')}
          ${sw('cNews', s.newsFilter, 'Filtro de notícias', 'não manda sinal perto de notícia de alto impacto')}
          <div class="range-row"><div class="top"><label for="cNw">Janela da notícia</label><b id="cNwV"></b></div><input type="range" id="cNw" min="5" max="60" step="5" value="${s.newsWindow}"></div>
        </div>
        <div class="card"><div class="card-h"><h3>${icon('bell', 16)} Avisos</h3></div>
          ${sw('nApp', s.notify.app, 'No app', 'aviso na tela com o botão de executar')}
          ${sw('nTg', s.notify.telegram, 'Telegram', 'bot manda o sinal no celular (simulado)')}
          ${sw('nWa', s.notify.whatsapp, 'WhatsApp', 'exige a API oficial do WhatsApp Business (paga)')}
          ${sw('nMail', s.notify.email, 'E-mail', 'resumo do dia')}
          <div class="field"><span class="lbl">Velocidade do simulador</span><div class="seg" id="cSpeed">${SPEEDS.map((x) => `<button data-v="${x.v}">${x.label}</button>`).join('')}</div></div>
        </div>
      </section>`;

    function labels() {
      $('#cLimV', root).textContent = fmt.pct(s.limiar, 0);
      $('#cLifeV', root).textContent = `${s.signalLife} candle(s) · ${s.signalLife * 5} min`;
      $('#cMaxV', root).textContent = `${s.maxPerDay} por dia`;
      $('#cRiskV', root).textContent = fmt.num(s.riskPct, 2) + '% · ' + fmt.usd(engine.broker.account.balance * s.riskPct / 100);
      $('#cDDV', root).textContent = s.maxDD + '%';
      $('#cNwV', root).textContent = `${s.newsWindow} min antes e depois`;
      root.querySelectorAll('#cMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === s.execMode));
      root.querySelectorAll('#cMode button').forEach((b) => b.classList.toggle('blue', b.dataset.m === s.execMode));
      root.querySelectorAll('#cSpeed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === s.speed));
      $('#cModeTxt', root).textContent = s.execMode === 'sinal' ? 'O que o Elton pediu: o app avisa e ele aperta o botão.' : 'O app executa sozinho. Só funciona na conta demo, para testar o modelo sem ninguém olhando.';
    }
    const bind = (id, fn) => ($('#' + id, root).oninput = (e) => { fn(e.target); labels(); });
    bind('cLim', (e) => engine.setSettings({ limiar: +e.value }));
    bind('cLife', (e) => engine.setSettings({ signalLife: +e.value }));
    bind('cMax', (e) => engine.setSettings({ maxPerDay: +e.value }));
    bind('cRisk', (e) => engine.setSettings({ riskPct: +e.value }));
    bind('cDD', (e) => engine.setSettings({ maxDD: +e.value }));
    bind('cNw', (e) => engine.setSettings({ newsWindow: +e.value }));
    const chk = (id, fn) => ($('#' + id, root).onchange = (e) => { fn(e.target.checked); labels(); toast('Configuração salva', 'ok'); });
    chk('cXAU', (v) => (s.active.XAUUSD = v));
    chk('cHK', (v) => (s.active.HK50 = v));
    chk('cReq', (v) => (s.requireApproved = v));
    chk('cAsia', (v) => (s.sessions.asia = v));
    chk('cLon', (v) => (s.sessions.londres = v));
    chk('cNy', (v) => (s.sessions.ny = v));
    chk('cNews', (v) => engine.setSettings({ newsFilter: v }));
    chk('nApp', (v) => (s.notify.app = v));
    chk('nTg', (v) => (s.notify.telegram = v));
    chk('nWa', (v) => (s.notify.whatsapp = v));
    chk('nMail', (v) => (s.notify.email = v));
    root.querySelector('#cMode').onclick = (e) => { const b = e.target.closest('button'); if (b) { engine.setSettings({ execMode: b.dataset.m }); labels(); toast(b.dataset.m === 'auto' ? 'Modo automático (demo) ligado' : 'Modo sinal + botão', 'ok'); } };
    root.querySelector('#cSpeed').onclick = (e) => { const b = e.target.closest('button'); if (b) { engine.setSpeed(+b.dataset.v); labels(); } };
    labels();
  },
};
