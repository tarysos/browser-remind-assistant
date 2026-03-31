// ============================================================
// native-messaging-handler — OpenClaw Native Messaging 處理
// 對應 SA §14 OpenClaw 整合設計
// 短連線、按需喚起：使用 sendNativeMessage 一次性通訊
// ============================================================

import {
  NATIVE_HOST_NAME,
  type NativeCommand,
  type NativePollRequest,
  type NativePollResponse,
  type CommandResult,
  type CreateReminderPayload,
  type UpdateReminderPayload,
  type DeleteReminderPayload,
  type ToggleReminderPayload,
  type ListRemindersPayload,
  type TriggerNotificationPayload,
} from '../../types/native-messaging.js';
import type {
  Reminder,
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
  ReminderType,
} from '../../types/reminder.js';
import {
  getAllRemindersArray,
  getEnabledReminders,
  getReminderById,
  createReminder,
  updateReminder as repoUpdateReminder,
  deleteReminder as repoDeleteReminder,
  toggleReminder as repoToggleReminder,
  generateId,
} from '../reminder-repository/index.js';
import {
  createAlarmForReminder,
  clearAlarmForReminder,
} from '../alarm-manager/index.js';
import { evaluate } from '../trigger-evaluator/index.js';
import { showNotification } from '../notification-manager/index.js';
import { updateBadge } from '../badge-manager/index.js';

// ============================================================
// Extension 版本（從 manifest 取得）
// ============================================================

function getExtensionVersion(): string {
  return chrome.runtime.getManifest().version;
}

// ============================================================
// 核心：Poll Native Host
// ============================================================

/**
 * 向 native host 發送 poll 請求，取得待處理命令並逐筆執行。
 * 若 native host 未安裝，靜默回傳空結果。
 */
export async function pollNativeHost(): Promise<CommandResult[]> {
  const request: NativePollRequest = {
    action: 'poll',
    extensionVersion: getExtensionVersion(),
  };

  let response: NativePollResponse;
  try {
    response = await new Promise<NativePollResponse>((resolve, reject) => {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_NAME, request, (resp) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(resp as NativePollResponse);
        }
      });
    });
  } catch (err) {
    const msg = (err as Error).message ?? '';
    // native host 未安裝 → 靜默跳過
    if (msg.includes('not found') || msg.includes('Native host has exited')) {
      console.log('[native-messaging] Native host 未安裝，略過 poll');
    } else {
      console.warn('[native-messaging] Poll 失敗:', msg);
    }
    return [];
  }

  if (!response?.commands?.length) return [];

  console.log(`[native-messaging] 收到 ${response.commands.length} 筆命令`);

  const results: CommandResult[] = [];
  for (const cmd of response.commands) {
    const result = await dispatchCommand(cmd);
    results.push(result);
  }

  return results;
}

// ============================================================
// 命令分派
// ============================================================

async function dispatchCommand(cmd: NativeCommand): Promise<CommandResult> {
  try {
    switch (cmd.type) {
      case 'create_reminder':
        return await handleCreateReminder(cmd.id, cmd.payload as CreateReminderPayload);
      case 'update_reminder':
        return await handleUpdateReminder(cmd.id, cmd.payload as UpdateReminderPayload);
      case 'delete_reminder':
        return await handleDeleteReminder(cmd.id, cmd.payload as DeleteReminderPayload);
      case 'toggle_reminder':
        return await handleToggleReminder(cmd.id, cmd.payload as ToggleReminderPayload);
      case 'list_reminders':
        return await handleListReminders(cmd.id, cmd.payload as ListRemindersPayload);
      case 'trigger_notification':
        return await handleTriggerNotification(cmd.id, cmd.payload as TriggerNotificationPayload);
      case 'get_status':
        return await handleGetStatus(cmd.id);
      default:
        return { commandId: cmd.id, success: false, error: `Unknown command type: ${cmd.type}` };
    }
  } catch (err) {
    return { commandId: cmd.id, success: false, error: (err as Error).message };
  }
}

// ============================================================
// 各命令 Handler
// ============================================================

/** 建立提醒 */
async function handleCreateReminder(
  commandId: string,
  payload: CreateReminderPayload,
): Promise<CommandResult> {
  const now = new Date().toISOString();
  const id = generateId('r');

  const reminder = buildReminderFromPayload(id, payload, now);
  await createReminder(reminder);
  await createAlarmForReminder(reminder);
  await updateBadge();

  console.log(`[native-messaging] 建立提醒: ${reminder.title} (${id})`);
  return { commandId, success: true, data: { reminderId: id } };
}

/** 更新提醒 */
async function handleUpdateReminder(
  commandId: string,
  payload: UpdateReminderPayload,
): Promise<CommandResult> {
  const existing = await getReminderById(payload.reminderId);
  if (!existing) {
    return { commandId, success: false, error: `Reminder not found: ${payload.reminderId}` };
  }

  const updates = payload.updates;
  if (updates.title !== undefined) existing.title = updates.title;
  if (updates.message !== undefined) existing.message = updates.message;
  if (updates.enabled !== undefined) existing.enabled = updates.enabled;
  if (updates.schedule) Object.assign(existing.schedule, updates.schedule);
  if (updates.rule) Object.assign(existing.rule, updates.rule);

  await repoUpdateReminder(existing);
  await clearAlarmForReminder(existing.id);
  if (existing.enabled) await createAlarmForReminder(existing);
  await updateBadge();

  console.log(`[native-messaging] 更新提醒: ${existing.title} (${existing.id})`);
  return { commandId, success: true, data: { reminderId: existing.id } };
}

