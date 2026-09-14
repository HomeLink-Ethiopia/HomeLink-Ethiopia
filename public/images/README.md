# 📸 Photo Directory

## How to Add Real Photos

This folder contains all images for the HomeLink Ethiopia platform.

### Folder Structure:

```
images/
├── cities/                    # Addis Ababa neighborhood photos
│   ├── bole/                  # Bole area photos (skyline, streets, buildings)
│   ├── cmc/                   # CMC area photos
│   ├── piassa/                # Piassa (downtown) photos
│   ├── kazanchis/             # Kazanchis business district
│   └── [other neighborhoods]/
│
└── properties/                # Property photos
    ├── exteriors/             # Building exteriors, compounds
    └── interiors/             # Interior room photos
        ├── living-rooms/      # Living room/salon photos
        ├── bedrooms/          # Bedroom photos (master, guest, etc.)
        ├── kitchens/          # Kitchen photos
        ├── bathrooms/         # Bathroom photos
        ├── dining/            # Dining room photos
        └── balconies/         # Balcony/terrace photos
```

---

## Quick Start

### 1. Add City Photos (for Homepage)

Place photos of Addis Ababa neighborhoods here:
- `cities/bole/bole-1.jpg` - Photo of Bole area
- `cities/cmc/cmc-1.jpg` - Photo of CMC area
- etc.

**Photo Requirements:**
- Size: 1920x1080 pixels (or 16:9 ratio)
- Format: JPG or WebP
- File size: < 500KB (compress using tinypng.com)
- Content: Clear shots of buildings, streets, landmarks

---

### 2. Add Property Photos

#### Exteriors:
Place photos of Ethiopian homes/buildings here:
- `properties/exteriors/apartment-1.jpg`
- `properties/exteriors/villa-1.jpg`
- `properties/exteriors/house-1.jpg`

#### Interiors:
Place room photos here:
- `properties/interiors/living-rooms/living-1.jpg`
- `properties/interiors/bedrooms/bedroom-1.jpg`
- `properties/interiors/kitchens/kitchen-1.jpg`
- `properties/interiors/bathrooms/bathroom-1.jpg`

**Photo Requirements:**
- Size: 1200x800 pixels (or 3:2 ratio)
- Format: JPG or WebP
- File size: < 300KB
- Content: Well-lit, clean rooms showing features

---

## Naming Convention

Use descriptive names with dashes:
- ✅ `bole-skyline-day.jpg`
- ✅ `modern-living-room-furnished.jpg`
- ✅ `master-bedroom-large.jpg`
- ❌ `IMG_1234.jpg` (too generic)
- ❌ `photo with spaces.jpg` (use dashes instead)

---

## Where to Get Photos

See the **REAL_PHOTOS_GUIDE.md** file in the project root for detailed instructions on:
- Where to source photos (stock sites, photographers, your own)
- How to optimize photos for web
- Legal/copyright considerations
- How to integrate into the code

---

## Example: Adding a Bole Photo

1. Take/download a photo of Bole area
2. Optimize it: Resize to 1920x1080, compress to < 500KB
3. Name it: `bole-skyline.jpg`
4. Place it here: `cities/bole/bole-skyline.jpg`
5. Update code to use: `/images/cities/bole/bole-skyline.jpg`

---

## Current Status

📁 **Folder structure created** - Ready for photos!  
📸 **Photos needed** - Add your real Ethiopian photos here  
📝 **Instructions available** - See REAL_PHOTOS_GUIDE.md  

**Start by adding 3-5 city photos and 5-10 property photos to see them on your site!**

