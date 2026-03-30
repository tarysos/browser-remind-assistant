// ============================================================
// Browser Reminder Assistant — 歷史紀錄型別
// 對應 SA §5.6
// ============================================================

import type { PeriodKey, ISODateTimeString } from './reminder.js';

/** 歷史事件類型 */
export type HistoryEventType =
  | 'triggered'
  | 'completed'
  | 'snoozed'
  | 'skipped'
  | 'missed_catchup';

/** 觸發來源 */
export type TriggerSource =
  | 'alarm'
  | 'browser_activity'
  | 'catchup';

/** 歷史事件上下文 */
export interface HistoryContext {
  periodKey: PeriodKey;
  source: TriggerSource;
}

/** 歷史紀錄項目 (SA §5.6) */
export interface HistoryEntry {
  id: string;
  reminderId: string;
  eventType: HistoryEventType;
  eventAt: ISODateTimeString;
  context: HistoryContext;
}
