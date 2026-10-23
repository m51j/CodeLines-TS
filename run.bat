@echo off
setlocal EnableExtensions DisableDelayedExpansion
title CodeLines

pushd "%~dp0"
if errorlevel 1 (
    echo ERROR: Cannot open the project folder.
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Install Node.js 24 or newer, then try again.
    goto :error
)
node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)"
if errorlevel 1 (
    echo ERROR: Node.js 24 or newer is required.
    goto :error
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm is missing. Reinstall Node.js with npm enabled.
    goto :error
)

if not exist "node_modules\.bin\tsx.cmd" goto :install
if not exist "node_modules\electron\dist\electron.exe" goto :install
goto :run

:install
echo Installing project dependencies...
call npm ci
if errorlevel 1 goto :error

:run
echo Building CodeLines...
call npm run build
if errorlevel 1 goto :error

echo Starting CodeLines...
set "ELECTRON_RUN_AS_NODE="
call npm start
if errorlevel 1 goto :error

popd
exit /b 0

:error
echo.
echo CodeLines could not start. See the error above.
popd
pause
exit /b 1
