@echo off
setlocal EnableDelayedExpansion
title Albion Craft - Leitor Local conectado a Nuvem (AWS)
cd /d "%~dp0"

echo ===================================================================
echo       ALBION CRAFT - LEITOR DE MERCADO CONECTADO A NUVEM
echo ===================================================================
echo.

:: 1. Carrega ou solicita as configuracoes do servidor na nuvem
set "SERVER_URL="
set "AUTH_TOKEN="

if exist "leitor_nuvem.env" (
    for /f "usebackq tokens=1,* delims==" %%A in ("leitor_nuvem.env") do (
        set "KEY=%%A"
        set "VAL=%%B"
        if "!KEY!"=="SERVER_URL" set "SERVER_URL=!VAL!"
        if "!KEY!"=="AUTH_TOKEN" set "AUTH_TOKEN=!VAL!"
    )
)

if "!SERVER_URL!"=="" (
    echo [CONFIGURACAO INICIAL]
    echo Digite a URL ou IP do seu servidor na AWS.
    echo Exemplos: http://54.233.120.45:8765 ou https://seu-dominio.com
    echo.
    set /p SERVER_URL="URL do Servidor AWS: "
    echo.
    set /p AUTH_TOKEN="Token de Seguranca (opcional, pressione Enter se nao usou): "
    echo.
    (
        echo SERVER_URL=!SERVER_URL!
        echo AUTH_TOKEN=!AUTH_TOKEN!
    ) > leitor_nuvem.env
    echo [OK] Configuracoes salvas em leitor_nuvem.env!
    echo.
)

:: Remove barra final se tiver
if "!SERVER_URL:~-1!"=="/" set "SERVER_URL=!SERVER_URL:~0,-1!"

:: Monta URL final de ingestao
if "!AUTH_TOKEN!"=="" (
    set "INGEST_URL=!SERVER_URL!/api/ingest"
) else (
    set "INGEST_URL=!SERVER_URL!/api/ingest?token=!AUTH_TOKEN!"
)

:: 2. Verifica se o executavel do leitor existe, senao baixa automaticamente
if exist "%~dp0albiondata-client.exe" goto :client_ok

echo [AVISO] albiondata-client.exe nao encontrado localmente.
echo Baixando leitor oficial do Albion Data Project...
python -c "import urllib.request, gzip, shutil, os; print('Baixando pacote...'); urllib.request.urlretrieve('https://github.com/ao-data/albiondata-client/releases/download/0.1.61/update-windows-amd64.exe.gz', 'albiondata-client.exe.gz'); print('Extraindo executavel...'); f_in=gzip.open('albiondata-client.exe.gz', 'rb'); f_out=open('albiondata-client.exe', 'wb'); shutil.copyfileobj(f_in, f_out); f_in.close(); f_out.close(); os.remove('albiondata-client.exe.gz'); print('Concluido!')"

if not exist "%~dp0albiondata-client.exe" (
    echo.
    echo [ERRO] Falha no download automatico. Verifique sua conexao com a internet.
    pause
    exit /b 1
)
echo [OK] Leitor baixado com sucesso!
echo.

:client_ok

:: 3. Verifica se o driver Npcap / WinPcap esta instalado
set "NPCAP_FOUND=0"
if exist "%WINDIR%\System32\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\System32\Npcap\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\SysWOW64\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\SysWOW64\Npcap\wpcap.dll" set "NPCAP_FOUND=1"

if "%NPCAP_FOUND%"=="1" goto :npcap_ok

echo [AVISO] Driver Npcap nao encontrado!
echo O Npcap e necessario para ler os pacotes do jogo passivamente.
echo Baixe em: https://npcap.com/#download
pause
exit /b 0

:npcap_ok

echo ===================================================================
echo CONECTANDO AO SERVIDOR AWS:
echo !INGEST_URL!
echo.
echo LEITOR ATIVO!
echo  - Va ate o mercado em qualquer cidade no Albion (Thetford, Fort Sterling, etc.)
echo  - Abra o Mercado e navegue pelas ordens de compra/venda.
echo  - O servidor na nuvem atualizara os precos automaticamente!
echo.
echo Para encerrar, feche esta janela.
echo ===================================================================
echo.

:reader_loop
.\albiondata-client.exe -i "!INGEST_URL!"
if errorlevel 1 (
    echo [AVISO] O leitor encerrou inesperadamente. Reiniciando em 2 segundos...
    timeout /t 2 /nobreak >nul
    goto :reader_loop
)
pause
exit /b 0
