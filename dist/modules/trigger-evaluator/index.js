// ============================================================
// trigger-evaluator — 判斷提醒是否應被觸發
// 對應 SA §6.2 + §6.3 + §8 trigger-evaluator
// ============================================================
// ============================================================
// Period Key 計算 (SA §5.5, §6.3)
// ============================================================
/** 取得今日的 daily period key: YYYY-MM-DD */
export function getDailyPeriodKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
/** 取得本週的 weekly period key: YYYY-Www */
export function getWeeklyPeriodKey(date = new Date()) {
    // ISO week number 計算
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
/** 取得本月的 monthly period key: YYYY-MM */
export function getMonthlyPeriodKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
/** 依頻率取得對應的 period key */
export function getPeriodKey(frequency, date = new Date()) {
    if (frequency === 'daily')
        return getDailyPeriodKey(date);
    if (frequency === 'weekly')
        return getWeeklyPeriodKey(date);
    return getMonthlyPeriodKey(date);
}
// ============================================================
// 時間工具
// ============================================================
/** 判斷目前時間是否在指定時段內 */
export function isWithinTimeWindow(startTime, endTime, now = new Date()) {
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}
// ============================================================
// 共用檢查 (SA §6.2.2)
// ============================================================
/** 檢查是否在 snooze 中 */
function isInSnooze(snoozeUntil) {
    if (!snoozeUntil)
        return false;
    return new Date(snoozeUntil).getTime() > Date.now();
}
/**
 * 取得提醒的週期頻率（統一入口）
 * site_trigger 的 every_visit 以 daily 作為 period 計算基準
 */
export function getReminderFrequency(reminder) {
    switch (reminder.type) {
        case 'one_time': return 'daily';
        case 'recurring': return reminder.schedule.frequency;
        case 'first_open': return reminder.schedule.cadence;
        case 'site_trigger': {
            const cadence = reminder.schedule.cadence;
            return cadence === 'every_visit' ? 'daily' : cadence;
        }
        default: return 'daily';
    }
}
/**
 * 判斷週期性提醒的 completedAt 是否在當前 period 內
 * 用於週期提醒：completedAt 只應阻擋「本期」，不應永久阻擋
 */
export function isCompletedInCurrentPeriod(completedAt, frequency) {
    if (!completedAt)
        return false;
    return getPeriodKey(frequency, new Date(completedAt)) === getPeriodKey(frequency);
}
// ============================================================
// 各類型判斷
// ============================================================
/** 單次提醒判斷 */
function evaluateOneTime(reminder, source) {
    const { state, schedule } = reminder;
    const no = { shouldTrigger: false, source };
    // 已觸發且已完成
    if (state.completedAt)
        return no;
    // 在 snooze 中
    if (isInSnooze(state.snoozeUntil))
        return no;
    const targetTime = new Date(schedule.dateTime).getTime();
    const now = Date.now();
    // 已過時間，檢查是否已觸發過
    if (state.triggeredAt)
        return no;
    // 時間已到或已過（補提醒）
    if (now >= targetTime) {
        const reason = source === 'catchup' ? 'missed_catchup' : 'time_match';
        return { shouldTrigger: true, reason, source };
    }
    return no;
}
/** 週期提醒判斷 */
function evaluateRecurring(reminder, source) {
    const { state, schedule } = reminder;
    const no = { shouldTrigger: false, source };
    // completedAt 只阻擋當期，跨期後自動恢復
    if (isCompletedInCurrentPeriod(state.completedAt, schedule.frequency))
        return no;
    if (isInSnooze(state.snoozeUntil))
        return no;
    const periodKey = getPeriodKey(schedule.frequency);
    // 本 period 已提醒過
    if (state.lastTriggeredPeriodKey === periodKey)
        return no;
    const now = new Date();
    const [hours, minutes] = schedule.timeOfDay.split(':').map(Number);
    const todayTarget = new Date(now);
    todayTarget.setHours(hours, minutes, 0, 0);
    // weekly：檢查星期
    if (schedule.frequency === 'weekly') {
        const dayOfWeek = now.getDay();
        if (!schedule.daysOfWeek.includes(dayOfWeek))
            return no;
    }
    // monthly：檢查日期（處理月末溢位，例如設定 31 號但本月只有 28 天則在月末觸發）
    if (schedule.frequency === 'monthly' && schedule.dayOfMonth != null) {
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const effectiveDay = Math.min(schedule.dayOfMonth, lastDay);
        if (now.getDate() !== effectiveDay)
            return no;
    }
    // 時間已到
    if (now.getTime() >= todayTarget.getTime()) {
        const reason = source === 'catchup' ? 'missed_catchup' : 'time_match';
        return { shouldTrigger: true, reason, source };
    }
    return no;
}
/** 首次開啟提醒判斷 (SA §6.3) */
function evaluateFirstOpen(reminder, source) {
    const { state, schedule, rule } = reminder;
    const no = { shouldTrigger: false, source };
    // completedAt 只阻擋當期
    if (isCompletedInCurrentPeriod(state.completedAt, schedule.cadence))
        return no;
    if (isInSnooze(state.snoozeUntil))
        return no;
    const now = new Date();
    const periodKey = getPeriodKey(schedule.cadence, now);
    // 本 period 已提醒過
    if (state.lastTriggeredPeriodKey === periodKey)
        return no;
    // 檢查星期
    const dayOfWeek = now.getDay();
    if (rule.validDaysOfWeek.length > 0 && !rule.validDaysOfWeek.includes(dayOfWeek))
        return no;
    // 檢查有效時段
    if (rule.timeWindowStart && rule.timeWindowEnd) {
        if (!isWithinTimeWindow(rule.timeWindowStart, rule.timeWindowEnd, now))
            return no;
    }
    return { shouldTrigger: true, reason: 'first_open', source };
}
// ============================================================
// URL Pattern Matching（SA §12.3）
// ============================================================
/**
 * 將 glob URL pattern 轉為 RegExp
 * 支援格式例如: "*://mail.google.com/*", "*://*.notion.so/*"
 */
export function urlPatternToRegExp(pattern) {
    // 1. 先將 * 替換為唯一佔位符
    const placeholder = '__WILDCARD__';
    const withPlaceholder = pattern.replace(/\*/g, placeholder);
    // 2. 跳脫所有 regex 特殊字元
    const escaped = withPlaceholder.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    // 3. 將佔位符還原為 .*
    const regexStr = escaped.replace(new RegExp(placeholder, 'g'), '.*');
    return new RegExp(`^${regexStr}$`, 'i');
}
/** 檢查 URL 是否匹配任一 pattern */
export function matchesUrlPatterns(url, patterns) {
    if (patterns.length === 0)
        return false;
    return patterns.some((p) => urlPatternToRegExp(p).test(url));
}
// ============================================================
// Site Trigger 評估（SA §12.3）
// ============================================================
/** 網站情境提醒判斷 */
function evaluateSiteTrigger(reminder, source, currentUrl) {
    const { state, schedule, rule } = reminder;
    const no = { shouldTrigger: false, source };
    // completedAt 只阻擋當期（every_visit 以 daily 為基準）
    const completedFreq = schedule.cadence === 'every_visit' ? 'daily' : schedule.cadence;
    if (isCompletedInCurrentPeriod(state.completedAt, completedFreq))
        return no;
    if (state.snoozeUntil && new Date(state.snoozeUntil).getTime() > Date.now())
        return no;
    // URL 匹配
    if (!currentUrl || !matchesUrlPatterns(currentUrl, rule.urlPatterns))
        return no;
    const now = new Date();
    // 檢查星期
    const dayOfWeek = now.getDay();
    if (rule.validDaysOfWeek.length > 0 && !rule.validDaysOfWeek.includes(dayOfWeek))
        return no;
    // 檢查工作時段
    if (rule.timeWindowStart && rule.timeWindowEnd) {
        if (!isWithinTimeWindow(rule.timeWindowStart, rule.timeWindowEnd, now))
            return no;
    }
    // 頻率控制
    if (schedule.cadence !== 'every_visit') {
        const periodKey = getPeriodKey(schedule.cadence, now);
        if (state.lastTriggeredPeriodKey === periodKey)
            return no;
    }
    return { shouldTrigger: true, reason: 'site_match', source };
}
// ============================================================
// 主入口：評估單筆提醒 (SA §6.2.2 Trigger Evaluator 順序)
// ============================================================
/**
 * 評估一筆提醒是否應被觸發
 * @param reminder 待評估的提醒
 * @param source 觸發來源
 * @param currentUrl 目前分頁的 URL（僅 site_trigger 需要）
 */
export function evaluate(reminder, source, currentUrl) {
    const no = { shouldTrigger: false, source };
    // 1. 是否啟用
    if (!reminder.enabled)
        return no;
    // 2-7. 依類型判斷
    switch (reminder.type) {
        case 'one_time':
            return evaluateOneTime(reminder, source);
        case 'recurring':
            return evaluateRecurring(reminder, source);
        case 'first_open':
            return evaluateFirstOpen(reminder, source);
        case 'site_trigger':
            return evaluateSiteTrigger(reminder, source, currentUrl);
        default:
            return no;
    }
}
/**
 * 批次評估所有提醒，回傳需觸發的清單
 */
export function evaluateAll(reminders, source, currentUrl) {
    const triggered = [];
    for (const reminder of reminders) {
        const result = evaluate(reminder, source, currentUrl);
        if (result.shouldTrigger) {
            triggered.push({ reminder, result });
        }
    }
    return triggered;
}
/**
 * 檢查是否有過期但未處理的提醒（補提醒用）
 */
export function findMissedReminders(reminders) {
    return reminders.filter((r) => {
        if (!r.enabled || !r.rule.allowMissedCatchup)
            return false;
        const result = evaluate(r, 'catchup');
        return result.shouldTrigger && result.reason === 'missed_catchup';
    });
}
