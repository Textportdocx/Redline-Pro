@echo off
title Redline Pro - Engineering Drawing & CAM Compare
cd /d "%~dp0"
if exist "dist\win-unpacked\Redline Pro.exe" (
  start "" "dist\win-unpacked\Redline Pro.exe" %*
) else (
  call npx electron . %*
)
