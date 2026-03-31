#!/usr/bin/env node
// ============================================================
// send-command.js — 寫入命令檔並觸發 Extension poll
//
// 用法：node send-command.js <extension-id> <command-json>
//
// 範例：
//   node send-command.js abcdef... '{"id":"cmd_001","type":"get_status","payload":{}}'
//   node send-command.js abcdef... command.json
//
// 流程：
// 1. 將命令 JSON 寫入 ~/.openclaw/pending-commands/
// 2. 啟動 trigger.js 通知 Extension 立即 poll
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// ============================================================
// 參數解析
// ============================================================

const extensionId = process.argv[2];
const commandArg = process.argv[3];

if (!extensionId || !commandArg) {
  console.error('用法: node send-command.js <extension-id> <command-json-or-file>');
  console.error('');
  console.error('範例:');
  console.error('  node send-command.js abc... \'{"id":"cmd_001","type":"get_status","payload":{}}\'');
  console.error('  node send-command.js abc... ./my-command.json');
  process.exit(1);
}

// ============================================================
// 讀取命令
// ============================================================

let commandJson;
try {
  // 嘗試解析為 JSON 字串
  if (commandArg.startsWith('{')) {
    commandJson = JSON.parse(commandArg);
  } else {
    // 嘗試當作檔案路徑讀取
    const content = fs.readFileSync(commandArg, 'utf8');
    commandJson = JSON.parse(content);
  }
} catch (e) {
  console.error(`❌ 無法解析命令: ${e.message}`);
  process.exit(1);
}

// 驗證基本欄位
if (!commandJson.id || !commandJson.type || commandJson.payload === undefined) {
  console.error('❌ 命令缺少必要欄位 (id, type, payload)');
  process.exit(1);
}

// ============================================================
// 寫入 pending-commands
// ============================================================

const pendingDir = path.join(os.homedir(), '.openclaw', 'pending-commands');
fs.mkdirSync(pendingDir, { recursive: true });

const filename = `${Date.now()}_${commandJson.id}.json`;
const filePath = path.join(pendingDir, filename);

fs.writeFileSync(filePath, JSON.stringify(commandJson, null, 2));
console.log(`✅ 命令已寫入: ${filePath}`);

// ============================================================
// 觸發 Extension
// ============================================================

console.log('🦞 通知 Extension poll...\n');

const trigger = spawn('node', [
  path.join(__dirname, 'trigger.js'),
  extensionId,
], { stdio: 'inherit' });

trigger.on('close', (code) => {
  process.exit(code || 0);
});
