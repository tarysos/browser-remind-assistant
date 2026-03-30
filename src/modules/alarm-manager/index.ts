// ============================================================
// alarm-manager — 建立 / 清除 / 重建 chrome.alarms
// 對應 SA §8 alarm-manager
// ============================================================

import type {
  Reminder,
  OneTimeReminder,
  RecurringReminder,
  RecurringSchedule,
  OneTimeSchedule,
} from '../../types/reminder.js';

// ============================================================
// Alarm 名稱規範
// ============================================================

/** 產生 alarm 名稱，格式: reminder:{id} */
export function getAlarmName(reminderId: string): string {
  return `reminder:${reminderId}`;
}

/** 產生 snooze alarm 名稱，格式: snooze:{id} */
export function getSnoozeAlarmName(reminderId: string): string {
  return `snooze:${reminderId}`;
}

/** 從 alarm 名稱解析 reminder ID */
export function parseAlarmName(alarmName: string): { type: 'reminder' | 'snooze'; reminderId: string } | null {
  const match = alarmName.match(/^(reminder|snooze):(.+)$/);
  if (!match) return null;
  return { type: match[1] as 'reminder' | 'snooze', reminderId: match[2] };
}

// ============================================================
// 計算下一次觸發時間
// ============================================================

/** 計算單次提醒的觸發時間 */
export function getNextFireTimeOneTime(schedule: OneTimeSchedule): number | null {
  const targetTime = new Date(schedule.dateTime).getTime();
  return targetTime > Date.now() ? targetTime : null;
}

/** 計算週期提醒的下一次觸發時間 */
export function getNextFireTimeRecurring(schedule: RecurringSchedule): number | null {
  const now = new Date();
  const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);

  if (schedule.frequency === 'daily') {
    const candidate = new Date(now);
    candidate.setHours(hours, minutes, 0, 0);
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 1);
    }
    return candidate.getTime();
  }

  if (schedule.frequency === 'weekly' && schedule.daysOfWeek.length > 0) {
    // 找最近的一個符合的星期
    for (let offset = 0; offset < 7; offset++) {
      const candidate = new Date(now);
      candidate.setDate(candidate.getDate() + offset);
      candidate.setHours(hours, minutes, 0, 0);
      const dayOfWeek = candidate.getDay();
      if (schedule.daysOfWeek.includes(dayOfWeek as any)) {
        if (candidate.getTime() > now.getTime()) {
          return candidate.getTime();
        }
      }
    }
    // 如果都不符合（理論上不會），往後找一週
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + 7);
    candidate.setHours(hours, minutes, 0, 0);
    return candidate.getTime();
  }

  return null;
}

// ============================================================
// Alarm CRUD
// ============================================================

/** 為某筆提醒建立 alarm */
export async function createAlarmForReminder(reminder: Reminder): Promise<void> {
  if (!reminder.enabled) return;

  // first_open 類型不使用 alarm，由 browser activity 觸發
  if (reminder.type === 'first_open') return;

  const alarmName = getAlarmName(reminder.id);

  // 先清除既有的
  await chrome.alarms.clear(alarmName);

  let fireTime: number | null = null;

  if (reminder.type === 'one_time') {
    fireTime = getNextFireTimeOneTime(reminder.schedule);
  } else if (reminder.type === 'recurring') {
    fireTime = getNextFireTimeRecurring(reminder.schedule);
  }

  if (fireTime !== null) {
    const delayInMinutes = Math.max((fireTime - Date.now()) / 60000, 0.1);
    await chrome.alarms.create(alarmName, { delayInMinutes });
  }
}

/** 清除某筆提醒的 alarm */
export async function clearAlarmForReminder(reminderId: string): Promise<void> {
  await chrome.alarms.clear(getAlarmName(reminderId));
  await chrome.alarms.clear(getSnoozeAlarmName(reminderId));
}

/** 建立 snooze alarm */
export async function createSnoozeAlarm(reminderId: string, delayMinutes: number): Promise<void> {
  const alarmName = getSnoozeAlarmName(reminderId);
  await chrome.alarms.clear(alarmName);
  await chrome.alarms.create(alarmName, { delayInMinutes: delayMinutes });
}

/** 清除所有本擴充建立的 alarm */
export async function clearAllAlarms(): Promise<void> {
  await chrome.alarms.clearAll();
}

// ============================================================
// 重建 Alarms（SA §6.6 Rebuild）
// ============================================================

/** 為所有啟用中的提醒重建 alarm */
export async function rebuildAllAlarms(reminders: Reminder[]): Promise<void> {
  // 先清除所有既有 alarm
  await clearAllAlarms();

  // 為每一筆啟用的提醒建立 alarm
  for (const reminder of reminders) {
    if (reminder.enabled) {
      await createAlarmForReminder(reminder);
    }
  }
}
