# 🚨 CRITICAL: Cache Clearing for Deployment

## Root Cause of Logo Issues

The logo corruption issue was caused by **STALE BUILD CACHE** in the `.next` folder. When code changes are made to the PPTX generation logic, the build cache must be cleared to ensure the new code is actually deployed.

## ⚠️ MUST DO BEFORE EVERY DEPLOYMENT

**ALWAYS run this command before deploying:**

```bash
pnpm run deploy:clear-caches
```

Or manually:

### On Linux/Mac:
```bash
bash scripts/deploy-clear-caches.sh
```

### On Windows:
```cmd
scripts\deploy-clear-caches.bat
```

## What Gets Cleared

1. **`.next` folder** - Next.js build cache (MOST IMPORTANT)
2. **`.tsbuildinfo`** - TypeScript incremental build cache
3. **Cached logo files** - Any temporarily cached logos
4. **Build artifacts** - `dist`, `out`, `build` folders
5. **Template logo** - Re-runs the logo fix script to verify template

## Why This Is Critical

The `.next` folder contains **compiled server-side code**. If you make changes to:
- `src/lib/pptx/*` (PPTX generation code)
- `src/lib/pptx/brand-assets.ts` (Logo loading)
- `.yak/template__Comp.pptx` (Template file)

And you don't clear the `.next` cache, **the server will continue running OLD CODE** from the cache, even though your source files have changed!

## Deployment Checklist

- [ ] 1. Make code changes
- [ ] 2. Run `pnpm run deploy:clear-caches`
- [ ] 3. Run `pnpm run build`
- [ ] 4. Verify logo in generated PPTX
- [ ] 5. Deploy to production
- [ ] 6. Restart the server

## Files Modified in This Fix

### Code Changes:
- `src/lib/pptx/pptx-template-builder-v2.ts` - Added cache clearing and force logo replacement
- `src/lib/pptx/brand-assets.ts` - Already configured correctly

### Template:
- `.yak/template__Comp.pptx` - Contains correct WHITE logo (white text on dark background)

### Scripts:
- `scripts/deploy-clear-caches.sh` - Linux/Mac cache clearing script
- `scripts/deploy-clear-caches.bat` - Windows cache clearing script

### Configuration:
- `package.json` - Added `deploy:clear-caches` command

## How to Verify Logo is Correct

After deployment:

1. Generate a test PPTX
2. Open the title slide
3. Verify the logo shows: **"HEALTHRISE"** in WHITE text on dark blue background
4. Confirm the title slide still inherits layout 2:
   - Unzip the generated PPTX
   - Ensure `ppt/slides/_rels/slide1.xml.rels` points to `../slideLayouts/slideLayout2.xml`
5. If you see "A HE LTH ISE" or the relationship is missing - THE CACHE WAS NOT CLEARED!

## Emergency Fix

If logo is still corrupted after deployment:

```bash
# 1. Delete build cache
rm -rf .next

# 2. Re-fix template
cd .yak && node fix-template-logo.js && cd ..

# 3. Rebuild
pnpm run build

# 4. Restart server
```

## Technical Details

### Cache Clearing Implementation:

The new code in `pptx-template-builder-v2.ts` includes:

```typescript
// CRITICAL: Clear logo cache to ensure fresh logo is loaded every time
clearLogoCache();
logger.info("Cleared logo cache to ensure fresh logo");
```

This ensures:
1. Logo cache is cleared at start of every PPTX generation
2. Fresh logo is loaded from disk
3. Logo is FORCE replaced in template (no early return optimization)
4. Detailed logging tracks logo replacement

### Logo Specifications:

- **File**: `public/Healthrise logo WHITE.webp`
- **Format**: WebP with alpha channel
- **Conversion**: Flattened with dark background (#0f1d42), converted to JPEG
- **Size**: ~8,025 bytes after conversion
- **Placement**: `ppt/media/image2.jpg` in template

## Server Restart Required

After deploying code changes to PPTX generation:

1. Clear caches
2. Rebuild
3. **RESTART THE SERVER** - This ensures the new build is loaded into memory

Without a server restart, the old code may still be running in the Node.js process!

---

**Last Updated**: 2025-10-16
**Issue Fixed**: Logo corruption ("A HE LTH ISE") caused by stale build cache
**Solution**: Always clear `.next` cache before deployment
