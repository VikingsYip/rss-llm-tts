@echo off
echo 构建RSS聚合新闻系统 - 桌面版 (使用Yarn)
echo.

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Node.js，请先安装Node.js
    pause
    exit /b 1
)

REM 检查Yarn是否安装
yarn --version >nul 2>&1
if errorlevel 1 (
    echo 警告: 未找到Yarn，正在安装Yarn...
    npm install -g yarn
    if errorlevel 1 (
        echo 错误: Yarn安装失败，请手动安装: npm install -g yarn
        pause
        exit /b 1
    )
)

REM 检查是否在正确的目录
if not exist "package.json" (
    echo 错误: 请在electron目录下运行此脚本
    pause
    exit /b 1
)

REM 配置Yarn使用国内镜像
echo 配置Yarn镜像源...
yarn config set registry https://registry.npmmirror.com
yarn config set network-timeout 300000

REM 清理缓存
echo 清理Yarn缓存...
yarn cache clean

echo.
echo 安装依赖 (使用Yarn)...
yarn install --network-timeout 300000
if errorlevel 1 (
    echo 错误: 依赖安装失败
    echo 尝试使用离线模式...
    yarn install --offline
    if errorlevel 1 (
        echo 错误: 依赖安装失败，请检查网络连接
        pause
        exit /b 1
    )
)

echo.
echo 构建前端应用...
cd ../frontend
if exist "package.json" (
    echo 安装前端依赖...
    yarn install --network-timeout 300000
    if errorlevel 1 (
        echo 警告: 前端依赖安装失败，尝试继续构建...
    )
    echo 构建前端...
    yarn build
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
yarn dist:win
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