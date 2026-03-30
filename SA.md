# Browser Reminder Assistant — 系統分析文件（SA）

## 1. 目標與範圍

### 1.1 目標

建立一個瀏覽器擴充功能型提醒助手，讓使用者可在瀏覽器內設定並接收以下提醒：

- **單次提醒**
  - 指定日期與時間提醒一次
- **固定週期提醒**
  - 每天固定時間提醒
  - 每週固定星期幾與時間提醒
- **首次開啟型提醒**
  - 每天第一次開啟瀏覽器時提醒
  - 每週第一次開啟瀏覽器時提醒
  - 可限定有效時段，例如「只有在 08:00–12:00 之間的第一次開啟才提醒」
- **補提醒 / 延後提醒**
  - 錯過提醒後於下次開啟瀏覽器補提醒
  - 可稍後提醒（Snooze）

本系統定位為：

- 瀏覽器工作流中的**輕量提醒助手**
- 而非作業系統層級的全天候鬧鐘系統

### 1.2 不在範圍

MVP 不涵蓋以下內容：

- 瀏覽器關閉期間的 OS 級準點通知保證
- 手機 App / 桌面 App 雙端同步
- AI 自動判斷提醒內容與時機
- 團隊共享提醒 / 多人協作
- 與 Google Calendar、Todo 平台雙向同步
- 過度複雜的規則引擎（如多條件布林邏輯組合）

### 1.3 產品定位

本產品不是一般鬧鐘，而是針對 **「瀏覽器使用情境」** 的提醒工具。
其價值在於：

- 使用者進入工作流時即時提醒
- 以「第一次開工」為觸發點，而非一味準點轟炸
- 提供補提醒、略過、延後等緩衝機制
- 降低提醒疲勞與干擾感
## 2. 核心需求

### 2.1 功能需求（FR）

#### FR-1 建立提醒

系統須支援建立以下提醒類型：

- **One-time Reminder**（單次提醒）
- **Recurring Reminder**（每日/每週週期提醒）
- **First-open Reminder**（每日/每週第一次開啟提醒）

#### FR-2 編輯與刪除提醒

使用者可：

- 編輯提醒標題、內容、時間、規則
- 啟用 / 停用提醒
- 刪除提醒

#### FR-3 準點提醒

對於單次與固定週期提醒，系統需在符合時間時嘗試觸發通知。

#### FR-4 首次開啟提醒

系統需支援：

- 每日第一次開啟瀏覽器提醒
- 每週第一次開啟瀏覽器提醒

並支援以下擴充條件：

- 僅限特定星期
- 僅限有效時段內
- 同一期間只提醒一次

#### FR-5 補提醒（Missed Reminder）

若提醒到期時瀏覽器未處於可執行擴充邏輯的狀態，系統於下次有效喚醒時應可判斷是否補提醒。

#### FR-6 稍後提醒（Snooze）

使用者可將提醒延後，例如：

- 10 分鐘後
- 30 分鐘後
- 1 小時後
- 明天同時段

#### FR-7 完成 / 略過

使用者可對提醒執行：

- 完成
- 今日略過
- 關閉通知但保留提醒規則

#### FR-8 今日提醒清單

Popup 頁面需提供：

- 今日待處理提醒
- 即將到來提醒
- 已延後提醒

#### FR-9 設定頁管理

Options Page 需提供：

- 所有提醒列表
- 篩選與搜尋
- 規則編輯
- 歷史紀錄檢視
- 匯出 / 匯入 JSON（V2 可補）

#### FR-10 Badge 顯示

擴充功能 icon badge 可顯示：

- 未處理提醒數量
- 或今日待辦數量

### 2.2 非功能需求（NFR）

#### NFR-1 與 MV3 相容

系統必須符合 Manifest V3 架構。Chrome 擴充在 MV3 下應使用 extension service worker 取代過去的長駐 background page，且 service worker 屬於事件驅動、非持久常駐模型。

#### NFR-2 狀態可持久化

由於 service worker 可能被終止，系統不得將提醒狀態只保存在記憶體；提醒資料、已觸發狀態、snooze 狀態等必須存於持久化儲存。Chrome Extensions 的 Storage API 適合存放這類擴充資料與狀態。

