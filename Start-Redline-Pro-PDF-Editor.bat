@echo off
title Redline Pro PDF Editor - Enterprise PDF Markup & Editing Studio
cd /d "%~dp0"
if exist "dist\win-unpacked\Redline Pro PDF Editor.exe" (
  start "" "dist\win-unpacked\Redline Pro PDF Editor.exe" %*
) else (
  call npx electron . --pdf-editor %*
)
