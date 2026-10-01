@echo off
echo ====================================================
echo Starting HomeLink Ethiopia Full-Stack Environment
echo ====================================================

echo.
echo [1/3] Starting Express Backend (Port 5000)...
start cmd /k "cd backend && npm install && npm start"

echo.
echo [2/3] Starting AI FastAPI Backend (Port 8000)...
start cmd /k "cd ai && (call conda activate base || echo Conda not found, proceeding) && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo.
echo [3/3] Starting Next.js Frontend (Port 3000)...
start cmd /k "npm install && npm run dev"

echo.
echo Boot sequence initiated!
echo - Express Backend: http://localhost:5000
echo - AI Engine: http://localhost:8000
echo - Next.js Frontend: http://localhost:3000
echo.
pause
