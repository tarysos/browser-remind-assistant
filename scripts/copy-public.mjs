/**
 * 將 public/ 資料夾的靜態檔案複製到 dist/
 * 用於 build 後組裝完整的 extension 資料夾
 */
import { cpSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const publicDir = resolve(root, 'public');
const distDir = resolve(root, 'dist');

if (!existsSync(distDir)) {
  mkdirSync(distDir, { recursive: true });
}

cpSync(publicDir, distDir, { recursive: true });

console.log('✅ public/ copied to dist/');
