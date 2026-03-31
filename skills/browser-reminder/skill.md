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

1. 安裝 **Browser Reminder Assistant** Chrome 擴充功能
2. 安裝 Native Messaging Bridge：
   ```bash
   cd native-bridge
   node install.js <your-chrome-extension-id>
   ```
   Extension ID 可在 `chrome://extensions/` 中找到。
3. Bridge 會自動在系統中註冊（Windows: Registry / macOS: NativeMessagingHosts / Linux: ~/.config）

## 發送命令

使用 `send-command.js` 一站式寫入命令並觸發 Extension：

```bash
# 查詢狀態
node send-command.js <ext-id> '{"id":"cmd_001","type":"get_status","payload":{}}'

# 建立提醒
node send-command.js <ext-id> '{"id":"cmd_002","type":"create_reminder","payload":{...}}'

# 也可傳入檔案路徑
node send-command.js <ext-id> ./my-command.json
```

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
