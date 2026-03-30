/**
 * 產生最小合法 PNG icon 檔案（純色方塊 + 鈴鐺 emoji 風格）
 * 不依賴任何外部套件，使用手動建構 PNG binary
 */
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import zlib from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'public', 'icons');

if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true });

function createPng(size) {
  // 建立 RGBA raw data：藍色背景 + 白色鈴鐺形狀
  const pixels = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.38;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 圓形背景
      if (dist <= r * 1.15) {
        // 藍色背景 #4a90d9
        pixels[idx] = 0x4a;
        pixels[idx + 1] = 0x90;
        pixels[idx + 2] = 0xd9;
        pixels[idx + 3] = 255;

        // 白色鈴鐺圖案（簡化版）
        const nx = (x - cx) / r;
        const ny = (y - cy) / r;

        // 鈴鐺身體（梯形）
        const bellTop = -0.6;
        const bellBottom = 0.3;
        if (ny >= bellTop && ny <= bellBottom) {
          const widthAtY = 0.25 + (ny - bellTop) * 0.5;
          if (Math.abs(nx) <= widthAtY) {
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 255;
          }
        }
        // 鈴鐺底部弧線
        if (ny > bellBottom && ny <= bellBottom + 0.15) {
          if (Math.abs(nx) <= 0.55) {
            pixels[idx] = 255;
            pixels[idx + 1] = 255;
            pixels[idx + 2] = 255;
          }
        }
        // 鈴鐺頂部小圓
        const topDist = Math.sqrt(nx * nx + (ny + 0.7) * (ny + 0.7));
        if (topDist <= 0.12) {
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
        }
        // 鈴舌（底部小圓）
        const clapperDist = Math.sqrt(nx * nx + (ny - 0.55) * (ny - 0.55));
        if (clapperDist <= 0.1) {
          pixels[idx] = 255;
          pixels[idx + 1] = 255;
          pixels[idx + 2] = 255;
        }
      } else {
        // 透明
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  // 建構 PNG
  // 加入 filter byte (0 = None) 在每行前面
  const rawData = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rawData[y * (size * 4 + 1)] = 0; // filter byte
    pixels.copy(rawData, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  const compressed = zlib.deflateSync(rawData);

  const chunks = [];

  // PNG Signature
  chunks.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  chunks.push(createChunk('IHDR', ihdr));

  // IDAT
  chunks.push(createChunk('IDAT', compressed));

  // IEND
  chunks.push(createChunk('IEND', Buffer.alloc(0)));

  return Buffer.concat(chunks);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);

  return Buffer.concat([len, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return crc ^ 0xffffffff;
}

for (const size of [16, 48, 128]) {
  const png = createPng(size);
  const path = resolve(iconsDir, `icon-${size}.png`);
  writeFileSync(path, png);
  console.log(`✅ ${path} (${png.length} bytes)`);
}
