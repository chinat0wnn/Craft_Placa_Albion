# Imagem base minimalista e segura com Python 3.12
FROM python:3.12-alpine

# Define variaveis de ambiente do Python
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HOST=0.0.0.0 \
    PORT=8765

# Cria diretorio de trabalho
WORKDIR /app

# Copia a aplicacao
COPY site /app/site

# Define o diretorio de execucao
WORKDIR /app/site

# Exponha a porta da aplicacao
EXPOSE 8765

# Healthcheck nativo
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:8765/api/live_status || exit 1

# Comando de inicializacao
CMD ["python", "server.py"]
