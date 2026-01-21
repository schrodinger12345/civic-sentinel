#!/bin/bash

# CivicFix AI - Full Stack Startup Script

echo "🚀 Starting CivicFix AI Full Stack..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env exists in backend
if [ ! -f "backend/.env" ]; then
    echo -e "${RED}❌ Missing backend/.env file${NC}"
    echo ""
    echo "Please create backend/.env with these variables:"
    echo "  - FIREBASE_PROJECT_ID"
    echo "  - FIREBASE_PRIVATE_KEY"
    echo "  - FIREBASE_CLIENT_EMAIL"
    echo "  - GOOGLE_CLOUD_PROJECT"
    echo "  - GOOGLE_CLOUD_LOCATION"
    echo ""
    echo "See SETUP.md for detailed instructions."
    exit 1
fi

# Start frontend
echo -e "${YELLOW}📱 Starting Frontend (React)...${NC}"
npm run dev &
FRONTEND_PID=$!

# Start backend
echo -e "${YELLOW}🔧 Starting Backend (Express + Gemini)...${NC}"
cd backend
npm run dev &
BACKEND_PID=$!
cd ..

echo ""
echo -e "${GREEN}✅ Both servers starting...${NC}"
echo ""
echo "Frontend: http://localhost:8080"
echo "Backend:  http://localhost:5000"
echo "Docs:     http://localhost:5000/api/health"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Handle Ctrl+C
trap "kill $FRONTEND_PID $BACKEND_PID" INT

# Wait for both processes
wait
