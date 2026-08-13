import assert from 'node:assert/strict';
import test from 'node:test';

import { statusLabel } from './model.ts';

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
