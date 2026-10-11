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

3. **Comparador Multi-Cidades & Mercado Negro:**
   - Preços de compra comparados nas 5 cidades reais (*Thetford, Martlock, Bridgewatch, Lymhurst, Fort Sterling*).
   - Preços de venda comparados nas 5 cidades, **Caerleon** e **Mercado Negro (Black Market)**.

4. **Busca Automática de Preços:**
   - Integração com a API pública do **Albion Online Data Project** (servidores *Américas / West*, *Europa* e *Ásia / East*).
   - Envio em lotes otimizados com pausa automática (*throttle*) e tratamento com retentativa inteligente para evitar erros de limite de requisições (`HTTP 429`).
   - Indicação visual de preços desatualizados (> 48h) e suporte a edição manual de qualquer valor.

5. **Planejador & Lista de Compras:**
   - Permite montar uma lista do que você deseja craftar e informa o custo total, receita esperada e lucro líquido.
   - Gera uma **Lista de Compras Consolidada** (minérios, barras prontas e artefatos necessários já descontando os retornos de recursos esperados), indicando em qual cidade comprar cada item pelo menor preço.

6. **Versão Planilha Excel:**
   - Acompanha o arquivo `Planilha_Craft_Placas.xlsx` com fórmulas matemáticas idênticas e validadas diretamente no Excel.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos
- **Python 3.8+** instalado no seu computador.
  > O servidor web utiliza apenas a biblioteca padrão do Python (`http.server`, `urllib`, `json`), portanto **não é necessário instalar nenhuma biblioteca externa via pip** para rodar o site!

---

### Opção 1: Execução Rápida (Windows)
Dê um duplo clique no arquivo:
```
Iniciar_Site.bat
```
O servidor será iniciado e a página abrirá automaticamente no seu navegador padrão em `http://127.0.0.1:8765`.

---

### Opção 2: Pelo Terminal / Linha de Comando

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
├── Iniciar_Site.bat               # Atalho para inicialização rápida no Windows
├── Planilha_Craft_Placas.xlsx     # Planilha Excel completa e automatizada
├── site/                          # Código da aplicação web
│   ├── server.py                  # Servidor HTTP local em Python puro + Proxy da API
│   ├── build_data.py              # Extrator de receitas oficiais do jogo
│   ├── gamedata.json              # Base de itens, receitas e valores de item
│   ├── data.json                  # Estado do usuário (preços salvos, configs, planos)
│   └── static/                    # Frontend da aplicação
│       ├── index.html             # Estrutura HTML
│       ├── style.css              # Tema escuro e responsivo
│       └── app.js                 # Lógica de cálculo, tabelas e integração com API
└── README.md                      # Esta documentação
```

---

## 🛠️ Tecnologias Utilizadas
- **Python 3** (servidor web embutido, processamento de dados e scripts de geração de planilhas com `openpyxl`)
- **JavaScript (ES6+) Nativo** (cálculos reativos no cliente sem frameworks pesados)
- **HTML5 & CSS3** (layout moderno com tema escuro adaptado para desktop)
- **Albion Online Data Project API** (cotações de mercado da comunidade)
