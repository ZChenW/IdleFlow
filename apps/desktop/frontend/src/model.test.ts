import assert from 'node:assert/strict';
import test from 'node:test';

import { fromMinutes, statusLabel, validateProfile } from './model.ts';

test('observe-only status identifies the existing idle owner', () => {
  assert.equal(
    statusLabel({
      enabled: false,
      inhibited: false,
      power_source: 'ac',
      managed_swayidle_pid: null,
      external_swayidle_detected: true,
      last_error: null,
    }),
    '观察模式 · 检测到现有 swayidle',
  );
});

test('profile validation rejects display-off before lock', () => {
  assert.equal(
    validateProfile({
      lock_after_seconds: 900,
      display_off_after_seconds: 600,
      suspend_after_seconds: 1800,
    }),
    '熄屏时间必须晚于锁屏时间',
  );
});

test('zero minutes remains visible as an invalid draft value', () => {
  assert.equal(fromMinutes(0), 0);
});
