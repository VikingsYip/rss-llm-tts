@echo off
echo 构建RSS聚合新闻系统 - 桌面版
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

REM 设置npm配置以改善网络连接
echo 配置npm网络设置...
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set timeout 60000

REM 清理缓存
echo 清理npm缓存...
npm cache clean --force

echo.
echo 安装依赖 (带重试机制)...
set /a retry_count=0
:install_retry
npm install --no-optional
if errorlevel 1 (
    set /a retry_count+=1
    if %retry_count% lss 3 (
        echo 安装失败，正在重试 (%retry_count%/3)...
        timeout /t 10 /nobreak >nul
        goto install_retry
    ) else (
        echo 错误: 依赖安装失败，请检查网络连接或尝试使用代理
        echo 建议: 使用代理或VPN，或者稍后重试
        pause
        exit /b 1
    )
)

echo.
echo 构建前端应用...
cd ../frontend
if exist "package.json" (
    echo 安装前端依赖...
    npm install --no-optional
    if errorlevel 1 (
        echo 警告: 前端依赖安装失败，尝试继续构建...
    )
    echo 构建前端...
    npm run build
    if errorlevel 1 (
        echo 错误: 前端构建失败
        cd ../electron
        pause
        exit /b 1
    )
) else (
    echo 警告: 未找到前端package.json，跳过前端构建
)
cd ../electron

echo.
echo 构建桌面应用...
npm run dist:win
if errorlevel 1 (
    echo 错误: 桌面应用构建失败
    echo 请检查:
    echo 1. 网络连接是否稳定
    echo 2. 是否有足够的磁盘空间
    echo 3. 防火墙是否阻止了下载
    pause
    exit /b 1
)

echo.
echo 构建完成！
echo 安装包位置: dist/
echo.

pause 