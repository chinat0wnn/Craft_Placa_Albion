@echo off
setlocal EnableDelayedExpansion
title Albion Craft - Leitor de Mercado em Tempo Real
cd /d "%~dp0"

echo ===================================================================
echo             ALBION CRAFT - LEITOR EM TEMPO REAL
echo ===================================================================
echo.

:: 1. Verifica se o executavel do leitor existe, senao baixa automaticamente
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

:: 2. Verifica se o driver Npcap / WinPcap esta instalado
set "NPCAP_FOUND=0"
if exist "%WINDIR%\System32\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\System32\Npcap\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\SysWOW64\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\SysWOW64\Npcap\wpcap.dll" set "NPCAP_FOUND=1"

if "%NPCAP_FOUND%"=="1" goto :npcap_ok

echo [AVISO] Driver Npcap nao encontrado!
echo.
echo O Npcap e necessario para ler os pacotes de rede do jogo
echo de forma 100%% segura e passiva (sem injecao de memoria).
echo.
echo Passo a passo para instalar (rapido e gratuito):
echo   1. Baixe o instalador em: https://npcap.com/#download
echo   2. Na instalacao, certifique-se de marcar:
echo      [X] "Install Npcap in WinPcap API-compatible Mode"
echo.
set /p OPEN_NPCAP="Deseja abrir a pagina de download do Npcap agora? [S/N]: "
if /i "!OPEN_NPCAP!"=="S" (
    start https://npcap.com/#download
)
echo.
echo Apos instalar o Npcap, execute este arquivo novamente.
pause
exit /b 0

:npcap_ok

:: 3. Verifica se o servidor web ja esta rodando na porta 8765
powershell -Command "if (!(Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue)) { exit 1 }" >nul 2>&1
if not errorlevel 1 (
    echo [OK] Servidor web detectado e ativo na porta 8765.
    goto :start_reader
)

echo [AVISO] O servidor web local nao foi detectado na porta 8765.
echo.
set /p START_SERVER="Deseja iniciar o servidor web agora em segundo plano? [S/N]: "
if /i "!START_SERVER!"=="S" (
    echo Iniciando servidor web...
    start "Albion Craft - Servidor Web" /min python site\server.py
    timeout /t 2 /nobreak >nul
) else (
    echo [INFO] Continuando. Lembre-se de abrir o Iniciar_Site.bat para ver os precos no navegador.
)

:start_reader
echo.
echo ===================================================================
echo LEITOR ATIVO!
echo  - Va ate o mercado em qualquer cidade no Albion (Thetford, Fort Sterling, etc.)
echo  - Abra o Mercado e navegue pelas ordens de compra/venda.
echo  - O site http://127.0.0.1:8765 atualizara os precos automaticamente!
echo.
echo Para fechar o leitor, basta fechar esta janela.
echo ===================================================================
echo.

:reader_loop
.\albiondata-client.exe -i "http://127.0.0.1:8765/api/ingest"
if errorlevel 1 (
    echo [AVISO] O leitor encerrou inesperadamente. Reiniciando em 2 segundos...
    timeout /t 2 /nobreak >nul
    goto :reader_loop
)
pause
exit /b 0
