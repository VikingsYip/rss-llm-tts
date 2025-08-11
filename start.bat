@echo off
chcp 65001 >nul
title RSS聚合新闻+LLM对话生成+语音合成系统

echo ========================================
echo RSS聚合新闻+LLM对话生成+语音合成系统
echo ========================================
echo.

:: 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未检测到Node.js，请先安装Node.js
    pause
    exit /b 1
)

:: 检查MySQL是否运行
echo 检查MySQL服务状态...
net start | findstr /i "mysql" >nul
if errorlevel 1 (
    echo 警告: MySQL服务可能未启动，请确保MySQL服务正在运行
    echo.
)

:: 创建必要的目录
if not exist "backend\uploads" mkdir "backend\uploads"
if not exist "backend\logs" mkdir "backend\logs"

:: 检查环境配置文件
if not exist "backend\.env" (
    echo 警告: 未找到backend\.env文件，将使用env.example作为模板
    copy "backend\env.example" "backend\.env"
    echo 请编辑backend\.env文件，配置数据库和API密钥
    echo.
)

:: 安装后端依赖
echo 正在安装后端依赖...
cd backend
if not exist "node_modules" (
    npm install
    if errorlevel 1 (
        echo 错误: 后端依赖安装失败
        pause
        exit /b 1
    )
)
cd ..

:: 安装前端依赖
echo 正在安装前端依赖...
cd frontend
if not exist "node_modules" (
    npm install
    if errorlevel 1 (
        echo 错误: 前端依赖安装失败
        pause
        exit /b 1
    )
)
cd ..

echo.
echo 依赖安装完成，正在启动服务...
echo.

:: 启动后端服务
echo 启动后端服务 (端口: 3001)...
start "RSS系统后端" cmd /k "cd backend && npm run dev  --max-old-space-size=4096"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 启动前端服务
echo 启动前端服务 (端口: 3000)...
start "RSS系统前端" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0 --port 3000"

echo.
echo ========================================
echo 服务启动完成！
echo ========================================
echo 前端地址: http://localhost:3000
echo 后端地址: http://localhost:3001
echo 健康检查: http://localhost:3001/health
echo.
echo 按任意键退出...
pause >nul 