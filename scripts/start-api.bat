@echo off
cd /d "%~dp0.."
node apps\server\dist\main.js > logs\server.out.log 2> logs\server.err.log
