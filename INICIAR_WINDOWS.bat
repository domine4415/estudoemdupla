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
node server.js --open
pause
