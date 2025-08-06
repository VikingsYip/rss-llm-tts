@echo off
chcp 65001 >nul
title 重启RSS系统服务

echo ========================================
echo 重启RSS聚合新闻+LLM对话生成+语音合成系统
echo ========================================
echo.

echo 正在停止现有服务...
call stop.bat

echo.
echo 等待3秒后重新启动服务...
timeout /t 3 /nobreak >nul

echo.
echo 正在重新启动服务...
call start.bat 