#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "      ALBION CRAFT - INSTALAÇÃO AUTOMÁTICA NA AWS         "
echo "=========================================================="

# 1. Atualizar pacotes do sistema
echo "[1/4] Atualizando pacotes do sistema operacional..."
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Instalar Docker se ainda não estiver instalado
if ! command -v docker &> /dev/null; then
    echo "[2/4] Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm -f get-docker.sh
    sudo usermod -aG docker "$USER"
    echo "Docker instalado com sucesso!"
else
    echo "[2/4] Docker já está instalado."
fi

# 3. Instalar Docker Compose Plugin se necessário
if ! docker compose version &> /dev/null; then
    echo "[3/4] Instalando plugin Docker Compose..."
    sudo apt-get install -y docker-compose-plugin
else
    echo "[3/4] Docker Compose já está instalado."
fi

# 4. Criar .env se não existir
if [ ! -f ".env" ]; then
    echo "[4/4] Criando arquivo .env padrão..."
    cp .env.example .env
fi

# 5. Build e Inicialização dos containers
echo "Iniciando build e subindo container..."
sudo docker compose up -d --build

echo ""
echo "=========================================================="
echo "               DEPLOY CONCLUÍDO COM SUCESSO!              "
echo "=========================================================="
echo "O Albion Craft já está rodando em segundo plano!"
echo "Verifique o status com: sudo docker compose ps"
echo "Verifique os logs com:   sudo docker compose logs -f"
echo ""
echo "Lembre-se de liberar a porta no Firewall/Security Group da AWS!"
echo "Porta padrão: 8765 (ou 80 se configurada no .env)"
echo "=========================================================="
