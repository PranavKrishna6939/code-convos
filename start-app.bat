@echo off
echo ==========================================
echo Installing Frontend Dependencies...
echo ==========================================
call npm install

echo ==========================================
echo Installing Backend Dependencies...
echo ==========================================
cd server
call npm install
cd ..

echo ==========================================
echo Starting Frontend and Backend...
echo ==========================================
npx concurrently "npm run dev" "cd server && npm run dev"
