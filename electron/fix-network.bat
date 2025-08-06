@echo off
echo RSS聚合新闻系统 - 网络故障排除工具
echo ======================================
echo.

echo 1. 检查网络连接...
ping -n 1 registry.npmjs.org >nul 2>&1
if errorlevel 1 (
    echo 警告: 无法连接到npm官方源
    echo 将使用国内镜像源...
    npm config set registry https://registry.npmmirror.com
) else (
    echo 网络连接正常
)

echo.
echo 2. 配置npm网络设置...
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set timeout 60000
npm config set strict-ssl false

echo.
echo 3. 清理npm缓存...
npm cache clean --force

echo.
echo 4. 检查当前npm配置...
echo 当前npm源: 
npm config get registry
echo.
echo 超时设置:
npm config get timeout
echo.
echo 重试次数:
npm config get fetch-retries

echo.
echo 5. 测试网络下载...
echo 正在测试下载一个小包...
npm install --no-save chalk@4.1.2
if errorlevel 1 (
    echo 网络测试失败，建议:
    echo - 检查防火墙设置
    echo - 尝试使用VPN
    echo - 检查代理设置
    echo - 稍后重试
) else (
    echo 网络测试成功！
    npm uninstall chalk
)

echo.
echo 网络故障排除完成！
echo 如果问题仍然存在，请尝试:
echo 1. 使用代理: npm config set proxy http://proxy-server:port
echo 2. 使用VPN
echo 3. 更换DNS服务器
echo 4. 检查防火墙设置
echo.
pause 