@echo off
chcp 65001 >nul
echo Building RSS News System - Desktop Version (Without Electron)
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

REM Clean cache
echo Cleaning npm cache...
npm cache clean --force

echo.
echo Installing dependencies (excluding electron for now)...
echo Installing electron-builder...
npm install electron-builder@^24.6.4 --save-dev --omit=optional

echo Installing other dependencies...
npm install concurrently@^8.2.2 wait-on@^7.2.0 --save-dev --omit=optional
npm install electron-store@^8.1.0 electron-updater@^6.1.7 --save --omit=optional

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
echo Now you can manually install electron when network is stable:
echo npm install electron@^28.0.0 --save
echo.
echo Or try building with electron-builder directly:
echo npx electron-builder --win --publish=never
echo.

pause 