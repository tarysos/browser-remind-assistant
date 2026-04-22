// ============================================================
// lifecycle-manager — extension 生命週期管理
// 對應 SA §6.6 + §8 lifecycle-manager
// ============================================================
import { getEnabledReminders } from '../reminder-repository/index.js';
import { rebuildAllAlarms } from '../alarm-manager/index.js';
import { findMissedReminders } from '../trigger-evaluator/index.js';
// ============================================================
// 啟動重建流程 (SA §6.6 Rebuild)
// ============================================================
/**
 * 執行完整的啟動重建流程：
 * 1. 載入所有 enabled reminders
 * 2. 重建 alarms
 * 3. 檢查 missed reminders
 * 回傳需補提醒的 reminder 清單
 */
export async function performStartupRebuild() {
    console.log('[lifecycle] 開始啟動重建...');
    // 1. 載入所有啟用中的提醒
    const enabledReminders = await getEnabledReminders();
    console.log(`[lifecycle] 載入 ${enabledReminders.length} 筆啟用提醒`);
    // 2. 重建 alarms
    await rebuildAllAlarms(enabledReminders);
    console.log('[lifecycle] alarms 重建完成');
    // 3. 檢查補提醒
    const missed = findMissedReminders(enabledReminders);
    console.log(`[lifecycle] 發現 ${missed.length} 筆需補提醒`);
    return missed;
}
// ============================================================
// 事件監聽設定
// ============================================================
/**
 * 設定 extension install / update 監聽
 */
export function setupInstallListener(onInstall, onUpdate) {
    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason === 'install') {
            console.log('[lifecycle] Extension 首次安裝');
            onInstall();
        }
        else if (details.reason === 'update') {
            console.log(`[lifecycle] Extension 更新: ${details.previousVersion}`);
            onUpdate(details.previousVersion ?? '');
        }
    });
}
/**
 * 設定 startup 監聽（瀏覽器啟動）
 */
export function setupStartupListener(onStartup) {
    chrome.runtime.onStartup.addListener(() => {
        console.log('[lifecycle] 瀏覽器啟動，開始 rebuild');
        onStartup();
    });
}
