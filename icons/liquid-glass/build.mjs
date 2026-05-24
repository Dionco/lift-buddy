// Generates the Liquid Glass app icon for Lift Buddy.
//
// Produces:
//   - background.svg / foreground.svg  (flat layers — drop into Icon Composer when on Xcode 26)
//   - icon.svg                         (composed source-of-truth, includes baked glass effects)
//   - icon-{1024,512,256,180}.png      (rasterised via sharp)
//
// Run:  node icons/liquid-glass/build.mjs

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = (name) => path.join(here, name);

// ───────────────────────── Palette ──────────────────────────
const BG_TOP = "#221814";     // warm dark, top-left lit
const BG_MID = "#120c0a";
const BG_BOT = "#070504";     // deep shadow, bottom-right
const RUST   = "#C0492F";     // brand rust orange
const RUST_D = "#7E2F1C";     // shadow side of rust
const CREAM  = "#F5F2EC";

// ─────────────────────── Geometry (1024) ────────────────────
const W = 1024, H = 1024;
const CX = W / 2;
// Inner plates: tall and prominent
const IP = { w: 208, h: 568, rx: 38, y: (H - 568) / 2 };
const IP_L_X = CX - 120 - IP.w; // 184
const IP_R_X = CX + 120;        // 632
// Outer plates: behind, shorter, narrower
const OP = { w: 116, h: 460, rx: 28, y: (H - 460) / 2 };
const OP_L_X = IP_L_X - 70;     // 114
const OP_R_X = IP_R_X + IP.w - OP.w + 70; // 770
// Bar
const BAR = { w: 240, h: 60, rx: 14, y: (H - 60) / 2 - 2, x: CX - 120 };

// ─────────────────────── Shared <defs> ──────────────────────
// All gradients, filters, and clipPaths used by the foreground.
// IDs are namespaced so foreground.svg and icon.svg can share them.
const defs = `
  <!-- Background gradient: warm top-left → cold bottom-right with a soft ambient bloom -->
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0"   stop-color="${BG_TOP}"/>
    <stop offset="0.55" stop-color="${BG_MID}"/>
    <stop offset="1"   stop-color="${BG_BOT}"/>
  </linearGradient>
  <radialGradient id="bg-bloom" cx="0.22" cy="0.18" r="0.7">
    <stop offset="0"    stop-color="#3a2520" stop-opacity="0.55"/>
    <stop offset="0.55" stop-color="#3a2520" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="bg-caustic" cx="0.5" cy="0.62" r="0.45">
    <stop offset="0"   stop-color="${RUST}" stop-opacity="0.22"/>
    <stop offset="0.6" stop-color="${RUST}" stop-opacity="0"/>
  </radialGradient>

  <!-- Glass plate fill: luminous tinted glass, top lit, bottom holds shadow.
       Opacity ~0.78 so the dark background subtly shows through (real glass, not paint). -->
  <linearGradient id="glass-rust" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#E97A5C" stop-opacity="0.82"/>
    <stop offset="0.45" stop-color="${RUST}" stop-opacity="0.78"/>
    <stop offset="1"    stop-color="#5A2114" stop-opacity="0.88"/>
  </linearGradient>
  <linearGradient id="glass-rust-deep" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#7E2F1C" stop-opacity="0.78"/>
    <stop offset="0.55" stop-color="#5A2114" stop-opacity="0.78"/>
    <stop offset="1"    stop-color="#2C0F08" stop-opacity="0.85"/>
  </linearGradient>

  <!-- Soft top sheen: dialled way down — the rim does the heavy lifting, not interior gloss -->
  <linearGradient id="top-gloss" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#FFFFFF" stop-opacity="0.22"/>
    <stop offset="0.25" stop-color="#FFFFFF" stop-opacity="0.06"/>
    <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>

  <!-- Specular: barely-there diagonal wash -->
  <linearGradient id="spec" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0"    stop-color="#FFFFFF" stop-opacity="0.20"/>
    <stop offset="0.3"  stop-color="#FFFFFF" stop-opacity="0.04"/>
    <stop offset="0.6"  stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>

  <!-- Under-light: warm refracted glow at bottom of plate (light bouncing off the surface below) -->
  <linearGradient id="under-light" x1="0" y1="1" x2="0" y2="0">
    <stop offset="0"    stop-color="#FF9C7A" stop-opacity="0.32"/>
    <stop offset="0.3"  stop-color="#FF9C7A" stop-opacity="0.06"/>
    <stop offset="0.6"  stop-color="#FF9C7A" stop-opacity="0"/>
  </linearGradient>

  <!-- Rim stroke: very bright top edge, faint mid, warm under-light at bottom -->
  <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#FFFFFF" stop-opacity="0.98"/>
    <stop offset="0.18" stop-color="#FFFFFF" stop-opacity="0.55"/>
    <stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.10"/>
    <stop offset="0.75" stop-color="#FFB89A" stop-opacity="0.18"/>
    <stop offset="1"    stop-color="#FFC9AC" stop-opacity="0.55"/>
  </linearGradient>

  <!-- Bar: polished chrome/glass -->
  <linearGradient id="bar-fill" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#FFFFFF"/>
    <stop offset="0.3"  stop-color="${CREAM}"/>
    <stop offset="0.55" stop-color="#D8D3C4"/>
    <stop offset="1"    stop-color="#9C9789"/>
  </linearGradient>
  <linearGradient id="bar-shine" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#FFFFFF" stop-opacity="0"/>
    <stop offset="0.45" stop-color="#FFFFFF" stop-opacity="0.85"/>
    <stop offset="0.55" stop-color="#FFFFFF" stop-opacity="0.85"/>
    <stop offset="1"    stop-color="#FFFFFF" stop-opacity="0"/>
  </linearGradient>

  <!-- Inner shadow: subtle, gives depth without darkening the whole plate -->
  <filter id="inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
    <feOffset dx="3" dy="10" result="off"/>
    <feComposite in="off" in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="inner"/>
    <feColorMatrix in="inner" type="matrix" values="
      0 0 0 0 0.05
      0 0 0 0 0.02
      0 0 0 0 0.01
      0 0 0 0.32 0"/>
  </filter>

  <!-- Soft drop shadow / contact shadow under each plate -->
  <filter id="contact" x="-30%" y="-30%" width="160%" height="180%">
    <feGaussianBlur in="SourceAlpha" stdDeviation="18"/>
    <feOffset dx="0" dy="22"/>
    <feColorMatrix type="matrix" values="
      0 0 0 0 0
      0 0 0 0 0
      0 0 0 0 0
      0 0 0 0.7 0"/>
  </filter>

  <!-- Coloured caustic under plates -->
  <filter id="caustic" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="42"/>
  </filter>

  <!-- Soft blur for the specular pinpoint so it doesn't look like a hard ellipse -->
  <filter id="soft-blur" x="-40%" y="-40%" width="180%" height="180%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="14"/>
  </filter>

  <!-- ClipPaths so highlights stay inside each plate -->
  <clipPath id="clip-ip-l"><rect x="${IP_L_X}" y="${IP.y}" width="${IP.w}" height="${IP.h}" rx="${IP.rx}"/></clipPath>
  <clipPath id="clip-ip-r"><rect x="${IP_R_X}" y="${IP.y}" width="${IP.w}" height="${IP.h}" rx="${IP.rx}"/></clipPath>
  <clipPath id="clip-op-l"><rect x="${OP_L_X}" y="${OP.y}" width="${OP.w}" height="${OP.h}" rx="${OP.rx}"/></clipPath>
  <clipPath id="clip-op-r"><rect x="${OP_R_X}" y="${OP.y}" width="${OP.w}" height="${OP.h}" rx="${OP.rx}"/></clipPath>
  <clipPath id="clip-bar"><rect x="${BAR.x}" y="${BAR.y}" width="${BAR.w}" height="${BAR.h}" rx="${BAR.rx}"/></clipPath>
`;

