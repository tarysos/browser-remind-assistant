// ============================================================
// Popup Controller — 今日清單與快速操作
// 對應 SA §7.1 + §8 popup-controller
// ============================================================

import {
  getAllRemindersArray,
  getReminderById,
  updateReminder,
  addHistoryEntry,
} from '../modules/reminder-repository/index.js';
import { createSnoozeAlarm, clearAlarmForReminder } from '../modules/alarm-manager/index.js';
import { getPeriodKey } from '../modules/trigger-evaluator/index.js';
import type {
  Reminder,
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
} from '../types/reminder.js';


// ============================================================
// DOM 元素
// ============================================================

const listPending = document.getElementById('list-pending') as HTMLUListElement;
const listUpcoming = document.getElementById('list-upcoming') as HTMLUListElement;
const listSnoozed = document.getElementById('list-snoozed') as HTMLUListElement;
const emptyPending = document.getElementById('empty-pending') as HTMLParagraphElement;
const btnAdd = document.getElementById('btn-add') as HTMLButtonElement;
const linkOptions = document.getElementById('link-options') as HTMLAnchorElement;

// ============================================================
// 分類提醒
// ============================================================

interface CategorizedReminders {
  pending: Reminder[];
  upcoming: Reminder[];
  snoozed: Reminder[];
}

