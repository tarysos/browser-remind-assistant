// ============================================================
// Browser Reminder Assistant — 型別統一匯出
// ============================================================

export type {
  ReminderType,
  Frequency,
  DayOfWeek,
  TimeString,
  ISODateTimeString,
  PeriodKey,
  OneTimeSchedule,
  RecurringSchedule,
  FirstOpenSchedule,
  SiteTriggerSchedule,
  Schedule,
  BasicRule,
  FirstOpenRule,
  SiteTriggerRule,
  Rule,
  OneTimeState,
  RecurringState,
  ReminderState,
  ReminderMeta,
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
  Reminder,
} from './reminder.js';

export type {
  HistoryEventType,
  TriggerSource,
  HistoryContext,
  HistoryEntry,
} from './history.js';

export type {
  GlobalSettings,
} from './settings.js';

// ============================================================
// Storage 資料結構（chrome.storage.local 的 key/value 形狀）
// ============================================================

import type { Reminder } from './reminder.js';
import type { HistoryEntry } from './history.js';
import type { GlobalSettings } from './settings.js';

/** chrome.storage.local 中存放的完整資料結構 */
export interface StorageSchema {
  reminders: Record<string, Reminder>;
  history: HistoryEntry[];
  settings: GlobalSettings;
}
