# ⚒️ Albion Craft & Refino (Placas, Arcos, Bestas & Culinária)

Sistema integrado de **Refino de Minérios e Madeiras**, **Craft de Equipamentos (Placas, Arcos e Bestas)** e **Culinária (Comidas Meta .0 a .3 & Açougue)** para o jogo **Albion Online**, com cálculo de custo unitário real (cadeia integrada), planejador de lotes, ranking de lucratividade, análise de qualidade (Q1–Q5), proteção anti-slippage (VWAP) e leitura automática de mercado em tempo real.

---

## 📋 Funcionalidades

1. **Refino Estratégico de Metal e Madeira (Cascata Completa vs Anterior Pronta):**
   - Suporte completo às duas cadeias de refino (**T2.0 ao T8.4**):
     - **⛏️ Minério $\rightarrow$ Barras de Metal** (`T2_ORE`..`T8_METALBAR`)
     - **🪵 Madeira $\rightarrow$ Tábuas de Madeira** (`T2_WOOD`..`T8_PLANKS`)
   - Compara em tempo real os dois métodos de refino:
     - **Barra / Tábua Anterior (T-1):** Compra o material refinado T-1 pronto no mercado mais barato + recurso bruto do tier (ideal para ciclos rápidos, menos peso de transporte e menor imobilização de capital).
     - **Cascata Completa:** Refina desde o T2 do zero aproveitando todos os retornos de recursos acumulados.
   - Informa a economia exata em prata por unidade entre os dois métodos e indica o vencedor.
   - Compara também com o **preço do material refinado pronto no mercado**, escolhendo a rota mais barata automaticamente (ou permitindo escolha manual por tier/encantamento).
   - Decompõe a **Lista de Compras** dinamicamente para ambos os recursos.

2. **Craft de Placas, Arcos e Bestas (1.025 combinações T4.0 ao T8.4):**
   - **🛡️ Equipamentos de Placas (Armadura, Elmo e Botas — 675 itens):**
     - Variantes comuns (**Soldado, Cavaleiro, Guardião**).
     - Variantes de artefato (**Graveguard, Demônio, Juiz, Duskweaver, Valor**).
     - Variante **👑 Real (Royal)**: calcula automaticamente a rota mais econômica para a peça base (forjar a mais barata entre Soldado/Cavaleiro/Guardião ou comprar pronta no mercado) + **Emblemas Reais (T4 a T8)** sem retorno de recurso e taxa zero de conversão.
   - **🏹 Arcos (175 itens — 32× Tábuas):**
     - **Arco (Bow)**, **Arco de Guerra (Warbow)** e **Arco Longo (Longbow)**.
     - Artefato: **Arco Sussurrante (Whispering)**, **Arco Lamenturiento (Wailing)**, **Arco de Badon (Badon)** e **Perfurador de Névoa (Mistpiercer)**.
   - **🎯 Bestas (175 itens — Tábuas + Barras de Metal):**
     - **Besta (Crossbow)** e **Besta Pesada (Heavy Crossbow)** (20× Tábuas + 12× Barras).
     - **Besta Leve (Light Crossbow 1M)** (16× Tábuas + 8× Barras).
     - Artefato (20× Tábuas + 12× Barras + Artefato): **Repetidora Lamenturienta (Weeping)**, **Atiradores de Dardos (Boltcasters)**, **Besta de Cerco (Siegebow)** e **Moldador de Energia (Energy Shaper)**.
   - Cálculo exato da taxa da estação baseada no *Item Value* oficial de todos os recursos somados + artefato.

