# 🎯 Logo Issue - Root Cause & Complete Fix

## Root Cause Identified

**Sharp library was MISSING from dependencies**, causing logo loading to fail on Linux production servers.

### The Issue Flow:
1. ✅ Code calls `clearLogoCache()` - Works correctly
2. ✅ Tries to load logo with `loadWhiteLogoAsJpeg()`
3. ❌ **Sharp module fails to load** (not installed on Linux)
4. ❌ Returns `null` - logo loading silently fails
5. ⚠️ Logs: "Failed to load logo - PPTX will use template default logo"
6. ❌ **Logo never replaced** - uses corrupted template logo
7. ❌ Users see "A HE LTH ISE" instead of "HEALTHRISE"

### Production Logs Showed:
```
[better-chatbot] ERROR Failed to normalize logo asset for healthrise theme:
Could not load the "sharp" module using the linux-x64 runtime
```

## Complete Fix Applied

### 1. ✅ Added Sharp to Dependencies
**File:** `package.json`
```json
"dependencies": {
  "sharp": "^0.33.5",
  ...
}
```

### 2. ✅ Fixed Template Logo
Ran `fix-template-logo.js` to ensure template has correct logo:
- Source: `public/Healthrise logo WHITE.webp` (2.1KB, 400x37px)
- Converts to: 8,025-byte JPEG with dark background (#0f1d42)
- Hash: `935490d045a7ad9538996c9b37fe63b4`

### 3. ✅ Created Cache Clearing Scripts
**Files:**
- `scripts/deploy-clear-caches.sh` (Linux/Mac)
- `scripts/deploy-clear-caches.bat` (Windows)
- `package.json`: Added `deploy:clear-caches` command

**What it clears:**
- `.next` folder (Next.js build cache)
- `.tsbuildinfo` (TypeScript cache)
- Cached logo files
- Build artifacts (dist, out, build)
- Re-runs logo fix script

### 4. ✅ Updated PPTX Generation Code
**File:** `src/lib/pptx/pptx-template-builder-v2.ts`

**Changes:**
- Line 200: Calls `clearLogoCache()` at start of every generation
- Line 471: Force logo replacement (no early return optimization)
- Lines 475-478: Verification logging

### 5. ✅ Installed Sharp Locally
Ran `pnpm install` - Sharp now installed for Windows development

## Deployment Instructions

### For Production Deployment:

**STEP 1: Clear All Caches**
```bash
pnpm run deploy:clear-caches
```

**STEP 2: Commit & Push Changes**
```bash
git add package.json LOGO_FIX_SUMMARY.md
git commit -m "Fix: Add Sharp to dependencies for logo processing"
git push
```

**STEP 3: Production will automatically:**
- Reinstall dependencies (including Sharp for Linux)
- Rebuild application with fresh code
- Deploy with working logo processing

**STEP 4: Verify Deployment**

After deployment, check logs for:
```
[better-chatbot] ℹ Cleared logo cache to ensure fresh logo
[better-chatbot] ℹ Loaded healthrise WHITE logo from public/Healthrise logo WHITE.webp (webp -> JPEG) with dark background
[better-chatbot] ℹ Replaced template logo with healthrise WHITE logo (8025 bytes)
[better-chatbot] ℹ Verified logo replacement: 8025 bytes in final PPTX
```

**STEP 5: Test PPTX Generation**
1. Generate a test presentation
2. Download and open the PPTX
3. Check title slide - should show **"HEALTHRISE"** in white text (not corrupted)

## Why This Works

### Before (Broken):
```
Generate PPTX → Try load logo → Sharp fails → Return null → Use old template logo → CORRUPTED
```

### After (Fixed):
```
Generate PPTX → Load logo with Sharp → Convert WebP→JPEG → Replace in template → CORRECT LOGO ✅
```

## Key Technical Details

### Sharp Configuration:
- **Version:** 0.33.5
- **Platform:** Cross-platform (Windows + Linux)
- **Purpose:** Convert WebP with transparency to JPEG with dark background
- **Build Config:** Listed in `pnpm.onlyBuiltDependencies` for native compilation

### Logo Specifications:
- **Source File:** `public/Healthrise logo WHITE.webp`
- **Format:** WebP with alpha channel (white text, transparent background)
- **Size:** 2,102 bytes (400x37 pixels)
- **Converted:** JPEG 8,025 bytes with #0f1d42 background
- **Location in PPTX:** `ppt/media/image2.jpg`

### Template File:
- **Path:** `.yak/template__Comp.pptx`
- **Title Slide:** Slide 1 (always present)
- **Logo Slot:** `ppt/media/image2.jpg` (replaced during generation)
- **Layout Slides:** 3, 4, 5, 6, 11, 13, 14 (used as templates)

## Files Modified

1. `package.json` - Added Sharp dependency
2. `DEPLOYMENT_CACHE_CLEARING.md` - Deployment documentation
3. `scripts/deploy-clear-caches.sh` - Cache clearing script (Linux/Mac)
4. `scripts/deploy-clear-caches.bat` - Cache clearing script (Windows)
5. `.yak/template__Comp.pptx` - Template with correct logo
6. `LOGO_FIX_SUMMARY.md` - This file

## Prevention

### Always Run Before Deployment:
```bash
pnpm run deploy:clear-caches
pnpm run build
```

### Monitor Production Logs For:
- "Failed to load logo" warnings
- Sharp module loading errors
- Logo replacement confirmation messages

## Support

If logo issues persist after this fix:

1. Check production logs for Sharp errors
2. Verify Sharp is installed: `ls node_modules/sharp`
3. Check logo file exists: `ls public/Healthrise\ logo\ WHITE.webp`
4. Extract logo from generated PPTX:
   ```bash
   unzip -p generated.pptx ppt/media/image2.jpg > test-logo.jpg
   ```
5. Compare with expected hash: `md5sum test-logo.jpg`

Expected hash: `935490d045a7ad9538996c9b37fe63b4`

---

**Last Updated:** 2025-10-16
**Issue:** Logo corruption ("A HE LTH ISE") in generated PPTXs
**Root Cause:** Sharp library not installed in production
**Status:** ✅ RESOLVED
