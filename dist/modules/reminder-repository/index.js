// ============================================================
// reminder-repository — CRUD reminders / states / history
// 對應 SA §8 reminder-repository
// 使用 chrome.storage.local 作為持久化層
// ============================================================
// ============================================================
// 常數 & 預設值
// ============================================================
const STORAGE_KEY_REMINDERS = 'reminders';
const STORAGE_KEY_HISTORY = 'history';
const STORAGE_KEY_SETTINGS = 'settings';
const DEFAULT_SETTINGS = {
    defaultTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    quietHoursStart: null,
    quietHoursEnd: null,
    enableMissedCatchup: true,
    badgeDisplay: 'pending',
};
// ============================================================
// ID 產生器
// ============================================================
export function generateId(prefix = 'r') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
// ============================================================
// Reminder CRUD
// ============================================================
/** 取得所有提醒（以 Record<id, Reminder> 形式） */
export async function getAllReminders() {
    const result = await chrome.storage.local.get(STORAGE_KEY_REMINDERS);
    return result[STORAGE_KEY_REMINDERS] ?? {};
}
/** 取得所有提醒（陣列） */
export async function getAllRemindersArray() {
    const map = await getAllReminders();
    return Object.values(map);
}
/** 依 ID 取得單筆提醒 */
export async function getReminderById(id) {
    const map = await getAllReminders();
    return map[id] ?? null;
}
/** 新增提醒 */
export async function createReminder(reminder) {
    const map = await getAllReminders();
    map[reminder.id] = reminder;
    await chrome.storage.local.set({ [STORAGE_KEY_REMINDERS]: map });
    return reminder;
}
/** 更新提醒（整筆覆蓋） */
export async function updateReminder(reminder) {
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
export async function deleteReminder(id) {
    const map = await getAllReminders();
    delete map[id];
    await chrome.storage.local.set({ [STORAGE_KEY_REMINDERS]: map });
}
/** 啟用 / 停用提醒 */
export async function toggleReminder(id, enabled) {
    const reminder = await getReminderById(id);
    if (!reminder)
        throw new Error(`Reminder not found: ${id}`);
    reminder.enabled = enabled;
    return updateReminder(reminder);
}
/** 依類型篩選 */
export async function getRemindersByType(type) {
    const all = await getAllRemindersArray();
    return all.filter((r) => r.type === type);
}
/** 取得所有啟用中的提醒 */
export async function getEnabledReminders() {
    const all = await getAllRemindersArray();
    return all.filter((r) => r.enabled);
}
// ============================================================
// History
// ============================================================
/** 取得所有歷史紀錄 */
export async function getHistory() {
    const result = await chrome.storage.local.get(STORAGE_KEY_HISTORY);
    return result[STORAGE_KEY_HISTORY] ?? [];
}
/** 寫入一筆歷史紀錄 */
export async function addHistoryEntry(reminderId, eventType, periodKey, source) {
    const entry = {
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
export async function getHistoryByReminderId(reminderId) {
    const history = await getHistory();
    return history.filter((h) => h.reminderId === reminderId);
}
// ============================================================
// Settings
// ============================================================
/** 取得全域設定 */
export async function getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEY_SETTINGS);
    return result[STORAGE_KEY_SETTINGS] ?? { ...DEFAULT_SETTINGS };
}
/** 更新全域設定（部分更新） */
export async function updateSettings(partial) {
    const current = await getSettings();
    const updated = { ...current, ...partial };
    await chrome.storage.local.set({ [STORAGE_KEY_SETTINGS]: updated });
    return updated;
}
