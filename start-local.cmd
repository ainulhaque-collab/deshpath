@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto bundled
node server.mjs
goto finish
:bundled
set "taskNode=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if not exist "%taskNode%" goto missing
"%taskNode%" server.mjs
goto finish
:missing
echo Please install Node.js 18 or newer from https://nodejs.org/
:finish
pause
