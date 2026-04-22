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
npm run build      # 清空 dist/ 後重新產生可直接載入 Chrome 的版本
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

### 從 Git / GitHub 取得專案時要注意

- Chrome 只能載入 `dist/`，**不能直接載入 repo 根目錄**。
- 如果你是 `git clone` 這個 repo，直接選 `dist/` 即可。
- 如果你下載的是 GitHub 自動產生的原始碼壓縮檔，請確認壓縮檔內有 `dist/`；若沒有，先執行：

```bash
npm install
npm run build
```

- 若你要給一般使用者安裝，優先提供 release zip，而不是 GitHub 的原始碼 zip。

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

### 運作架構

```
OpenClaw 下命令
  → send-command.js 寫入 ~/.openclaw/pending-commands/
  → trigger.js 啟動臨時 localhost 頁面
  → 頁面呼叫 chrome.runtime.sendMessage(extensionId, {action:'poll'})
  → Extension onMessageExternal 收到通知 → 呼叫 pollNativeHost()
  → bridge.js 讀取 pending commands → 回傳給 Extension → 執行 CRUD
  → 命令檔自動刪除
```

使用 `externally_connectable` 機制按需觸發，**命令即時執行**，不使用定時 polling。

### 下載

從 [GitHub Releases](https://github.com/tarysos/browser-remind-assistant/releases) 下載：

| 檔案 | 說明 |
|------|------|
| `browser-reminder-assistant-v1.2.2.zip` | Chrome 擴充功能本體，解壓後載入 Chrome |
| `native-bridge.zip` | Native Messaging Bridge，用於 OpenClaw ↔ Extension 通訊 |
| `skill.md` | OpenClaw Skill 定義檔，描述所有可用命令 |

### 安裝步驟

#### Step 1：安裝 Chrome 擴充功能

1. 下載 `browser-reminder-assistant-v1.2.2.zip` 並解壓
2. 開啟 Chrome，前往 `chrome://extensions/`
3. 開啟右上角「開發人員模式」
4. 點擊「載入未封裝項目」→ 選擇解壓後的資料夾
5. 記下擴充功能的 **Extension ID**（格式如 `abcdefghijklmnopqrstuvwxyzabcdef`）

#### Step 2：安裝 Native Messaging Bridge

> 前置條件：需已安裝 [Node.js](https://nodejs.org/)（v16+）

1. 下載 `native-bridge.zip` 並解壓到任意位置（例如 `~/openclaw/native-bridge/`）
2. 執行安裝腳本：

```bash
cd native-bridge
node install.js <your-extension-id>
```

安裝腳本會自動：
- **Windows**：產生 `bridge.bat` 包裝檔 → 寫入 Registry 註冊 `com.openclaw.reminder_bridge`
- **macOS**：寫入 `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openclaw.reminder_bridge.json`
- **Linux**：寫入 `~/.config/google-chrome/NativeMessagingHosts/com.openclaw.reminder_bridge.json`
- 建立 `~/.openclaw/pending-commands/` 目錄

3. **重新啟動 Chrome**（必須，Chrome 只在啟動時讀取 Native Host 註冊）

#### Step 3：驗證安裝

```bash
cd native-bridge
node test-bridge.js
```

應輸出 3/3 通過：
```
🦞 Bridge 功能測試

--- 測試 1: 無 pending commands ---
  ✅ 通過：收到空命令陣列
--- 測試 2: 有 pending command ---
  ✅ 通過：收到正確命令
  ✅ 通過：命令檔已刪除
--- 測試 3: 非 poll 動作 ---
  ✅ 通過：非 poll 回傳空陣列

結果: 3/3 通過
```

#### Step 4：安裝 OpenClaw Skill（選用）

下載 `skill.md` 並放入 OpenClaw 的 skills 目錄：

```bash
# 或使用 clawhub（如果可用）
clawhub install browser-reminder
```

### 使用方式

#### 方式一：透過 OpenClaw 自然語言（推薦）

安裝 Skill 後，直接對龍蝦說：

- 🗣️ 「幫我設一個明天下午 3 點的提醒，要記得繳電費」
- 🗣️ 「每週一三五早上 9 點提醒我站會」
- 🗣️ 「列出我所有的提醒」
- 🗣️ 「把那個繳電費的提醒刪掉」
- 🗣️ 「暫停每週站會的提醒」

#### 方式二：透過 send-command.js 手動下命令

```bash
cd native-bridge

# 查詢擴充狀態
node send-command.js <ext-id> '{"id":"cmd_001","type":"get_status","payload":{}}'

# 建立單次提醒
node send-command.js <ext-id> '{"id":"cmd_002","type":"create_reminder","payload":{"title":"繳電費","message":"記得繳這個月的電費","reminderType":"one_time","schedule":{"dateTime":"2026-04-05T14:00:00+08:00","timezone":"Asia/Taipei"},"rule":{"allowMissedCatchup":true}}}'

# 列出所有提醒
node send-command.js <ext-id> '{"id":"cmd_003","type":"list_reminders","payload":{"filter":"all"}}'

# 也可以傳入 JSON 檔案
node send-command.js <ext-id> ./my-command.json
```

執行後會自動開啟 Chrome 頁面觸發 Extension poll，完成後頁面自動關閉。

### native-bridge 檔案說明

| 檔案 | 用途 |
|------|------|
| `bridge.js` | Bridge 主程式 — 接收 Extension 的 stdin 請求，掃描 `~/.openclaw/pending-commands/`，回傳命令後刪除檔案 |
| `install.js` | 安裝腳本 — 自動產生 host manifest、註冊系統、建立目錄 |
| `trigger.js` | 觸發器 — 啟動臨時 localhost HTTP server，頁面透過 `chrome.runtime.sendMessage` 通知 Extension |
| `send-command.js` | 一站式工具 — 寫入命令 JSON 檔 + 自動呼叫 trigger.js |
| `test-bridge.js` | 測試腳本 — 驗證 bridge stdin/stdout 協議正確性 |
| `com.openclaw.reminder_bridge.json` | Host manifest 模板 — install.js 會用實際路徑覆寫 |

### 疑難排解

| 問題 | 解決方式 |
|------|----------|
| Extension 收不到命令 | 確認已重啟 Chrome；檢查 `chrome://extensions/` 是否有錯誤 |
| `test-bridge.js` 失敗 | 確認 Node.js v16+ 已安裝；確認 `~/.openclaw/pending-commands/` 目錄存在 |
| Registry 寫入失敗（Windows） | 以系統管理員身份執行 `node install.js` |
| trigger.js 開啟頁面但無反應 | 確認 Extension ID 正確；確認 manifest.json 含 `externally_connectable` |
| 命令執行但提醒沒出現 | 檢查命令 JSON 格式是否正確（需有 `id`、`type`、`payload`） |

完整命令文件請參閱 [skills/browser-reminder/skill.md](skills/browser-reminder/skill.md)。

## 設計文件

詳見 [SA.md](SA.md)

## License

[ISC](LICENSE)
