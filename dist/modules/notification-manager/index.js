// ============================================================
// notification-manager — 建立 / 清除 / 互動回調
// 對應 SA §8 notification-manager + §7.3
// ============================================================
// ============================================================
// Notification ID 規範
// ============================================================
export function getNotificationId(reminderId) {
    return `notif:${reminderId}`;
}
// ============================================================
// 建立通知
// ============================================================
/** 取得通知標題前綴（依觸發原因） */
function getPrefix(result) {
    switch (result.reason) {
        case 'first_open':
            return '🌅 首次開啟';
        case 'missed_catchup':
            return '⏰ 補提醒';
        case 'time_match':
        default:
            return '🔔 提醒';
    }
}
/** 建立系統通知 */
export async function showNotification(reminder, result) {
    const notifId = getNotificationId(reminder.id);
    const prefix = getPrefix(result);
    const options = {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
        title: `${prefix}：${reminder.title}`,
        message: reminder.message || '',
        priority: 2,
        requireInteraction: true,
        buttons: [
            { title: '✅ 完成' },
            { title: '⏰ 30 分鐘後提醒' },
        ],
    };
    return new Promise((resolve) => {
        chrome.notifications.create(notifId, options, (id) => {
            resolve(id);
        });
    });
}
/** 清除通知 */
export async function clearNotification(reminderId) {
    const notifId = getNotificationId(reminderId);
    return new Promise((resolve) => {
        chrome.notifications.clear(notifId, () => resolve());
    });
}
/** 從 notification ID 解析 reminder ID */
export function parseNotificationId(notifId) {
    const match = notifId.match(/^notif:(.+)$/);
    return match ? match[1] : null;
}
/**
 * 設定通知互動監聽器
 * @param onAction 當使用者互動時的回調
 */
export function setupNotificationListeners(onAction) {
    // 點擊通知按鈕
    chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
        const reminderId = parseNotificationId(notifId);
        if (!reminderId)
            return;
        if (buttonIndex === 0) {
            onAction(reminderId, 'complete');
        }
        else if (buttonIndex === 1) {
            onAction(reminderId, 'snooze');
        }
    });
    // 點擊通知本體
    chrome.notifications.onClicked.addListener((notifId) => {
        const reminderId = parseNotificationId(notifId);
        if (!reminderId)
            return;
        onAction(reminderId, 'click');
    });
    // 關閉通知（略過）
    chrome.notifications.onClosed.addListener((notifId, byUser) => {
        if (!byUser)
            return;
        const reminderId = parseNotificationId(notifId);
        if (!reminderId)
            return;
        onAction(reminderId, 'skip');
    });
}
