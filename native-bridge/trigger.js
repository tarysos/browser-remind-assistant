#!/usr/bin/env node
// ============================================================
// trigger.js — 通知 Extension 立即 poll
//
// 用法：node trigger.js <extension-id> [port]
//
// 機制：
// 1. 在 localhost 啟動一個臨時 HTTP server
// 2. 返回一個 HTML 頁面，頁面載入後呼叫
//    chrome.runtime.sendMessage(extensionId, {action:'poll'})
// 3. 收到 Extension 回應後自動關閉
//
// 這利用了 manifest.json 中的 externally_connectable 設定
// 允許 localhost 頁面與 Extension 通訊
// ============================================================

const http = require('http');
const path = require('path');

// ============================================================
// 參數解析
// ============================================================

const extensionId = process.argv[2];
const port = parseInt(process.argv[3] || '18931', 10);

if (!extensionId) {
  console.error('用法: node trigger.js <extension-id> [port]');
  console.error('');
  console.error('  extension-id: Chrome 擴充功能 ID（chrome://extensions 中找到）');
  console.error('  port: HTTP server 端口（預設 18931）');
  process.exit(1);
}

// ============================================================
// Trigger HTML 頁面
// ============================================================

const triggerHtml = `<!DOCTYPE html>
<html>
<head><title>OpenClaw Trigger</title></head>
<body>
<p id="status">正在通知 Extension...</p>
<script>
  const EXTENSION_ID = '${extensionId}';

  function trigger() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
      document.getElementById('status').textContent =
        '❌ 請在 Chrome 中開啟此頁面（需要 chrome.runtime API）';
      return;
    }

    chrome.runtime.sendMessage(
      EXTENSION_ID,
      { action: 'poll' },
      function(response) {
        if (chrome.runtime.lastError) {
          document.getElementById('status').textContent =
            '❌ ' + chrome.runtime.lastError.message;
        } else {
          document.getElementById('status').textContent =
            '✅ 已通知 Extension，回應: ' + JSON.stringify(response);
        }
        // 通知 server 可以關閉了
        fetch('/done').catch(() => {});
      }
    );
  }

  trigger();
</script>
</body>
</html>`;

// ============================================================
// HTTP Server（一次性，觸發完自動關閉）
// ============================================================

const server = http.createServer((req, res) => {
  if (req.url === '/done') {
    res.writeHead(200);
    res.end('ok');
    // 稍微延遲後關閉 server
    setTimeout(() => {
      server.close();
      process.exit(0);
    }, 500);
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(triggerHtml);
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`🦞 Trigger server 已啟動: ${url}`);
  console.log('   請在 Chrome 中開啟上方網址（或等待自動開啟）...');

  // 嘗試自動開啟瀏覽器
  const { exec } = require('child_process');
  const platform = process.platform;
  const openCmd = platform === 'win32' ? 'start'
    : platform === 'darwin' ? 'open'
    : 'xdg-open';
  exec(`${openCmd} ${url}`, () => {});

  // 10 秒超時自動關閉
  setTimeout(() => {
    console.log('⏰ 超時，關閉 server');
    server.close();
    process.exit(0);
  }, 10000);
});