function categorize(reminders: Reminder[]): CategorizedReminders {
  const now = new Date();
  const result: CategorizedReminders = { pending: [], upcoming: [], snoozed: [] };

  for (const r of reminders) {
    if (!r.enabled) continue;

    // 檢查 snooze
    const snoozeUntil = r.type === 'one_time'
      ? (r as OneTimeReminder).state.snoozeUntil
      : (r as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.snoozeUntil;

    if (snoozeUntil && new Date(snoozeUntil).getTime() > now.getTime()) {
      result.snoozed.push(r);
      continue;
    }

    // 檢查已完成
    const completedAt = r.type === 'one_time'
      ? (r as OneTimeReminder).state.completedAt
      : (r as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.completedAt;
    if (completedAt) continue;

    // 判斷是否為今日待處理
    if (r.type === 'one_time') {
      const targetTime = new Date((r as OneTimeReminder).schedule.dateTime);
      if (targetTime.getTime() <= now.getTime()) {
        result.pending.push(r);
      } else {
        result.upcoming.push(r);
      }
    } else {
      // recurring / first_open → 今日或本週期待處理
      result.pending.push(r);
    }
  }

  // 依時間排序（SA §12.2）
  const getSortTime = (r: Reminder): number => {
    if (r.type === 'one_time') return new Date((r as OneTimeReminder).schedule.dateTime).getTime();
    if (r.type === 'recurring') {
      const [h, m] = (r as RecurringReminder).schedule.timeOfDay.split(':').map(Number);
      return h * 60 + m;
    }
    return 0; // first_open 沒有固定時間，排最前
  };
  result.pending.sort((a, b) => getSortTime(a) - getSortTime(b));
  result.upcoming.sort((a, b) => getSortTime(a) - getSortTime(b));
  result.snoozed.sort((a, b) => {
    const aSnooze = a.type === 'one_time'
      ? (a as OneTimeReminder).state.snoozeUntil
      : (a as RecurringReminder | FirstOpenReminder).state.snoozeUntil;
    const bSnooze = b.type === 'one_time'
      ? (b as OneTimeReminder).state.snoozeUntil
      : (b as RecurringReminder | FirstOpenReminder).state.snoozeUntil;
    return new Date(aSnooze!).getTime() - new Date(bSnooze!).getTime();
  });

  return result;
}

// ============================================================
// 渲染
// ============================================================

/** 取得 snoozeUntil 值 */
function getSnoozeUntil(r: Reminder): string | null {
  return r.type === 'one_time'
    ? (r as OneTimeReminder).state.snoozeUntil
    : (r as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.snoozeUntil;
}

/** 判斷是否正在 snooze 中 */
function isSnoozed(r: Reminder): boolean {
  const su = getSnoozeUntil(r);
  return !!su && new Date(su).getTime() > Date.now();
}

function renderReminderItem(r: Reminder): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'reminder-item';

  const timeStr = r.type === 'one_time'
    ? new Date((r as OneTimeReminder).schedule.dateTime).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : r.type === 'recurring'
      ? `${(r as RecurringReminder).schedule.frequency === 'daily' ? '每天' : '每週'} ${(r as RecurringReminder).schedule.timeOfDay}`
      : r.type === 'site_trigger'
        ? `🌐 網站情境 (${(r as SiteTriggerReminder).rule.urlPatterns.length} 個網站)`
        : `首次開啟 (${(r as FirstOpenReminder).schedule.cadence === 'daily' ? '每天' : '每週'})`;

  if (isSnoozed(r)) {
    // === 已延後項目：顯示延後到何時 + 取消延後按鈕 ===
    const snoozeTime = new Date(getSnoozeUntil(r)!).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `
      <span class="title">${escapeHtml(r.title)}</span>
      <span class="time snooze-time">⏰ 延後至 ${snoozeTime}</span>
      <div class="actions">
        <button data-action="cancel_snooze" data-id="${r.id}" title="取消延後">↩️</button>
        <button data-action="complete" data-id="${r.id}" title="完成">✅</button>
      </div>
    `;
  } else {
    // === 一般項目：snooze 選單 ===
    li.innerHTML = `
      <span class="title">${escapeHtml(r.title)}</span>
      <span class="time">${timeStr}</span>
      <div class="actions">
        <button data-action="complete" data-id="${r.id}" title="完成">✅</button>
        <select data-action="snooze_select" data-id="${r.id}" class="snooze-select" title="稍後提醒">
          <option value="" disabled selected>⏰</option>
          <option value="10">10 分鐘後</option>
          <option value="30">30 分鐘後</option>
          <option value="60">1 小時後</option>
          <option value="tomorrow">明天</option>
        </select>
        <button data-action="skip" data-id="${r.id}" title="略過">⏭</button>
      </div>
    `;
  }
  return li;
}

function renderList(ul: HTMLUListElement, reminders: Reminder[]): void {
  ul.innerHTML = '';
  for (const r of reminders) {
    ul.appendChild(renderReminderItem(r));
  }
}

async function render(): Promise<void> {
  const all = await getAllRemindersArray();
  const { pending, upcoming, snoozed } = categorize(all);

  renderList(listPending, pending);
  renderList(listUpcoming, upcoming);
  renderList(listSnoozed, snoozed);

  emptyPending.style.display = pending.length === 0 ? 'block' : 'none';

  document.getElementById('section-upcoming')!.style.display = upcoming.length > 0 ? 'block' : 'none';
  document.getElementById('section-snoozed')!.style.display = snoozed.length > 0 ? 'block' : 'none';
}

// ============================================================
// 操作
// ============================================================

/** 計算 snooze 延後分鐘數 */
function resolveSnoozeMinutes(value: string): number {
  if (value === 'tomorrow') {
    // 明天同一時間 → 計算到明天 00:00 的分鐘數再加上現在的時間偏移
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(now.getHours(), now.getMinutes(), 0, 0);
    return Math.max(Math.round((tomorrow.getTime() - now.getTime()) / 60000), 1);
  }
  return parseInt(value, 10) || 10;
}

async function handleAction(id: string, action: string, snoozeValue?: string): Promise<void> {
  const reminder = await getReminderById(id);
  if (!reminder) return;
  const now = new Date().toISOString();
  const freq: 'daily' | 'weekly' = reminder.type === 'one_time' ? 'daily'
    : reminder.type === 'recurring' ? (reminder as RecurringReminder).schedule.frequency
    : reminder.type === 'site_trigger'
      ? ((reminder as SiteTriggerReminder).schedule.cadence === 'every_visit' ? 'daily' : (reminder as SiteTriggerReminder).schedule.cadence as 'daily' | 'weekly')
      : (reminder as FirstOpenReminder).schedule.cadence;
  const periodKey = getPeriodKey(freq);

  if (action === 'complete') {
    if (reminder.type === 'one_time') (reminder as OneTimeReminder).state.completedAt = now;
    else (reminder as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.completedAt = now;
    await updateReminder(reminder);
    await addHistoryEntry(id, 'completed', periodKey, 'alarm');

  } else if (action === 'snooze') {
    const minutes = resolveSnoozeMinutes(snoozeValue || '10');
    const snoozeUntil = new Date(Date.now() + minutes * 60000).toISOString();
    if (reminder.type === 'one_time') (reminder as OneTimeReminder).state.snoozeUntil = snoozeUntil;
    else (reminder as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.snoozeUntil = snoozeUntil;
    await updateReminder(reminder);
    await createSnoozeAlarm(id, minutes);
    await addHistoryEntry(id, 'snoozed', periodKey, 'alarm');

  } else if (action === 'cancel_snooze') {
    // 取消延後：清除 snoozeUntil + 清除 snooze alarm
    if (reminder.type === 'one_time') (reminder as OneTimeReminder).state.snoozeUntil = null;
    else (reminder as RecurringReminder | FirstOpenReminder | SiteTriggerReminder).state.snoozeUntil = null;
    await updateReminder(reminder);
    await clearAlarmForReminder(id);

  } else if (action === 'skip') {
    await addHistoryEntry(id, 'skipped', periodKey, 'alarm');
  }

  await render();
}

// ============================================================
// 工具函式
// ============================================================

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// 事件綁定
// ============================================================

document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const btn = target.closest('button[data-action]') as HTMLButtonElement | null;
  if (btn) {
    const action = btn.dataset.action!;
    const id = btn.dataset.id!;
    handleAction(id, action);
  }
});

// snooze 下拉選單
document.addEventListener('change', (e) => {
  const target = e.target as HTMLSelectElement;
  if (target.dataset.action === 'snooze_select' && target.value) {
    const id = target.dataset.id!;
    handleAction(id, 'snooze', target.value);
    target.value = ''; // 重置選單
  }
});

btnAdd.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

linkOptions.addEventListener('click', (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

// ============================================================
// 初始化
// ============================================================

render();
