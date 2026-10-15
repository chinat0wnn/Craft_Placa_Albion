@echo off
setlocal EnableDelayedExpansion
title Albion Craft + Leitor de Mercado em Tempo Real
cd /d "%~dp0"

echo ===================================================================
echo             ALBION CRAFT - LEITOR EM TEMPO REAL
echo ===================================================================
echo.

:: 1. Verifica se o executavel do leitor existe, senao baixa automaticamente
if not exist "%~dp0albiondata-client.exe" (
    echo [AVISO] albiondata-client.exe nao encontrado localmente.
    echo Baixando leitor oficial do Albion Data Project (v0.1.61)...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $url = 'https://github.com/ao-data/albiondata-client/releases/download/v0.1.61/update-windows-amd64.exe.gz'; $gz = 'albiondata-client.exe.gz'; Invoke-WebRequest -Uri $url -OutFile $gz; $in = New-Object System.IO.FileStream($gz, [System.IO.FileMode]::Open); $out = New-Object System.IO.FileStream('albiondata-client.exe', [System.IO.FileMode]::Create); $gzs = New-Object System.IO.Compression.GZipStream($in, [System.IO.Compression.CompressionMode]::Decompress); $gzs.CopyTo($out); $gzs.Close(); $out.Close(); $in.Close(); Remove-Item $gz"
    if not exist "%~dp0albiondata-client.exe" (
        echo [ERRO] Falha no download automatico. Verifique sua conexao com a internet.
        pause
        exit /b
    )
    echo [OK] Leitor baixado com sucesso!
    echo.
)

:: 2. Verifica se o driver Npcap / WinPcap esta instalado
set "NPCAP_FOUND=0"
if exist "%WINDIR%\System32\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\System32\Npcap\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\SysWOW64\wpcap.dll" set "NPCAP_FOUND=1"
if exist "%WINDIR%\SysWOW64\Npcap\wpcap.dll" set "NPCAP_FOUND=1"

if "%NPCAP_FOUND%"=="0" (
    echo [AVISO] Driver Npcap nao encontrado!
    echo.
    echo O Npcap e necessario para ler os pacotes de rede do jogo
    echo de forma 100%% segura e passiva (sem injecao de memoria).
    echo.
    echo Passo a passo para instalar (rapido e gratuito):
    echo  1. Baixe o instalador em: https://npcap.com/#download
    echo  2. Na instalacao, certifique-se de marcar:
    echo     [X] "Install Npcap in WinPcap API-compatible Mode"
    echo.
    set /p OPEN_NPCAP="Deseja abrir a pagina de download do Npcap agora? (S/N): "
    if /i "!OPEN_NPCAP!"=="S" (
        start https://npcap.com/#download
    )
    echo.
    set /p RUN_SITE_ONLY="Deseja iniciar apenas o site (sem leitor de pacotes)? (S/N): "
    if /i "!RUN_SITE_ONLY!"=="S" (
        goto :start_site_only
    )
    echo.
    echo Pressione qualquer tecla para sair...
    pause >nul
    exit /b
)

:: 3. Inicia servidor web local em segundo plano
echo [1/2] Iniciando servidor web do Albion Craft...
start "Albion Craft - Servidor Web" /min python site\server.py

timeout /t 2 /nobreak >nul

:: 4. Inicia o leitor de mercado
echo [2/2] Iniciando leitor de mercado (albiondata-client)...
echo.
echo ===================================================================
echo LEITOR ATIVO!
echo  - Va ate o mercado em qualquer cidade no Albion (Thetford, Fort Sterling, etc.)
echo  - Abra o Mercado e navegue pelas ordens de compra/venda.
echo  - O site http://127.0.0.1:8765 atualizara os precos automaticamente!
echo.
echo Para fechar tudo, basta fechar esta janela.
echo ===================================================================
echo.

.\albiondata-client.exe -i "http://127.0.0.1:8765/api/ingest"

pause
exit /b

:start_site_only
echo.
echo Iniciando apenas o site...
cd /d "%~dp0site"
python server.py
pause
exit /b
