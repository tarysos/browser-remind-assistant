# Browser Reminder Assistant

瀏覽器工作流中的輕量提醒助手 — Chrome MV3 擴充功能。

## 功能特色

- **單次提醒** — 指定日期時間提醒一次
- **週期提醒** — 每天 / 每週固定時間提醒
- **首次開啟提醒** — 每天 / 每週第一次開啟瀏覽器時提醒，可限定有效時段
- **網站情境提醒** — 造訪特定網站時觸發（每次 / 每天首次 / 每週首次）
- **補提醒** — 錯過的提醒在下次開啟瀏覽器時補上
- **稍後提醒（Snooze）** — 延後 10 分鐘再提醒
- **安靜時段** — 設定不被打擾的時間段
- **Badge 計數** — 擴充功能圖示顯示未處理數量
- **🦞 OpenClaw 整合** — 透過 Native Messaging 讓 AI 助手管理你的提醒

## 技術架構

| 項目 | 技術 |
|------|------|
| Manifest | V3 |
| Background | Extension Service Worker |
| 排程 | `chrome.alarms` |
| 持久化 | `chrome.storage.local` |
| 通知 | `chrome.notifications` |
| 語言 | TypeScript |
| 測試 | Vitest |
| AI 整合 | Chrome Native Messaging + `externally_connectable` |

## 快速開始

### 安裝依賴

```bash
npm install
```

### 開發

```bash
npm run build      # 編譯 TypeScript + 複製靜態檔案到 dist/
npm run watch      # TypeScript watch mode
npm test           # 執行測試
npm run test:watch # 測試 watch mode
```

### 載入擴充功能

1. 執行 `npm run build`
2. 開啟 Chrome，前往 `chrome://extensions/`
3. 開啟右上角「開發人員模式」
4. 點擊「載入未封裝項目」
5. 選擇專案中的 `dist/` 資料夾

### 重新產生 Icon

```bash
node scripts/generate-icons.mjs
```

## 專案結構

```
src/
├── types/                        # TypeScript 型別定義
│   ├── reminder.ts               #   Reminder / Schedule / Rule / State
│   ├── history.ts                #   歷史紀錄
│   ├── settings.ts               #   全域設定
│   └── index.ts                  #   統一匯出
├── modules/
│   ├── reminder-repository/      # CRUD + history + settings
│   ├── alarm-manager/            # chrome.alarms 管理
│   ├── trigger-evaluator/        # 規則判斷 + URL matching
│   ├── notification-manager/     # 系統通知 + 互動回調
│   ├── badge-manager/            # icon badge 更新
│   ├── lifecycle-manager/        # startup rebuild
│   └── native-messaging-handler/ # OpenClaw Native Messaging 對接
├── background/
│   └── service-worker.ts         # 事件驅動中樞
├── popup/
│   └── popup.ts                  # Popup 今日清單
└── options/
    └── options.ts                # Options 管理頁面

public/
├── manifest.json                 # MV3 manifest
├── icons/                        # 擴充功能圖示
├── popup/                        # Popup HTML + CSS
└── options/                      # Options HTML + CSS

native-bridge/                    # OpenClaw Native Messaging Bridge
├── bridge.js                     # Bridge 主程式（stdin/stdout JSON）
├── install.js                    # 跨平台安裝腳本
├── trigger.js                    # 通知 Extension 立即 poll
├── send-command.js               # 一站式：寫入命令 + 觸發
├── test-bridge.js                # Bridge 功能測試
└── com.openclaw.reminder_bridge.json  # Host manifest 模板

skills/browser-reminder/
└── skill.md                      # OpenClaw Skill 定義
```

## 權限說明

| 權限 | 用途 |
|------|------|
| `alarms` | 週期與單次排程 |
| `storage` | 持久化提醒資料與設定 |
| `notifications` | 系統通知 |
| `tabs` | 網站情境提醒：偵測分頁 URL |
| `activeTab` | 取得當前分頁資訊 |
| `nativeMessaging` | 與 OpenClaw Native Bridge 通訊 |

## 🦞 OpenClaw 整合

讓 [OpenClaw](https://openclaw.com) AI 助手透過自然語言管理你的瀏覽器提醒。

### 架構

```
OpenClaw 下命令
  → send-command.js 寫入 ~/.openclaw/pending-commands/
  → trigger.js 啟動 localhost 頁面
  → chrome.runtime.sendMessage(extensionId, {action:'poll'})
  → Extension onMessageExternal → pollNativeHost()
  → bridge.js 讀取 pending commands → 回傳 → 執行 CRUD
```

### 安裝 Native Bridge

```bash
cd native-bridge
node install.js <your-chrome-extension-id>
```

Extension ID 可在 `chrome://extensions/` 中找到。

### 發送命令

```bash
# 查詢狀態
node send-command.js <ext-id> '{"id":"cmd_001","type":"get_status","payload":{}}'

# 建立提醒
node send-command.js <ext-id> '{"id":"cmd_002","type":"create_reminder","payload":{"title":"繳電費","message":"","reminderType":"one_time","schedule":{"dateTime":"2026-04-05T14:00:00+08:00","timezone":"Asia/Taipei"},"rule":{"allowMissedCatchup":true}}}'
```

完整命令文件請參閱 [skills/browser-reminder/skill.md](skills/browser-reminder/skill.md)。

## 設計文件

詳見 [SA.md](SA.md)

## License

[ISC](LICENSE)