#### NFR-3 提醒不重複轟炸

同一提醒在同一個 period 內不可重複多次彈出，例如：

- 每日首次提醒一天最多一次
- 每週首次提醒一週最多一次

#### NFR-4 低干擾

提醒應輕量，不可頻繁搶焦點。應優先使用 OS 通知、badge、popup 列表等方式，而不是強制彈窗。

#### NFR-5 可恢復

瀏覽器重新啟動後，系統須能重建必要的 alarm 與運行狀態。尤其跨 session 行為不可完全依賴 alarms 本身；MDN 文件明確指出 alarms 不會跨瀏覽器 session 持久存在，因此重新啟動時應由本系統自行重建。

#### NFR-6 跨瀏覽器延展性

架構需盡量採 WebExtensions 風格設計，保留日後支援 Edge / Firefox 的可能。但 Chrome、Firefox、Safari 間 API 與行為存在差異，需有相容層抽象。

## 3. 技術約束與關鍵前提

### 3.1 技術基礎

建議技術基礎如下：

| 項目 | 技術選擇 |
|------|----------|
| Manifest Version | MV3 |
| Background Runtime | Extension Service Worker |
| Scheduling | `chrome.alarms` |
| Persistence | `chrome.storage.local` |
| UI | Popup + Options Page |
| Notification | `chrome.notifications` 或兼容 WebExtensions 通知 API |
| Permission | `alarms`, `storage`, `notifications` |

> Chrome 官方說明 MV3 中背景頁被 service worker 取代，並建議使用 alarms 進行計時型任務，使用 Storage API 進行持久化狀態管理。

### 3.2 關鍵限制

#### 限制 A：Service Worker 非常駐

不得假設背景程式永遠活著。任何需要在未來持續存在的狀態都必須落盤。Chrome 明確表示不打算支持 persistent service worker。

#### 限制 B：通知依賴 OS 機制

通知最終透過底層作業系統顯示，其外觀與互動行為可能因作業系統與使用者設定而異。

#### 限制 C：跨 Session Alarm 重建

為保守設計，系統應於擴充啟動 / 喚醒時主動檢查並重建 alarms，不可完全相信瀏覽器跨 session 幫你保留排程。MDN 明示 alarms 不會跨瀏覽器 session 持久。

## 4. 整體架構

### 4.1 架構元件

#### 4.1.1 Popup UI

用途：

- 顯示今日提醒
- 快速新增提醒
- 快速 snooze / 完成 / 略過
- 顯示未完成數

#### 4.1.2 Options Page

用途：

- 完整管理所有提醒
- 編輯規則
- 檢視觸發歷史
- 測試提醒
- 進階設定（安靜時段、補提醒策略）

#### 4.1.3 Background Service Worker

核心調度中心，負責：

- 啟動時載入提醒資料
- 重建 alarms
- 監聽 `alarms.onAlarm`
- 監聯瀏覽器活動事件
- 判斷是否觸發首次開啟提醒
- 發送通知
- 更新 badge
- 寫入提醒狀態 / 歷史

#### 4.1.4 Storage Layer

資料持久化：

- `reminders`
- `reminder states`
- `history`
- `settings`
- `rebuild metadata`

> 建議主要放於 `chrome.storage.local`。Storage API 就是 Chrome extension 專用的持久化資料方案。

#### 4.1.5 Notification Adapter

封裝通知建立、清除、互動回調，降低未來跨瀏覽器差異。

#### 4.1.6 Trigger Evaluator

規則判斷模組，負責：

- 時間是否符合
- period 是否已提醒
- 是否在 snooze 中
- 是否需補提醒
- 是否符合首次開啟條件

### 4.2 高階架構圖（文字版）

```
[Popup UI] --------\
                    \
[Options Page] ------> [Service Worker / Reminder Engine] ----> [Notifications]
                    /                |   |   \
                   /                 |   |    \
            [Badge Adapter]          |   |     -> [Browser Activity Events]
                                     |   |
                                     |   -> [Alarm Scheduler]
                                     |
                                     -> [Storage Layer]
```
## 5. 資料模型設計

### 5.1 Reminder 主體

