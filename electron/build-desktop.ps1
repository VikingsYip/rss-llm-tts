# RSS聚合新闻系统 - 桌面版构建脚本 (PowerShell版本)
Write-Host "构建RSS聚合新闻系统 - 桌面版" -ForegroundColor Green
Write-Host ""

# 检查Node.js是否安装
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 未找到Node.js，请先安装Node.js" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}
Write-Host "Node.js版本: $nodeVersion" -ForegroundColor Green

# 检查是否在正确的目录
if (-not (Test-Path "package.json")) {
    Write-Host "错误: 请在electron目录下运行此脚本" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}

# 配置npm网络设置
Write-Host "配置npm网络设置..." -ForegroundColor Yellow
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

# 清理缓存
Write-Host "清理npm缓存..." -ForegroundColor Yellow
npm cache clean --force

Write-Host ""
Write-Host "安装依赖 (带重试机制)..." -ForegroundColor Yellow
$retryCount = 0
$maxRetries = 3

do {
    $retryCount++
    Write-Host "尝试安装依赖 (第$retryCount次)..." -ForegroundColor Cyan
    
    npm install --omit=optional
    if ($LASTEXITCODE -eq 0) {
        Write-Host "依赖安装成功！" -ForegroundColor Green
        break
    } else {
        if ($retryCount -lt $maxRetries) {
            Write-Host "安装失败，等待10秒后重试..." -ForegroundColor Yellow
            Start-Sleep -Seconds 10
        } else {
            Write-Host "错误: 依赖安装失败，请检查网络连接" -ForegroundColor Red
            Write-Host "建议: 使用代理或VPN，或者稍后重试" -ForegroundColor Yellow
            Read-Host "按任意键退出"
            exit 1
        }
    }
} while ($retryCount -lt $maxRetries)

Write-Host ""
Write-Host "构建前端应用..." -ForegroundColor Yellow
Set-Location "../frontend"

if (Test-Path "package.json") {
    Write-Host "安装前端依赖..." -ForegroundColor Cyan
    npm install --omit=optional
    if ($LASTEXITCODE -ne 0) {
        Write-Host "警告: 前端依赖安装失败，尝试继续构建..." -ForegroundColor Yellow
    }
    
    Write-Host "构建前端..." -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "错误: 前端构建失败" -ForegroundColor Red
        Set-Location "../electron"
        Read-Host "按任意键退出"
        exit 1
    }
} else {
    Write-Host "警告: 未找到前端package.json，跳过前端构建" -ForegroundColor Yellow
}

Set-Location "../electron"

Write-Host ""
Write-Host "构建桌面应用..." -ForegroundColor Yellow
npm run dist:win
if ($LASTEXITCODE -ne 0) {
    Write-Host "错误: 桌面应用构建失败" -ForegroundColor Red
    Write-Host "请检查:" -ForegroundColor Yellow
    Write-Host "1. 网络连接是否稳定" -ForegroundColor Yellow
    Write-Host "2. 是否有足够的磁盘空间" -ForegroundColor Yellow
    Write-Host "3. 防火墙是否阻止了下载" -ForegroundColor Yellow
    Read-Host "按任意键退出"
    exit 1
}

Write-Host ""
Write-Host "构建完成！" -ForegroundColor Green
Write-Host "安装包位置: dist/" -ForegroundColor Green
Write-Host ""

Read-Host "按任意键退出" 