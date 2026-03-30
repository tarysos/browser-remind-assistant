// ============================================================
// Browser Reminder Assistant — 資料型別定義
// 對應 SA §5 資料模型設計
// ============================================================

/** 提醒類型 */
export type ReminderType = 'one_time' | 'recurring' | 'first_open' | 'site_trigger';

/** 週期頻率 */
export type Frequency = 'daily' | 'weekly';

/** 星期（0=日, 1=一, ..., 6=六） */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 時間字串格式 HH:mm */
export type TimeString = string;

/** ISO 8601 日期時間字串 */
export type ISODateTimeString = string;

/** Period Key: YYYY-MM-DD 或 YYYY-Www */
export type PeriodKey = string;

// ============================================================
// Schedule 排程定義
// ============================================================

/** 單次提醒排程 (SA §5.2) */
export interface OneTimeSchedule {
  dateTime: ISODateTimeString;
  timezone: string;
}

/** 週期提醒排程 (SA §5.3) */
export interface RecurringSchedule {
  frequency: Frequency;
  daysOfWeek: DayOfWeek[];
  timeOfDay: TimeString;
  timezone: string;
  startDate: ISODateTimeString | null;
  endDate: ISODateTimeString | null;
}

/** 首次開啟提醒排程 (SA §5.4) */
export interface FirstOpenSchedule {
  cadence: Frequency;
  timezone: string;
}

/** 網站情境提醒排程 (SA §12.3) */
export interface SiteTriggerSchedule {
  /** 觸發頻率: 每次造訪 | 每天首次造訪 | 每週首次造訪 */
  cadence: 'every_visit' | 'daily' | 'weekly';
  timezone: string;
}

export type Schedule = OneTimeSchedule | RecurringSchedule | FirstOpenSchedule | SiteTriggerSchedule;

// ============================================================
// Rule 規則定義
// ============================================================

/** 單次 / 週期提醒規則 */
export interface BasicRule {
  allowMissedCatchup: boolean;
}

/** 首次開啟提醒規則 (SA §5.4) */
export interface FirstOpenRule {
  triggerOn: 'browser_activity';
  validDaysOfWeek: DayOfWeek[];
  timeWindowStart: TimeString;
  timeWindowEnd: TimeString;
  sites: string[];
  allowMissedCatchup: boolean;
}

/** 網站情境提醒規則 (SA §12.3) */
export interface SiteTriggerRule {
  /** URL 匹配模式，支援 glob（例如 "*://mail.google.com/*"） */
  urlPatterns: string[];
  /** 有效星期 */
  validDaysOfWeek: DayOfWeek[];
  /** 工作時段開始 */
  timeWindowStart: TimeString;
  /** 工作時段結束 */
  timeWindowEnd: TimeString;
  /** 是否允許補提醒 */
  allowMissedCatchup: boolean;
}

export type Rule = BasicRule | FirstOpenRule | SiteTriggerRule;

// ============================================================
// State 狀態定義
// ============================================================

/** 單次提醒狀態 (SA §5.2) */
export interface OneTimeState {
  triggeredAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  snoozeUntil: ISODateTimeString | null;
}

/** 週期 / 首次開啟提醒狀態 (SA §5.3, §5.4) */
export interface RecurringState {
  lastTriggeredAt: ISODateTimeString | null;
  lastTriggeredPeriodKey: PeriodKey | null;
  snoozeUntil: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
}

export type ReminderState = OneTimeState | RecurringState;

// ============================================================
// Meta 元資料
// ============================================================

export interface ReminderMeta {
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

// ============================================================
// Reminder 主體 (SA §5.1)
// ============================================================

interface ReminderBase {
  id: string;
  title: string;
  message: string;
  enabled: boolean;
  meta: ReminderMeta;
}

export interface OneTimeReminder extends ReminderBase {
  type: 'one_time';
  schedule: OneTimeSchedule;
  rule: BasicRule;
  state: OneTimeState;
}

export interface RecurringReminder extends ReminderBase {
  type: 'recurring';
  schedule: RecurringSchedule;
  rule: BasicRule;
  state: RecurringState;
}

export interface FirstOpenReminder extends ReminderBase {
  type: 'first_open';
  schedule: FirstOpenSchedule;
  rule: FirstOpenRule;
  state: RecurringState;
}

export interface SiteTriggerReminder extends ReminderBase {
  type: 'site_trigger';
  schedule: SiteTriggerSchedule;
  rule: SiteTriggerRule;
  state: RecurringState;
}

/** 聯合類型：所有提醒 */
export type Reminder = OneTimeReminder | RecurringReminder | FirstOpenReminder | SiteTriggerReminder;
