@echo off
REM Start the LiveOverlays server
cd /d "%~dp0"

REM Install dependencies if node_modules is missing
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)

echo Starting LiveOverlays server...
node server.js

REM Keep the window open if the server stops or errors
echo.
echo Server stopped.
pause
