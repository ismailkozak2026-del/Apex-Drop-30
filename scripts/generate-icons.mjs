import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

// CRC32 table for valid PNG chunk generation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter none
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

function clamp(v, min = 0, max = 1) {
  return v < min ? min : v > max ? max : v;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function blendPixel(rgba, idx, r, g, b, alpha) {
  const a = clamp(alpha, 0, 1);
  if (a <= 0) return;
  const inv = 1 - a;
  rgba[idx] = Math.round(rgba[idx] * inv + r * a);
  rgba[idx + 1] = Math.round(rgba[idx + 1] * inv + g * a);
  rgba[idx + 2] = Math.round(rgba[idx + 2] * inv + b * a);
  rgba[idx + 3] = 255;
}

function sdRoundedBox(px, py, bx, by, r) {
  const qx = Math.abs(px) - bx + r;
  const qy = Math.abs(py) - by + r;
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
    Math.min(Math.max(qx, qy), 0) -
    r
  );
}

function sdSegment(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h);
}

function renderGameIcon(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.72 : 0.92;
  const aa = 2.0 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const idx = (y * size + x) * 4;

      // Obsidian & amber-crimson tactical background
      const rad = Math.hypot(u, v);
      const bgR = Math.round(mix(20, 9, clamp(rad)));
      const bgG = Math.round(mix(22, 11, clamp(rad)));
      const bgB = Math.round(mix(28, 16, clamp(rad)));
      rgba[idx] = bgR;
      rgba[idx + 1] = bgG;
      rgba[idx + 2] = bgB;
      rgba[idx + 3] = 255;

      const sx = u / scale;
      const sy = v / scale;

      // Outer tactical octagon/rounded border ring
      const ringDist = Math.abs(Math.hypot(sx, sy) - 0.76) - 0.045;
      const ringAlpha = clamp(0.5 - ringDist / aa);
      blendPixel(rgba, idx, 245, 158, 11, ringAlpha); // Amber Gold

      // Inner precision ring
      const innerDist = Math.abs(Math.hypot(sx, sy) - 0.52) - 0.02;
      const innerAlpha = clamp(0.5 - innerDist / aa);
      blendPixel(rgba, idx, 239, 68, 68, innerAlpha * 0.9); // Crimson Red

      // 4 Crosshair ticks
      const ticks = [
        [0, -0.88, 0, -0.44],
        [0, 0.44, 0, 0.88],
        [-0.88, 0, -0.44, 0],
        [0.44, 0, 0.88, 0],
      ];
      for (const [ax, ay, bx, by] of ticks) {
        const d = sdSegment(sx, sy, ax, ay, bx, by) - 0.045;
        blendPixel(rgba, idx, 248, 250, 252, clamp(0.5 - d / aa));
      }

      // Apex upward chevron inside crosshair
      const c1 = sdSegment(sx, sy, -0.26, 0.14, 0, -0.22) - 0.055;
      const c2 = sdSegment(sx, sy, 0, -0.22, 0.26, 0.14) - 0.055;
      const chev = Math.min(c1, c2);
      blendPixel(rgba, idx, 251, 191, 36, clamp(0.5 - chev / aa));

      // Center dot
      const dot = Math.hypot(sx, sy - 0.12) - 0.06;
      blendPixel(rgba, idx, 239, 68, 68, clamp(0.5 - dot / aa));
    }
  }
  return encodePNG(size, size, rgba);
}

function renderKontrolIcon(size, maskable = false) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.72 : 0.92;
  const aa = 2.0 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const idx = (y * size + x) * 4;

      // Deep ocean navy background
      const rad = Math.hypot(u, v);
      rgba[idx] = Math.round(mix(8, 4, clamp(rad)));
      rgba[idx + 1] = Math.round(mix(32, 16, clamp(rad)));
      rgba[idx + 2] = Math.round(mix(58, 34, clamp(rad)));
      rgba[idx + 3] = 255;

      const sx = u / scale;
      const sy = v / scale;

      // Shield / Command Frame
      const box = Math.abs(sdRoundedBox(sx, sy, 0.72, 0.72, 0.2)) - 0.05;
      blendPixel(rgba, idx, 6, 182, 212, clamp(0.5 - box / aa)); // Cyan-500

      // 3 Slider / Control bars inside
      const bars = [-0.3, 0, 0.3];
      const knobs = [-0.22, 0.25, -0.05];
      for (let i = 0; i < 3; i++) {
        const by = bars[i];
        const barDist = sdSegment(sx, sy, -0.44, by, 0.44, by) - 0.032;
        blendPixel(rgba, idx, 148, 224, 248, clamp(0.5 - barDist / aa) * 0.7);
        const knobDist = Math.hypot(sx - knobs[i], sy - by) - 0.095;
        blendPixel(rgba, idx, 34, 211, 238, clamp(0.5 - knobDist / aa));
        const knobInner = Math.hypot(sx - knobs[i], sy - by) - 0.04;
        blendPixel(rgba, idx, 255, 255, 255, clamp(0.5 - knobInner / aa));
      }
    }
  }
  return encodePNG(size, size, rgba);
}

// Write Main Game icons
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), renderGameIcon(192, false));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), renderGameIcon(512, false));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), renderGameIcon(512, true));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), renderGameIcon(180, false));

// Write Kontrol App icons (blue/cyan)
fs.writeFileSync(path.join(publicDir, 'kontrol-192x192.png'), renderKontrolIcon(192, false));
fs.writeFileSync(path.join(publicDir, 'kontrol-512x512.png'), renderKontrolIcon(512, false));
fs.writeFileSync(path.join(publicDir, 'kontrol-maskable-512x512.png'), renderKontrolIcon(512, true));
fs.writeFileSync(path.join(publicDir, 'kontrol-apple-touch-icon.png'), renderKontrolIcon(180, false));

// Write SVG icons
fs.writeFileSync(
  path.join(publicDir, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0d0f14"/>
  <circle cx="256" cy="256" r="184" fill="none" stroke="#f59e0b" stroke-width="22"/>
  <circle cx="256" cy="256" r="126" fill="none" stroke="#ef4444" stroke-width="10"/>
  <path d="M256 44v96M256 372v96M44 256h96M372 256h96" stroke="#f8fafc" stroke-width="22" stroke-linecap="round"/>
  <path d="M192 292L256 196l64 96" fill="none" stroke="#fbbf24" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="256" cy="292" r="18" fill="#ef4444"/>
</svg>`
);

fs.writeFileSync(
  path.join(publicDir, 'kontrol-icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#06172a"/>
  <rect x="76" y="76" width="360" height="360" rx="64" fill="none" stroke="#06b6d4" stroke-width="24"/>
  <path d="M148 182h216M148 256h216M148 330h216" stroke="#7dd3fc" stroke-width="18" stroke-linecap="round"/>
  <circle cx="204" cy="182" r="24" fill="#22d3ee" stroke="#ffffff" stroke-width="8"/>
  <circle cx="316" cy="256" r="24" fill="#22d3ee" stroke="#ffffff" stroke-width="8"/>
  <circle cx="244" cy="330" r="24" fill="#22d3ee" stroke="#ffffff" stroke-width="8"/>
</svg>`
);

console.log('Generated all PWA icons in public/');