```json
{
  "id": "r_001",
  "type": "one_time | recurring | first_open",
  "title": "提醒標題",
  "message": "提醒內容",
  "enabled": true,
  "schedule": {},
  "rule": {},
  "state": {},
  "meta": {}
}
```

### 5.2 One-time Reminder

```json
{
  "id": "r_101",
  "type": "one_time",
  "title": "繳費提醒",
  "message": "記得處理本月帳單",
  "enabled": true,
  "schedule": {
    "dateTime": "2026-04-05T14:00:00+08:00",
    "timezone": "Asia/Taipei"
  },
  "rule": {
    "allowMissedCatchup": true
  },
  "state": {
    "triggeredAt": null,
    "completedAt": null,
    "snoozeUntil": null
  },
  "meta": {
    "createdAt": "2026-03-30T14:00:00+08:00",
    "updatedAt": "2026-03-30T14:00:00+08:00"
  }
}
```

### 5.3 Recurring Reminder

```json
{
  "id": "r_201",
  "type": "recurring",
  "title": "每週週報",
  "message": "整理本週工作摘要",
  "enabled": true,
  "schedule": {
    "frequency": "weekly",
    "daysOfWeek": [1],
    "timeOfDay": "09:00",
    "timezone": "Asia/Taipei",
    "startDate": null,
    "endDate": null
  },
  "rule": {
    "allowMissedCatchup": true
  },
  "state": {
    "lastTriggeredAt": null,
    "lastTriggeredPeriodKey": null,
    "snoozeUntil": null,
    "completedAt": null
  },
  "meta": {
    "createdAt": "2026-03-30T14:00:00+08:00",
    "updatedAt": "2026-03-30T14:00:00+08:00"
  }
}
```

### 5.4 First-open Reminder

```json
{
  "id": "r_301",
  "type": "first_open",
  "title": "今日開工提醒",
  "message": "先確認今天最重要的三件事",
  "enabled": true,
  "schedule": {
    "cadence": "daily",
    "timezone": "Asia/Taipei"
  },
  "rule": {
    "triggerOn": "browser_activity",
    "validDaysOfWeek": [1, 2, 3, 4, 5],
    "timeWindowStart": "08:00",
    "timeWindowEnd": "12:00",
    "sites": [],
    "allowMissedCatchup": false
  },
  "state": {
    "lastTriggeredAt": null,
    "lastTriggeredPeriodKey": null,
    "snoozeUntil": null,
    "completedAt": null
  },
  "meta": {
    "createdAt": "2026-03-30T14:00:00+08:00",
    "updatedAt": "2026-03-30T14:00:00+08:00"
  }
}
```

### 5.5 Reminder State 補充欄位

- **`lastTriggeredPeriodKey`** — 用來防止同 period 重複提醒：
  - daily: `2026-03-30`
  - weekly: `2026-W14`
- **`snoozeUntil`** — 若目前時間小於此值，則暫不觸發。
- **`completedAt`** — 若該次提醒已完成，則不再重複提示。

### 5.6 History

```json
{
  "id": "h_001",
  "reminderId": "r_201",
  "eventType": "triggered | completed | snoozed | skipped | missed_catchup",
  "eventAt": "2026-03-30T09:00:03+08:00",
  "context": {
    "periodKey": "2026-W14",
    "source": "alarm | browser_activity | catchup"
  }
}
```
## 6. 關鍵邏輯設計

### 6.1 觸發來源

系統主要有兩大觸發來源：

#### A. Alarm Trigger

適用：

- 單次提醒
- 每日/每週固定時間提醒
- snooze 後再次提醒

#### B. Browser Activity Trigger

適用：

- 每天第一次開啟提醒
- 每週第一次開啟提醒
- 補提醒檢查
- alarm 重建檢查

可用事件例子：

- extension 啟動
- service worker 喚醒
- tab 建立
- 視窗 focus
- 使用者打開 popup
- active tab 變更

### 6.2 提醒判斷流程

#### 6.2.1 共用流程

```
接收到事件
  -> 載入 reminders 與 states
  -> 篩選 enabled reminders
  -> 對每筆 reminder 執行 Trigger Evaluator
  -> 若符合觸發條件
       -> 建立通知
       -> 更新 state
       -> 寫 history
       -> 更新 badge
```

#### 6.2.2 Trigger Evaluator 順序

