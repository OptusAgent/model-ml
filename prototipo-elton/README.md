# Sinal Lab · protótipo do app do Elton

Protótipo navegável do app de sinais. O mercado (ouro XAUUSD e HK50), a conta MT5 e o modelo
são **simulados no navegador**. As telas e o caminho dos dados são os mesmos do app real.

O que dá para testar:

- sinais em tempo real no M5, com alvo de 3R, chance mínima de 50% e até 3 por dia (respostas do Elton), com o botão "Comprar/Vender no MT5";
- gráfico com M1, M2, M5, M15 e H1 e o RSI(10) com as divergências marcadas;
- execução da ordem, stop e alvo fechando sozinhos, relatório no formato do MT5;
- o modelo por trás: notebook com o código Python do servidor e saídas calculadas;
- laboratório com Walk Forward (Pardo), cofre, teste contra o acaso, calibração e as regras que o modelo encontrou;
- semáforo de risco com cenários de estresse;
- arquitetura de conexão com o MT5 e as opções de execução pesquisadas.

> Os números não são previsão de mercado. O ouro simulado tem uma vantagem embutida para o
> modelo encontrar. O HK50 simulado quase não tem, para mostrar uma regra sendo reprovada.

---

## 1. Rodar no seu computador

Não precisa instalar nada além do Python (só para servir os arquivos).

```bash
cd prototipo-elton
```

```bash
python3 -m http.server 5173
```

Abra `http://localhost:5173`. É preciso internet, porque as fontes e a biblioteca de gráficos vêm de CDN.

Abrir o `index.html` direto com dois cliques **não funciona**: os módulos JavaScript exigem um servidor.

## 2. Publicar na Vercel

O projeto é um site estático: não tem build nem dependências.

### Opção A: pelo site (com GitHub)

1. Suba a pasta `prototipo-elton` para um repositório no GitHub (pode ser a raiz do repositório ou uma subpasta).
2. Em vercel.com → **Add New… → Project** → importe o repositório.
3. Configure:
   - **Framework Preset:** Other
   - **Root Directory:** `prototipo-elton` (se estiver numa subpasta)
   - **Build Command:** deixe vazio
   - **Output Directory:** `.` (ponto)
4. Clique em **Deploy**. Cada `git push` publica de novo.

### Opção B: pela linha de comando

```bash
npm i -g vercel
```

```bash
cd prototipo-elton && vercel
```

```bash
vercel --prod
```

O primeiro `vercel` faz perguntas: aceite os padrões e, em "Output Directory", use `.`.

### Proteger o link

O link da Vercel é público. Para que só o Elton veja, use **Settings → Deployment Protection**
(Vercel Authentication ou senha, conforme o plano), ou não divulgue o link.

## 3. Como apresentar

Dentro do app, abra **Guia de apresentação** (menu lateral, ou "Mais" no celular). Ele tem:

- **Parte 1:** lista para testar sozinho em 15 minutos;
- **Parte 2:** roteiro de 7 passos para o Elton, com o que fazer e o que falar;
- perguntas prováveis e respostas;
- tabela do que é simulado e do que vira real.

Atalhos úteis na apresentação:

- relógio e velocidade no topo. O mercado começa 15 min antes de Nova York; sinais só na abertura da Ásia e em NY, até 3 por dia. Use 300× para chegar rápido nesses horários;
- botão de pausa para congelar o mercado enquanto explica;
- **Risco e semáforo → Injetar 10 stops**: mostra o semáforo vermelho na hora;
- **Risco e semáforo → Reiniciar a conta demo** antes de começar.

No celular (iPhone 17: 402×874; 17 Pro Max: 440×956), o menu vira uma barra de abas embaixo.
O layout respeita a área segura (Dynamic Island e barra de início). Para parecer app, abra no
Safari → Compartilhar → **Adicionar à Tela de Início**.

## 4. Estrutura do código

```
prototipo-elton/
├─ index.html              casca da página; carrega fontes, Lightweight Charts e o app
├─ vercel.json             configuração da Vercel
└─ assets/
   ├─ css/styles.css       design (tokens de cor, cartões, responsivo, iPhone)
   └─ js/
      ├─ util.js           números em pt-BR, sorteio com semente, eventos
      ├─ market.js         mercado simulado (regimes alta/baixa/lateral, liquidez)   → real: MT5
      ├─ features.js       fichas, rótulos triple-barrier, regressão logística       → real: Python
      ├─ lab.js            Walk Forward, cofre, acaso, calibração, regras            → real: notebook/job
      ├─ broker.js         MockMT5 com a mesma "cara" da biblioteca MetaTrader5      → real: mt5.order_send
      ├─ engine.js         relógio, vigia, sinais, execução, semáforo, notícias      → real: serviço no VPS
      ├─ ui.js             gráfico de candles, cartão de sinal, minigráficos
      ├─ icons.js          ícones SVG
      ├─ app.js            menu, rotas (#/painel…), avisos, notificações
      └─ views/            uma tela por arquivo
         painel · operar · posicoes · risco · notebook · laboratorio · conexoes · config · guia
```

