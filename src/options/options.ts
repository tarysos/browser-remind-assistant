// ============================================================
// Options Controller — 完整管理頁面
// 對應 SA §7.2 + §8 options-controller
// ============================================================

import {
  getAllRemindersArray,
  createReminder,
  updateReminder,
  deleteReminder,
  toggleReminder,
  generateId,
  getHistory,
  getSettings,
  updateSettings,
  getReminderById,
} from '../modules/reminder-repository/index.js';
import { createAlarmForReminder, clearAlarmForReminder } from '../modules/alarm-manager/index.js';
import type {
  Reminder,
  ReminderType,
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
  DayOfWeek,
} from '../types/reminder.js';
import type { HistoryEntry, HistoryEventType } from '../types/history.js';

// ============================================================
// DOM 元素
// ============================================================

const inputSearch = document.getElementById('input-search') as HTMLInputElement;
const filterType = document.getElementById('filter-type') as HTMLSelectElement;
const btnAdd = document.getElementById('btn-add') as HTMLButtonElement;
const tbodyReminders = document.getElementById('tbody-reminders') as HTMLTableSectionElement;
const emptyList = document.getElementById('empty-list') as HTMLParagraphElement;
const sectionForm = document.getElementById('section-form') as HTMLElement;
const sectionList = document.getElementById('section-list') as HTMLElement;
const formTitle = document.getElementById('form-title') as HTMLHeadingElement;
const reminderForm = document.getElementById('reminder-form') as HTMLFormElement;
const formId = document.getElementById('form-id') as HTMLInputElement;
const formType = document.getElementById('form-type') as HTMLSelectElement;
const formReminderTitle = document.getElementById('form-reminder-title') as HTMLInputElement;
const formMessage = document.getElementById('form-message') as HTMLTextAreaElement;
const formDatetime = document.getElementById('form-datetime') as HTMLInputElement;
const formFrequency = document.getElementById('form-frequency') as HTMLSelectElement;
const formTime = document.getElementById('form-time') as HTMLInputElement;
const formCadence = document.getElementById('form-cadence') as HTMLSelectElement;
const formWindowStart = document.getElementById('form-window-start') as HTMLInputElement;
const formWindowEnd = document.getElementById('form-window-end') as HTMLInputElement;
const formCatchup = document.getElementById('form-catchup') as HTMLInputElement;
const btnCancel = document.getElementById('btn-cancel') as HTMLButtonElement;

const fieldsOneTime = document.getElementById('fields-one-time') as HTMLFieldSetElement;
const fieldsRecurring = document.getElementById('fields-recurring') as HTMLFieldSetElement;
const fieldsFirstOpen = document.getElementById('fields-first-open') as HTMLFieldSetElement;
const fieldsSiteTrigger = document.getElementById('fields-site-trigger') as HTMLFieldSetElement;
const formUrlPatterns = document.getElementById('form-url-patterns') as HTMLTextAreaElement;
const formSiteCadence = document.getElementById('form-site-cadence') as HTMLSelectElement;
const formSiteWindowStart = document.getElementById('form-site-window-start') as HTMLInputElement;
const formSiteWindowEnd = document.getElementById('form-site-window-end') as HTMLInputElement;

// ============================================================
// 列表渲染
// ============================================================

const TYPE_LABELS: Record<ReminderType, string> = {
  one_time: '單次',
  recurring: '週期',
  first_open: '首次開啟',
  site_trigger: '網站情境',
};

function getTypeBadge(type: ReminderType): string {
  return `<span class="type-badge ${type}">${TYPE_LABELS[type]}</span>`;
}

const DAY_NAMES = ['日','一','二','三','四','五','六'];

