@echo off
title DevDash Launcher
color 0B
echo ===================================================
echo             DEVDASH PROJECT MANAGER
echo ===================================================
echo.
echo Starting Backend Server...
start "DevDash Backend (Port 4000)" cmd /k "cd backend && npm start"

echo Starting Frontend Server...
start "DevDash Frontend (Port 5173)" cmd /k "cd frontend && npm run dev"

echo.
echo Servers are launching in separate windows!
echo - Backend API is running on http://localhost:4000
echo - Frontend UI is running on http://localhost:5173
echo.
echo Once the frontend window says "ready", open your browser
echo to http://localhost:5173 to use DevDash.
echo.
echo Close the popup windows to stop the servers.
echo Press any key to exit this launcher.
pause >nul
