---
name: browser-reminder
description: Manage browser reminders — create, update, delete, toggle, list reminders and trigger notifications via the Browser Reminder Assistant Chrome extension.
metadata:
  openclaw:
    requires:
      bins:
        - com.openclaw.reminder_bridge
---

# Browser Reminder Assistant

管理瀏覽器提醒的 OpenClaw Skill。透過 Chrome Native Messaging 與 Browser Reminder Assistant 擴充功能溝通，支援建立、編輯、刪除、啟停用提醒，以及查詢提醒清單與觸發通知。

## 架構

```
OpenClaw 下命令
  → send-command.js 寫入 ~/.openclaw/pending-commands/
  → trigger.js 啟動 localhost 頁面
  → chrome.runtime.sendMessage(extensionId, {action:'poll'})
  → Extension onMessageExternal → pollNativeHost()
  → bridge.js 讀取 pending commands → 回傳 → 執行 CRUD
```

使用 `externally_connectable` 機制按需觸發，命令即時執行，不使用定時 polling。

## 前置需求

### 1. 安裝 Chrome 擴充功能

1. 從 [GitHub Releases](https://github.com/user/browser-remind-assistant/releases) 下載 `browser-reminder-assistant-v1.2.0.zip`
2. 解壓後在 Chrome → `chrome://extensions/` → 開啟開發人員模式 → 載入未封裝項目
3. 記下 Extension ID（格式如 `abcdefghijklmnopqrstuvwxyzabcdef`）

### 2. 安裝 Native Messaging Bridge

> 需要 [Node.js](https://nodejs.org/) v16+

1. 從 Releases 下載 `native-bridge.zip` 並解壓到任意位置
2. 執行安裝腳本：

```bash
cd native-bridge
node install.js <your-extension-id>
```

安裝腳本會自動完成：
- 產生含正確路徑的 host manifest JSON
- 系統註冊（Windows: Registry / macOS: `~/Library/.../NativeMessagingHosts/` / Linux: `~/.config/google-chrome/NativeMessagingHosts/`）
- 建立 `~/.openclaw/pending-commands/` 命令佇列目錄

3. **重新啟動 Chrome**（必須！Chrome 只在啟動時載入 Native Host 設定）

### 3. 驗證安裝

```bash
node test-bridge.js
```

應看到 `3/3 通過`。

### 4. 安裝此 Skill

將 `skill.md` 放入 OpenClaw skills 目錄，或執行：

```bash
clawhub install browser-reminder
```

## 發送命令

### 透過 OpenClaw 自然語言（推薦）

安裝 Skill 後直接對龍蝦說：

- 🗣️ 「幫我設一個明天下午 3 點的提醒，要記得繳電費」
- 🗣️ 「每週一三五早上 9 點提醒我站會」
- 🗣️ 「列出我所有的提醒」
- 🗣️ 「把那個繳電費的提醒刪掉」
- 🗣️ 「暫停每週站會的提醒」

### 透過 send-command.js 手動下命令

```bash
cd native-bridge

# 查詢狀態
node send-command.js <ext-id> '{"id":"cmd_001","type":"get_status","payload":{}}'

# 建立提醒
node send-command.js <ext-id> '{"id":"cmd_002","type":"create_reminder","payload":{...}}'

# 傳入 JSON 檔案
node send-command.js <ext-id> ./my-command.json
```

執行後會自動開啟 Chrome 頁面觸發 Extension，完成後頁面自動關閉。

## 可用命令

所有命令透過 Native Messaging Bridge 傳送至擴充功能，格式為 JSON。

### 1. 建立提醒 (`create_reminder`)

建立一個新的瀏覽器提醒。支援四種類型：

- `one_time` — 單次提醒，指定日期時間
- `recurring` — 週期提醒（每天/每週/每月）
- `first_open` — 首次開啟瀏覽器時觸發
- `site_trigger` — 造訪特定網站時觸發

```json
{
  "id": "cmd_001",
  "type": "create_reminder",
  "payload": {
    "title": "繳電費",
    "message": "記得繳這個月的電費",
    "reminderType": "one_time",
    "schedule": {
      "dateTime": "2026-04-05T14:00:00+08:00",
      "timezone": "Asia/Taipei"
    },
    "rule": {
      "allowMissedCatchup": true
    }
  }
}
```

週期提醒範例：

```json
{
  "id": "cmd_002",
  "type": "create_reminder",
  "payload": {
    "title": "每週站會",
    "message": "",
    "reminderType": "recurring",
    "schedule": {
      "frequency": "weekly",
      "daysOfWeek": [1, 3, 5],
      "timeOfDay": "09:00",
      "timezone": "Asia/Taipei"
    },
    "rule": { "allowMissedCatchup": true }
  }
}
```

### 2. 更新提醒 (`update_reminder`)

修改現有提醒的標題、內容、排程或規則。

```json
{
  "id": "cmd_003",
  "type": "update_reminder",
  "payload": {
    "reminderId": "r_abc123",
    "updates": {
      "title": "新標題",
      "message": "新內容",
      "enabled": true
    }
  }
}
```

### 3. 刪除提醒 (`delete_reminder`)

```json
{
  "id": "cmd_004",
  "type": "delete_reminder",
  "payload": { "reminderId": "r_abc123" }
}
```

### 4. 啟用／停用提醒 (`toggle_reminder`)

```json
{
  "id": "cmd_005",
  "type": "toggle_reminder",
  "payload": { "reminderId": "r_abc123", "enabled": false }
}
```

### 5. 查詢提醒清單 (`list_reminders`)

```json
{
  "id": "cmd_006",
  "type": "list_reminders",
  "payload": { "filter": "all" }
}
```

`filter` 可為 `"all"`（全部）或 `"enabled"`（僅啟用中）。

### 6. 強制觸發通知 (`trigger_notification`)

立即對指定提醒發送一則系統通知。

```json
{
  "id": "cmd_007",
  "type": "trigger_notification",
  "payload": { "reminderId": "r_abc123" }
}
```

### 7. 查詢擴充狀態 (`get_status`)

取得擴充功能版本、總提醒數、啟用中提醒數。

```json
{
  "id": "cmd_008",
  "type": "get_status",
  "payload": {}
}
```

## 回應格式

每筆命令的回應：

```json
{
  "commandId": "cmd_001",
  "success": true,
  "data": { "reminderId": "r_new_id" }
}
```

失敗時：

```json
{
  "commandId": "cmd_001",
  "success": false,
  "error": "Reminder not found: r_abc123"
}
```

## 檔案結構

```
native-bridge/
├── bridge.js                     # Bridge 主程式（stdin/stdout JSON）
├── install.js                    # 跨平台安裝腳本
├── trigger.js                    # 通知 Extension 立即 poll
├── send-command.js               # 一站式：寫入命令 + 觸發
├── test-bridge.js                # Bridge 功能測試
└── com.openclaw.reminder_bridge.json  # Host manifest 模板
```

## 注意事項

- 使用 `externally_connectable` 機制按需觸發，命令即時執行，無定時 polling
- 下達命令後，`trigger.js` 會啟動臨時 localhost 頁面通知 Extension 立即 poll
- 若 Native Host 未安裝，擴充功能會靜默跳過，不影響正常使用
- 所有時間欄位建議使用 ISO 8601 格式並附帶時區
- 支援平台：Windows / macOS / Linux

## 疑難排解

| 問題 | 解決方式 |
|------|----------|
| Extension 收不到命令 | 確認已重啟 Chrome；檢查 `chrome://extensions/` 是否有錯誤 |
| `test-bridge.js` 失敗 | 確認 Node.js v16+ 已安裝；確認 `~/.openclaw/pending-commands/` 目錄存在 |
| Registry 寫入失敗（Windows） | 以系統管理員身份執行 `node install.js` |
| trigger.js 開啟頁面但無反應 | 確認 Extension ID 正確；確認擴充功能已啟用 |
| 命令執行但提醒沒出現 | 檢查命令 JSON 是否含 `id`、`type`、`payload` 三個必要欄位 |
