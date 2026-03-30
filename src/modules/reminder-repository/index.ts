// ============================================================
// reminder-repository — CRUD reminders / states / history
// 對應 SA §8 reminder-repository
// 使用 chrome.storage.local 作為持久化層
// ============================================================

import type {
  Reminder,
  ReminderType,
} from '../../types/reminder.js';
import type { HistoryEntry, HistoryEventType, TriggerSource } from '../../types/history.js';
import type { GlobalSettings } from '../../types/settings.js';

// ============================================================
// 常數 & 預設值
// ============================================================

const STORAGE_KEY_REMINDERS = 'reminders';
const STORAGE_KEY_HISTORY = 'history';
const STORAGE_KEY_SETTINGS = 'settings';

const DEFAULT_SETTINGS: GlobalSettings = {
  defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  quietHoursStart: null,
  quietHoursEnd: null,
  enableMissedCatchup: true,
  badgeDisplay: 'pending',
};

// ============================================================
// ID 產生器
// ============================================================

export function generateId(prefix: string = 'r'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ============================================================
// Reminder CRUD
// ============================================================

/** 取得所有提醒（以 Record<id, Reminder> 形式） */
export async function getAllReminders(): Promise<Record<string, Reminder>> {
  const result = await chrome.storage.local.get(STORAGE_KEY_REMINDERS);
  return (result[STORAGE_KEY_REMINDERS] as Record<string, Reminder>) ?? {};
}

/** 取得所有提醒（陣列） */
export async function getAllRemindersArray(): Promise<Reminder[]> {
  const map = await getAllReminders();
  return Object.values(map);
}

/** 依 ID 取得單筆提醒 */
export async function getReminderById(id: string): Promise<Reminder | null> {
  const map = await getAllReminders();
  return map[id] ?? null;
}

/** 新增提醒 */
export async function createReminder(reminder: Reminder): Promise<Reminder> {
  const map = await getAllReminders();
  map[reminder.id] = reminder;
  await chrome.storage.local.set({ [STORAGE_KEY_REMINDERS]: map });
  return reminder;
}

/** 更新提醒（整筆覆蓋） */
export async function updateReminder(reminder: Reminder): Promise<Reminder> {
  const map = await getAllReminders();
  if (!map[reminder.id]) {
    throw new Error(`Reminder not found: ${reminder.id}`);
  }
  reminder.meta.updatedAt = new Date().toISOString();
  map[reminder.id] = reminder;
  await chrome.storage.local.set({ [STORAGE_KEY_REMINDERS]: map });
  return reminder;
}

/** 刪除提醒 */
export async function deleteReminder(id: string): Promise<void> {
  const map = await getAllReminders();
  delete map[id];
  await chrome.storage.local.set({ [STORAGE_KEY_REMINDERS]: map });
}

/** 啟用 / 停用提醒 */
export async function toggleReminder(id: string, enabled: boolean): Promise<Reminder> {
  const reminder = await getReminderById(id);
  if (!reminder) throw new Error(`Reminder not found: ${id}`);
  reminder.enabled = enabled;
  return updateReminder(reminder);
}

/** 依類型篩選 */
export async function getRemindersByType(type: ReminderType): Promise<Reminder[]> {
  const all = await getAllRemindersArray();
  return all.filter((r) => r.type === type);
}

/** 取得所有啟用中的提醒 */
export async function getEnabledReminders(): Promise<Reminder[]> {
  const all = await getAllRemindersArray();
  return all.filter((r) => r.enabled);
}

// ============================================================
// History
// ============================================================

/** 取得所有歷史紀錄 */
export async function getHistory(): Promise<HistoryEntry[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY_HISTORY);
  return (result[STORAGE_KEY_HISTORY] as HistoryEntry[]) ?? [];
}

/** 寫入一筆歷史紀錄 */
export async function addHistoryEntry(
  reminderId: string,
  eventType: HistoryEventType,
  periodKey: string,
  source: TriggerSource,
): Promise<HistoryEntry> {
  const entry: HistoryEntry = {
    id: generateId('h'),
    reminderId,
    eventType,
    eventAt: new Date().toISOString(),
    context: { periodKey, source },
  };
  const history = await getHistory();
  history.push(entry);
  await chrome.storage.local.set({ [STORAGE_KEY_HISTORY]: history });
  return entry;
}

/** 取得特定提醒的歷史紀錄 */
export async function getHistoryByReminderId(reminderId: string): Promise<HistoryEntry[]> {
  const history = await getHistory();
  return history.filter((h) => h.reminderId === reminderId);
}

// ============================================================
// Settings
// ============================================================

/** 取得全域設定 */
export async function getSettings(): Promise<GlobalSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
  return (result[STORAGE_KEY_SETTINGS] as GlobalSettings) ?? { ...DEFAULT_SETTINGS };
}

/** 更新全域設定（部分更新） */
export async function updateSettings(partial: Partial<GlobalSettings>): Promise<GlobalSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
  return updated;
}
