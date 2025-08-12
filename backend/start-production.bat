@echo off
chcp 65001 >nul
title RSS系统 - 生产环境启动

echo ========================================
echo RSS系统 - 生产环境启动配置
echo ========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到Node.js，请先安装Node.js
    pause
    exit /b 1
)

:: 显示生产环境配置
echo 生产环境启动配置:
echo   - 堆内存限制: 8GB
echo   - 垃圾回收: 启用
echo   - 内存优化: 启用
echo   - 半空间大小: 512MB
echo   - 生产模式: 启用
echo.

:: 设置环境变量
set NODE_ENV=production
set MAX_OLD_SPACE_SIZE=8192
set OPTIMIZE_FOR_SIZE=true

:: 启动后端服务（生产环境配置）
echo 启动后端服务 (端口: 3001)...
cd backend

:: 使用生产环境启动参数
start "RSS系统后端-生产版" cmd /k "npm start"

echo.
echo ========================================
echo 生产环境启动完成！
echo ========================================
echo 后端地址: http://localhost:3001
echo 内存状态: http://localhost:3001/api/memory
echo 健康检查: http://localhost:3001/health
echo.
echo 按任意键退出...
pause >nul 