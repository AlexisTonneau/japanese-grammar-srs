import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

const BG = "#0a0a0a";
const FG = "#ffffff";

function svg({ size, rounded }) {
  const fontSize = Math.round(size * 0.7);
  const radius = rounded ? Math.round(size * 0.22) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BG}"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central"
          font-family="'Noto Sans JP','Hiragino Sans','Yu Gothic',sans-serif"
          font-weight="700" font-size="${fontSize}" fill="${FG}">文</text>
  </svg>`;
}

const targets = [
  { name: "icon-192.png", size: 192, rounded: false, purpose: "any" },
  { name: "icon-512.png", size: 512, rounded: false, purpose: "any" },
  { name: "icon-maskable-512.png", size: 512, rounded: false, purpose: "maskable", padding: 0.1 },
  { name: "apple-touch-icon.png", size: 180, rounded: false, purpose: "ios" },
  { name: "favicon.png", size: 64, rounded: false, purpose: "favicon" },
];

for (const t of targets) {
  const padding = t.padding ?? 0;
  const inner = Math.round(t.size * (1 - padding * 2));
  const innerSvg = svg({ size: inner, rounded: false });

  if (padding > 0) {
    const offset = Math.round((t.size - inner) / 2);
    const composite = `<svg xmlns="http://www.w3.org/2000/svg" width="${t.size}" height="${t.size}">
      <rect width="${t.size}" height="${t.size}" fill="${BG}"/>
      <g transform="translate(${offset},${offset})">${innerSvg.replace(/<\?xml[^?]*\?>/, "")}</g>
    </svg>`;
    await sharp(Buffer.from(composite)).png().toFile(join(outDir, t.name));
  } else {
    await sharp(Buffer.from(innerSvg)).png().toFile(join(outDir, t.name));
  }
  console.log(`wrote ${t.name} (${t.size}x${t.size})`);
}

const svgFavicon = svg({ size: 64, rounded: false });
writeFileSync(join(outDir, "icon.svg"), svgFavicon);
console.log("wrote icon.svg");
