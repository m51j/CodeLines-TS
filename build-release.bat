@echo off
setlocal EnableExtensions DisableDelayedExpansion
title CodeLines - Build Release

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
if not exist "node_modules\.bin\electron-builder.cmd" goto :install
if not exist "node_modules\electron\dist\electron.exe" goto :install
goto :build

:install
echo Installing project dependencies...
call npm ci
if errorlevel 1 goto :error

:build
echo Building the Windows installer and portable application...
set "ELECTRON_RUN_AS_NODE="
call npm run package
if errorlevel 1 goto :error

echo.
echo Release build completed successfully.
echo Output folder: "%CD%\release"
popd
pause
exit /b 0

:error
echo.
echo Release build failed. See the error above.
popd
pause
exit /b 1