// ─────────────────────── Building blocks ────────────────────
// One glass plate = base fill + inner-shadow + top gloss band + diagonal specular streak + rim stroke.
// All overlays are clipped to the plate's rect so highlights don't leak.
function glassPlate({ x, y, w, h, rx, fill, clipId, specularAngle = 28 }) {
  // Specular pinpoint: small bright spot near top-left, no visible ellipse edge
  const specCX = x + w * 0.30;
  const specCY = y + h * 0.16;
  const specRX = w * 0.42;
  const specRY = h * 0.045;

  return `
    <!-- contact shadow -->
    <g filter="url(#contact)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#000"/>
    </g>
    <!-- base glass fill (translucent) -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}"/>
    <!-- inner shadow -->
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#000" filter="url(#inner-shadow)"/>
    <g clip-path="url(#${clipId})">
      <!-- soft full-height top sheen (dispersed, no hard edge) -->
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#top-gloss)"/>
      <!-- warm under-light at bottom -->
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#under-light)"/>
      <!-- subtle diagonal specular wash -->
      <rect x="${x}" y="${y}" width="${w}" height="${h * 0.55}" fill="url(#spec)"/>
      <!-- soft specular pinpoint (heavily blurred so it reads as a glint, not a shape) -->
      <ellipse cx="${specCX}" cy="${specCY}" rx="${specRX * 0.7}" ry="${specRY * 0.8}"
               fill="#FFFFFF" opacity="0.22"
               transform="rotate(${specularAngle} ${specCX} ${specCY})"
               filter="url(#soft-blur)"/>
    </g>
    <!-- rim stroke on top: bright above, warm under-light below — slightly thicker for read at small sizes -->
    <rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="${rx - 0.5}"
          fill="none" stroke="url(#rim)" stroke-width="3"/>
  `;
}