function getScheduleHtml(r: Reminder): string {
  if (r.type === 'one_time') {
    const dt = new Date((r as OneTimeReminder).schedule.dateTime);
    const date = dt.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const time = dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    return `<div class="schedule-detail">
      <span class="schedule-main">📅 ${date}</span>
      <span class="schedule-sub">🕐 ${time}</span>
    </div>`;
  } else if (r.type === 'recurring') {
    const s = (r as RecurringReminder).schedule;
    if (s.frequency === 'daily') {
      return `<div class="schedule-detail">
        <span class="schedule-main">🔁 每天</span>
        <span class="schedule-sub">🕐 ${s.timeOfDay}</span>
      </div>`;
    }
    const days = s.daysOfWeek.map(d => DAY_NAMES[d]).join('、');
    return `<div class="schedule-detail">
      <span class="schedule-main">🔁 每週 ${days}</span>
      <span class="schedule-sub">🕐 ${s.timeOfDay}</span>
    </div>`;
  } else if (r.type === 'site_trigger') {
    const s = (r as SiteTriggerReminder).schedule;
    const ru = (r as SiteTriggerReminder).rule;
    const cadenceLabel = s.cadence === 'every_visit' ? '每次造訪' : s.cadence === 'daily' ? '每天首次' : '每週首次';
    const sites = ru.urlPatterns.slice(0, 2).join(', ') + (ru.urlPatterns.length > 2 ? ` +${ru.urlPatterns.length - 2}` : '');
    return `<div class="schedule-detail">
      <span class="schedule-main">🌐 ${cadenceLabel}</span>
      <span class="schedule-sub" title="${escapeHtml(ru.urlPatterns.join('\n'))}">${escapeHtml(sites)}</span>
      ${ru.timeWindowStart && ru.timeWindowEnd ? `<span class="schedule-sub">🕐 ${ru.timeWindowStart}–${ru.timeWindowEnd}</span>` : ''}
    </div>`;
  } else {
    const s = (r as FirstOpenReminder).schedule;
    const ru = (r as FirstOpenReminder).rule;
    const days = ru.validDaysOfWeek.map(d => DAY_NAMES[d]).join('、');
    return `<div class="schedule-detail">
      <span class="schedule-main">🚀 ${s.cadence === 'daily' ? '每天' : '每週'}首次開啟</span>
      ${days ? `<span class="schedule-sub">📆 ${days}</span>` : ''}
      ${ru.timeWindowStart && ru.timeWindowEnd ? `<span class="schedule-sub">🕐 ${ru.timeWindowStart}–${ru.timeWindowEnd}</span>` : ''}
    </div>`;
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function renderList(): Promise<void> {
  let reminders = await getAllRemindersArray();

  // 篩選
  const typeFilter = filterType.value;
  if (typeFilter !== 'all') {
    reminders = reminders.filter(r => r.type === typeFilter);
  }
  const search = inputSearch.value.trim().toLowerCase();
  if (search) {
    reminders = reminders.filter(r =>
      r.title.toLowerCase().includes(search) || r.message.toLowerCase().includes(search)
    );
  }

  tbodyReminders.innerHTML = '';
  emptyList.style.display = reminders.length === 0 ? 'block' : 'none';

  for (const r of reminders) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="status-badge ${r.enabled ? 'enabled' : 'disabled'}">${r.enabled ? '啟用' : '停用'}</span></td>
      <td>${escapeHtml(r.title)}</td>
      <td>${getTypeBadge(r.type)}</td>
      <td>${getScheduleHtml(r)}</td>
      <td>
        <span class="action-group">
          <button class="btn btn-sm" data-action="edit" data-id="${r.id}">✏️ 編輯</button>
        </span>
        <span class="action-separator"></span>
        <span class="action-group">
          <button class="btn btn-sm" data-action="toggle" data-id="${r.id}">${r.enabled ? '⏸ 停用' : '▶️ 啟用'}</button>
          <button class="btn btn-sm btn-danger" data-action="delete" data-id="${r.id}">🗑 刪除</button>
        </span>
      </td>
    `;
    tbodyReminders.appendChild(tr);
  }
}

// ============================================================
// 表單操作
// ============================================================

function showTypeFields(type: string): void {
  fieldsOneTime.style.display = type === 'one_time' ? 'block' : 'none';
  fieldsRecurring.style.display = type === 'recurring' ? 'block' : 'none';
  fieldsFirstOpen.style.display = type === 'first_open' ? 'block' : 'none';
  fieldsSiteTrigger.style.display = type === 'site_trigger' ? 'block' : 'none';
}

function showForm(title: string): void {
  formTitle.textContent = title;
  sectionForm.style.display = 'block';
  sectionList.style.display = 'none';
}

function hideForm(): void {
  sectionForm.style.display = 'none';
  sectionList.style.display = 'block';
  reminderForm.reset();
  formId.value = '';
}

function getCheckedDays(containerId: string): DayOfWeek[] {
  const container = document.getElementById(containerId)!;
  const checked = container.querySelectorAll<HTMLInputElement>('input:checked');
  return Array.from(checked).map(cb => Number(cb.value) as DayOfWeek);
}


function buildReminderFromForm(): Reminder {
  const now = new Date().toISOString();
  const type = formType.value as ReminderType;
  const id = formId.value || generateId('r');
  const meta = { createdAt: now, updatedAt: now };

  if (type === 'one_time') {
    return {
      id, type, title: formReminderTitle.value, message: formMessage.value, enabled: true,
      schedule: { dateTime: new Date(formDatetime.value).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      rule: { allowMissedCatchup: formCatchup.checked },
      state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
      meta,
    } as OneTimeReminder;
  } else if (type === 'recurring') {
    return {
      id, type, title: formReminderTitle.value, message: formMessage.value, enabled: true,
      schedule: {
        frequency: formFrequency.value as 'daily' | 'weekly',
        daysOfWeek: getCheckedDays('form-days'),
        timeOfDay: getTimeValue(formTime),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        startDate: null, endDate: null,
      },
      rule: { allowMissedCatchup: formCatchup.checked },
      state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
      meta,
    } as RecurringReminder;
  } else if (type === 'site_trigger') {
    const urlPatterns = formUrlPatterns.value.split('\n').map(s => s.trim()).filter(Boolean);
    return {
      id, type, title: formReminderTitle.value, message: formMessage.value, enabled: true,
      schedule: {
        cadence: formSiteCadence.value as 'every_visit' | 'daily' | 'weekly',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      rule: {
        urlPatterns,
        validDaysOfWeek: getCheckedDays('form-site-days'),
        timeWindowStart: getTimeValue(formSiteWindowStart) || '00:00',
        timeWindowEnd: getTimeValue(formSiteWindowEnd) || '23:59',
        allowMissedCatchup: formCatchup.checked,
      },
      state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
      meta,
    } as SiteTriggerReminder;
  } else {
    return {
      id, type: 'first_open' as const, title: formReminderTitle.value, message: formMessage.value, enabled: true,
      schedule: { cadence: formCadence.value as 'daily' | 'weekly', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      rule: {
        triggerOn: 'browser_activity' as const,
        validDaysOfWeek: getCheckedDays('form-valid-days'),
        timeWindowStart: getTimeValue(formWindowStart) || '00:00',
        timeWindowEnd: getTimeValue(formWindowEnd) || '23:59',
        sites: [],
        allowMissedCatchup: formCatchup.checked,
      },
      state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
      meta,
    } as FirstOpenReminder;
  }
}

// ============================================================
// 事件綁定
// ============================================================

formType.addEventListener('change', () => showTypeFields(formType.value));

btnAdd.addEventListener('click', () => {
  showForm('新增提醒');
  showTypeFields(formType.value);
});

btnCancel.addEventListener('click', () => hideForm());

reminderForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const reminder = buildReminderFromForm();
  if (formId.value) {
    await updateReminder(reminder);
  } else {
    await createReminder(reminder);
  }
  await createAlarmForReminder(reminder);
  hideForm();
  await renderList();
});

// 列表操作（事件委派）
tbodyReminders.addEventListener('click', async (e) => {
  const btn = (e.target as HTMLElement).closest('button[data-action]') as HTMLButtonElement | null;
  if (!btn) return;
  const action = btn.dataset.action!;
  const id = btn.dataset.id!;

  if (action === 'delete') {
    if (!confirm('確定刪除此提醒？')) return;
    await deleteReminder(id);
    await clearAlarmForReminder(id);
    await renderList();
  } else if (action === 'toggle') {
    const all = await getAllRemindersArray();
    const r = all.find(r => r.id === id);
    if (!r) return;
    const updated = await toggleReminder(id, !r.enabled);
    if (updated.enabled) await createAlarmForReminder(updated);
    else await clearAlarmForReminder(id);
    await renderList();
  } else if (action === 'edit') {
    const all = await getAllRemindersArray();
    const r = all.find(r => r.id === id);
    if (!r) return;
    populateForm(r);
  }
});

inputSearch.addEventListener('input', () => renderList());
filterType.addEventListener('change', () => renderList());

function populateForm(r: Reminder): void {
  formId.value = r.id;
  formType.value = r.type;
  formReminderTitle.value = r.title;
  formMessage.value = r.message;
  formCatchup.checked = r.rule.allowMissedCatchup;
  showTypeFields(r.type);
  if (r.type === 'one_time') {
    const dt = new Date((r as OneTimeReminder).schedule.dateTime);
    formDatetime.value = dt.toISOString().slice(0, 16);
  } else if (r.type === 'recurring') {
    const s = (r as RecurringReminder).schedule;
    formFrequency.value = s.frequency;
    setTimeDisplay(formTime, s.timeOfDay);
    setCheckedDays('form-days', s.daysOfWeek);
  } else if (r.type === 'site_trigger') {
    const s = (r as SiteTriggerReminder).schedule;
    const ru = (r as SiteTriggerReminder).rule;
    formUrlPatterns.value = ru.urlPatterns.join('\n');
    formSiteCadence.value = s.cadence;
    setTimeDisplay(formSiteWindowStart, ru.timeWindowStart);
    setTimeDisplay(formSiteWindowEnd, ru.timeWindowEnd);
    setCheckedDays('form-site-days', ru.validDaysOfWeek);
  } else {
    const s = (r as FirstOpenReminder).schedule;
    const ru = (r as FirstOpenReminder).rule;
    formCadence.value = s.cadence;
    setTimeDisplay(formWindowStart, ru.timeWindowStart);
    setTimeDisplay(formWindowEnd, ru.timeWindowEnd);
    setCheckedDays('form-valid-days', ru.validDaysOfWeek);
  }
  showForm('編輯提醒');
}

function setCheckedDays(containerId: string, days: DayOfWeek[]): void {
  const container = document.getElementById(containerId)!;
  container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach(cb => {
    cb.checked = days.includes(Number(cb.value) as DayOfWeek);
  });
}

// ============================================================
// 歷史紀錄 (SA §5.6)
// ============================================================

const tbodyHistory = document.getElementById('tbody-history') as HTMLTableSectionElement;
const emptyHistory = document.getElementById('empty-history') as HTMLParagraphElement;
const historySearch = document.getElementById('history-search') as HTMLInputElement;
const historyFilter = document.getElementById('history-filter') as HTMLSelectElement;

function getEventLabel(type: HistoryEventType): string {
  const map: Record<HistoryEventType, string> = {
    triggered: '🔔 已觸發',
    completed: '✅ 已完成',
    snoozed: '⏰ 已延後',
    skipped: '⏭ 已略過',
    missed_catchup: '⏰ 補提醒',
  };
  return map[type] ?? type;
}

async function renderHistory(): Promise<void> {
  let history = await getHistory();
  const allReminders = await getAllRemindersArray();
  const reminderMap = new Map(allReminders.map(r => [r.id, r]));

  // 篩選事件類型
  const typeFilter = historyFilter.value;
  if (typeFilter !== 'all') {
    history = history.filter(h => h.eventType === typeFilter);
  }

  // 搜尋
  const search = historySearch.value.trim().toLowerCase();
  if (search) {
    history = history.filter(h => {
      const r = reminderMap.get(h.reminderId);
      return r?.title.toLowerCase().includes(search) || r?.message.toLowerCase().includes(search);
    });
  }

  // 按時間倒序
  history.sort((a, b) => new Date(b.eventAt).getTime() - new Date(a.eventAt).getTime());

  tbodyHistory.innerHTML = '';
  emptyHistory.style.display = history.length === 0 ? 'block' : 'none';

  for (const h of history.slice(0, 100)) {
    const r = reminderMap.get(h.reminderId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(h.eventAt).toLocaleString('zh-TW')}</td>
      <td>${escapeHtml(r?.title ?? '(已刪除)')}</td>
      <td>${getEventLabel(h.eventType)}</td>
      <td>${h.context.source}</td>
    `;
    tbodyHistory.appendChild(tr);
  }
}

historySearch.addEventListener('input', () => renderHistory());
historyFilter.addEventListener('change', () => renderHistory());

// ============================================================
// 全域設定 (SA §7.2)
// ============================================================

const settingTimezone = document.getElementById('setting-timezone') as HTMLInputElement;
const settingQuietStart = document.getElementById('setting-quiet-start') as HTMLInputElement;
const settingQuietEnd = document.getElementById('setting-quiet-end') as HTMLInputElement;
const settingCatchup = document.getElementById('setting-catchup') as HTMLInputElement;
const settingBadge = document.getElementById('setting-badge') as HTMLSelectElement;
const btnSaveSettings = document.getElementById('btn-save-settings') as HTMLButtonElement;

async function loadSettings(): Promise<void> {
  const s = await getSettings();
  settingTimezone.value = s.defaultTimezone;
  setTimeDisplay(settingQuietStart, s.quietHoursStart ?? '');
  setTimeDisplay(settingQuietEnd, s.quietHoursEnd ?? '');
  settingCatchup.checked = s.enableMissedCatchup;
  settingBadge.value = s.badgeDisplay;
}

btnSaveSettings.addEventListener('click', async () => {
  await updateSettings({
    quietHoursStart: getTimeValue(settingQuietStart) || null,
    quietHoursEnd: getTimeValue(settingQuietEnd) || null,
    enableMissedCatchup: settingCatchup.checked,
    badgeDisplay: settingBadge.value as 'pending' | 'today',
  });
  alert('設定已儲存');
});

// ============================================================
// 時間格式切換（24/12 小時制）
// ============================================================

const btn24 = document.getElementById('btn-time-24') as HTMLButtonElement;
const btn12 = document.getElementById('btn-time-12') as HTMLButtonElement;

let timeFormat: '24' | '12' = (localStorage.getItem('timeFormat') as '24' | '12') || '24';

/** 24 小時制 → 12 小時制 */
function to12h(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24;
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? '下午' : '上午';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${period} ${h12}:${String(m).padStart(2, '0')}`;
}

/** 12 小時制 → 24 小時制 */
function to24h(time12: string): string {
  if (!time12) return time12;
  // 若已經是 HH:mm 格式就直接回傳
  if (/^\d{1,2}:\d{2}$/.test(time12.trim())) return time12.trim();
  const match = time12.match(/(上午|下午|AM|PM)\s*(\d{1,2}):(\d{2})/i);
  if (!match) return time12;
  const isPM = /下午|PM/i.test(match[1]);
  let h = parseInt(match[2], 10);
  const m = match[3];
  if (isPM && h < 12) h += 12;
  if (!isPM && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${m}`;
}

/** 取得輸入框的 24h 值（不管目前顯示格式） */
function getTimeValue(input: HTMLInputElement): string {
  return timeFormat === '12' ? to24h(input.value) : input.value;
}

/** 設定輸入框的值（依目前格式轉換顯示） */
function setTimeDisplay(input: HTMLInputElement, time24: string): void {
  input.value = timeFormat === '12' ? to12h(time24) : time24;
}

function applyTimeFormat(format: '24' | '12'): void {
  // 先把所有輸入框的值轉回 24h
  const inputs = document.querySelectorAll<HTMLInputElement>('.time-input');
  const values24: string[] = [];
  inputs.forEach(input => {
    values24.push(getTimeValue(input));
  });

  timeFormat = format;
  localStorage.setItem('timeFormat', format);

  // 更新按鈕狀態
  btn24.classList.toggle('active', format === '24');
  btn12.classList.toggle('active', format === '12');

  // 重新設定顯示值和 placeholder
  inputs.forEach((input, i) => {
    if (format === '24') {
      input.placeholder = 'HH:mm';
      input.pattern = '[0-2]?[0-9]:[0-5][0-9]';
      input.classList.remove('format-12');
      input.classList.add('format-24');
    } else {
      input.placeholder = '上午 9:00';
      input.pattern = '(上午|下午|AM|PM)\\s*\\d{1,2}:\\d{2}';
      input.classList.remove('format-24');
      input.classList.add('format-12');
    }
    if (values24[i]) {
      setTimeDisplay(input, values24[i]);
    }
  });
}

btn24.addEventListener('click', () => applyTimeFormat('24'));
btn12.addEventListener('click', () => applyTimeFormat('12'));

// ============================================================
// 初始化
// ============================================================

renderList();
renderHistory();
loadSettings();
applyTimeFormat(timeFormat);