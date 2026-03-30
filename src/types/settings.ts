// ============================================================
// Browser Reminder Assistant — 全域設定型別
// 對應 SA §7.2 全域設定
// ============================================================

import type { TimeString } from './reminder.js';

/** 全域設定 */
export interface GlobalSettings {
  /** 預設時區，例如 "Asia/Taipei" */
  defaultTimezone: string;

  /** 安靜時段開始（該時段內不發送通知） */
  quietHoursStart: TimeString | null;

  /** 安靜時段結束 */
  quietHoursEnd: TimeString | null;

  /** 是否啟用補提醒 */
  enableMissedCatchup: boolean;

  /** badge 顯示規則: 'pending' 未處理數 | 'today' 今日待辦數 */
  badgeDisplay: 'pending' | 'today';
}
