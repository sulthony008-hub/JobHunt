@echo off
title JobHunter Dashboard
cd /d "%~dp0"

python -c "import socket,sys; s=socket.socket(); s.settimeout(0.4); sys.exit(0 if s.connect_ex(('127.0.0.1',8770))==0 else 1)"
if errorlevel 1 (
  echo Menjalankan JobHunter Dashboard di http://127.0.0.1:8770
  start "JobHunter Server" /min python dashboard\app.py
  timeout /t 2 /nobreak >nul
)
start "" http://127.0.0.1:8770
