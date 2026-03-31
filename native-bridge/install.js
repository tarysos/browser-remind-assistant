#!/usr/bin/env node
// ============================================================
// Native Messaging Bridge 安裝腳本
// 用法：node install.js <chrome-extension-id>
//
// 功能：
// 1. 產生正確路徑的 host manifest JSON
// 2. 依平台放到 Chrome 指定位置
// 3. (Windows) 寫入 Registry
// 4. 建立 pending-commands 目錄
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const HOST_NAME = 'com.openclaw.reminder_bridge';

// ============================================================
// 解析參數
// ============================================================

const extensionId = process.argv[2];
if (!extensionId) {
  console.error('用法: node install.js <chrome-extension-id>');
  console.error('');
  console.error('  chrome-extension-id 可在 chrome://extensions 中找到');
  console.error('  範例: node install.js abcdefghijklmnopqrstuvwxyzabcdef');
  process.exit(1);
}

// ============================================================
// 路徑計算
// ============================================================

const bridgeDir = __dirname;
const bridgeScript = path.join(bridgeDir, 'bridge.js');
const platform = os.platform();

// Windows 需要用 batch 包裝來呼叫 node
let bridgePath;
if (platform === 'win32') {
  const batPath = path.join(bridgeDir, 'bridge.bat');
  const nodePath = process.execPath;
  fs.writeFileSync(batPath, `@echo off\r\n"${nodePath}" "${bridgeScript}"\r\n`);
  bridgePath = batPath;
} else {
  // macOS / Linux 直接指向 node script，需確保可執行
  bridgePath = bridgeScript;
  try { fs.chmodSync(bridgePath, 0o755); } catch (_) {}
}

// ============================================================
// 產生 Host Manifest
// ============================================================

const manifest = {
  name: HOST_NAME,
  description: 'OpenClaw ↔ Browser Reminder Assistant Native Messaging Bridge',
  path: bridgePath,
  type: 'stdio',
  allowed_origins: [
    `chrome-extension://${extensionId}/`,
  ],
};

// ============================================================
// 依平台安裝
// ============================================================

function getManifestDir() {
  switch (platform) {
    case 'win32':
      // Windows: manifest 放在 bridge 目錄旁即可，路徑由 Registry 指向
      return bridgeDir;
    case 'darwin':
      return path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts');
    case 'linux':
      return path.join(os.homedir(), '.config', 'google-chrome', 'NativeMessagingHosts');
    default:
      console.error(`不支援的平台: ${platform}`);
      process.exit(1);
  }
}

const manifestDir = getManifestDir();
const manifestPath = path.join(manifestDir, `${HOST_NAME}.json`);

// 確保目標目錄存在
fs.mkdirSync(manifestDir, { recursive: true });

// 寫入 manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`✅ Host manifest 已寫入: ${manifestPath}`);

// Windows: 寫入 Registry
if (platform === 'win32') {
  const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}`;
  try {
    execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`, { stdio: 'pipe' });
    console.log(`✅ Registry 已註冊: ${regKey}`);
  } catch (err) {
    console.error(`❌ Registry 寫入失敗: ${err.message}`);
    console.error('   請以系統管理員身份重新執行');
    process.exit(1);
  }
}

// ============================================================
// 建立 pending-commands 目錄
// ============================================================

const pendingDir = path.join(os.homedir(), '.openclaw', 'pending-commands');
fs.mkdirSync(pendingDir, { recursive: true });
console.log(`✅ Pending commands 目錄: ${pendingDir}`);

// ============================================================
// 完成
// ============================================================

console.log('');
console.log('🦞 安裝完成！');
console.log('');
console.log('使用方式：');
console.log(`  1. 將命令 JSON 檔放入 ${pendingDir}`);
console.log('  2. 擴充功能每分鐘會自動 poll 並執行命令');
console.log('');
console.log('測試：');
console.log('  node test-bridge.js');
