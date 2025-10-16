@echo off
REM Deployment Cache Clearing Script (Windows)
REM Run this script before every deployment to ensure fresh code

echo 🧹 DEPLOYMENT: Clearing ALL caches...
echo.

REM 1. Clear Next.js build cache
echo 1. Clearing Next.js build cache (.next)...
if exist .next rmdir /s /q .next
echo    ✅ .next cache cleared

REM 2. Clear TypeScript build cache
echo 2. Clearing TypeScript cache...
if exist .tsbuildinfo del /q .tsbuildinfo
echo    ✅ TypeScript cache cleared

REM 3. Clear logo cache (if any cached logo files exist)
echo 3. Checking for cached logo files...
if exist .yak\cached-logo.jpg (
    del /q .yak\cached-logo.jpg
    echo    ✅ Cached logo files cleared
) else (
    echo    ℹ️  No cached logo files found
)

REM 4. Clear any temporary build artifacts
echo 4. Clearing temporary build artifacts...
if exist dist rmdir /s /q dist
if exist out rmdir /s /q out
if exist build rmdir /s /q build
echo    ✅ Build artifacts cleared

REM 5. Re-run the logo fix script to ensure template is up to date
echo 5. Re-fixing template logo...
if exist .yak\fix-template-logo.js (
    cd .yak
    node fix-template-logo.js
    cd ..
    echo    ✅ Template logo verified/fixed
) else (
    echo    ⚠️  Logo fix script not found
)

echo.
echo ✅ ALL CACHES CLEARED - Safe to deploy
echo    Next steps:
echo    1. Run 'pnpm run build' to create fresh build
echo    2. Restart the server
echo    3. Verify PPTX generation works correctly
echo.
pause
