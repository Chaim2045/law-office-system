@echo off
REM ========================================
REM Setup Windows Task Scheduler for Daily Backups
REM הגדרת גיבוי יומי אוטומטי
REM ========================================

echo.
echo ========================================
echo   Setup Automatic Daily Backups
echo ========================================
echo.

REM Get current directory
set "SCRIPT_DIR=%~dp0"
set "PROJECT_DIR=%SCRIPT_DIR%.."
set "BACKUP_SCRIPT=%SCRIPT_DIR%run-backup.bat"

echo Project Directory: %PROJECT_DIR%
echo Backup Script: %BACKUP_SCRIPT%
echo.

REM Check if running as administrator
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: This script must be run as Administrator!
    echo.
    echo Please:
    echo 1. Right-click this file
    echo 2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Creating scheduled task for daily backups...
echo.

REM Delete existing task if exists
schtasks /delete /tn "Firestore Daily Backup" /f >nul 2>&1

REM Create new scheduled task
REM Runs daily at 2:00 AM
schtasks /create ^
    /tn "Firestore Daily Backup" ^
    /tr "\"%BACKUP_SCRIPT%\"" ^
    /sc daily ^
    /st 02:00 ^
    /ru "%USERNAME%" ^
    /rl highest ^
    /f

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo   SUCCESS!
    echo ========================================
    echo.
    echo Automatic daily backup has been configured!
    echo.
    echo Schedule: Every day at 2:00 AM
    echo Task Name: "Firestore Daily Backup"
    echo.
    echo To manage the task:
    echo 1. Open "Task Scheduler" (search in Windows)
    echo 2. Find "Firestore Daily Backup"
    echo.
    echo To test now, run: run-backup.bat
    echo.
) else (
    echo.
    echo ========================================
    echo   FAILED!
    echo ========================================
    echo.
    echo Failed to create scheduled task.
    echo Please check Windows Task Scheduler manually.
    echo.
)

pause