function glassBar() {
  const { x, y, w, h, rx } = BAR;
  return `
    <g filter="url(#contact)">
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#000"/>
    </g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#bar-fill)"/>
    <g clip-path="url(#clip-bar)">
      <!-- bright horizontal shine band across the middle -->
      <rect x="${x}" y="${y + h * 0.18}" width="${w}" height="${h * 0.55}" fill="url(#bar-shine)"/>
      <!-- top thin gloss -->
      <rect x="${x + 3}" y="${y + 2}" width="${w - 6}" height="${h * 0.28}" rx="${rx - 1}" fill="#FFFFFF" opacity="0.55"/>
    </g>
    <rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${rx - 0.3}"
          fill="none" stroke="url(#rim)" stroke-width="1.5"/>
  `;
}

// Caustic glow underneath each plate — sits on background, behind plates
function caustics() {
  const c = (x, y, w, h, color, op) => `
    <ellipse cx="${x + w / 2}" cy="${y + h + 18}" rx="${w * 0.55}" ry="${h * 0.10}" fill="${color}" opacity="${op}" filter="url(#caustic)"/>
  `;
  return `
    ${c(OP_L_X, OP.y, OP.w, OP.h, RUST_D, 0.28)}
    ${c(OP_R_X, OP.y, OP.w, OP.h, RUST_D, 0.28)}
    ${c(IP_L_X, IP.y, IP.w, IP.h, RUST,   0.42)}
    ${c(IP_R_X, IP.y, IP.w, IP.h, RUST,   0.42)}
  `;
}

// ─────────────────────── Layer composition ──────────────────
// Order matters: back-to-front = outer plates → bar → inner plates (inner plates partially overlap bar ends).
const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0"   stop-color="${BG_TOP}"/>
      <stop offset="0.55" stop-color="${BG_MID}"/>
      <stop offset="1"   stop-color="${BG_BOT}"/>
    </linearGradient>
    <radialGradient id="bg-bloom" cx="0.22" cy="0.18" r="0.7">
      <stop offset="0"    stop-color="#3a2520" stop-opacity="0.55"/>
      <stop offset="0.55" stop-color="#3a2520" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#bg-bloom)"/>
</svg>`;

const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>${defs}</defs>
  <!-- caustics behind everything -->
  ${caustics()}
  <!-- outer plates (back) -->
  ${glassPlate({ x: OP_L_X, y: OP.y, w: OP.w, h: OP.h, rx: OP.rx, fill: "url(#glass-rust-deep)", clipId: "clip-op-l" })}
  ${glassPlate({ x: OP_R_X, y: OP.y, w: OP.w, h: OP.h, rx: OP.rx, fill: "url(#glass-rust-deep)", clipId: "clip-op-r" })}
  <!-- bar -->
  ${glassBar()}
  <!-- inner plates (front) -->
  ${glassPlate({ x: IP_L_X, y: IP.y, w: IP.w, h: IP.h, rx: IP.rx, fill: "url(#glass-rust)", clipId: "clip-ip-l" })}
  ${glassPlate({ x: IP_R_X, y: IP.y, w: IP.w, h: IP.h, rx: IP.rx, fill: "url(#glass-rust)", clipId: "clip-ip-r" })}
</svg>`;

const composedSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <defs>${defs}</defs>
  <!-- background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#bg-bloom)"/>
  <rect width="${W}" height="${H}" fill="url(#bg-caustic)"/>
  <!-- foreground stack -->
  ${caustics()}
  ${glassPlate({ x: OP_L_X, y: OP.y, w: OP.w, h: OP.h, rx: OP.rx, fill: "url(#glass-rust-deep)", clipId: "clip-op-l" })}
  ${glassPlate({ x: OP_R_X, y: OP.y, w: OP.w, h: OP.h, rx: OP.rx, fill: "url(#glass-rust-deep)", clipId: "clip-op-r" })}
  ${glassBar()}
  ${glassPlate({ x: IP_L_X, y: IP.y, w: IP.w, h: IP.h, rx: IP.rx, fill: "url(#glass-rust)", clipId: "clip-ip-l" })}
  ${glassPlate({ x: IP_R_X, y: IP.y, w: IP.w, h: IP.h, rx: IP.rx, fill: "url(#glass-rust)", clipId: "clip-ip-r" })}
</svg>`;

// ─────────────────────── Write + rasterise ──────────────────
await writeFile(out("background.svg"), backgroundSvg);
await writeFile(out("foreground.svg"), foregroundSvg);
await writeFile(out("icon.svg"),       composedSvg);

const svgBuffer = Buffer.from(composedSvg);
for (const size of [1024, 512, 256, 180]) {
  await sharp(svgBuffer, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out(`icon-${size}.png`));
  console.log(`wrote icon-${size}.png`);
}
