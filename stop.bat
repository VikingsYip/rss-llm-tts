@echo off
chcp 65001 >nul
title 停止RSS系统服务

echo ========================================
echo 停止RSS聚合新闻+LLM对话生成+语音合成系统
echo ========================================
echo.

:: 停止Node.js进程
echo 正在停止Node.js进程...
taskkill /f /im node.exe >nul 2>&1
if errorlevel 1 (
    echo 没有找到运行中的Node.js进程
) else (
    echo Node.js进程已停止
)

:: 停止特定端口的进程
echo 正在停止端口3000和3001的进程...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do taskkill /f /pid %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001') do taskkill /f /pid %%a >nul 2>&1

echo.
echo 所有服务已停止！
echo.
pause 