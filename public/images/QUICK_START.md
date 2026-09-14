# Quick Start: Adding Images

## Fastest Way to Get Started

### Step 1: Visit Ethiopian Real Estate Sites

**Best sources for authentic images:**

1. **EthioHouses** (ethiohouses.com)
   - Go to: https://www.ethiohouses.com
   - Browse properties in Addis Ababa
   - Look for properties in: Bole, Kazanchis, CMC, Old Airport

2. **RealEthio** (realethio.com)
   - Browse residential properties
   - Download high-quality property images

3. **Zegebeya** (zegebeya.com)
   - Check the real estate section
   - Many properties with good photos

### Step 2: Download & Rename Images

**For Hero Images (Priority #1):**
1. Find 4 impressive property exterior shots
2. Download and save as:
   - `hero/hero-1.jpg` (Bole area)
   - `hero/hero-2.jpg` (Kazanchis area)
   - `hero/hero-3.jpg` (CMC area)
   - `hero/hero-4.jpg` (Any impressive property)

**For Neighborhoods:**
1. Find images showcasing each area
2. Save as: `neighborhoods/bole.jpg`, `neighborhoods/kazanchis.jpg`, etc.

**For Properties:**
1. Download 20+ different property images
2. Save as: `properties/property-1.jpg` through `properties/property-20.jpg`

### Step 3: Optimize Images

Before using, compress them:
- Visit: https://tinypng.com
- Drag and drop all your images
- Download the compressed versions
- Replace originals with compressed versions

### Step 4: Test

```bash
npm run dev
```

Visit http://localhost:3000 and check:
- Home page hero slideshow shows your images
- Neighborhood cards show your images
- Property listings show your images

## Image Dimensions Quick Reference

| Type | Size | Qty | Priority |
|------|------|-----|----------|
| Hero | 1920x1080 | 4 | ⭐⭐⭐ HIGH |
| Neighborhoods | 800x600 | 8 | ⭐⭐ MEDIUM |
| Properties | 800x600 | 20+ | ⭐⭐⭐ HIGH |
| Interiors | 800x600 | 30+ | ⭐ LOW |

## Copyright Notice

⚠️ **Important**: Make sure you have permission to use images!

**Safe options:**
- Your own photos
- Images you have permission to use
- Stock photos (Unsplash, Pexels) with proper licensing
- Partner with local real estate agencies for photo sharing

**Avoid:**
- Copying images from other sites without permission
- Using watermarked images
- Claiming others' photography as your own

## Alternative: Temporary Testing

If you need to test quickly without real images, the app will automatically use placeholder images from picsum.photos until you add real ones.

The placeholders are already configured and working!
