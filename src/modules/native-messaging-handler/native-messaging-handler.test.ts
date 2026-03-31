// ============================================================
// native-messaging-handler 單元測試
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NativeCommand, CommandResult } from '../../types/native-messaging.js';
import type { OneTimeReminder, Reminder } from '../../types/reminder.js';

// ============================================================
// Mock chrome APIs
// ============================================================

const mockReminders: Record<string, Reminder> = {};

vi.stubGlobal('chrome', {
  runtime: {
    getManifest: () => ({ version: '1.2.0' }),
    sendNativeMessage: vi.fn(),
    lastError: null,
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    clearAll: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        if (key === 'reminders') return { reminders: { ...mockReminders } };
        if (key === 'settings') return { settings: { badgeDisplay: 'pending', defaultTimezone: 'Asia/Taipei', quietHoursStart: null, quietHoursEnd: null, enableMissedCatchup: true } };
        return {};
      }),
      set: vi.fn(async () => {}),
    },
  },
  action: {
    setBadgeText: vi.fn(async () => {}),
    setBadgeBackgroundColor: vi.fn(async () => {}),
  },
  notifications: {
    create: vi.fn((_id: string, _opts: unknown, cb: (id: string) => void) => cb(_id as string)),
  },
});

// Import after mocks are set up
const { _dispatchCommand: dispatchCommand } = await import('./index.js');

// ============================================================
// Helper: 建立測試用 Reminder
// ============================================================

function makeOneTimeReminder(overrides: Partial<OneTimeReminder> = {}): OneTimeReminder {
  return {
    id: 'r_test_1',
    type: 'one_time',
    title: 'Test Reminder',
    message: 'Test message',
    enabled: true,
    schedule: { dateTime: new Date(Date.now() + 3600000).toISOString(), timezone: 'Asia/Taipei' },
    rule: { allowMissedCatchup: true },
    state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ...overrides,
  };
}

// ============================================================
// Tests
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  // 清空 mock reminders
  Object.keys(mockReminders).forEach((k) => delete mockReminders[k]);
});

describe('dispatchCommand — create_reminder', () => {
  it('should create a one_time reminder and return success', async () => {
    const cmd: NativeCommand<'create_reminder'> = {
      id: 'cmd_001',
      type: 'create_reminder',
      payload: {
        title: 'Pay bills',
        message: 'Pay electricity bill',
        reminderType: 'one_time',
        schedule: { dateTime: '2026-04-05T14:00:00+08:00', timezone: 'Asia/Taipei' },
        rule: { allowMissedCatchup: true },
      },
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(true);
    expect(result.commandId).toBe('cmd_001');
    expect(result.data).toHaveProperty('reminderId');
  });

  it('should create a recurring reminder', async () => {
    const cmd: NativeCommand<'create_reminder'> = {
      id: 'cmd_002',
      type: 'create_reminder',
      payload: {
        title: 'Weekly standup',
        message: '',
        reminderType: 'recurring',
        schedule: { frequency: 'weekly', daysOfWeek: [1], timeOfDay: '09:00', timezone: 'Asia/Taipei' },
        rule: { allowMissedCatchup: true },
      },
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(true);
  });
});

describe('dispatchCommand — delete_reminder', () => {
  it('should delete a reminder and return success', async () => {
    const cmd: NativeCommand<'delete_reminder'> = {
      id: 'cmd_010',
      type: 'delete_reminder',
      payload: { reminderId: 'r_test_1' },
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(true);
    expect(result.commandId).toBe('cmd_010');
  });
});

describe('dispatchCommand — list_reminders', () => {
  it('should return empty list when no reminders', async () => {
    const cmd: NativeCommand<'list_reminders'> = {
      id: 'cmd_020',
      type: 'list_reminders',
      payload: { filter: 'all' },
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(true);
    expect((result.data as any).count).toBe(0);
    expect((result.data as any).reminders).toEqual([]);
  });
});

describe('dispatchCommand — get_status', () => {
  it('should return extension status', async () => {
    const cmd: NativeCommand<'get_status'> = {
      id: 'cmd_030',
      type: 'get_status',
      payload: {},
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(true);
    expect((result.data as any).version).toBe('1.2.0');
    expect((result.data as any).totalReminders).toBe(0);
    expect((result.data as any).enabledReminders).toBe(0);
  });
});

describe('dispatchCommand — toggle_reminder', () => {
  it('should return error when reminder not found', async () => {
    const cmd: NativeCommand<'toggle_reminder'> = {
      id: 'cmd_040',
      type: 'toggle_reminder',
      payload: { reminderId: 'nonexistent', enabled: false },
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('dispatchCommand — update_reminder', () => {
  it('should return error when reminder not found', async () => {
    const cmd: NativeCommand<'update_reminder'> = {
      id: 'cmd_050',
      type: 'update_reminder',
      payload: { reminderId: 'nonexistent', updates: { title: 'New title' } },
    };

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

describe('dispatchCommand — unknown command', () => {
  it('should return error for unknown command type', async () => {
    const cmd = {
      id: 'cmd_999',
      type: 'unknown_action',
      payload: {},
    } as unknown as NativeCommand;

    const result = await dispatchCommand(cmd);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown command type');
  });
});
