@echo off
chcp 65001 >nul
echo Building RSS News System - Desktop Version
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo Error: Node.js not found, please install Node.js first
    pause
    exit /b 1
)

REM Check if in correct directory
if not exist "package.json" (
    echo Error: Please run this script in the electron directory
    pause
    exit /b 1
)

REM Configure npm for better network connection
echo Configuring npm network settings...
npm config set registry https://registry.npmmirror.com
npm config set fetch-retries 5
npm config set fetch-retry-mintimeout 20000
npm config set fetch-retry-maxtimeout 120000
npm config set electron_mirror https://npmmirror.com/mirrors/electron/

REM Clean cache
echo Cleaning npm cache...
npm cache clean --force

echo.
echo Installing dependencies (with retry mechanism)...
set /a retry_count=0
:install_retry
npm install --omit=optional
if errorlevel 1 (
    set /a retry_count+=1
    if %retry_count% lss 3 (
        echo Installation failed, retrying (%retry_count%/3)...
        timeout /t 10 /nobreak >nul
        goto install_retry
    ) else (
        echo Error: Dependency installation failed, please check network connection
        echo Suggestion: Use proxy or VPN, or try again later
        pause
        exit /b 1
    )
)

echo.
echo Building frontend application...
cd ../frontend
if exist "package.json" (
    echo Installing frontend dependencies...
    npm install --omit=optional
    if errorlevel 1 (
        echo Warning: Frontend dependency installation failed, trying to continue...
    )
    echo Building frontend...
    npm run build
    if errorlevel 1 (
        echo Error: Frontend build failed
        cd ../electron
        pause
        exit /b 1
    )
) else (
    echo Warning: Frontend package.json not found, skipping frontend build
)
cd ../electron

echo.
echo Building desktop application...
npm run dist:win
if errorlevel 1 (
    echo Error: Desktop application build failed
    echo Please check:
    echo 1. Network connection is stable
    echo 2. Sufficient disk space
    echo 3. Firewall is not blocking downloads
    pause
    exit /b 1
)

echo.
echo Build completed!
echo Installer location: dist/
echo.

pause 