3. **Volume de Compra Diário & Risco de Liquidez (Anti-Prata Parada):**
   - Coleta o histórico real de compras diárias via API pública do **Albion Online Data Project** (média dos últimos 28 dias por cidade e Mercado Negro).
   - **Indicadores visuais de giro de mercado:**
     - 🟢 **Alto Giro (≥ 20 un/dia):** Venda rápida e garantida.
     - 🟡 **Médio Giro (5 a 19 un/dia):** Demanda moderada.
     - 🟠 **Baixo Giro (1 a 4.9 un/dia):** Poucas vendas diárias, produzir com cautela.
     - 🔴 **Risco de Prata Parada (< 1 un/dia ou sem vendas recentes):** Alerta crítico para evitar gastar prata em itens que ficam semanas no mercado sem vender.
   - **Lucro Diário Estimado (`Lucro/un × Demanda/dia`):** Mostra a prata real que o item gera no seu bolso por dia.
   - **Tempo Estimado para Escoar o Lote no Planejador:** Calcula quantos dias levará para vender todo o lote com base no ritmo real do mercado.

4. **Análise de Preço por Qualidade (Q1 a Q5 & Mix Real de Craft):**
   - Suporte completo às 5 qualidades: **Normal (Q1), Bom (Q2), Notável (Q3), Excelente (Q4) e Obra-prima (Q5)**.
   - **Modo ⚡ Mix Real do Craft:** Pondera as chances reais estatísticas de rolagem ao forjar (`45% Q1, 42% Q2, 11% Q3, 2% Q4`), permitindo calcular a receita verdadeira de lotes e aproveitar ofertas altas do Mercado Negro.
   - **Comparativo interativo:** Tooltip em cada peça exibindo a cotação de cada qualidade e qual cidade paga melhor.
   - **Consulta e edição individual** por qualidade na aba *Preços > Equipamentos*.

5. **Proteção de Volume & Preço Médio (VWAP / Anti-Slippage):**
   - Protege o artesão contra **anúncios trolls de 1 unidade** que distorcem o menor preço de mercado e iludem o cálculo de custos em compras grandes (ex.: precisar de milhares de minérios/madeiras quando só há 1 pelo preço mínimo).
   - Calcula o **VWAP (Preço Médio Ponderado por Volume)** dos últimos 28 dias para transações reais de minérios, barras, madeiras, tábuas e artefatos.
   - Alertas visuais de derrapagem (`⚠️ Spot vs VWAP`) no Refino e no Planejador.
   - Modos de compra configuráveis: **Inteligente (Anti-Slippage)**, **Preço Médio Real (VWAP)**, **Menor Oferta Spot** e **Spot + Margem (5% ou 10%)**.

6. **Leitura de Histórico de Preço e Diagnóstico de Saúde de Mercado (Anti-Trolls / Anti-Anomalias):**
   - Identifica instantaneamente se uma cotação de mercado é **Confiável e Estável** ou **Perigosa / Anormal** (ofertas troll de 1 unidade, mercado esvaziado ou itens estagnados sem compradores).
   - **Badges de Saúde e Diagnóstico Automatizado:**
     - 🟢 **Estável & Confiável:** Preço spot alinhado com o VWAP histórico (±12%) e vendas recentes ativas nos últimos 7 dias. Lucro seguro e comprovado.
     - ⚠️ **Anormal / Inflado (+25% ou mais acima do VWAP):** Alerta crítico contra anúncios trolls de 1 peça com preços astronômicos que geram lucros ilusórios no ranking.
     - 📉 **Abaixo da Média / Dump (-25% ou mais abaixo do VWAP):** Preço abaixo da média histórica; oportunidade de compra rápida ou queima de estoque.
     - 🟡 **Oscilando / Moderado:** Variação intermediária em relação à média histórica.
     - ⛔ **Sem Vendas / Mercado Parado:** Sem transações nos últimos 21 dias (alerta de prata parada).
   - **Modal Interativo de Histórico Completo:**
     - Clique em qualquer badge de saúde ou de volume para abrir o modal detalhado do item.
     - **Gráfico SVG Interativo (28 dias):** Curva de preço médio diário, barras de volume negociado, linha guia do VWAP histórico e linha guia do preço Spot atual (mostrando visualmente se a oferta é um pico irreal ou preço consistente).
     - **Tabela Transacional Dia a Dia:** Histórico com data, unidades vendidas no dia, preço médio e volume total em prata.
     - **Abas de Mercado:** Alterne instantaneamente entre o Mercado Negro e todas as cidades reais.
     - **Atualização Instantânea:** Botão para atualizar o histórico detalhado sob demanda para o item consultado.
   - **Base de Preço de Venda no Ranking:**
     - `⚡ Mercado Atual (Spot)`: Menor oferta de venda nas cidades ou maior ordem de compra no Mercado Negro.
     - `📊 Preço Histórico Real (VWAP)`: Calcula a lucratividade com base no VWAP real, blindando o ranking contra anúncios trolls.
     - `🛡️ Mais Seguro`: Usa o menor valor entre Spot e VWAP.
     - `💡 Inteligente`: Usa Spot normalmente, mas substitui pelo VWAP caso o anúncio esteja inflado (+25%).
   - **Filtro de Saúde:** Permite filtrar o ranking por itens estáveis, ocultar preços anormais ou esconder itens sem vendas recentes.

