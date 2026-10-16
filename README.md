# ⚒️ Albion Craft & Refino (Equipamentos de Placas)

Sistema integrado de **Refino de Minérios** e **Craft de Equipamentos de Placas** para o jogo **Albion Online**, com cálculo de custo unitário real (cadeia integrada), planejador de lotes, ranking de lucratividade e busca automática de preços em tempo real via **Albion Online Data Project**.

---

## 📋 Funcionalidades

1. **Refino Estratégico (Cascata Completa vs Barra Anterior Pronta):**
   - Compara em tempo real os dois métodos de refino:
     - **Barra Anterior:** Compra a barra T-1 pronta no mercado mais barato + minério bruto do tier (ideal para ciclos rápidos, menos peso de transporte e economia de capital).
     - **Cascata Completa:** Refina desde o T2 do zero aproveitando todos os retornos de recursos acumulados.
   - Informa a economia exata em prata por barra entre os dois métodos e indica o vencedor.
   - Compara também com o **preço da barra pronta no mercado**, escolhendo a rota mais barata (ou permitindo escolha manual por barra).
   - Decompõe a **Lista de Compras** dinamicamente: se você optar por *Barra Anterior*, a lista pede a barra T-1 e o minério atual sem exigir minérios dos tiers anteriores.

2. **Craft de Equipamentos de Placas:**
   - Cobre **armaduras, elmos e botas** em todos os tiers e encantamentos (**T4.0 ao T8.4** — 600 combinações possíveis).
   - Suporte a variantes comuns (**Soldado, Cavaleiro, Guardião**) e variantes com artefato (**Graveguard, Demônio, Juiz, Duskweaver, Valor**).
   - Cálculo exato da taxa da forja baseada no *Item Value* oficial e dedução do retorno de recursos do craft.
   - Artefatos configurados sem retorno (mecânica oficial do jogo).

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
   - Protege o artesão contra **anúncios trolls de 1 unidade** que distorcem o menor preço de mercado e iludem o cálculo de custos em compras grandes (ex.: precisar de 10.000 minérios quando só há 1 pelo preço mínimo).
   - Calcula o **VWAP (Preço Médio Ponderado por Volume)** dos últimos 28 dias para transações reais de minérios e barras.
   - Alertas visuais de derrapagem (`⚠️ Spot vs VWAP`) no Refino e no Planejador.
   - Modos de compra configuráveis: **Inteligente (Anti-Slippage)**, **Preço Médio Real (VWAP)**, **Menor Oferta Spot** e **Spot + Margem (5% ou 10%)**.

6. **Comparador Multi-Cidades & Mercado Negro:**
   - Preços de compra comparados nas 5 cidades reais (*Thetford, Martlock, Bridgewatch, Lymhurst, Fort Sterling*).
   - Preços de venda comparados nas 5 cidades, **Caerleon** e **Mercado Negro (Black Market)**.

7. **Leitor de Mercado em Tempo Real (In-Game Packet Capture):**
   - Captura preços **automaticamente e em tempo real** diretamente do jogo conforme você visita os mercados das cidades e do Mercado Negro.
   - Suporte a captura de qualidades (1 a 5) e profundidade de ordens (quantidades disponíveis).
   - **100% Seguro e em Conformidade com as Regras (TOS) da Sandbox Interactive:** Funciona por monitoramento passivo de pacotes de rede locais (via driver Npcap), **sem injetar código nem tocar na memória do cliente do jogo**.
   - Integração direta: alimenta o servidor local em `/api/ingest`, atualizando as tabelas e o ranking de lucro no navegador instantaneamente com alertas visuais.

8. **Busca Automática via API Pública:**
   - Integração com a API pública do **Albion Online Data Project** (servidores *Américas / West*, *Europa* e *Ásia / East*).
   - Envio em lotes otimizados com pausa automática (*throttle*) e tratamento com retentativa inteligente para evitar erros de limite de requisições (`HTTP 429`).
   - Indicação visual de preços desatualizados (> 48h) e suporte a edição manual de qualquer valor.

9. **Planejador & Lista de Compras:**
   - Permite montar uma lista do que você deseja craftar e informa o custo total, receita esperada e lucro líquido.
   - Gera uma **Lista de Compras Consolidada** (minérios, barras prontas e artefatos necessários já descontando os retornos de recursos esperados), indicando em qual cidade comprar cada item pelo menor preço.

10. **Versão Planilha Excel:**
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
- Inicia o leitor de pacotes passivo (`albiondata-client`).
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
Ele valida se o servidor local está ativo, baixa o leitor oficial se necessário e conecta os pacotes in-game diretamente à interface.

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