O motor (`market`, `features`, `lab`, `broker`, `engine`) não usa o DOM. Dá para rodar no Node:

```bash
node -e "import('./assets/js/lab.js').then(m=>{const L=m.runLab('XAUUSD');console.log(L.verdict,L.wfeAvg,L.cofre)})"
```

No console do navegador, `window.__engine` dá acesso ao motor (sinais, conta, laboratório).

## 5. Como o motor funciona

1. **Coletor** (`market.js`): a cada tick (10 segundos simulados) o preço anda; a cada 6 ticks fecha um candle de 1 minuto.
2. **Vigia** (`engine.js → onM5Close`): a cada candle de 5 minutos fechado, monta a ficha só com o passado, classifica o mercado (alta/baixa/lateral) e pede a chance ao modelo.
3. **Filtros:** ativo ligado → não lateral → regra aprovada no laboratório → horário (abertura da Ásia e Nova York) → até 3 sinais por dia → notícia → semáforo → sem posição aberta → chance ≥ 50%.
4. **Sinal:** lado, entrada, stop (1 ATR), alvo (3R, o mínimo do Elton), lotes por risco (0,5% da conta), expectativa e explicação.
5. **Executor** (`broker.js`): `order_send` com latência, códigos de retorno do MT5 (10009, 10014, 10016, 10019); a corretora vigia stop e alvo a cada tick.
6. **Semáforo:** compara o ao vivo com as provas (acerto, sequência de stops, queda da conta).
7. **Laboratório** (`lab.js`): 90 mil minutos sintéticos → 18 mil candles de 5 min → fichas e rótulos → 4 rodadas de Walk Forward → cofre → teste contra entradas no chute → veredito.

## 6. Do protótipo ao app real

| Peça | Protótipo | App real (sugestão) |
|---|---|---|
| Preços e histórico | simulador | terminal MT5 da Hantec + biblioteca `MetaTrader5` (`copy_rates_range`, `copy_rates_from_pos`) |
| Servidor | navegador | VPS **Windows** perto de Londres, com o MT5 aberto 24h |
| Modelo | regressão logística em JS | Python: pandas, scikit-learn/LightGBM, joblib; histórico em Parquet |
| API | eventos internos | FastAPI + WebSocket |
| App | HTML/JS estático | Next.js na Vercel (pode reaproveitar este design) |
| Avisos | toast na tela | bot do Telegram; WhatsApp pela API oficial (paga) |
| Execução | MockMT5 | `mt5.order_send` com Algo Trading ligado no terminal |

### Opções de execução pesquisadas (nov/2026)

- **Ponte Python no VPS (recomendado):** a biblioteca oficial `MetaTrader5` só roda no Windows. No Linux, só com Wine ([mt5linux](https://pypi.org/project/mt5linux/)).
- **Expert Advisor em MQL5:** um botão no próprio MT5, como o Elton falou na reunião. Exige programar em MQL5.
- **MetaApi:** API paga na nuvem, com REST e streaming. O [site](https://metaapi.cloud/) lista assinaturas de US$ 30 e US$ 100/mês, mas o preço da API estava indisponível; confirmar. Pela [documentação](https://metaapi.cloud/docs/client/rateLimiting/), o streaming não consome créditos.
- **Servidores MCP para MT5:** projetos de código aberto que deixam um assistente de IA consultar a conta e até enviar ordens ([metatrader-mcp-server](https://pypi.org/project/metatrader-mcp-server/0.4.2/), [mcp-metatrader5-server](https://mcp-metatrader5-server.readthedocs.io/)). Não têm auditoria: usar só para consulta.

### Pontos a confirmar com o Elton e a Hantec

- nome exato dos ativos, tamanho do contrato e valor do ponto do HK50 (no protótipo foi simplificado para US$ 1 por ponto);
- se a conta permite Algo Trading/EA;
- login da conta demo para a Fase 1;
- horários, notícias que ele evita, risco por operação e limite de queda.

## 7. Limitações conhecidas

- Mercado, conta e modelo são sintéticos. Fins de semana e feriados não são simulados.
- O modelo usa 13 variáveis (incluindo RSI(10) e divergência) e regressão logística, para rodar rápido no navegador.
- Com dados sintéticos o acerto no alvo de 3R sai alto demais. Com dados reais da Hantec ele deve ser bem menor; quem decide é o laboratório.
- A latência da ordem simulada pode mover o preço de entrada (escorregamento). Por isso o resultado em R pode ficar um pouco abaixo do alvo.
- Nada fica salvo entre visitas, a não ser o checklist da tela de conexões (no navegador).
