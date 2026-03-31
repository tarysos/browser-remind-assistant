#!/usr/bin/env node
// ============================================================
// Bridge 功能測試腳本
// 模擬 Chrome Extension 的 sendNativeMessage 行為
// ============================================================

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PENDING_DIR = path.join(os.homedir(), '.openclaw', 'pending-commands');

// ============================================================
// 工具函式
// ============================================================

function encodeMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  return Buffer.concat([header, buf]);
}

function decodeMessage(buffer) {
  if (buffer.length < 4) return null;
  const len = buffer.readUInt32LE(0);
  if (buffer.length < 4 + len) return null;
  const json = buffer.slice(4, 4 + len).toString('utf8');
  return JSON.parse(json);
}

// ============================================================
// 測試 1: 無 pending commands 時回傳空陣列
// ============================================================

async function testEmptyPoll() {
  console.log('--- 測試 1: 無 pending commands ---');

  const result = await runBridge({ action: 'poll', extensionVersion: '1.3.0' });
  const ok = result && Array.isArray(result.commands) && result.commands.length === 0;
  console.log(ok ? '  ✅ 通過：收到空命令陣列' : `  ❌ 失敗：${JSON.stringify(result)}`);
  return ok;
}

// ============================================================
// 測試 2: 有 pending command 時正確回傳並刪除檔案
// ============================================================

async function testWithPendingCommand() {
  console.log('--- 測試 2: 有 pending command ---');

  // 建立測試命令檔
  fs.mkdirSync(PENDING_DIR, { recursive: true });
  const cmdFile = path.join(PENDING_DIR, `${Date.now()}_test.json`);
  const testCmd = {
    id: 'test_001',
    type: 'get_status',
    payload: {},
  };
  fs.writeFileSync(cmdFile, JSON.stringify(testCmd));

  const result = await runBridge({ action: 'poll', extensionVersion: '1.3.0' });
  const hasCmd = result && result.commands.length === 1 && result.commands[0].id === 'test_001';
  const fileDeleted = !fs.existsSync(cmdFile);

  console.log(hasCmd ? '  ✅ 通過：收到正確命令' : `  ❌ 失敗：${JSON.stringify(result)}`);
  console.log(fileDeleted ? '  ✅ 通過：命令檔已刪除' : '  ❌ 失敗：命令檔未刪除');

  // 清理
  if (fs.existsSync(cmdFile)) fs.unlinkSync(cmdFile);

  return hasCmd && fileDeleted;
}

// ============================================================
// 測試 3: 非 poll 動作回傳空陣列
// ============================================================

async function testInvalidAction() {
  console.log('--- 測試 3: 非 poll 動作 ---');

  const result = await runBridge({ action: 'unknown' });
  const ok = result && Array.isArray(result.commands) && result.commands.length === 0;
  console.log(ok ? '  ✅ 通過：非 poll 回傳空陣列' : `  ❌ 失敗：${JSON.stringify(result)}`);
  return ok;
}

// ============================================================
// 啟動 bridge 子程序
// ============================================================

function runBridge(message) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, 'bridge.js')], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const chunks = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));

    child.on('close', () => {
      const output = Buffer.concat(chunks);
      try {
        resolve(decodeMessage(output));
      } catch (e) {
        reject(new Error(`無法解析輸出: ${output.toString('hex')}`));
      }
    });

    child.on('error', reject);

    // 寫入 Native Messaging 格式的請求
    child.stdin.write(encodeMessage(message));
    child.stdin.end();
  });
}

// ============================================================
// 執行所有測試
// ============================================================

async function main() {
  console.log('🦞 Bridge 功能測試\n');

  const results = [];
  results.push(await testEmptyPoll());
  results.push(await testWithPendingCommand());
  results.push(await testInvalidAction());

  console.log('');
  const passed = results.filter(Boolean).length;
  console.log(`結果: ${passed}/${results.length} 通過`);
  process.exit(passed === results.length ? 0 : 1);
}

main();
