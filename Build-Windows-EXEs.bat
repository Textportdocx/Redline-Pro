@echo off
title Redline Pro 1.0.0 - Build Portable & Setup EXEs
echo ============================================================
echo   Redline Pro 1.0.0 - Automated Portable ^& Setup EXE Builder
echo   Redline Studio - textportdocx.in
echo ============================================================
echo.

cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Node.js 18+ is not installed or not in PATH.
  echo Download Node.js LTS from https://nodejs.org/ and run this script again.
  pause
  exit /b 1
)

echo [1/4] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
  echo [ERROR] npm install failed.
  pause
  exit /b 1
)

echo.
echo [2/4] Building unpacked Windows app (dist\win-unpacked)...
call npx electron-builder --win dir --x64
if %errorlevel% neq 0 (
  echo [ERROR] Unpacked build failed.
  pause
  exit /b 1
)

echo.
echo [3/4] Patching icon ^& metadata and packaging RedlinePro-Portable-1.0.0.exe...
call node patch_exe.js "dist\win-unpacked\Redline Pro.exe" build\icon.ico
call npx electron-builder --win portable --prepackaged dist/win-unpacked --x64

echo.
echo [4/4] Building RedlinePro-Setup-1.0.0.exe installer via NSIS...
where makensis >nul 2>nul
if %errorlevel% equ 0 (
  makensis /DSRC="dist\win-unpacked" /DICON="build\icon.ico" /DLIC="LICENSE.txt" /DOUT="dist\RedlinePro-Setup-1.0.0.exe" installer.nsi
) else if exist "C:\Program Files (x86)\NSIS\makensis.exe" (
  "C:\Program Files (x86)\NSIS\makensis.exe" /DSRC="dist\win-unpacked" /DICON="build\icon.ico" /DLIC="LICENSE.txt" /DOUT="dist\RedlinePro-Setup-1.0.0.exe" installer.nsi
) else if exist "C:\Program Files\NSIS\makensis.exe" (
  "C:\Program Files\NSIS\makensis.exe" /DSRC="dist\win-unpacked" /DICON="build\icon.ico" /DLIC="LICENSE.txt" /DOUT="dist\RedlinePro-Setup-1.0.0.exe" installer.nsi
) else (
  echo [NOTE] NSIS (makensis) not found in PATH; using electron-builder NSIS target as fallback...
  call npx electron-builder --win nsis --prepackaged dist/win-unpacked --x64
)

echo.
echo ============================================================
echo   BUILD COMPLETE!
echo   Your EXE files are ready in the "dist" folder:
echo     1. dist\RedlinePro-Portable-1.0.0.exe
echo     2. dist\RedlinePro-Setup-1.0.0.exe
echo ============================================================
explorer dist
pause
