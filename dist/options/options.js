// ============================================================
// Options Controller — 完整管理頁面
// 對應 SA §7.2 + §8 options-controller
// ============================================================
import { getAllRemindersArray, createReminder, updateReminder, deleteReminder, toggleReminder, generateId, getHistory, getSettings, updateSettings, } from '../modules/reminder-repository/index.js';
import { createAlarmForReminder, clearAlarmForReminder } from '../modules/alarm-manager/index.js';
// ============================================================
// DOM 元素
// ============================================================
const inputSearch = document.getElementById('input-search');
const filterType = document.getElementById('filter-type');
const btnAdd = document.getElementById('btn-add');
const tbodyReminders = document.getElementById('tbody-reminders');
const emptyList = document.getElementById('empty-list');
const sectionForm = document.getElementById('section-form');
const sectionList = document.getElementById('section-list');
const formTitle = document.getElementById('form-title');
const reminderForm = document.getElementById('reminder-form');
const formId = document.getElementById('form-id');
const formType = document.getElementById('form-type');
const formReminderTitle = document.getElementById('form-reminder-title');
const formMessage = document.getElementById('form-message');
const formDatetime = document.getElementById('form-datetime');
const formFrequency = document.getElementById('form-frequency');
const formTime = document.getElementById('form-time');
const formCadence = document.getElementById('form-cadence');
const formWindowStart = document.getElementById('form-window-start');
const formWindowEnd = document.getElementById('form-window-end');
const formCatchup = document.getElementById('form-catchup');
const btnCancel = document.getElementById('btn-cancel');
const fieldsOneTime = document.getElementById('fields-one-time');
const fieldsRecurring = document.getElementById('fields-recurring');
const fieldsFirstOpen = document.getElementById('fields-first-open');
const fieldsSiteTrigger = document.getElementById('fields-site-trigger');
const fieldsWeeklyDays = document.getElementById('fields-weekly-days');
const fieldsMonthlyDay = document.getElementById('fields-monthly-day');
const formDayOfMonth = document.getElementById('form-day-of-month');
const formUrlPatterns = document.getElementById('form-url-patterns');
const formSiteCadence = document.getElementById('form-site-cadence');
const formSiteWindowStart = document.getElementById('form-site-window-start');
const formSiteWindowEnd = document.getElementById('form-site-window-end');
// ============================================================
// 列表渲染
// ============================================================
const TYPE_LABELS = {
    one_time: '單次',
    recurring: '週期',
    first_open: '首次開啟',
    site_trigger: '網站情境',
};
function getTypeBadge(type) {
    return `<span class="type-badge ${type}">${TYPE_LABELS[type]}</span>`;
}
const DAY_NAMES = ['日', '一', '二', '三', '四', '五', '六'];
function getScheduleHtml(r) {
    if (r.type === 'one_time') {
        const dt = new Date(r.schedule.dateTime);
        const date = dt.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const time = dt.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        return `<div class="schedule-detail">
      <span class="schedule-main">📅 ${date}</span>
      <span class="schedule-sub">🕐 ${time}</span>
    </div>`;
    }
    else if (r.type === 'recurring') {
        const s = r.schedule;
        if (s.frequency === 'daily') {
            return `<div class="schedule-detail">
        <span class="schedule-main">🔁 每天</span>
        <span class="schedule-sub">🕐 ${s.timeOfDay}</span>
      </div>`;
        }
        if (s.frequency === 'monthly') {
            return `<div class="schedule-detail">
        <span class="schedule-main">🔁 每月 ${s.dayOfMonth} 號</span>
        <span class="schedule-sub">🕐 ${s.timeOfDay}</span>
      </div>`;
        }
        const days = s.daysOfWeek.map(d => DAY_NAMES[d]).join('、');
        return `<div class="schedule-detail">
      <span class="schedule-main">🔁 每週 ${days}</span>
      <span class="schedule-sub">🕐 ${s.timeOfDay}</span>
    </div>`;
    }
    else if (r.type === 'site_trigger') {
        const s = r.schedule;
        const ru = r.rule;
        const cadenceLabel = s.cadence === 'every_visit' ? '每次造訪' : s.cadence === 'daily' ? '每天首次' : '每週首次';
        const sites = ru.urlPatterns.slice(0, 2).join(', ') + (ru.urlPatterns.length > 2 ? ` +${ru.urlPatterns.length - 2}` : '');
        return `<div class="schedule-detail">
      <span class="schedule-main">🌐 ${cadenceLabel}</span>
      <span class="schedule-sub" title="${escapeHtml(ru.urlPatterns.join('\n'))}">${escapeHtml(sites)}</span>
      ${ru.timeWindowStart && ru.timeWindowEnd ? `<span class="schedule-sub">🕐 ${ru.timeWindowStart}–${ru.timeWindowEnd}</span>` : ''}
    </div>`;
    }
    else {
        const s = r.schedule;
        const ru = r.rule;
        const days = ru.validDaysOfWeek.map(d => DAY_NAMES[d]).join('、');
        return `<div class="schedule-detail">
      <span class="schedule-main">🚀 ${s.cadence === 'daily' ? '每天' : '每週'}首次開啟</span>
      ${days ? `<span class="schedule-sub">📆 ${days}</span>` : ''}
      ${ru.timeWindowStart && ru.timeWindowEnd ? `<span class="schedule-sub">🕐 ${ru.timeWindowStart}–${ru.timeWindowEnd}</span>` : ''}
    </div>`;
    }
}
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
async function renderList() {
    let reminders = await getAllRemindersArray();
    // 篩選
    const typeFilter = filterType.value;
    if (typeFilter !== 'all') {
        reminders = reminders.filter(r => r.type === typeFilter);
    }
    const search = inputSearch.value.trim().toLowerCase();
    if (search) {
        reminders = reminders.filter(r => r.title.toLowerCase().includes(search) || r.message.toLowerCase().includes(search));
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
function showFrequencySubFields(freq) {
    fieldsWeeklyDays.style.display = freq === 'weekly' ? 'block' : 'none';
    fieldsMonthlyDay.style.display = freq === 'monthly' ? 'block' : 'none';
}
function showTypeFields(type) {
    fieldsOneTime.style.display = type === 'one_time' ? 'block' : 'none';
    fieldsRecurring.style.display = type === 'recurring' ? 'block' : 'none';
    fieldsFirstOpen.style.display = type === 'first_open' ? 'block' : 'none';
    fieldsSiteTrigger.style.display = type === 'site_trigger' ? 'block' : 'none';
    if (type === 'recurring') {
        showFrequencySubFields(formFrequency.value);
    }
}
function showForm(title) {
    formTitle.textContent = title;
    sectionForm.style.display = 'block';
    sectionList.style.display = 'none';
}
function hideForm() {
    sectionForm.style.display = 'none';
    sectionList.style.display = 'block';
    reminderForm.reset();
    formId.value = '';
}
function getCheckedDays(containerId) {
    const container = document.getElementById(containerId);
    const checked = container.querySelectorAll('input:checked');
    return Array.from(checked).map(cb => Number(cb.value));
}
function buildReminderFromForm() {
    const now = new Date().toISOString();
    const type = formType.value;
    const id = formId.value || generateId('r');
    const meta = { createdAt: now, updatedAt: now };
    if (type === 'one_time') {
        return {
            id, type, title: formReminderTitle.value, message: formMessage.value, enabled: true,
            schedule: { dateTime: new Date(formDatetime.value).toISOString(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            rule: { allowMissedCatchup: formCatchup.checked },
            state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
            meta,
        };
    }
    else if (type === 'recurring') {
        const freq = formFrequency.value;
        return {
            id, type, title: formReminderTitle.value, message: formMessage.value, enabled: true,
            schedule: {
                frequency: freq,
                daysOfWeek: freq === 'weekly' ? getCheckedDays('form-days') : [],
                dayOfMonth: freq === 'monthly' ? Number(formDayOfMonth.value) : null,
                timeOfDay: formTime.value,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                startDate: null, endDate: null,
            },
            rule: { allowMissedCatchup: formCatchup.checked },
            state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
            meta,
        };
    }
    else if (type === 'site_trigger') {
        const urlPatterns = formUrlPatterns.value.split('\n').map(s => s.trim()).filter(Boolean);
        return {
            id, type, title: formReminderTitle.value, message: formMessage.value, enabled: true,
            schedule: {
                cadence: formSiteCadence.value,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            rule: {
                urlPatterns,
                validDaysOfWeek: getCheckedDays('form-site-days'),
                timeWindowStart: formSiteWindowStart.value || '00:00',
                timeWindowEnd: formSiteWindowEnd.value || '23:59',
                allowMissedCatchup: formCatchup.checked,
            },
            state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
            meta,
        };
    }
    else {
        return {
            id, type: 'first_open', title: formReminderTitle.value, message: formMessage.value, enabled: true,
            schedule: { cadence: formCadence.value, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
            rule: {
                triggerOn: 'browser_activity',
                validDaysOfWeek: getCheckedDays('form-valid-days'),
                timeWindowStart: formWindowStart.value || '00:00',
                timeWindowEnd: formWindowEnd.value || '23:59',
                sites: [],
                allowMissedCatchup: formCatchup.checked,
            },
            state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
            meta,
        };
    }
}
// ============================================================
// 事件綁定
// ============================================================
formType.addEventListener('change', () => showTypeFields(formType.value));
formFrequency.addEventListener('change', () => showFrequencySubFields(formFrequency.value));
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
    }
    else {
        await createReminder(reminder);
    }
    await createAlarmForReminder(reminder);
    hideForm();
    await renderList();
});
// 列表操作（事件委派）
tbodyReminders.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn)
        return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    if (action === 'delete') {
        if (!confirm('確定刪除此提醒？'))
            return;
        await deleteReminder(id);
        await clearAlarmForReminder(id);
        await renderList();
    }
    else if (action === 'toggle') {
        const all = await getAllRemindersArray();
        const r = all.find(r => r.id === id);
        if (!r)
            return;
        const updated = await toggleReminder(id, !r.enabled);
        if (updated.enabled)
            await createAlarmForReminder(updated);
        else
            await clearAlarmForReminder(id);
        await renderList();
    }
    else if (action === 'edit') {
        const all = await getAllRemindersArray();
        const r = all.find(r => r.id === id);
        if (!r)
            return;
        populateForm(r);
    }
});
inputSearch.addEventListener('input', () => renderList());
filterType.addEventListener('change', () => renderList());
function populateForm(r) {
    formId.value = r.id;
    formType.value = r.type;
    formReminderTitle.value = r.title;
    formMessage.value = r.message;
    formCatchup.checked = r.rule.allowMissedCatchup;
    showTypeFields(r.type);
    if (r.type === 'one_time') {
        const dt = new Date(r.schedule.dateTime);
        formDatetime.value = dt.toISOString().slice(0, 16);
    }
    else if (r.type === 'recurring') {
        const s = r.schedule;
        formFrequency.value = s.frequency;
        formTime.value = s.timeOfDay;
        setCheckedDays('form-days', s.daysOfWeek);
        if (s.dayOfMonth != null) {
            formDayOfMonth.value = String(s.dayOfMonth);
        }
        showFrequencySubFields(s.frequency);
    }
    else if (r.type === 'site_trigger') {
        const s = r.schedule;
        const ru = r.rule;
        formUrlPatterns.value = ru.urlPatterns.join('\n');
        formSiteCadence.value = s.cadence;
        formSiteWindowStart.value = ru.timeWindowStart;
        formSiteWindowEnd.value = ru.timeWindowEnd;
        setCheckedDays('form-site-days', ru.validDaysOfWeek);
    }
    else {
        const s = r.schedule;
        const ru = r.rule;
        formCadence.value = s.cadence;
        formWindowStart.value = ru.timeWindowStart;
        formWindowEnd.value = ru.timeWindowEnd;
        setCheckedDays('form-valid-days', ru.validDaysOfWeek);
    }
    showForm('編輯提醒');
}
function setCheckedDays(containerId, days) {
    const container = document.getElementById(containerId);
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = days.includes(Number(cb.value));
    });
}
// ============================================================
// 歷史紀錄 (SA §5.6)
// ============================================================
const tbodyHistory = document.getElementById('tbody-history');
const emptyHistory = document.getElementById('empty-history');
const historySearch = document.getElementById('history-search');
const historyFilter = document.getElementById('history-filter');
function getEventLabel(type) {
    const map = {
        triggered: '🔔 已觸發',
        completed: '✅ 已完成',
        snoozed: '⏰ 已延後',
        skipped: '⏭ 已略過',
        missed_catchup: '⏰ 補提醒',
    };
    return map[type] ?? type;
}
async function renderHistory() {
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
const settingTimezone = document.getElementById('setting-timezone');
const settingQuietStart = document.getElementById('setting-quiet-start');
const settingQuietEnd = document.getElementById('setting-quiet-end');
const settingCatchup = document.getElementById('setting-catchup');
const settingBadge = document.getElementById('setting-badge');
const btnSaveSettings = document.getElementById('btn-save-settings');
async function loadSettings() {
    const s = await getSettings();
    settingTimezone.value = s.defaultTimezone;
    settingQuietStart.value = s.quietHoursStart ?? '';
    settingQuietEnd.value = s.quietHoursEnd ?? '';
    settingCatchup.checked = s.enableMissedCatchup;
    settingBadge.value = s.badgeDisplay;
}
btnSaveSettings.addEventListener('click', async () => {
    await updateSettings({
        quietHoursStart: settingQuietStart.value || null,
        quietHoursEnd: settingQuietEnd.value || null,
        enableMissedCatchup: settingCatchup.checked,
        badgeDisplay: settingBadge.value,
    });
    alert('設定已儲存');
});
// ============================================================
// 初始化
// ============================================================
renderList();
renderHistory();
loadSettings();