7. **Comparador Multi-Cidades & Mercado Negro:**
   - Preços de compra comparados nas 5 cidades reais (*Thetford, Martlock, Bridgewatch, Lymhurst, Fort Sterling*).
   - Preços de venda comparados nas 5 cidades, **Caerleon** e **Mercado Negro (Black Market)**.

8. **Leitor de Mercado em Tempo Real (In-Game Packet Capture):**
   - Captura preços **automaticamente e em tempo real** diretamente do jogo conforme você visita os mercados das cidades e do Mercado Negro.
   - Suporte a captura de qualidades (1 a 5) e profundidade de ordens (quantidades disponíveis).
   - **100% Seguro e em Conformidade com as Regras (TOS) da Sandbox Interactive:** Funciona por monitoramento passivo de pacotes de rede locais (via driver Npcap), **sem injetar código nem tocar na memória do cliente do jogo**.
   - Integração direta: alimenta o servidor local em `/api/ingest`, atualizando as tabelas e o ranking de lucro no navegador instantaneamente com alertas visuais.

9. **Busca Automática via API Pública:**
   - Integração com a API pública do **Albion Online Data Project** (servidores *Américas / West*, *Europa* e *Ásia / East*).
   - Envio em lotes otimizados com pausa automática (*throttle*) e tratamento com retentativa inteligente para evitar erros de limite de requisições (`HTTP 429`).
   - Indicação visual de preços desatualizados (> 48h) e suporte a edição manual de qualquer valor.

