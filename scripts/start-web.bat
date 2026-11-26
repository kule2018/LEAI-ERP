@echo off
cd /d "%~dp0.."
pnpm --filter @leaierp/web dev > logs\vite.out.log 2> logs\vite.err.log