每筆提醒依序判斷：

1. 是否啟用
2. 是否已完成
3. 是否在 snooze 中
4. 是否符合提醒類型的時間/規則
5. 本 period 是否已提醒過
6. 是否符合補提醒條件
7. 若成立則觸發通知

### 6.3 首次開啟提醒判斷

#### 定義

「首次開啟」不應狹義綁定為「瀏覽器程序剛啟動的瞬間」，而應定義為：

> 在某一 period 內，第一次偵測到有效瀏覽器活動時觸發一次提醒

- **Daily first-open** — `periodKey = YYYY-MM-DD`
- **Weekly first-open** — `periodKey = YYYY-Www`

#### 判斷條件

以 daily 為例：

1. 今天在 `validDaysOfWeek` 內
2. 目前時間位於有效時段
3. `lastTriggeredPeriodKey !== 今天`
4. reminder 非 snooze / 非 completed
5. 觸發後更新 `lastTriggeredPeriodKey`

### 6.4 Missed Reminder 補提醒

#### 補提醒場景

若某提醒理論上應於過去某時間點觸發，但瀏覽器未能執行擴充邏輯，則下次瀏覽器活動時：

1. 檢查是否有過期但未處理提醒
2. 若該提醒允許補提醒，則建立 `missed_catchup` 通知

#### 補提醒策略

MVP 建議：

- **one-time**：允許補提醒
- **recurring**：允許補提醒，但只補最近一次
- **first-open**：不補提醒，因其本質就是「進入工作場景時提醒」

### 6.5 Snooze 流程

#### 使用者行為

通知上點擊：

- 10 分鐘後提醒
- 30 分鐘後提醒
- 1 小時後提醒

#### 系統處理

1. 更新 `state.snoozeUntil`
2. 建立對應 alarm
3. 到點再走標準 trigger 流程

### 6.6 重建流程（Rebuild）

瀏覽器或 extension 重新啟動時：

1. 載入所有 enabled reminders
2. 找出需存在 alarm 的提醒
3. 重新計算下一次觸發時間
4. 重建 alarms
5. 檢查是否有 missed reminders
6. 更新 badge

> 這是必要的，因為 MV3 service worker 非持久，且 alarms 跨 session 的穩定性不應作為唯一依賴。

## 7. UI/UX 設計

### 7.1 Popup 設計

**目標：** 提供「輕量即看即用」體驗。

**區塊：**

- 今日待處理提醒
- 即將到來提醒
- 已 snooze 提醒
- 快速新增

**每筆提醒操作：**

- 完成
- 稍後提醒
- 略過
- 編輯

### 7.2 Options Page 設計

**目標：** 提供完整管理能力。

**區塊：**

- 所有提醒列表
- 新增 / 編輯表單
- 篩選條件
- 歷史紀錄
- 全域設定

**全域設定範例：**

- 預設時區
- 安靜時段
- 是否顯示補提醒
- popup 顯示模式
- badge 顯示規則

### 7.3 通知設計

通知透過系統通知機制顯示，因此外觀與互動可能因 OS 而異。系統需避免依賴過於複雜的通知互動模型。

通知內容建議：

- Title
- Message
- Source / 類型標記（例如：今日首次提醒、補提醒）
- 操作：完成 / 稍後 / 略過
## 8. 模組切分

### 8.1 建議模組

#### `reminder-repository`

負責：

- CRUD reminders
- CRUD states
- history 寫入 / 讀取

#### `alarm-manager`

負責：

- 建立 alarm
- 清除 alarm
- 重建 alarm
- 計算下一次觸發時間

#### `trigger-evaluator`

負責：

- 計算 period key
- 判斷是否符合時間規則
- 判斷是否已提醒
- 判斷是否需補提醒

#### `notification-manager`

負責：

- 建立通知
- 清除通知
- 處理通知互動回調

#### `badge-manager`

負責：

- 更新 badge 數字
- 更新 badge 狀態

#### `lifecycle-manager`

負責：

- extension install / update
- startup rebuild
- service worker 喚醒初始化

#### `popup-controller`

負責：

- 今日列表
- 快速操作

#### `options-controller`

負責：

- 表單驗證
- 規則儲存
- 歷史列表呈現

## 9. Manifest 與權限建議