10. **🍲 Culinária & Craft de Comidas (84 combinações Meta .0 a .3):**
    - Suporte completo às 7 famílias principais de comida do Albion Online:
      - **🥧 Tortas (Pies):** T3 Galinha, T5 Ganso e T7 Porco.
      - **🍳 Omeletes (Omelettes):** T3 Galinha, T5 Ganso e T7 Porco.
      - **🍲 Guisados / Ensopados (Stews):** T4 Cabra, T6 Carneiro e T8 Carne Bovina.
      - **🥪 Sanduíches (Sandwiches):** T4 Cabra, T6 Carneiro e T8 Carne Bovina.
      - **🍗 Assados (Roasts):** T3 Frango, T5 Ganso e T7 Porco.
      - **🥗 Saladas (Salads):** T2 Feijão, T4 Nabo e T6 Batata.
      - **🥣 Sopas (Soups):** T1 Cenoura, T3 Trigo e T5 Repolho.
    - **Rendimento Real de 10 Unidades por Lote:** Cada ciclo de produção gera 10 comidas consumindo os ingredientes da receita. Custo unitário dividido por 10.
    - **Bônus de Produção de Culinária:**
      - **Caerleon (Cidade Bônus Oficial):** 24.8% de retorno sem foco, ~47.9% com foco.
      - **Ilha Particular:** 0% de retorno sem foco, ~43.5% com foco.
      - Cidades Reais: 15.2% de retorno sem foco.
    - **Encantamentos (.1, .2, .3) com Molhos de Peixe:**
      - Aplicação de **Molho de Peixe Básico (.1)**, **Extravagante (.2)** e **Especial (.3)** com as quantidades exatas por tier (10, 30 ou 90 molhos por lote de 10).
      - Conforme as regras oficiais do jogo, molhos de peixe têm **0% de taxa de retorno** (sem desperdício de cálculo).
    - **🔪 Açougue & Arbitragem de Insumos:**
      - Compara automaticamente a economia entre **abater o animal vivo na fazenda** (1 animal adulto = 18 carnes cruas) vs **comprar a carne pronta no mercado**.
      - Processamento intermediário: Moinho (Trigo $\rightarrow$ Farinha 1:1), Padaria (Farinha $\rightarrow$ Pão 1:1) e Cozinha (Leite $\rightarrow$ Manteiga 1:1).
    - **🏛️ Nutrição de Estações de Craft & Comidas Favoritas (2x Nutrição):**
      - Mapeamento oficial das **16 estações de craft, refino e processamento** extraídas dos binários do jogo (`buildings.json`).
      - Cada estação consome nutrição por ciclo de fabricação; donos de lotes urbanos compram massivamente a **Comida Favorita** de cada loja porque ela concede **+100% de nutrição bônus (o dobro / 2x)** por prata gasta:
        - 🔨 **Forja do Guerreiro (`FORGE`):** Guisado de Carneiro T6 (`T6_MEAL_STEW`) $\rightarrow$ 886 nutrição (2x).
        - 🏹 **Cabana do Caçador (`HUNTERSLODGE`):** Salada de Batata T6 (`T6_MEAL_SALAD`) $\rightarrow$ 886 nutrição (2x).
        - 🔮 **Torre do Mago (`MAGICITEMS`):** Sanduíche de Carneiro T6 (`T6_MEAL_SANDWICH`) $\rightarrow$ 886 nutrição (2x).
        - ⛏️ **Fundição de Minério (`SMELTER`):** Sopa de Trigo T3 (`T3_MEAL_SOUP`) $\rightarrow$ 266 nutrição (2x).
        - 🪵 **Serraria (`CARPENTERSWORKSHOP`):** Sopa de Cenoura T1 (`T1_MEAL_SOUP`) $\rightarrow$ 88 nutrição (2x).
        - 🐂 **Curtume (`TANNERY`):** Torta de Galinha T3 (`T3_MEAL_PIE`) $\rightarrow$ 156 nutrição (2x).
        - 🧵 **Tecelagem (`WEAVINGMILL`):** Omelete de Galinha T3 (`T3_MEAL_OMELETTE`) $\rightarrow$ 156 nutrição (2x).
        - 🪨 **Cantaria (`STONEMASONRY`):** Salada de Feijão T2 (`T2_MEAL_SALAD`) $\rightarrow$ 88 nutrição (2x).
        - 🍲 **Cozinha (`COOK`):** Torta de Ganso T5 (`T5_MEAL_PIE`) $\rightarrow$ 532 nutrição (2x).
        - 🧪 **Laboratório de Alquimia (`ALCHEMIST`):** Omelete de Porco T7 (`T7_MEAL_OMELETTE`) $\rightarrow$ 1.598 nutrição (2x).
        - 🔪 **Açougueiro (`BUTCHER`):** Sopa de Repolho T5 (`T5_MEAL_SOUP`) $\rightarrow$ 800 nutrição (2x).
        - 🌾 **Moinho (`MILL`):** Omelete de Ganso T5 (`T5_MEAL_OMELETTE`) $\rightarrow$ 532 nutrição (2x).
        - ⚙️ **Fabricante de Ferramentas (`TOOLMAKER`):** Salada de Nabo T4 (`T4_MEAL_SALAD`) $\rightarrow$ 266 nutrição (2x).
        - 🐎 **Cavalariça / Selaria (`STABLE`):** Guisado de Cabra T4 (`T4_MEAL_STEW`) $\rightarrow$ 266 nutrição (2x).
        - ✨ **Forja de Artefatos (`MELDBUILDING`):** Salada de Batata T6 (`T6_MEAL_SALAD`) $\rightarrow$ 886 nutrição (2x).
        - 🔧 **Oficina de Reparos (`REPAIRSHOP`):** Sanduíche de Cabra T4 (`T4_MEAL_SANDWICH`) $\rightarrow$ 266 nutrição (2x).
    - **🔥 Registro & Seletor de Bônus Diários de Produção:**
      - Seletor persistente no topo da tela e na aba de Culinária com os **13 eventos diários do Albion Online**.
      - Identificação automática do **Pico de Demanda do Dia**: indica na hora qual comida terá consumo explosivo devido ao evento ativo.
      - **Destaque Dinâmico no Ranking:** As comidas do dia recebem aura dourada pulsante (`bonus-glow`) e o selo `🔥 BÔNUS HOJE`.
      - **Filtro de Construções:** Filtra o ranking apenas por comidas usadas em lojas ou por estação específica.
      - **Envio Rápido de Lotes:** Botões de 1 lote (10 un.) e 10 lotes (100 un.) para abastecer o Planejador com um clique.
    - **📋 Planejador de Culinária & Lista de Compras Consolidada:**
      - Planejamento de lotes com cálculo de custo, receita esperada, lucro líquido, demanda e foco necessário.
      - Lista de compras consolidada com dedução automática do retorno de recursos da cidade.
    - **Cotações e Busca Rápida na API:** Botão exclusivo para atualizar instantaneamente preços e histórico de liquidez/VWAP de todas as comidas e insumos.

