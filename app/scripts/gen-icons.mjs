/* Generates the PWA icons (a miniature "today strip" on the night palette)
 * as raw PNGs using only node:zlib — no image dependencies. */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BG = [14, 17, 22];
const SURFACE = [29, 36, 48];
const SLEEP = [124, 140, 248];
const INTAKE = [224, 164, 88];
const STATE = [91, 192, 190];

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc(size * (stride + 1));
  for (let y = 0; y < size; y++) {
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
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

function makeIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const fill = (x0, y0, x1, y1, [r, g, b]) => {
    for (let y = Math.round(y0); y < Math.round(y1); y++) {
      for (let x = Math.round(x0); x < Math.round(x1); x++) {
        const i = (y * size + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
    }
  };

  fill(0, 0, size, size, BG);
  const s = (f) => size * f;
  // horizontal track with a sleep band segment
  fill(s(0.14), s(0.52), s(0.86), s(0.66), SURFACE);
  fill(s(0.2), s(0.52), s(0.52), s(0.66), SLEEP);
  // event ticks above the track
  fill(s(0.58), s(0.34), s(0.61), s(0.48), INTAKE);
  fill(s(0.68), s(0.34), s(0.71), s(0.48), STATE);
  fill(s(0.78), s(0.34), s(0.81), s(0.48), SLEEP);
  return encodePng(size, px);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon-192.png'), makeIcon(192));
writeFileSync(join(outDir, 'icon-512.png'), makeIcon(512));
writeFileSync(join(outDir, 'icon-maskable-512.png'), makeIcon(512));
console.log('icons written to', outDir);
