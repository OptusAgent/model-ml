# Estrutura do notebook do modelo (app do Elton)

Referência: as seções 0–10 do projeto [deteccao_fraude](https://github.com/ValmirJrDS/deteccao_fraude),
adaptadas para dados de mercado. O notebook do protótipo (`prototipo-elton`) foi feito para apresentação
e é mais enxuto. **O modelo real segue esta estrutura.**

| Seção | Conteúdo | Adaptação para mercado |
|---|---|---|
| 0 · Imports, funções e carga | bibliotecas, funções auxiliares, caminhos | carga pelo MT5: `mt5.copy_rates_range` (10 anos de candles) |
| 1 · Descrição dos dados | dimensões, tipos, nulos, estatística descritiva | + buracos, fins de semana, feriados, spread, retornos e volatilidade por horário |
| 2 · Mapa de hipóteses + feature engineering | hipóteses → variáveis | hipóteses do Elton: varrida de liquidez, estrutura (alta/baixa/lateral), sessões, notícias, número redondo |
| 3 · Filtragem | linhas e colunas | horários sem mercado, dados ruins, picos impossíveis |
| 4 · Análise uni, bi e multivariada | validar hipóteses | ex.: "depois de varrer o fundo na alta, sai mais alvo?" |
| 5 · Preparação | normalização, padronização, encoders, variável resposta | variável resposta = **três barreiras** (alvo, stop, tempo, com spread). Escalador ajustado **só no treino de cada rodada** e reaproveitado no teste |
| 6 · Seleção de features e divisão | seleção + treino/validação/teste | divisão **no tempo**: Walk Forward + cofre (último pedaço, usado uma vez) |
| 7 · Modelos | referência, linear, não linear, validação cruzada | referência = "sempre a favor da tendência"; logística, Random Forest, XGBoost/LightGBM; validação **no tempo** ou k-fold com purge/embargo |
| 8 · Hiperparâmetros | busca aleatória, modelo final | busca **dentro de cada rodada** do Walk Forward; o modelo final nunca treina na validação |
| 9 · Tradução do erro para o negócio | desempenho do negócio e do modelo | expectativa em R e US$, perda máxima, sequência de stops, calibração, eficiência do Walk Forward, chance de ser sorte (PBO) |
| 10 · Deploy | API | vigia ao vivo no MT5, semáforo, retreino |

## Três regras que não podem ser quebradas

1. **Escalador e encoders:** ajusta (`fit`) no treino e só aplica (`transform`) na validação, no teste e na produção.
   Nunca criar um escalador novo para o teste (no projeto de fraude isso acontece na seção 8.3.3).
2. **Modelo final:** nunca treinar com `fit(X_val, y_val)`. A validação só mede (no projeto de fraude isso acontece na seção 8.2).
3. **Divisão:** nunca `train_test_split` aleatório nem `StratifiedKFold` comum com dados de mercado,
   porque misturam o futuro com o passado (no projeto de fraude: seção 6.2). Sempre divisão no tempo.
