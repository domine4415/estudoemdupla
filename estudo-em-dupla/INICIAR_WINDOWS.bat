@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo O Node.js nao esta instalado. Instale em https://nodejs.org/ e tente novamente.
  pause
  exit /b 1
)
echo Iniciando servidor...
echo Deixe esta janela aberta!
if exist ".env" (
  node --env-file=.env server.js --open
) else (
  echo Arquivo .env nao encontrado. Iniciando sem as configuracoes locais do Supabase.
  node server.js --open
)
pause