### 9.1 Manifest 方向

建議使用 MV3，並定義：

- `background.service_worker`
- `action.default_popup`
- `options_page`
- 權限：`alarms`, `storage`, `notifications`

> Chrome 官方已將 MV3 作為現行主流架構，且 service worker 是背景邏輯中心。

### 9.2 權限原則

只申請必要權限：

- `alarms`：週期與單次排程
- `storage`：持久化提醒資料
- `notifications`：系統通知

若未來做網站情境提醒，再考慮新增：

- `tabs`
- `activeTab`
- `host_permissions`
## 10. 邊界情境與風險

### 10.1 瀏覽器關閉時無法保證準點提醒

這是架構性限制。瀏覽器擴充不是系統常駐鬧鐘。
因此產品文案與設計需明確定位為：

- 瀏覽器工作流提醒
- 支援補提醒
- 不承諾 OS 級背景精準喚醒

### 10.2 Service Worker 回收

若某些狀態只放記憶體，將導致：

- 重複提醒
- 漏提醒
- snooze 消失
- 補提醒錯亂

因此所有關鍵狀態必須持久化。

### 10.3 跨平台通知差異

通知是否有 action button、顯示樣式、停留時間等都可能受 OS 限制。不能把複雜流程綁死在通知互動上。

### 10.4 跨瀏覽器差異

WebExtensions 雖有共通模型，但仍存在實作差異，尤其在 alarm、service worker、通知互動與 manifest 支援細節上。

## 11. MVP 建議範圍

### 11.1 必做

**功能：**

- 建立單次提醒
- 建立每日固定提醒
- 建立每週固定提醒
- 建立每日第一次開啟提醒
- 建立每週第一次開啟提醒
- snooze
- 完成 / 略過
- missed catch-up
- popup 今日清單
- options page 管理頁

**技術：**

- MV3 service worker
- alarms
- `storage.local`
- notifications
- badge

### 11.2 可延後到 V2

- 指定網站提醒
- 工作日/假日規則
- 匯入 / 匯出 JSON
- 完成率與略過率統計
- 多語系
- sync 設定同步

### 11.3 V3 方向

- 自然語言建立提醒
- 與 Calendar / Todo 串接
- 提醒優先級與智能降噪
- 使用習慣學習
- 工作流導向提醒（例如打開 Gmail/Jira/Notion 才提醒）

## 12. 建議的實作策略

### 12.1 第一階段

先做穩定的時間型與首次開啟型提醒：

- one-time
- recurring
- first-open daily / weekly
- snooze
- catch-up

> 先把 Trigger Evaluator + Storage State + Alarm Rebuild 做穩。

### 12.2 第二階段

補強 UX：

- badge
- 歷史紀錄
- 安靜時段
- 今日列表排序
- 通知互動優化

### 12.3 第三階段

加入情境提醒：

- 特定網站
- 指定工作時段
- 工作流入口提醒

## 13. 結論

此系統最適合設計成：

> **MV3 瀏覽器擴充功能型提醒助手**

核心採：

- **Service Worker** 作為事件驅動中樞
- **Alarms** 作為時間排程
- **Storage** 作為提醒與狀態持久化
- **Notifications** 作為提示介面

## 14. OpenClaw 未來擴充整合設計（Native Messaging 方向）

為避免額外常駐一個本機 HTTP 服務並降低背景資源占用，未來與 OpenClaw 的整合建議優先採 Chrome Native Messaging 機制，而非 localhost API。Native Messaging 允許 Browser Extension 與已註冊的本機程式（native messaging host）交換訊息，通訊方式為標準輸入與標準輸出，而非透過 port 對外提供 HTTP 服務。OpenClaw 不直接讀寫 extension storage，也不直接操作 chrome.storage.local；相反地，OpenClaw 應透過本機 helper / CLI 提交提醒請求，由 extension 透過 Native Messaging 與該 helper 交換資料，再由 extension 自行完成 reminder 寫入、alarm 重建、badge 更新與通知觸發。此設計可避免將提醒能力做成常駐背景服務，同時保留 extension 對內部狀態與排程引擎的所有權。實作上應採 短連線、按需喚起 模式，避免長時間保持 native connection 導致 service worker 不必要地持續存活。