# App Icons

Set of icons for Lift Buddy, designed against the **Apple Human Interface Guidelines** for app icons.

## Files

| File | Size | Use |
|---|---|---|
| `icon-1024.png` | 1024 × 1024 | **Master** — drop into Icon Composer / Xcode for iOS app submission. App Store listing. |
| `icon-512.png` | 512 × 512 | PWA manifest (`any` purpose), splash screens, large web tile. |
| `icon-192.png` | 192 × 192 | PWA manifest (`any`), Android Chrome. |
| `apple-touch-icon.png` | 180 × 180 | Web clip / legacy `<link rel="apple-touch-icon">`. |
| `icon-dark-*.png` | 3 sizes | **Dark appearance** variant — used when the user picks dark icons on iOS/iPadOS Home Screen. |
| `icon-tinted-*.png` | 3 sizes | **Tinted appearance** variant — grayscale; the system colorizes it to match the user's selected tint. |

## Design notes

Following the HIG:
- **No baked-in effects.** No drop shadows, specular highlights, bevels, glows. The system applies these dynamically.
- **Subtle top-to-bottom gradient** on the background (light → dark), which "responds well to system lighting effects".
- **Simple overlapping filled shapes.** The dumbbell is four plates + a bar — outer plates recede behind inner plates for layered depth.
- **No text.** The HIG advises against text unless essential; the wordmark already sits next to the icon at runtime.
- **Full-bleed, opaque.** No transparency on the canvas; the system rounds the corners (~22.37% radius for iOS/iPadOS).
- **Consistent across appearances.** The shape and composition don't change between default / dark / tinted — only the palette shifts.

## How to use

### iOS / iPadOS app (Xcode + Icon Composer)

1. Open Icon Composer (bundled with Xcode 16+).
2. Import `icon-1024.png` as the base layer — or, for richer Liquid Glass effects on iOS 18+, separate the foreground (dumbbell) from the background (gradient) and import them as discrete layers. Foreground SVGs can be derived from `assets/mark.svg`; the background gradient can be defined directly in Icon Composer.
3. Add `icon-dark-1024.png` as the Dark variant and `icon-tinted-1024.png` as the Tinted variant.
4. Export to `Assets.xcassets`.

### Android / PWA (`manifest.json`)

```json
{
  "name": "Lift Buddy",
  "icons": [
    { "src": "/assets/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/assets/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

For Android adaptive icons (rounded / squircle / circle masks), Android Studio's Asset Studio can ingest `icon-1024.png` and generate the foreground + background layers.

### Web clip (legacy)

```html
<link rel="apple-touch-icon" href="/assets/icons/apple-touch-icon.png">
```

## Regenerating

The icons are generated programmatically (Canvas, vector shapes) — there's no Photoshop / Figma file to maintain. To re-render at a different size or with a tweaked palette, edit the script that produced them. The shapes are entirely defined in code so size variations stay crisp.
