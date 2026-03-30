// ============================================================
// Background Service Worker — 核心調度中心
// 對應 SA §4.1.3 + §6.1
// ============================================================

import {
  getEnabledReminders,
  getReminderById,
  updateReminder,
  addHistoryEntry,
} from '../modules/reminder-repository/index.js';
import {
  parseAlarmName,
  createAlarmForReminder,
  createSnoozeAlarm,
  clearAlarmForReminder,
} from '../modules/alarm-manager/index.js';
import {
  evaluate,
  evaluateAll,
  getPeriodKey,
} from '../modules/trigger-evaluator/index.js';
import {
  showNotification,
  clearNotification,
  setupNotificationListeners,
  type NotificationAction,
} from '../modules/notification-manager/index.js';
import {
  performStartupRebuild,
  setupInstallListener,
  setupStartupListener,
} from '../modules/lifecycle-manager/index.js';
import { updateBadge } from '../modules/badge-manager/index.js';
import { getSettings } from '../modules/reminder-repository/index.js';
import { isWithinTimeWindow } from '../modules/trigger-evaluator/index.js';
import type {
  Reminder,
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
} from '../types/reminder.js';
import type { TriggerSource, HistoryEventType } from '../types/history.js';
import type { TriggerResult } from '../modules/trigger-evaluator/index.js';

// ============================================================
// Snooze 預設延後分鐘數
// ============================================================
const DEFAULT_SNOOZE_MINUTES = 30;

/** 取得提醒的頻率（用於計算 periodKey） */
function getFrequency(reminder: Reminder): 'daily' | 'weekly' | 'monthly' {
  switch (reminder.type) {
    case 'one_time': return 'daily';
    case 'recurring': return (reminder as RecurringReminder).schedule.frequency;
    case 'first_open': return (reminder as FirstOpenReminder).schedule.cadence;
    case 'site_trigger': {
      const cadence = (reminder as SiteTriggerReminder).schedule.cadence;
      return cadence === 'every_visit' ? 'daily' : cadence;
    }
    default: return 'daily';
  }
}

// ============================================================
// 核心觸發流程 (SA §6.2.1)
// ============================================================

/**
 * 觸發單筆提醒：發送通知 → 更新狀態 → 寫歷史 → 重建 alarm
 */
