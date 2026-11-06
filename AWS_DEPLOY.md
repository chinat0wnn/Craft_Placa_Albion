# 🚀 Guia de Deploy na Nuvem (AWS) - Albion Craft

Este guia ensina como hospedar o **Albion Craft** na nuvem da AWS de forma simples, barata e persistente, permitindo acessar o painel de qualquer lugar e continuar alimentando os preços em tempo real com o leitor no seu computador.

---

## 🏗️ Como Funciona a Arquitetura na Nuvem

```
[Seu Computador com Albion Online]
  ├── Jogo Albion Online (Lê pacotes com Npcap)
  └── Iniciar_Leitor_Nuvem.bat (albiondata-client.exe)
            │
            │  POST /api/ingest (pacotes de mercado)
            ▼
[AWS - Servidor na Nuvem (EC2 ou Lightsail)]
  ├── Docker Container (Porta 8765 ou 80)
  │     └── Python Server (site/server.py)
  └── Volume Persistente (site/data.json - preços salvos)
            ▲
            │  HTTP/HTTPS (Navegador)
            │
[Qualquer Celular, Tablet ou Navegador Web]
```

> **Nota:** O leitor de pacotes (`albiondata-client.exe`) precisa rodar na sua máquina local onde o jogo está aberto. Ele enviará os dados para a sua instância na AWS automaticamente via script `Iniciar_Leitor_Nuvem.bat`.

---

## 💰 Escolhendo o Serviço na AWS

| Opção | Custo Estimado | Dificuldade | Recomendação |
|---|---|---|---|
| **AWS Lightsail (Recomendada)** | ~$3.50 a $5.00 / mês | ⭐ Muito Fácil | **Melhor custo-benefício**: IP estático gratuito, firewall simples na tela, sem surpresas na fatura. |
| **AWS EC2 (t4g.small / t3.micro)** | Grátis no Free Tier (1º ano) | ⭐⭐ Fácil | Excelente se você ainda tem créditos ou está no Free Tier da AWS. |

---

## 📋 Passo a Passo de Instalação

### Opção 1: Usando AWS Lightsail (Recomendado)

1. Acesse o console do [AWS Lightsail](https://lightsail.aws.amazon.com/).
2. Clique em **Create instance**.
3. Selecione:
   - **Plataforma:** Linux/Unix
   - **Blueprint:** *OS Only* $\rightarrow$ **Ubuntu 24.04 LTS** (ou 22.04 LTS).
   - **Plano:** O plano mais básico de **$3.50 ou $5.00/mês** (512MB ou 1GB RAM) é mais que suficiente.
4. Escolha um nome para a instância (ex: `albion-craft`) e clique em **Create instance**.
5. **Configurar Firewall (Portas de Rede):**
   - Na página da sua instância no Lightsail, clique na aba **Networking**.
   - Em *IPv4 Firewall*, clique em **Add rule** e libere a porta:
     - **Custom** $\rightarrow$ **TCP** $\rightarrow$ Porta `8765` (ou Porta `80` se preferir acesso HTTP direto).
     - (Opcional) Adicione um **Static IP** gratuito para seu IP não mudar caso a máquina reinicie.
6. **Conectar e Instalar:**
   - Clique no ícone de terminal (**Connect using SSH**) no painel do Lightsail.
   - Execute os comandos abaixo:

```bash
# 1. Clonar o projeto
git clone https://github.com/chinat0wnn/Craft_Placa_Albion.git
cd Craft_Placa_Albion

# 2. Rodar o script de instalação automática
chmod +x deploy/setup_aws.sh
./deploy/setup_aws.sh
```

Pronto! O servidor já está online! Acesse no navegador:
`http://SEU_IP_AWS:8765`

---

### Opção 2: Usando AWS EC2

1. No console da AWS, acesse o painel do **EC2** e clique em **Launch Instances**.
2. **Nome:** `albion-craft-server`.
3. **AMI:** Ubuntu Server 24.04 LTS (HVM) ou 22.04 LTS.
4. **Tipo de Instância:** `t4g.small`, `t4g.micro` ou `t3.micro` (Elegível para o Free Tier).
5. **Key pair:** Selecione uma chave existente ou crie uma `.pem` para acessar via SSH.
6. **Network settings / Security Group:**
   - Marque **Allow SSH traffic from Anywhere** (ou seu IP).
   - Clique em **Edit** e adicione uma regra de entrada:
     - Tipo: **Custom TCP**
     - Port range: `8765` (ou `80`)
     - Source: `0.0.0.0/0` (Anywhere)
7. Clique em **Launch Instance**.
8. Conecte na máquina via SSH ou pelo **EC2 Instance Connect** no navegador e execute:

```bash
git clone https://github.com/chinat0wnn/Craft_Placa_Albion.git
cd Craft_Placa_Albion
chmod +x deploy/setup_aws.sh
./deploy/setup_aws.sh
```

---

## 🔒 Segurança (Token Opcional)

Se quiser evitar que qualquer pessoa pela internet sobrescreva seus preços ou envie dados para o seu servidor, você pode definir uma senha/token:

1. No servidor AWS, edite o arquivo `.env`:
   ```bash
   nano .env
   ```
2. Defina uma chave secreta:
   ```env
   AUTH_TOKEN=minha_senha_super_secreta_123
   ```
3. Reinicie o container:
   ```bash
   sudo docker compose up -d
   ```

---

## 🎮 Conectando o Leitor Local (no seu Windows)

Com o servidor rodando na AWS:

1. Na pasta do projeto no seu PC Windows, dê dois cliques em:
   **`Iniciar_Leitor_Nuvem.bat`**
2. Na primeira vez, ele perguntará:
   - **URL do Servidor AWS:** Digite `http://SEU_IP_AWS:8765`
   - **Token:** Se configurou `AUTH_TOKEN`, digite ele; se não configurou, pressione `Enter`.
3. O script salvará essas informações no arquivo local `leitor_nuvem.env` e iniciará a leitura dos pacotes do Albion Online diretamente para o seu servidor na nuvem!
4. Toda vez que você for jogar, basta abrir o `Iniciar_Leitor_Nuvem.bat`.

---

## 🛠️ Comandos Úteis no Servidor AWS

- **Ver status do container:**
  ```bash
  sudo docker compose ps
  ```
- **Ver logs em tempo real:**
  ```bash
  sudo docker compose logs -f
  ```
- **Reiniciar o serviço:**
  ```bash
  sudo docker compose restart
  ```
- **Parar o serviço:**
  ```bash
  sudo docker compose down
  ```
- **Atualizar com novas alterações do git:**
  ```bash
  git pull
  sudo docker compose up -d --build
  ```