11. **Planejador & Lista de Compras Consolidada:**
    - Permite misturar Placas, Arcos e Bestas no mesmo plano de produção e informa o custo total, receita esperada, lucro líquido e giro do lote.
    - Gera uma **Lista de Compras Consolidada** separando **Minérios**, **Barras Prontas**, **Madeiras**, **Tábuas Prontas**, **Artefatos**, **Emblemas Reais** e **Peças Base** (já descontando os retornos de recursos esperados), indicando em qual cidade comprar cada item pelo menor preço.

12. **Versão Planilha Excel:**
    - Acompanha o arquivo `Planilha_Craft_Placas.xlsx` com fórmulas matemáticas idênticas e validadas diretamente no Excel.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- **Python 3.8+** instalado no seu computador.
  > O servidor web utiliza apenas a biblioteca padrão do Python (`http.server`, `urllib`, `json`), portanto **não é necessário instalar bibliotecas externas via pip**.
- *(Opcional, para o leitor em tempo real)* **Driver Npcap**:
  > Se for usar o leitor passivo de pacotes, instale o Npcap gratuito em [npcap.com](https://npcap.com/#download) marcando a opção *"Install Npcap in WinPcap API-compatible Mode"*.

---

### Opção 1: Com Leitor de Mercado em Tempo Real (Recomendado)
Dê um duplo clique no arquivo:
```
Iniciar_Com_Leitor.bat
```
- Inicia o servidor web do Albion Craft em segundo plano.
- Inicia o leitor de pacotes passivo (`albiondata-client`) com **sistema de watchdog e auto-recuperação**: se a rede oscilar ou houver qualquer interrupção, o leitor reinicia automaticamente.
- Conforme você abre o mercado no Albion Online (Thetford, Fort Sterling, Caerleon, Mercado Negro, etc.), as ordens são capturadas e o site é atualizado na hora com uma notificação verde e status "Ao vivo".

---

### Opção 2: Somente o Site Local (Sem Leitor de Pacotes)
Dê um duplo clique no arquivo:
```
Iniciar_Site.bat
```
O servidor será iniciado e a página abrirá em `http://127.0.0.1:8765`. Você poderá consultar a API pública ou preencher os preços manualmente.

---

### Opção 3: Apenas o Leitor (Servidor Web já em execução)
Caso já tenha iniciado o site com o `Iniciar_Site.bat`, basta dar um duplo clique em:
```
Iniciar_Apenas_Leitor.bat
```
Ele valida se o servidor local está ativo, baixa o leitor oficial se necessário, conta com watchdog integrado e conecta os pacotes in-game diretamente à interface.

---

### Opção 4: Pelo Terminal / Linha de Comando

1. Abra o terminal (PowerShell, CMD ou Bash) na pasta do projeto:
   ```bash
   cd site
   ```

2. Inicie o servidor:
   ```bash
   python server.py
   ```

3. Abra o seu navegador e acesse:
   ```
   http://127.0.0.1:8765
   ```

Para encerrar o servidor, pressione `Ctrl + C` no terminal.

---

## 📖 Como Usar o Site

1. **Aba Config:**
   - Defina as taxas do mercado (ex.: 0% para compra direta, 2.5% para ordem de compra; 6.5% de venda com Premium ou 10.5% sem).
   - Ajuste as taxas de retorno da sua cidade ou se usará foco (ex.: refino 36.7% / craft 24.8%).
   - Configure a taxa cobrada pelas barracas da cidade (prata por 100 de nutrição).
   - Selecione o seu servidor (*Américas*, *Europa* ou *Ásia*).

2. **Aba Preços:**
   - Clique em **"↻ Buscar todos os preços"** para baixar automaticamente as cotações mais recentes do servidor escolhido.
   - Se preferir, edite ou insira manualmente qualquer valor nas tabelas de Minério, Barras, Artefatos ou Equipamentos.

3. **Aba Refino:**
   - Veja o custo efetivo de cada barra e a economia obtida ao refinar em vez de comprar pronta.
   - A coluna *Origem* permite alternar entre `Automático`, `Refinar` ou `Comprar`.

4. **Aba Ranking de Lucro:**
   - Ordene as 600 peças de placa por maior lucro, melhor margem ou menor custo.
   - Use o botão **"+ planejar"** para adicionar itens diretamente ao seu plano de produção.

5. **Aba Planejador:**
   - Adicione os itens e as quantidades que deseja produzir.
   - Visualize o resumo financeiro (investimento necessário, taxas e lucro final).
   - Consulte a **Lista de Compras** para saber a quantidade exata de minérios, barras e artefatos a comprar em cada cidade.

---

## 📁 Estrutura de Arquivos

```
Planilhas_Albion/
├── Iniciar_Com_Leitor.bat         # Inicialização completa (Site + Leitor em tempo real)
├── Iniciar_Apenas_Leitor.bat      # Inicialização exclusiva do leitor (para servidor já ativo)
├── Iniciar_Site.bat               # Atalho para inicialização simples (somente o site)
├── Planilha_Craft_Placas.xlsx     # Planilha Excel completa e automatizada
├── site/                          # Código da aplicação web
│   ├── server.py                  # Servidor HTTP local (endpoints /api/ingest e /api/live_status)
│   ├── build_data.py              # Extrator de receitas oficiais do jogo
│   ├── gamedata.json              # Base de itens, receitas e valores de item
│   ├── data.json                  # Estado do usuário (preços salvos, configs, planos)
│   └── static/                    # Frontend da aplicação
│       ├── index.html             # Estrutura HTML com badge de status ao vivo
│       ├── style.css              # Tema escuro e responsivo
│       └── app.js                 # Lógica de cálculo, tabelas, polling ao vivo e API
└── README.md                      # Esta documentação
```

---

## 🛠️ Tecnologias Utilizadas
- **Python 3** (servidor web embutido, processamento de dados e scripts de geração de planilhas com `openpyxl`)
- **JavaScript (ES6+) Nativo** (cálculos reativos no cliente sem frameworks pesados)
- **HTML5 & CSS3** (layout moderno com tema escuro adaptado para desktop)
- **Albion Online Data Project API** (cotações de mercado da comunidade)
