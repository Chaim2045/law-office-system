@echo off
REM ========================================
REM Firestore Backup Runner
REM הפעלת גיבוי Firestore
REM ========================================

echo.
echo ========================================
echo   Firestore Backup System
echo ========================================
echo.

REM Change to project directory
cd /d "%~dp0.."

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

REM Check if firebase-admin is installed
if not exist "node_modules\firebase-admin" (
    echo Installing firebase-admin...
    call npm install firebase-admin
)

REM Run backup script
echo Running backup...
node scripts/backup-firestore-simple.js

REM Check if backup succeeded
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   Backup completed successfully!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo   Backup FAILED!
    echo ========================================
)

echo.
pause
