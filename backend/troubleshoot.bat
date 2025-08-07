@echo off
echo ========================================
echo RSS-LLM-TTS 故障排除工具
echo ========================================
echo.

echo 请选择要执行的检查:
echo 1. 检查数据库连接
echo 2. 检查内存使用情况
echo 3. 检查环境变量配置
echo 4. 检查RSS服务状态
echo 5. 测试批量更新RSS源功能
echo 6. 运行所有检查
echo 7. 退出
echo.

set /p choice=请输入选项 (1-7): 

if "%choice%"=="1" goto check_db
if "%choice%"=="2" goto check_memory
if "%choice%"=="3" goto check_env
if "%choice%"=="4" goto check_rss
if "%choice%"=="5" goto test_batch_update
if "%choice%"=="6" goto check_all
if "%choice%"=="7" goto exit
goto invalid

:check_db
echo.
echo 正在检查数据库连接...
node db-check.js
goto end

:check_memory
echo.
echo 正在检查内存使用情况...
node memory-monitor.js
goto end

:check_env
echo.
echo 正在检查环境变量配置...
echo.
echo 当前环境变量:
echo DB_HOST: %DB_HOST%
echo DB_PORT: %DB_PORT%
echo DB_NAME: %DB_NAME%
echo DB_USER: %DB_USER%
echo DB_PASSWORD: %DB_PASSWORD%
echo NODE_ENV: %NODE_ENV%
echo.
echo 如果环境变量为空，请检查 .env 文件是否存在并正确配置
goto end

:check_rss
echo.
echo 正在检查RSS服务状态...
node check-rss-status.js
goto end

:test_batch_update
echo.
echo 正在测试批量更新RSS源功能...
node test-batch-update.js
goto end

:check_all
echo.
echo 正在运行所有检查...
echo.
echo 1. 检查数据库连接...
node db-check.js
echo.
echo 2. 检查内存使用情况...
node memory-monitor.js
echo.
echo 3. 检查环境变量配置...
echo DB_HOST: %DB_HOST%
echo DB_PORT: %DB_PORT%
echo DB_NAME: %DB_NAME%
echo DB_USER: %DB_USER%
echo DB_PASSWORD: %DB_PASSWORD%
echo NODE_ENV: %NODE_ENV%
echo.
echo 4. 检查RSS服务状态...
node check-rss-status.js
echo.
echo 5. 测试批量更新RSS源功能...
node test-batch-update.js
goto end

:invalid
echo 无效选项，请重新选择
goto end

:end
echo.
echo 检查完成！
echo.
pause

:exit
echo 退出故障排除工具 