async function triggerReminder(reminder: Reminder, result: TriggerResult): Promise<void> {
  console.log(`[sw] 觸發提醒: ${reminder.title} (${result.reason})`);

  // 0. 安靜時段檢查 — 若在安靜時段內則不發送通知
  const settings = await getSettings();
  if (settings.quietHoursStart && settings.quietHoursEnd) {
    if (isWithinTimeWindow(settings.quietHoursStart, settings.quietHoursEnd)) {
      console.log(`[sw] 安靜時段中，略過通知: ${reminder.title}`);
      return;
    }
  }

  // 1. 發送通知
  await showNotification(reminder, result);

  // 2. 更新狀態
  const now = new Date().toISOString();
  if (reminder.type === 'one_time') {
    (reminder as OneTimeReminder).state.triggeredAt = now;
  } else {
    const state = (reminder as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state;
    state.lastTriggeredAt = now;
    state.lastTriggeredPeriodKey = getPeriodKey(getFrequency(reminder));
  }
  await updateReminder(reminder);

  // 3. 寫歷史
  await addHistoryEntry(
    reminder.id,
    result.reason === 'missed_catchup' ? 'missed_catchup' : 'triggered',
    getPeriodKey(getFrequency(reminder)),
    result.source,
  );

  // 4. 為 recurring 類型重建下一次 alarm
  if (reminder.type === 'recurring') {
    await createAlarmForReminder(reminder);
  }

  // 5. 更新 badge
  await updateBadge();
}

/**
 * 處理 alarm 觸發事件 (SA §6.1 A. Alarm Trigger)
 */
async function handleAlarmTrigger(alarm: chrome.alarms.Alarm): Promise<void> {
  const parsed = parseAlarmName(alarm.name);
  if (!parsed) return;

  const reminder = await getReminderById(parsed.reminderId);
  if (!reminder) return;

  const source: TriggerSource = parsed.type === 'snooze' ? 'alarm' : 'alarm';
  const result = evaluate(reminder, source);

  if (result.shouldTrigger) {
    await triggerReminder(reminder, result);
  }
}

/**
 * 處理瀏覽器活動事件 (SA §6.1 B. Browser Activity Trigger)
 */
async function handleBrowserActivity(): Promise<void> {
  const reminders = await getEnabledReminders();
  const triggered = evaluateAll(reminders, 'browser_activity');

  for (const { reminder, result } of triggered) {
    await triggerReminder(reminder, result);
  }
}

/**
 * 處理分頁導覽事件 — 網站情境提醒 (SA §12.3)
 * 當使用者切換分頁或導覽至新網址時觸發
 */
async function handleTabNavigation(url: string): Promise<void> {
  const reminders = await getEnabledReminders();
  const triggered = evaluateAll(reminders, 'browser_activity', url);

  for (const { reminder, result } of triggered) {
    await triggerReminder(reminder, result);
  }
}

// ============================================================
// 通知互動回調 (SA §6.5 Snooze / §FR-7 完成/略過)
// ============================================================

async function handleNotificationAction(
  reminderId: string,
  action: NotificationAction,
): Promise<void> {
  const reminder = await getReminderById(reminderId);
  if (!reminder) return;

  const now = new Date().toISOString();
  let eventType: HistoryEventType;
  const periodKey = getPeriodKey(getFrequency(reminder));

  switch (action) {
    case 'complete': {
      if (reminder.type === 'one_time') {
        (reminder as OneTimeReminder).state.completedAt = now;
      } else {
        (reminder as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.completedAt = now;
      }
      eventType = 'completed';
      await clearNotification(reminderId);
      break;
    }
    case 'snooze': {
      const snoozeUntil = new Date(Date.now() + DEFAULT_SNOOZE_MINUTES * 60000).toISOString();
      if (reminder.type === 'one_time') {
        (reminder as OneTimeReminder).state.snoozeUntil = snoozeUntil;
      } else {
        (reminder as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.snoozeUntil = snoozeUntil;
      }
      await createSnoozeAlarm(reminderId, DEFAULT_SNOOZE_MINUTES);
      eventType = 'snoozed';
      await clearNotification(reminderId);
      break;
    }
    case 'skip':
      eventType = 'skipped';
      break;
    case 'click':
      // 點擊通知本體 → 不做狀態變更，僅記錄
      return;
    default:
      return;
  }

  await updateReminder(reminder);
  await addHistoryEntry(reminderId, eventType!, periodKey, 'alarm');
  await updateBadge();
}

// ============================================================
// 啟動與事件註冊
// ============================================================

/** 啟動重建並處理補提醒 */
async function onStartup(): Promise<void> {
  const missed = await performStartupRebuild();
  for (const reminder of missed) {
    const result = evaluate(reminder, 'catchup');
    if (result.shouldTrigger) {
      await triggerReminder(reminder, result);
    }
  }
  // 啟動後更新 badge
  await updateBadge();
}

// --- install / update / startup ---
setupInstallListener(
  () => { onStartup(); },
  (_prev) => { onStartup(); },
);
setupStartupListener(() => { onStartup(); });

// --- alarm ---
chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarmTrigger(alarm);
});

// --- browser activity (SA §6.1 B) ---
// tab 建立、視窗 focus → 檢查 first-open 與補提醒
chrome.tabs.onCreated.addListener(() => { handleBrowserActivity(); });
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId !== chrome.windows.WINDOW_ID_NONE) {
    handleBrowserActivity();
  }
});
chrome.tabs.onActivated.addListener((activeInfo) => {
  handleBrowserActivity();
  // 取得切換到的分頁 URL → site-trigger 評估
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab?.url) handleTabNavigation(tab.url);
  });
});

// --- site-trigger: 分頁網址變更 (SA §12.3) ---
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在 URL 變更且頁面載入完成時觸發
  if (changeInfo.status === 'complete' && tab.url) {
    handleTabNavigation(tab.url);
  }
});

// --- notification 互動 ---
setupNotificationListeners(handleNotificationAction);

console.log('[sw] Service Worker 已載入');
