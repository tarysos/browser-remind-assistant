// ============================================================
// trigger-evaluator 單元測試
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getDailyPeriodKey,
  getWeeklyPeriodKey,
  getMonthlyPeriodKey,
  getPeriodKey,
  isWithinTimeWindow,
  evaluate,
  evaluateAll,
  urlPatternToRegExp,
  matchesUrlPatterns,
} from './index.js';
import type {
  OneTimeReminder,
  RecurringReminder,
  FirstOpenReminder,
  SiteTriggerReminder,
} from '../../types/reminder.js';

// ============================================================
// Period Key 計算
// ============================================================

describe('getDailyPeriodKey', () => {
  it('should return YYYY-MM-DD format', () => {
    const date = new Date('2026-03-30T10:00:00+08:00');
    const key = getDailyPeriodKey(date);
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getWeeklyPeriodKey', () => {
  it('should return YYYY-Www format', () => {
    const date = new Date('2026-03-30T10:00:00+08:00');
    const key = getWeeklyPeriodKey(date);
    expect(key).toMatch(/^\d{4}-W\d{2}$/);
  });
});

describe('getMonthlyPeriodKey', () => {
  it('should return YYYY-MM format', () => {
    const date = new Date('2026-03-30T10:00:00+08:00');
    const key = getMonthlyPeriodKey(date);
    expect(key).toMatch(/^\d{4}-\d{2}$/);
    expect(key).toBe('2026-03');
  });
});

describe('getPeriodKey with monthly', () => {
  it('should return monthly period key for monthly frequency', () => {
    const date = new Date('2026-07-15T10:00:00');
    const key = getPeriodKey('monthly', date);
    expect(key).toBe('2026-07');
  });
});

// ============================================================
// isWithinTimeWindow
// ============================================================

describe('isWithinTimeWindow', () => {
  it('should return true when within window', () => {
    const now = new Date('2026-03-30T09:30:00');
    expect(isWithinTimeWindow('08:00', '12:00', now)).toBe(true);
  });

  it('should return false when outside window', () => {
    const now = new Date('2026-03-30T14:00:00');
    expect(isWithinTimeWindow('08:00', '12:00', now)).toBe(false);
  });

  it('should return true at boundary start', () => {
    const now = new Date('2026-03-30T08:00:00');
    expect(isWithinTimeWindow('08:00', '12:00', now)).toBe(true);
  });
});

// ============================================================
// evaluate — One-time Reminder
// ============================================================

describe('evaluate one_time', () => {
  const baseOneTime: OneTimeReminder = {
    id: 'r_test_1',
    type: 'one_time',
    title: 'Test',
    message: '',
    enabled: true,
    schedule: {
      dateTime: new Date(Date.now() - 60000).toISOString(), // 1 分鐘前
      timezone: 'Asia/Taipei',
    },
    rule: { allowMissedCatchup: true },
    state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
    meta: { createdAt: '', updatedAt: '' },
  };

  it('should trigger when time has passed and not yet triggered', () => {
    const result = evaluate(baseOneTime, 'alarm');
    expect(result.shouldTrigger).toBe(true);
  });

  it('should NOT trigger when disabled', () => {
    const r = { ...baseOneTime, enabled: false };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger when already triggered', () => {
    const r = {
      ...baseOneTime,
      state: { ...baseOneTime.state, triggeredAt: new Date().toISOString() },
    };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger when completed', () => {
    const r = {
      ...baseOneTime,
      state: { ...baseOneTime.state, completedAt: new Date().toISOString() },
    };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger when in snooze', () => {
    const r = {
      ...baseOneTime,
      state: { ...baseOneTime.state, snoozeUntil: new Date(Date.now() + 600000).toISOString() },
    };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger when time is in the future', () => {
    const r = {
      ...baseOneTime,
      schedule: {
        ...baseOneTime.schedule,
        dateTime: new Date(Date.now() + 3600000).toISOString(),
      },
    };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });
});

// ============================================================
// evaluate — Monthly Recurring Reminder
// ============================================================

describe('evaluate recurring monthly', () => {
  const now = new Date();
  const todayDay = now.getDate();
  const pastTime = `${String(now.getHours()).padStart(2, '0')}:${String(Math.max(now.getMinutes() - 1, 0)).padStart(2, '0')}`;

  const baseMonthly: RecurringReminder = {
    id: 'r_test_monthly',
    type: 'recurring',
    title: 'Monthly test',
    message: '',
    enabled: true,
    schedule: {
      frequency: 'monthly',
      daysOfWeek: [],
      dayOfMonth: todayDay,
      timeOfDay: pastTime,
      timezone: 'Asia/Taipei',
      startDate: null,
      endDate: null,
    },
    rule: { allowMissedCatchup: true },
    state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
    meta: { createdAt: '', updatedAt: '' },
  };

  it('should trigger when today is the correct day of month and time has passed', () => {
    const result = evaluate(baseMonthly, 'alarm');
    expect(result.shouldTrigger).toBe(true);
  });

  it('should NOT trigger on a different day of month', () => {
    const wrongDay = todayDay === 15 ? 20 : 15;
    const r: RecurringReminder = {
      ...baseMonthly,
      schedule: { ...baseMonthly.schedule, dayOfMonth: wrongDay },
    };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger if already triggered this month', () => {
    const r: RecurringReminder = {
      ...baseMonthly,
      state: { ...baseMonthly.state, lastTriggeredPeriodKey: getMonthlyPeriodKey() },
    };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger when disabled', () => {
    const r = { ...baseMonthly, enabled: false };
    const result = evaluate(r, 'alarm');
    expect(result.shouldTrigger).toBe(false);
  });
});

// ============================================================
// evaluate — First-open Reminder
// ============================================================

describe('evaluate first_open', () => {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const baseFirstOpen: FirstOpenReminder = {
    id: 'r_test_3',
    type: 'first_open',
    title: 'First open test',
    message: '',
    enabled: true,
    schedule: { cadence: 'daily', timezone: 'Asia/Taipei' },
    rule: {
      triggerOn: 'browser_activity',
      validDaysOfWeek: [dayOfWeek as any],
      timeWindowStart: '00:00',
      timeWindowEnd: '23:59',
      sites: [],
      allowMissedCatchup: false,
    },
    state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
    meta: { createdAt: '', updatedAt: '' },
  };

  it('should trigger on first open of the day', () => {
    const result = evaluate(baseFirstOpen, 'browser_activity');
    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('first_open');
  });

  it('should NOT trigger if already triggered today', () => {
    const r = {
      ...baseFirstOpen,
      state: { ...baseFirstOpen.state, lastTriggeredPeriodKey: getDailyPeriodKey() },
    };
    const result = evaluate(r, 'browser_activity');
    expect(result.shouldTrigger).toBe(false);
  });
});

// ============================================================
// evaluateAll
// ============================================================

describe('evaluateAll', () => {
  it('should return only triggered reminders', () => {
    const past: OneTimeReminder = {
      id: 'r1', type: 'one_time', title: 'Past', message: '', enabled: true,
      schedule: { dateTime: new Date(Date.now() - 60000).toISOString(), timezone: 'UTC' },
      rule: { allowMissedCatchup: true },
      state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
      meta: { createdAt: '', updatedAt: '' },
    };
    const future: OneTimeReminder = {
      id: 'r2', type: 'one_time', title: 'Future', message: '', enabled: true,
      schedule: { dateTime: new Date(Date.now() + 3600000).toISOString(), timezone: 'UTC' },
      rule: { allowMissedCatchup: true },
      state: { triggeredAt: null, completedAt: null, snoozeUntil: null },
      meta: { createdAt: '', updatedAt: '' },
    };

    const results = evaluateAll([past, future], 'alarm');
    expect(results).toHaveLength(1);
    expect(results[0].reminder.id).toBe('r1');
  });
});

// ============================================================
// URL Pattern Matching
// ============================================================

describe('urlPatternToRegExp', () => {
  it('should match exact URL with wildcard protocol', () => {
    const re = urlPatternToRegExp('*://mail.google.com/*');
    expect(re.test('https://mail.google.com/')).toBe(true);
    expect(re.test('https://mail.google.com/inbox')).toBe(true);
    expect(re.test('http://mail.google.com/inbox')).toBe(true);
  });

  it('should not match different domain', () => {
    const re = urlPatternToRegExp('*://mail.google.com/*');
    expect(re.test('https://calendar.google.com/')).toBe(false);
  });

  it('should match wildcard subdomain', () => {
    const re = urlPatternToRegExp('*://*.notion.so/*');
    expect(re.test('https://www.notion.so/page')).toBe(true);
    expect(re.test('https://myworkspace.notion.so/page')).toBe(true);
  });
});

describe('matchesUrlPatterns', () => {
  it('should return true if any pattern matches', () => {
    const patterns = ['*://mail.google.com/*', '*://github.com/*'];
    expect(matchesUrlPatterns('https://github.com/repo', patterns)).toBe(true);
  });

  it('should return false if no pattern matches', () => {
    const patterns = ['*://mail.google.com/*'];
    expect(matchesUrlPatterns('https://twitter.com', patterns)).toBe(false);
  });

  it('should return false for empty patterns', () => {
    expect(matchesUrlPatterns('https://google.com', [])).toBe(false);
  });
});

// ============================================================
// evaluate — Site Trigger Reminder
// ============================================================

describe('evaluate site_trigger', () => {
  const now = new Date();
  const dayOfWeek = now.getDay();

  const baseSiteTrigger: SiteTriggerReminder = {
    id: 'r_test_site',
    type: 'site_trigger',
    title: 'Gmail 提醒',
    message: '檢查重要郵件',
    enabled: true,
    schedule: { cadence: 'daily', timezone: 'Asia/Taipei' },
    rule: {
      urlPatterns: ['*://mail.google.com/*'],
      validDaysOfWeek: [dayOfWeek as any],
      timeWindowStart: '00:00',
      timeWindowEnd: '23:59',
      allowMissedCatchup: false,
    },
    state: { lastTriggeredAt: null, lastTriggeredPeriodKey: null, snoozeUntil: null, completedAt: null },
    meta: { createdAt: '', updatedAt: '' },
  };

  it('should trigger when URL matches and within time window', () => {
    const result = evaluate(baseSiteTrigger, 'browser_activity', 'https://mail.google.com/inbox');
    expect(result.shouldTrigger).toBe(true);
    expect(result.reason).toBe('site_match');
  });

  it('should NOT trigger when URL does not match', () => {
    const result = evaluate(baseSiteTrigger, 'browser_activity', 'https://twitter.com');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger without URL', () => {
    const result = evaluate(baseSiteTrigger, 'browser_activity');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger if already triggered today (daily cadence)', () => {
    const r = {
      ...baseSiteTrigger,
      state: { ...baseSiteTrigger.state, lastTriggeredPeriodKey: getDailyPeriodKey() },
    };
    const result = evaluate(r, 'browser_activity', 'https://mail.google.com/inbox');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should trigger on every_visit cadence even if triggered today', () => {
    const r: SiteTriggerReminder = {
      ...baseSiteTrigger,
      schedule: { cadence: 'every_visit', timezone: 'Asia/Taipei' },
      state: { ...baseSiteTrigger.state, lastTriggeredPeriodKey: getDailyPeriodKey() },
    };
    const result = evaluate(r, 'browser_activity', 'https://mail.google.com/inbox');
    expect(result.shouldTrigger).toBe(true);
  });

  it('should NOT trigger when disabled', () => {
    const r = { ...baseSiteTrigger, enabled: false };
    const result = evaluate(r, 'browser_activity', 'https://mail.google.com/inbox');
    expect(result.shouldTrigger).toBe(false);
  });

  it('should NOT trigger when completed', () => {
    const r = {
      ...baseSiteTrigger,
      state: { ...baseSiteTrigger.state, completedAt: new Date().toISOString() },
    };
    const result = evaluate(r, 'browser_activity', 'https://mail.google.com/inbox');
    expect(result.shouldTrigger).toBe(false);
  });
});
