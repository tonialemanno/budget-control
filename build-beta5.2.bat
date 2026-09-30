@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-beta5.2.ps1"
if errorlevel 1 (
  echo.
  echo FEHLER: Beta 5.2 konnte nicht gebaut werden.
  pause
  exit /b 1
)
echo.
echo Beta 5.2 wurde erfolgreich erstellt.
pause
