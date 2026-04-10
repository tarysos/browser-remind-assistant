// ============================================================
// badge-manager — 更新擴充功能 icon badge
// 對應 SA §8 badge-manager + FR-10
// ============================================================

import { getAllRemindersArray } from '../reminder-repository/index.js';
import { getSettings } from '../reminder-repository/index.js';
import { evaluate, getPeriodKey, getReminderFrequency, isCompletedInCurrentPeriod } from '../trigger-evaluator/index.js';
import type {
  Reminder,
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
} from '../../types/reminder.js';

// ============================================================
// Badge 計算
// ============================================================

/**
 * 計算「未處理」提醒數量：
 * 已觸發但尚未完成、非 snooze 中的提醒
 */
function countPending(reminders: Reminder[]): number {
  const now = Date.now();
  let count = 0;

  for (const r of reminders) {
    if (!r.enabled) continue;

    if (r.type === 'one_time') {
      const s = (r as OneTimeReminder).state;
      if (s.completedAt) continue;
      if (s.snoozeUntil && new Date(s.snoozeUntil).getTime() > now) continue;
      // 時間已到且未完成
      const targetTime = new Date((r as OneTimeReminder).schedule.dateTime).getTime();
      if (targetTime <= now && !s.triggeredAt) count++;
      if (s.triggeredAt && !s.completedAt) count++;
    } else {
      const s = (r as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state;
      const freq = getReminderFrequency(r);
      // completedAt 只阻擋當期
      if (isCompletedInCurrentPeriod(s.completedAt, freq)) continue;
      if (s.snoozeUntil && new Date(s.snoozeUntil).getTime() > now) continue;

      // 已觸發但本 period 尚未完成
      if (s.lastTriggeredAt) {
        const currentPeriod = getPeriodKey(freq);
        if (s.lastTriggeredPeriodKey === currentPeriod && !isCompletedInCurrentPeriod(s.completedAt, freq)) {
          count++;
        }
      }
    }
  }

  return count;
}

/**
 * 計算「今日待辦」提醒數量：
 * 今天應觸發（含已觸發未完成 + 尚未觸發）的提醒
 */
function countToday(reminders: Reminder[]): number {
  let count = 0;

  for (const r of reminders) {
    if (!r.enabled) continue;

    // 已完成的跳過：單次永久跳過，週期只跳過當期
    if (r.type === 'one_time') {
      if ((r as OneTimeReminder).state.completedAt) continue;
    } else {
      const completedAt = (r as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.completedAt;
      if (isCompletedInCurrentPeriod(completedAt, getReminderFrequency(r))) continue;
    }

    if (r.type === 'one_time') {
      const target = new Date((r as OneTimeReminder).schedule.dateTime);
      const today = new Date();
      if (
        target.getFullYear() === today.getFullYear() &&
        target.getMonth() === today.getMonth() &&
        target.getDate() === today.getDate()
      ) {
        count++;
      }
    } else {
      // recurring / first_open → 用 evaluate 判斷今日是否該觸發
      const result = evaluate(r, 'browser_activity');
      if (result.shouldTrigger) count++;

      // 已觸發本 period 但未完成也算
      const s = (r as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state;
      const freq = getReminderFrequency(r);
      if (s.lastTriggeredPeriodKey === getPeriodKey(freq) && !isCompletedInCurrentPeriod(s.completedAt, freq)) {
        count++;
      }
    }
  }

  return count;
}

// ============================================================
// 更新 Badge
// ============================================================

/**
 * 根據設定計算並更新 badge
 */
export async function updateBadge(): Promise<void> {
  const [reminders, settings] = await Promise.all([
    getAllRemindersArray(),
    getSettings(),
  ]);

  const count = settings.badgeDisplay === 'pending'
    ? countPending(reminders)
    : countToday(reminders);

  if (count > 0) {
    await chrome.action.setBadgeText({ text: String(count) });
    await chrome.action.setBadgeBackgroundColor({ color: '#e74c3c' });
  } else {
    await chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * 清除 badge
 */
export async function clearBadge(): Promise<void> {
  await chrome.action.setBadgeText({ text: '' });
}
