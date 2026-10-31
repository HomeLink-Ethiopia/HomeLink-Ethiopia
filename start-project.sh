#!/bin/bash
echo "===================================================="
echo "Starting HomeLink Ethiopia Full-Stack Environment"
echo "===================================================="

trap 'kill $(jobs -p) 2>/dev/null' EXIT

echo ""
echo "[1/3] Starting Express Backend (Port 5000)..."
(cd backend && npm install && npm start) &

echo ""
echo "[2/3] Starting AI FastAPI Backend (Port 8000)..."
(cd ai && python3 -m uvicorn main:app --reload --host 127.0.0.1 --port 8000) &

echo ""
echo "[3/3] Starting Next.js Frontend (Port 3000)..."
npm install && npm run dev &

echo ""
echo "Boot sequence initiated!"
echo "- Express Backend: http://localhost:5000"
echo "- AI Engine: http://localhost:8000"
echo "- Next.js Frontend: http://localhost:3000"
echo ""

wait
