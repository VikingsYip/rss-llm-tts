@echo off
chcp 65001 >nul
title RSS系统 - 优化启动 (8GB内存)

echo ========================================
echo RSS系统 - 优化启动配置
echo ========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到Node.js，请先安装Node.js
    pause
    exit /b 1
)

:: 显示优化配置
echo 优化启动配置:
echo   - 堆内存限制: 8GB
echo   - 垃圾回收: 启用
echo   - 内存优化: 启用
echo   - 半空间大小: 512MB
echo.

:: 启动后端服务（优化配置）
echo 启动后端服务 (端口: 3001)...
cd backend

:: 使用优化的启动参数
start "RSS系统后端-优化版" cmd /k "npm run dev"

echo.
echo ========================================
echo 优化启动完成！
echo ========================================
echo 前端地址: http://localhost:3000
echo 后端地址: http://localhost:3001
echo 内存状态: http://localhost:3001/api/memory
echo 健康检查: http://localhost:3001/health
echo.
echo 按任意键退出...
pause >nul 