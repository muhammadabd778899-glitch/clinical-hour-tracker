/**
 * Generates the PNG app icons without any external image dependency.
 * Run once with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const TEAL = [0x14, 0x7d, 0x78, 255];
const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

function draw(size, { maskable = false } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = color[0];
    px[i + 1] = color[1];
    px[i + 2] = color[2];
    px[i + 3] = color[3];
  };

  const radius = maskable ? 0 : Math.round(size * 0.22);
  const inset = maskable ? Math.round(size * 0.08) : 0;
  const w = size - inset * 2;

  // Background (rounded square, or full-bleed square for maskable).
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const lx = x - inset;
      const ly = y - inset;
      if (lx < 0 || ly < 0 || lx >= w || ly >= w) continue;
      if (radius > 0) {
        const cx = lx < radius ? radius : lx >= w - radius ? w - radius - 1 : lx;
        const cy = ly < radius ? radius : ly >= w - radius ? w - radius - 1 : ly;
        const dx = lx - cx;
        const dy = ly - cy;
        if (dx * dx + dy * dy > radius * radius) continue;
      }
      set(x, y, TEAL);
    }
  }

  // Clock: ring + hands (a classic "10:10" pose), scaled into the icon.
  const c = size / 2;
  const r = size * 0.27;
  const ringWidth = Math.max(2, Math.round(size * 0.055));

  const inRing = (x, y) => {
    const d = Math.hypot(x - c, y - c);
    return d <= r && d >= r - ringWidth;
  };

  const segmentDistance = (px, py, x1, y1, x2, y2) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  };

  const hand = (x, y) => {
    const dx = x - c;
    const dy = y - c;
    const w = Math.max(1.5, size * 0.038);
    // Minute hand pointing to 2 o'clock.
    if (segmentDistance(dx, dy, 0, 0, 0.62 * r, -0.36 * r) <= w) return true;
    // Hour hand pointing to 10 o'clock.
    if (segmentDistance(dx, dy, 0, 0, -0.52 * r, -0.3 * r) <= w) return true;
    return false;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inRing(x, y) || hand(x, y)) set(x, y, WHITE);
    }
  }

  // Center pin.
  const pin = Math.max(2, size * 0.045);
  for (let y = Math.floor(c - pin); y <= c + pin; y++) {
    for (let x = Math.floor(c - pin); x <= c + pin; x++) {
      if (Math.hypot(x - c, y - c) <= pin) set(x, y, WHITE);
    }
  }

  return px;
}

writeFileSync(path.join(outDir, 'icon-192.png'), encodePng(192, draw(192)));
writeFileSync(path.join(outDir, 'icon-512.png'), encodePng(512, draw(512)));
writeFileSync(path.join(outDir, 'maskable-512.png'), encodePng(512, draw(512, { maskable: true })));
console.log('Icons written to public/');
