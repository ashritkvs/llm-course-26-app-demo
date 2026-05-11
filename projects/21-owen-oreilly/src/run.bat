@echo off
setlocal
title Project Demo Runner

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Error: Python is not installed or not in PATH.
    pause
    exit /b
)

:: 2. Create Virtual Environment if it doesn't exist
if not exist "venv" (
    echo [1/3] Creating virtual environment...
    python -m venv venv
)

:: 3. Install/Update dependencies
echo [2/3] Preparing dependencies...
call venv\Scripts\activate
python -m pip install --upgrade pip >nul
pip install -r requirements.txt >nul

:: 4. Run the application
echo [3/3] Starting server...
echo.
echo The demo will open in your browser shortly.
echo Press Ctrl+C in this window to shut down the server.
echo.
python backend.py

pause