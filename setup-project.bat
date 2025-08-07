@echo off
echo ========================================
echo RSS-LLM-TTS 项目设置脚本
echo ========================================
echo.

echo 1. 安装前端依赖...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 前端依赖安装成功
echo.

echo 2. 安装后端依赖...
cd ..\backend
call npm install
if %errorlevel% neq 0 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装成功
echo.

echo 3. 返回项目根目录...
cd ..
echo ✅ 项目设置完成！
echo.
echo 下一步操作：
echo 1. 启动后端服务: cd backend && npm start
echo 2. 启动前端服务: cd frontend && npm start
echo.
pause 