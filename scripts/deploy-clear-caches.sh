#!/bin/bash

# Deployment Cache Clearing Script
# Run this script before every deployment to ensure fresh code

echo "🧹 DEPLOYMENT: Clearing ALL caches..."
echo ""

# 1. Clear Next.js build cache
echo "1. Clearing Next.js build cache (.next)..."
rm -rf .next
echo "   ✅ .next cache cleared"

# 2. Clear Node modules cache (optional, uncomment if needed)
# echo "2. Clearing node_modules cache..."
# rm -rf node_modules/.cache
# echo "   ✅ node_modules cache cleared"

# 3. Clear TypeScript build cache
echo "2. Clearing TypeScript cache..."
rm -rf .tsbuildinfo
echo "   ✅ TypeScript cache cleared"

# 4. Clear logo cache (if any cached logo files exist)
echo "3. Checking for cached logo files..."
if [ -f ".yak/cached-logo.jpg" ]; then
    rm -f .yak/cached-logo.jpg
    echo "   ✅ Cached logo files cleared"
else
    echo "   ℹ️  No cached logo files found"
fi

# 5. Clear any temporary build artifacts
echo "4. Clearing temporary build artifacts..."
rm -rf dist out build
echo "   ✅ Build artifacts cleared"

# 6. Re-run the logo fix script to ensure template is up to date
echo "5. Re-fixing template logo..."
if [ -f ".yak/fix-template-logo.js" ]; then
    cd .yak && node fix-template-logo.js && cd ..
    echo "   ✅ Template logo verified/fixed"
else
    echo "   ⚠️  Logo fix script not found"
fi

echo ""
echo "✅ ALL CACHES CLEARED - Safe to deploy"
echo "   Next steps:"
echo "   1. Run 'pnpm run build' to create fresh build"
echo "   2. Restart the server"
echo "   3. Verify PPTX generation works correctly"
echo ""
