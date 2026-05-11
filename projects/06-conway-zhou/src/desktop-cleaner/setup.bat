@echo off
cd /d "%~dp0"
echo Installing Desktop Cleaner dependencies...
pip install -r requirements.txt
echo.
echo Setup complete! You can now run run.bat to launch the app.
pause
