@echo off
chcp 65001 >nul
echo ========================================
echo RSS聚合新闻系统 - 代码清理工具
echo ========================================
echo.

echo 开始清理不必要的文件...

REM 清理前端构建文件
echo 清理前端构建文件...
if exist "frontend\dist" (
    echo   删除 frontend\dist
    rmdir /s /q "frontend\dist"
)

if exist "frontend\node_modules" (
    echo   删除 frontend\node_modules
    rmdir /s /q "frontend\node_modules"
)

if exist "frontend\.vite" (
    echo   删除 frontend\.vite
    rmdir /s /q "frontend\.vite"
)

REM 清理后端构建文件
echo 清理后端构建文件...
if exist "backend\node_modules" (
    echo   删除 backend\node_modules
    rmdir /s /q "backend\node_modules"
)

if exist "backend\logs" (
    echo   删除 backend\logs
    rmdir /s /q "backend\logs"
)

if exist "backend\*.log" (
    echo   删除 backend\*.log
    del /q "backend\*.log"
)

REM 清理Electron构建文件
echo 清理Electron构建文件...
if exist "electron\node_modules" (
    echo   删除 electron\node_modules
    rmdir /s /q "electron\node_modules"
)

if exist "electron\dist" (
    echo   删除 electron\dist
    rmdir /s /q "electron\dist"
)

if exist "electron\build" (
    echo   删除 electron\build
    rmdir /s /q "electron\build"
)

if exist "electron\out" (
    echo   删除 electron\out
    rmdir /s /q "electron\out"
)

REM 清理数据库文件
echo 清理数据库文件...
if exist "backend\*.db" (
    echo   删除 backend\*.db
    del /q "backend\*.db"
)

if exist "backend\*.sqlite" (
    echo   删除 backend\*.sqlite
    del /q "backend\*.sqlite"
)

REM 清理临时文件
echo 清理临时文件...
if exist "*.tmp" (
    echo   删除 *.tmp
    del /q "*.tmp"
)

if exist "*.temp" (
    echo   删除 *.temp
    del /q "*.temp"
)

REM 清理IDE和编辑器文件
echo 清理IDE和编辑器文件...
if exist ".vscode" (
    echo   删除 .vscode
    rmdir /s /q ".vscode"
)

if exist ".idea" (
    echo   删除 .idea
    rmdir /s /q ".idea"
)

if exist "*.swp" (
    echo   删除 *.swp
    del /q "*.swp"
)

if exist "*.swo" (
    echo   删除 *.swo
    del /q "*.swo"
)

if exist "*~" (
    echo   删除 *~
    del /q "*~"
)

REM 清理操作系统生成的文件
echo 清理操作系统生成的文件...
if exist "Thumbs.db" (
    echo   删除 Thumbs.db
    del /q "Thumbs.db"
)

if exist ".DS_Store" (
    echo   删除 .DS_Store
    del /q ".DS_Store"
)

if exist "desktop.ini" (
    echo   删除 desktop.ini
    del /q "desktop.ini"
)

REM 清理测试文件
echo 清理测试文件...
if exist "backend\test-*.js" (
    echo   删除 backend\test-*.js
    del /q "backend\test-*.js"
)

REM 清理环境配置文件
echo 清理环境配置文件...
if exist ".env" (
    echo   删除 .env
    del /q ".env"
)

if exist ".env.local" (
    echo   删除 .env.local
    del /q ".env.local"
)

if exist ".env.production" (
    echo   删除 .env.production
    del /q ".env.production"
)

if exist ".env.development" (
    echo   删除 .env.development
    del /q ".env.development"
)

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
echo 保留的文件和目录：
echo   ✓ 源代码文件 (.js, .jsx, .ts, .tsx, .json, .md)
echo   ✓ 配置文件 (package.json, vite.config.js, etc.)
echo   ✓ 文档文件 (.md, .txt)
echo   ✓ 资源文件 (assets/, public/)
echo   ✓ 数据库迁移文件
echo   ✓ README文件
echo.
echo 已清理的文件和目录：
echo   ✗ node_modules/
echo   ✗ dist/, build/, out/
echo   ✗ .vite/
echo   ✗ logs/
echo   ✗ 数据库文件 (.db, .sqlite)
echo   ✗ 临时文件 (.tmp, .temp)
echo   ✗ IDE配置文件 (.vscode/, .idea/)
echo   ✗ 操作系统文件 (Thumbs.db, .DS_Store)
echo   ✗ 环境配置文件 (.env*)
echo   ✗ 测试文件 (test-*.js)
echo.
echo 现在可以安全地提交到GitHub了！
echo.
pause 