/** 刪除提醒 */
async function handleDeleteReminder(
  commandId: string,
  payload: DeleteReminderPayload,
): Promise<CommandResult> {
  await repoDeleteReminder(payload.reminderId);
  await clearAlarmForReminder(payload.reminderId);
  await updateBadge();

  console.log(`[native-messaging] 刪除提醒: ${payload.reminderId}`);
  return { commandId, success: true };
}

/** 啟用 / 停用提醒 */
async function handleToggleReminder(
  commandId: string,
  payload: ToggleReminderPayload,
): Promise<CommandResult> {
  const updated = await repoToggleReminder(payload.reminderId, payload.enabled);
  if (updated.enabled) {
    await createAlarmForReminder(updated);
  } else {
    await clearAlarmForReminder(updated.id);
  }
  await updateBadge();

  console.log(`[native-messaging] ${payload.enabled ? '啟用' : '停用'}提醒: ${updated.id}`);
  return { commandId, success: true, data: { reminderId: updated.id, enabled: updated.enabled } };
}

/** 查詢提醒 */
async function handleListReminders(
  commandId: string,
  payload: ListRemindersPayload,
): Promise<CommandResult> {
  const reminders = payload.filter === 'enabled'
    ? await getEnabledReminders()
    : await getAllRemindersArray();

  return {
    commandId,
    success: true,
    data: {
      count: reminders.length,
      reminders: reminders.map((r) => ({
        id: r.id, type: r.type, title: r.title, message: r.message, enabled: r.enabled,
      })),
    },
  };
}

/** 強制觸發通知 */
async function handleTriggerNotification(
  commandId: string,
  payload: TriggerNotificationPayload,
): Promise<CommandResult> {
  const reminder = await getReminderById(payload.reminderId);
  if (!reminder) {
    return { commandId, success: false, error: `Reminder not found: ${payload.reminderId}` };
  }

  const result = evaluate(reminder, 'alarm');
  await showNotification(reminder, {
    shouldTrigger: true,
    reason: result.reason ?? 'time_match',
    source: 'alarm',
  });

  console.log(`[native-messaging] 強制觸發通知: ${reminder.title}`);
  return { commandId, success: true, data: { reminderId: reminder.id } };
}

/** 取得擴充狀態 */
async function handleGetStatus(commandId: string): Promise<CommandResult> {
  const all = await getAllRemindersArray();
  const enabled = all.filter((r) => r.enabled);

  return {
    commandId,
    success: true,
    data: {
      version: getExtensionVersion(),
      totalReminders: all.length,
      enabledReminders: enabled.length,
    },
  };
}

// ============================================================
// 從 Payload 建立 Reminder 物件
// ============================================================

function buildReminderFromPayload(
  id: string,
  payload: CreateReminderPayload,
  now: string,
): Reminder {
  const meta = { createdAt: now, updatedAt: now };
  const type = payload.reminderType;

  switch (type) {
    case 'one_time':
      return {
        id, type, title: payload.title, message: payload.message, enabled: true,
        schedule: {
          dateTime: (payload.schedule.dateTime as string) ?? now,
          timezone: (payload.schedule.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        rule: { allowMissedCatchup: (payload.rule.allowMissedCatchup as boolean) ?? true },
        state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
        meta,
      } as OneTimeReminder;

    case 'recurring':
      return {
        id, type, title: payload.title, message: payload.message, enabled: true,
        schedule: {
          frequency: (payload.schedule.frequency as string) ?? 'daily',
          daysOfWeek: (payload.schedule.daysOfWeek as number[]) ?? [],
          dayOfMonth: (payload.schedule.dayOfMonth as number) ?? null,
          timeOfDay: (payload.schedule.timeOfDay as string) ?? '09:00',
          timezone: (payload.schedule.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
          startDate: null, endDate: null,
        },
        rule: { allowMissedCatchup: (payload.rule.allowMissedCatchup as boolean) ?? true },
        state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
        meta,
      } as RecurringReminder;

    case 'first_open':
      return {
        id, type, title: payload.title, message: payload.message, enabled: true,
        schedule: {
          cadence: (payload.schedule.cadence as string) ?? 'daily',
          timezone: (payload.schedule.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        rule: {
          triggerOn: 'browser_activity' as const,
          validDaysOfWeek: (payload.rule.validDaysOfWeek as number[]) ?? [],
          timeWindowStart: (payload.rule.timeWindowStart as string) ?? '00:00',
          timeWindowEnd: (payload.rule.timeWindowEnd as string) ?? '23:59',
          sites: [],
          allowMissedCatchup: (payload.rule.allowMissedCatchup as boolean) ?? false,
        },
        state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
        meta,
      } as FirstOpenReminder;

    case 'site_trigger':
      return {
        id, type, title: payload.title, message: payload.message, enabled: true,
        schedule: {
          cadence: (payload.schedule.cadence as string) ?? 'daily',
          timezone: (payload.schedule.timezone as string) ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        rule: {
          urlPatterns: (payload.rule.urlPatterns as string[]) ?? [],
          validDaysOfWeek: (payload.rule.validDaysOfWeek as number[]) ?? [],
          timeWindowStart: (payload.rule.timeWindowStart as string) ?? '00:00',
          timeWindowEnd: (payload.rule.timeWindowEnd as string) ?? '23:59',
          allowMissedCatchup: (payload.rule.allowMissedCatchup as boolean) ?? false,
        },
        state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
        meta,
      } as SiteTriggerReminder;

    default:
      throw new Error(`Unsupported reminder type: ${type}`);
  }
}

// Re-export for testing
export { dispatchCommand as _dispatchCommand };
