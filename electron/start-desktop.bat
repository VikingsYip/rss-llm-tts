@echo off
echo 启动RSS聚合新闻系统 - 桌面版
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查是否在正确的目录
if not exist "package.json" (
    echo 错误: 请在electron目录下运行此脚本
    pause
    exit /b 1
)

echo 安装依赖...
npm install

echo.
echo 启动开发模式...
echo 前端服务将运行在: http://localhost:3000
echo 桌面应用将自动打开
echo.

REM 设置开发环境变量
set NODE_ENV=development

REM 启动开发模式
npm run dev

pause 