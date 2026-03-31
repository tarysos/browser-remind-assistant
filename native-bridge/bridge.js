#!/usr/bin/env node
// ============================================================
// com.openclaw.reminder_bridge — Native Messaging Bridge
// Chrome Native Messaging 使用 length-prefixed JSON over stdin/stdout
// 協議：先讀 4 bytes (uint32 LE) 表示 JSON 長度，再讀 JSON body
// ============================================================

const fs = require('fs');
const path = require('path');
const os = require('os');

// ============================================================
// 常數
// ============================================================

/** pending commands 存放目錄 */
const PENDING_DIR = path.join(os.homedir(), '.openclaw', 'pending-commands');

// ============================================================
// stdin/stdout 工具（Chrome Native Messaging 協議）
// ============================================================

/**
 * 從 stdin 讀取一筆 Chrome Native Messaging 訊息
 * 格式：[4 bytes uint32 LE = length][length bytes JSON]
 */
function readMessage() {
  return new Promise((resolve, reject) => {
    // 先讀 4 bytes 取得訊息長度
    const header = Buffer.alloc(4);
    let headerBytesRead = 0;

    const onReadable = () => {
      while (headerBytesRead < 4) {
        const chunk = process.stdin.read(4 - headerBytesRead);
        if (chunk === null) return; // 等待更多資料
        chunk.copy(header, headerBytesRead);
        headerBytesRead += chunk.length;
      }

      const msgLen = header.readUInt32LE(0);
      if (msgLen === 0) {
        resolve(null);
        return;
      }

      // 讀取 JSON body
      let body = '';
      let bodyBytesRead = 0;
      const readBody = () => {
        while (bodyBytesRead < msgLen) {
          const chunk = process.stdin.read(msgLen - bodyBytesRead);
          if (chunk === null) return;
          body += chunk.toString('utf8');
          bodyBytesRead += chunk.length;
        }
        process.stdin.removeListener('readable', readBody);
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${body}`));
        }
      };

      process.stdin.removeListener('readable', onReadable);
      process.stdin.on('readable', readBody);
      readBody();
    };

    process.stdin.on('readable', onReadable);
  });
}

/**
 * 將 JSON 物件以 Chrome Native Messaging 格式寫入 stdout
 */
function writeMessage(obj) {
  const json = JSON.stringify(obj);
  const buf = Buffer.from(json, 'utf8');
  const header = Buffer.alloc(4);
  header.writeUInt32LE(buf.length, 0);
  process.stdout.write(header);
  process.stdout.write(buf);
}

// ============================================================
// Pending Commands 管理
// ============================================================

/**
 * 讀取所有 pending command 檔案，回傳命令陣列並刪除已讀取的檔案
 */
function readPendingCommands() {
  const commands = [];

  if (!fs.existsSync(PENDING_DIR)) {
    return commands;
  }

  const files = fs.readdirSync(PENDING_DIR)
    .filter(f => f.endsWith('.json'))
    .sort(); // 按時間戳排序

  for (const file of files) {
    const filePath = path.join(PENDING_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const cmd = JSON.parse(content);

      // 驗證基本欄位
      if (cmd && cmd.id && cmd.type && cmd.payload !== undefined) {
        commands.push(cmd);
      }

      // 處理完成後刪除檔案
      fs.unlinkSync(filePath);
    } catch (e) {
      // 無效檔案 → 刪除並跳過
      try { fs.unlinkSync(filePath); } catch (_) {}
    }
  }

  return commands;
}

// ============================================================
// 主流程
// ============================================================

async function main() {
  try {
    // 讀取 Extension 的 poll 請求
    const request = await readMessage();

    if (!request || request.action !== 'poll') {
      writeMessage({ commands: [] });
      process.exit(0);
    }

    // 讀取待處理命令
    const commands = readPendingCommands();

    // 回應
    writeMessage({ commands });
  } catch (err) {
    // 出錯時回傳空命令，確保 Extension 不會卡住
    writeMessage({ commands: [] });
  }

  process.exit(0);
}

main();
