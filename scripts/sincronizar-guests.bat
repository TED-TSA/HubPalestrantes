@echo off
cd /d "%~dp0.."
npm run sincronizar-guests >> logs\guests-sync.log 2>&1
