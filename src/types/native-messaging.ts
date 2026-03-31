// ============================================================
// Browser Reminder Assistant — Native Messaging 型別定義
// 對應 SA §14 OpenClaw 整合設計
// ============================================================

import type { ReminderType } from './reminder.js';

// ============================================================
// Native Messaging Host 常數
// ============================================================

/** Native Messaging Host 名稱（需與 native host manifest 的 name 一致） */
export const NATIVE_HOST_NAME = 'com.openclaw.reminder_bridge';

// ============================================================
// 命令類型
// ============================================================

/** OpenClaw 支援的命令類型 */
export type NativeCommandType =
  | 'create_reminder'
  | 'update_reminder'
  | 'delete_reminder'
  | 'toggle_reminder'
  | 'list_reminders'
  | 'trigger_notification'
  | 'get_status';

// ============================================================
// 命令 Payload 定義
// ============================================================

/** 建立提醒 */
export interface CreateReminderPayload {
  title: string;
  message: string;
  reminderType: ReminderType;
  schedule: Record<string, unknown>;
  rule: Record<string, unknown>;
}

/** 更新提醒 */
export interface UpdateReminderPayload {
  reminderId: string;
  updates: {
    title?: string;
    message?: string;
    enabled?: boolean;
    schedule?: Record<string, unknown>;
    rule?: Record<string, unknown>;
  };
}

/** 刪除提醒 */
export interface DeleteReminderPayload {
  reminderId: string;
}

/** 啟用 / 停用提醒 */
export interface ToggleReminderPayload {
  reminderId: string;
  enabled: boolean;
}

/** 查詢提醒 */
export interface ListRemindersPayload {
  filter?: 'all' | 'enabled';
}

/** 強制觸發通知 */
export interface TriggerNotificationPayload {
  reminderId: string;
}

/** 取得狀態 */
export type GetStatusPayload = Record<string, never>;

// ============================================================
// Payload 聯合對應
// ============================================================

export type NativeCommandPayloadMap = {
  create_reminder: CreateReminderPayload;
  update_reminder: UpdateReminderPayload;
  delete_reminder: DeleteReminderPayload;
  toggle_reminder: ToggleReminderPayload;
  list_reminders: ListRemindersPayload;
  trigger_notification: TriggerNotificationPayload;
  get_status: GetStatusPayload;
};

// ============================================================
// 命令與回應
// ============================================================

/** 單筆命令 */
export interface NativeCommand<T extends NativeCommandType = NativeCommandType> {
  id: string;
  type: T;
  payload: NativeCommandPayloadMap[T];
}

/** Extension → Native Host 的 poll 請求 */
export interface NativePollRequest {
  action: 'poll';
  extensionVersion: string;
}

/** Native Host → Extension 的 poll 回應 */
export interface NativePollResponse {
  commands: NativeCommand[];
}

/** 單筆命令的處理結果 */
export interface CommandResult {
  commandId: string;
  success: boolean;
  data?: unknown;
  error?: string;
}
